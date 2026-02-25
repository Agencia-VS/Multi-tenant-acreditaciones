/**
 * API: Acreditación Masiva (Bulk) — Optimized Single-RPC Batch
 * POST — Procesa un array de registros (CSV parseado en frontend)
 * 
 * Optimización v2: usa bulk_check_and_create_registrations() RPC
 * que procesa TODO el array en una sola transacción PostgreSQL.
 * 
 * Flujo:
 * 1. Verificar evento + deadline
 * 2. Resolver usuario autenticado
 * 3. Validar filas (campos requeridos)
 * 4. Batch lookup/upsert de profiles (chunks de 50-100)
 * 5. Pre-fetch zone rules + resolver zonas en JS
 * 6. ★ Una sola llamada RPC con todo el array → PG hace checks + inserts
 * 7. Batch save tenant profile data (paralelo)
 * 8. Audit log
 * 
 * NO vincula authUserId a profiles de bulk (evita duplicate key user_id).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getEventById } from '@/lib/services';
import { getCurrentUser, isSuperAdmin } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { logAuditAction } from '@/lib/services/audit';
import { isAccreditationClosed } from '@/lib/dates';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { validateEmail, sanitize, validateDocumentByType, normalizeDocumentByType, type DocumentType } from '@/lib/validation';
import type { Json } from '@/lib/supabase/database.types';

interface BulkRow {
  rut: string;
  document_type?: string;
  document_number?: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  organizacion?: string;
  tipo_medio?: string;
  zona?: string;
  patente?: string;
  [key: string]: string | undefined;
}

const BASE_FIELDS = ['rut', 'document_type', 'document_number', 'nombre', 'apellido', 'email', 'telefono', 'cargo', 'organizacion', 'tipo_medio'];
const CHUNK_SIZE = 50; // supabase batch limit

/** Split array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, rows } = body as { event_id: string; rows: BulkRow[] };

    if (!event_id) {
      return NextResponse.json({ error: 'event_id es requerido' }, { status: 400 });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'Se requiere un array de registros' }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json({ error: 'Máximo 2000 registros por lote' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // ── 1. Verificar evento + deadline ──
    const event = await getEventById(event_id);
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }
    const deadlineCheck = isAccreditationClosed(
      event.config as Record<string, unknown>,
      event.fecha_limite_acreditacion
    );
    if (deadlineCheck.closed) {
      return NextResponse.json(
        { error: deadlineCheck.reason || 'El plazo para solicitar acreditación ha cerrado' },
        { status: 403 }
      );
    }

    // ── 2. Resolver usuario autenticado (submitter) ──
    let authUserId: string | undefined;
    let submitterProfileId: string | undefined;
    try {
      const user = await getCurrentUser();
      if (user) {
        authUserId = user.id;
        // Superadmins y tenant admins no linkan su perfil
        const isSuper = await isSuperAdmin(user.id);
        if (!isSuper) {
          const profile = await getProfileByUserId(user.id);
          if (profile) submitterProfileId = profile.id;
        }
      }
    } catch { /* no bloquear */ }

    // ── 3. Validar filas y separar válidas/inválidas ──
    const results: { row: number; rut: string; nombre: string; ok: boolean; error?: string }[] = [];
    const validRows: { index: number; row: BulkRow; formData: { rut: string; document_type: DocumentType; document_number: string; document_normalized: string; nombre: string; apellido: string; email: string; telefono: string; cargo: string; organizacion: string; tipo_medio: string; datos_extra: Record<string, string> } }[] = [];
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawDocument = sanitize(row.document_number || row.rut || '');
      const documentType: DocumentType = row.document_type === 'dni_extranjero' ? 'dni_extranjero' : 'rut';

      if (!rawDocument || !row.nombre || !row.apellido) {
        results.push({
          row: i + 1, rut: row.rut || row.document_number || '—',
          nombre: `${row.nombre || '?'} ${row.apellido || '?'}`,
          ok: false, error: 'Faltan campos requeridos (documento, nombre, apellido)',
        });
        errorCount++;
        continue;
      }

      const docResult = validateDocumentByType(documentType, rawDocument);
      if (!docResult.valid) {
        results.push({
          row: i + 1, rut: rawDocument,
          nombre: `${row.nombre} ${row.apellido}`,
          ok: false,
          error: documentType === 'rut'
            ? `RUT inv\u00e1lido: ${docResult.error}`
            : `Documento extranjero inv\u00e1lido: ${docResult.error}`,
        });
        errorCount++;
        continue;
      }

      // Validar email si viene
      const rawEmail = row.email?.trim() || '';
      if (rawEmail) {
        const emailResult = validateEmail(rawEmail);
        if (!emailResult.valid) {
          results.push({
            row: i + 1, rut: row.rut,
            nombre: `${row.nombre} ${row.apellido}`,
            ok: false, error: `Email inv\u00e1lido: ${emailResult.error}`,
          });
          errorCount++;
          continue;
        }
      }

      // Sanitizar todos los campos
      const normalizedDocument = normalizeDocumentByType(documentType, rawDocument);
      const formData = {
        rut: normalizedDocument,
        document_type: documentType,
        document_number: rawDocument,
        document_normalized: normalizedDocument,
        nombre: sanitize(row.nombre),
        apellido: sanitize(row.apellido),
        email: rawEmail ? sanitize(rawEmail) : '', telefono: sanitize(row.telefono || ''),
        cargo: sanitize(row.cargo || ''), organizacion: sanitize(row.organizacion || ''),
        tipo_medio: sanitize(row.tipo_medio || ''),
        datos_extra: {} as Record<string, string>,
      };

      for (const [key, val] of Object.entries(row)) {
        if (!BASE_FIELDS.includes(key) && val) {
          formData.datos_extra[key] = sanitize(val);
        }
      }

      validRows.push({ index: i, row, formData });
    }

    if (validRows.length === 0) {
      return NextResponse.json({ total: rows.length, success: 0, errors: errorCount, results });
    }

    // ── All-or-nothing: if ANY row failed basic validation, stop everything ──
    if (errorCount > 0) {
      for (const { index, formData } of validRows) {
        results.push({
          row: index + 1,
          rut: formData.rut,
          nombre: `${formData.nombre} ${formData.apellido}`,
          ok: false,
          error: 'No se procesó: se encontraron errores en otras personas del lote',
        });
      }
      results.sort((a, b) => a.row - b.row);
      return NextResponse.json({ total: rows.length, success: 0, errors: rows.length, results });
    }

    // ── 4. Batch lookup/upsert de profiles ──
    const docKey = (type: DocumentType, normalized: string) => `${type}:${normalized}`;
    const allDocNormalized = [...new Set(validRows.map(v => v.formData.document_normalized))];
    const existingProfiles = new Map<string, { id: string; user_id: string | null }>();
    const newlyCreatedProfileIds = new Set<string>();

    const cleanupTransientProfiles = async () => {
      if (newlyCreatedProfileIds.size === 0) return;
      try {
        const candidateIds = [...newlyCreatedProfileIds];
        const usedIds = new Set<string>();

        for (const idChunk of chunk(candidateIds, 100)) {
          const { data: regs } = await supabase
            .from('registrations')
            .select('profile_id')
            .in('profile_id', idChunk);
          if (regs) {
            for (const reg of regs) usedIds.add(reg.profile_id);
          }
        }

        const deletable = candidateIds.filter(id => !usedIds.has(id));
        for (const idChunk of chunk(deletable, CHUNK_SIZE)) {
          await supabase
            .from('profiles')
            .delete()
            .in('id', idChunk);
        }
      } catch (cleanupErr) {
        console.warn('[BulkAccreditation] Non-critical: failed to cleanup transient profiles', cleanupErr);
      }
    };

    for (const docChunk of chunk(allDocNormalized, 100)) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, rut, user_id, document_type, document_normalized')
        .in('document_normalized', docChunk);
      if (profiles) {
        for (const p of profiles) {
          const type = (p.document_type as DocumentType | null) || 'rut';
          const normalized = (p.document_normalized as string | null) || p.rut;
          if (normalized) existingProfiles.set(docKey(type, normalized), { id: p.id, user_id: p.user_id });
        }
      }
    }

    // Separate new profiles from existing ones
    const profilesToCreate: Record<string, unknown>[] = [];
    const pendingProfileUpdates: { id: string; updates: Record<string, unknown> }[] = [];

    for (const { formData } of validRows) {
      const key = docKey(formData.document_type, formData.document_normalized);
      const existing = existingProfiles.get(key);
      if (existing) {
        const updates: Record<string, unknown> = {
          document_type: formData.document_type,
          document_number: formData.document_number,
          document_normalized: formData.document_normalized,
          rut: formData.document_type === 'rut' ? formData.rut : null,
          nacionalidad: formData.document_type === 'dni_extranjero' ? 'Extranjera' : 'Chilena',
        };
        if (formData.nombre) updates.nombre = formData.nombre;
        if (formData.apellido) updates.apellido = formData.apellido;
        if (formData.email) updates.email = formData.email;
        if (formData.telefono) updates.telefono = formData.telefono;
        if (formData.cargo) updates.cargo = formData.cargo;
        if (formData.tipo_medio) updates.tipo_medio = formData.tipo_medio;
        if (formData.organizacion) updates.medio = formData.organizacion;
        pendingProfileUpdates.push({ id: existing.id, updates });
      } else if (!existingProfiles.has(key)) {
        existingProfiles.set(key, { id: '', user_id: null });
        profilesToCreate.push({
          document_type: formData.document_type,
          document_number: formData.document_number,
          document_normalized: formData.document_normalized,
          rut: formData.document_type === 'rut' ? formData.rut : null,
          nacionalidad: formData.document_type === 'dni_extranjero' ? 'Extranjera' : 'Chilena',
          nombre: formData.nombre,
          apellido: formData.apellido,
          email: formData.email || null,
          telefono: formData.telefono || null,
          cargo: formData.cargo || null,
          medio: formData.organizacion || null,
          tipo_medio: formData.tipo_medio || null,
        });
      }
    }

    // Batch insert new profiles
    if (profilesToCreate.length > 0) {
      for (const profileChunk of chunk(profilesToCreate, CHUNK_SIZE)) {
        const chunkDocKeys = new Set(
          profileChunk
            .map(p => {
              const type = (p.document_type as DocumentType | undefined) || 'rut';
              const normalized = p.document_normalized as string | undefined;
              return normalized ? docKey(type, normalized) : null;
            })
            .filter(Boolean) as string[]
        );
        const { data: created, error } = await (supabase as any)
          .from('profiles')
          .upsert(profileChunk as never, { onConflict: 'document_type,document_normalized', ignoreDuplicates: false })
          .select('id, user_id, document_type, document_normalized');
        if (error) {
          console.error('[BulkAccreditation] Error upserting profiles:', error.message);
        }
        if (created) {
          for (const p of created) {
            const type = (p.document_type as DocumentType | null) || 'rut';
            const normalized = (p.document_normalized as string | null) || '';
            if (normalized) {
              const key = docKey(type, normalized);
              existingProfiles.set(key, { id: p.id, user_id: p.user_id });
              if (chunkDocKeys.has(key)) newlyCreatedProfileIds.add(p.id);
            }
          }
        }
      }
    }

    // Re-fetch any profiles that didn't get their IDs (from upsert returning existing)
    const missingDocNormalized = allDocNormalized.filter(dn => {
      const candidate = validRows.find(v => v.formData.document_normalized === dn)?.formData;
      if (!candidate) return false;
      return !existingProfiles.get(docKey(candidate.document_type, candidate.document_normalized))?.id;
    });
    if (missingDocNormalized.length > 0) {
      for (const docChunk of chunk(missingDocNormalized, 100)) {
        const { data: fetched } = await (supabase as any)
          .from('profiles')
          .select('id, user_id, document_type, document_normalized, rut')
          .in('document_normalized', docChunk);
        if (fetched) {
          for (const p of fetched) {
            const type = (p.document_type as DocumentType | null) || 'rut';
            const normalized = (p.document_normalized as string | null) || p.rut;
            if (normalized) existingProfiles.set(docKey(type, normalized), { id: p.id, user_id: p.user_id });
          }
        }
      }
    }

    // ── 5. Pre-fetch zone rules for this event (1 query) ──
    const { data: zoneRules } = await supabase
      .from('event_zone_rules')
      .select('cargo, zona, match_field')
      .eq('event_id', event_id);

    function resolveZoneLocal(cargo?: string, tipoMedio?: string): string | null {
      if (!zoneRules) return null;
      if (cargo) {
        const rule = zoneRules.find(r => r.match_field === 'cargo' && r.cargo === cargo);
        if (rule?.zona) return rule.zona;
      }
      if (tipoMedio) {
        const rule = zoneRules.find(r => r.match_field === 'tipo_medio' && r.cargo === tipoMedio);
        if (rule?.zona) return rule.zona;
      }
      return null;
    }

    // ── 6. Create registrations via SINGLE bulk RPC ──
    // Build the payload array for the PG function
    let successCount = 0;
    const rpcRows: {
      profile_id: string;
      organizacion: string | null;
      tipo_medio: string | null;
      cargo: string | null;
      datos_extra: Record<string, string>;
      row_index: number;
    }[] = [];

    const skippedResults: typeof results = [];

    for (const { index, formData } of validRows) {
      const profile = existingProfiles.get(docKey(formData.document_type, formData.document_normalized));
      if (!profile?.id) {
        skippedResults.push({
          row: index + 1,
          rut: formData.rut,
          nombre: `${formData.nombre} ${formData.apellido}`,
          ok: false,
          error: `Perfil no encontrado para documento ${formData.document_number}`,
        });
        errorCount++;
        continue;
      }

      // Resolve zone locally (no DB call)
      const datosExtra = { ...formData.datos_extra };
      if (!datosExtra.zona) {
        const autoZona = resolveZoneLocal(formData.cargo, formData.tipo_medio);
        if (autoZona) datosExtra.zona = autoZona;
      }

      rpcRows.push({
        profile_id: profile.id,
        organizacion: formData.organizacion || null,
        tipo_medio: formData.tipo_medio || null,
        cargo: formData.cargo || null,
        datos_extra: datosExtra,
        row_index: index,
      });
    }

    // Add skipped results
    results.push(...skippedResults);

    // ── All-or-nothing: if ANY profile couldn't be resolved, stop everything ──
    if (skippedResults.length > 0) {
      await cleanupTransientProfiles();
      for (const rpcRow of rpcRows) {
        const vr = validRows.find(v => v.index === rpcRow.row_index)!;
        results.push({
          row: rpcRow.row_index + 1,
          rut: vr.formData.rut,
          nombre: `${vr.formData.nombre} ${vr.formData.apellido}`,
          ok: false,
          error: 'No se procesó: se encontraron errores en otras personas del lote',
        });
        errorCount++;
      }
      results.sort((a, b) => a.row - b.row);
      return NextResponse.json({ total: rows.length, success: 0, errors: errorCount, results });
    }

    // ★ Pre-validate + Single RPC call for ALL registrations
    if (rpcRows.length > 0) {
      // ── Pre-check: duplicates against existing registrations ──
      const allProfileIds = [...new Set(rpcRows.map(r => r.profile_id))];
      const duplicateProfileIds = new Set<string>();
      for (const pidChunk of chunk(allProfileIds, 100)) {
        const { data: existingRegs } = await supabase
          .from('registrations')
          .select('profile_id')
          .eq('event_id', event_id)
          .in('profile_id', pidChunk);
        if (existingRegs) {
          for (const e of existingRegs) duplicateProfileIds.add(e.profile_id);
        }
      }

      // ── Pre-check: duplicate emails within batch + already used in event ──
      const emailCounts = new Map<string, number>();
      for (const { formData } of validRows) {
        const normalizedEmail = formData.email?.trim().toLowerCase();
        if (!normalizedEmail) continue;
        emailCounts.set(normalizedEmail, (emailCounts.get(normalizedEmail) || 0) + 1);
      }
      const batchDuplicateEmails = new Set(
        [...emailCounts.entries()].filter(([, count]) => count > 1).map(([email]) => email)
      );

      const existingEventEmailSet = new Set<string>();
      if (emailCounts.size > 0) {
        const { data: existingEventEmails } = await (supabase as any)
          .from('registrations')
          .select('email_snapshot')
          .eq('event_id', event_id)
          .not('email_snapshot', 'is', null);
        if (existingEventEmails) {
          for (const reg of existingEventEmails) {
            const normalized = reg.email_snapshot?.toLowerCase().trim();
            if (normalized) existingEventEmailSet.add(normalized);
          }
        }
      }

      // ── Pre-check: within-batch duplicate documents ──
      const docCounts = new Map<string, number>();
      for (const rpcRow of rpcRows) {
        const vr = validRows.find(v => v.index === rpcRow.row_index)!;
        const key = docKey(vr.formData.document_type, vr.formData.document_normalized);
        docCounts.set(key, (docCounts.get(key) || 0) + 1);
      }
      const batchDuplicateDocs = new Set(
        [...docCounts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
      );

      if (duplicateProfileIds.size > 0 || batchDuplicateDocs.size > 0 || batchDuplicateEmails.size > 0 || existingEventEmailSet.size > 0) {
        await cleanupTransientProfiles();
        for (const rpcRow of rpcRows) {
          const vr = validRows.find(v => v.index === rpcRow.row_index)!;
          const nombre = `${vr.formData.nombre} ${vr.formData.apellido}`;
          const key = docKey(vr.formData.document_type, vr.formData.document_normalized);
          const normalizedEmail = vr.formData.email?.trim().toLowerCase() || '';
          if (duplicateProfileIds.has(rpcRow.profile_id)) {
            results.push({ row: rpcRow.row_index + 1, rut: vr.formData.rut, nombre, ok: false,
              error: 'Esta persona ya está registrada en este evento' });
          } else if (normalizedEmail && batchDuplicateEmails.has(normalizedEmail)) {
            results.push({ row: rpcRow.row_index + 1, rut: vr.formData.rut, nombre, ok: false,
              error: 'Email duplicado en el mismo lote' });
          } else if (normalizedEmail && existingEventEmailSet.has(normalizedEmail)) {
            results.push({ row: rpcRow.row_index + 1, rut: vr.formData.rut, nombre, ok: false,
              error: 'Este email ya está registrado en este evento' });
          } else if (batchDuplicateDocs.has(key)) {
            results.push({ row: rpcRow.row_index + 1, rut: vr.formData.rut, nombre, ok: false,
              error: vr.formData.document_type === 'rut' ? 'RUT duplicado en el mismo lote' : 'Documento duplicado en el mismo lote' });
          } else {
            results.push({ row: rpcRow.row_index + 1, rut: vr.formData.rut, nombre, ok: false,
              error: 'No se procesó: se encontraron errores en otras personas del lote' });
          }
          errorCount++;
        }
        results.sort((a, b) => a.row - b.row);
        return NextResponse.json({ total: rows.length, success: 0, errors: errorCount, results });
      }

      // ── All clear → Single RPC call ──
      const { data: rpcResults, error: rpcError } = await supabase.rpc(
        'bulk_check_and_create_registrations',
        {
          p_event_id: event_id,
          p_submitted_by: submitterProfileId || undefined,
          p_rows: rpcRows as unknown as Json,
        }
      );

      if (rpcError) {
        await cleanupTransientProfiles();
        // RPC-level failure: mark all rows as failed
        for (const rpcRow of rpcRows) {
          const vr = validRows.find(v => v.index === rpcRow.row_index)!;
          errorCount++;
          results.push({
            row: rpcRow.row_index + 1,
            rut: vr.formData.rut,
            nombre: `${vr.formData.nombre} ${vr.formData.apellido}`,
            ok: false,
            error: rpcError.message || 'Error interno en acreditación masiva',
          });
        }

        results.sort((a, b) => a.row - b.row);
        return NextResponse.json({ total: rows.length, success: 0, errors: rows.length, results });
      } else {
        // Parse individual results from the RPC response
        const rowResults = (rpcResults || []) as Array<{
          row_index: number;
          ok: boolean;
          error?: string;
          reg_id?: string;
        }>;

        const successfulRegIds = rowResults
          .filter(r => r.ok && !!r.reg_id)
          .map(r => r.reg_id as string);
        const hasAnyFailure = rpcRows.some(rpcRow => {
          const rr = rowResults.find(r => r.row_index === rpcRow.row_index);
          return !rr?.ok;
        });

        // Enforce strict all-or-nothing: if one fails, rollback created registrations and fail all
        if (hasAnyFailure) {
          await cleanupTransientProfiles();
          if (successfulRegIds.length > 0) {
            for (const regChunk of chunk(successfulRegIds, CHUNK_SIZE)) {
              await supabase
                .from('registrations')
                .delete()
                .eq('event_id', event_id)
                .in('id', regChunk);
            }
          }

          for (const rpcRow of rpcRows) {
            const vr = validRows.find(v => v.index === rpcRow.row_index)!;
            const rr = rowResults.find(r => r.row_index === rpcRow.row_index);
            const hasRowError = rr && !rr.ok;
            results.push({
              row: rpcRow.row_index + 1,
              rut: vr.formData.rut,
              nombre: `${vr.formData.nombre} ${vr.formData.apellido}`,
              ok: false,
              error: hasRowError
                ? (rr?.error || 'Error desconocido')
                : 'No se procesó: se encontraron errores en otras personas del lote',
            });
            errorCount++;
          }

          results.sort((a, b) => a.row - b.row);
          return NextResponse.json({ total: rows.length, success: 0, errors: rows.length, results });
        } else {
          // Build a map for quick lookup
          const resultMap = new Map(rowResults.map(r => [r.row_index, r]));

          for (const rpcRow of rpcRows) {
            const vr = validRows.find(v => v.index === rpcRow.row_index)!;
            const rr = resultMap.get(rpcRow.row_index);

            if (rr?.ok) {
              successCount++;
              results.push({
                row: rpcRow.row_index + 1,
                rut: vr.formData.rut,
                nombre: `${vr.formData.nombre} ${vr.formData.apellido}`,
                ok: true,
              });
            } else {
              errorCount++;
              results.push({
                row: rpcRow.row_index + 1,
                rut: vr.formData.rut,
                nombre: `${vr.formData.nombre} ${vr.formData.apellido}`,
                ok: false,
                error: rr?.error || 'Error desconocido',
              });
            }
          }
        }
      }
    }

    // Apply pending profile updates ONLY after successful all-or-nothing registration
    if (pendingProfileUpdates.length > 0) {
      const updatePromises = pendingProfileUpdates.map(({ id, updates }) =>
        supabase.from('profiles').update(updates).eq('id', id)
      );
      await Promise.allSettled(updatePromises);
    }

    // ── 7. Batch save tenant profile data (parallel) ──
    try {
      const tenantId = event.tenant_id;
      const formKeys = ((event.form_fields || []) as unknown as Array<{ key: string }>).map(f => f.key);

      if (tenantId && formKeys.length > 0) {
        const dataToSave = validRows
          .filter(vr => results.find(r => r.rut === vr.formData.rut && r.ok))
          .filter(vr => Object.keys(vr.formData.datos_extra).length > 0)
          .map(vr => ({
            profileId: existingProfiles.get(docKey(vr.formData.document_type, vr.formData.document_normalized))?.id,
            data: Object.fromEntries(
              Object.entries(vr.formData.datos_extra)
                .filter(([key]) => !key.startsWith('responsable_') && !key.startsWith('_'))
            ),
          }))
          .filter(d => d.profileId);

        if (dataToSave.length > 0) {
          const profileIds = dataToSave.map(d => d.profileId!);

          for (const idChunk of chunk(profileIds, CHUNK_SIZE)) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, datos_base')
              .in('id', idChunk);

            if (profiles) {
              // Build all update payloads, then fire them in parallel
              const updatePayloads = profiles.map(p => {
                const saveDatum = dataToSave.find(d => d.profileId === p.id);
                if (!saveDatum) return null;

                const datosBase = (p.datos_base || {}) as Record<string, unknown>;
                const tenantMap = (datosBase._tenant || {}) as Record<string, unknown>;
                const currentTenantData = (tenantMap[tenantId] || {}) as Record<string, unknown>;

                const mergedTenantData = {
                  ...currentTenantData,
                  ...saveDatum.data,
                  _form_keys: formKeys,
                  _updated_at: new Date().toISOString(),
                };

                const flatMerge = { ...datosBase };
                for (const [key, val] of Object.entries(saveDatum.data)) {
                  if (!key.startsWith('_')) flatMerge[key] = val;
                }
                flatMerge._tenant = { ...(tenantMap as object), [tenantId]: mergedTenantData };

                return { id: p.id, datos_base: flatMerge };
              }).filter(Boolean) as { id: string; datos_base: Record<string, unknown> }[];

              // ★ Fire all updates in parallel instead of sequential awaits
              await Promise.allSettled(
                updatePayloads.map(u =>
                  supabase.from('profiles').update({ datos_base: u.datos_base as any }).eq('id', u.id)
                )
              );
            }
          }
        }
      }
    } catch (err) {
      console.warn('[BulkAccreditation] Non-critical: failed to save tenant profile data', err);
    }

    // ── 8. Audit log (single entry for the whole batch) ──
    try {
      await logAuditAction(authUserId || null, 'registration.bulk_created', 'event', event_id, {
        event_id,
        total: rows.length,
        success: successCount,
        errors: errorCount,
        submitted_by_profile: submitterProfileId,
      });
    } catch { /* non-critical */ }

    // Sort results by row number
    results.sort((a, b) => a.row - b.row);

    return NextResponse.json({
      total: rows.length,
      success: successCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
