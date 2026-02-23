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

interface BulkRow {
  rut: string;
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

const BASE_FIELDS = ['rut', 'nombre', 'apellido', 'email', 'telefono', 'cargo', 'organizacion', 'tipo_medio'];
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
    const validRows: { index: number; row: BulkRow; formData: { rut: string; nombre: string; apellido: string; email: string; telefono: string; cargo: string; organizacion: string; tipo_medio: string; datos_extra: Record<string, string> } }[] = [];
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.rut || !row.nombre || !row.apellido) {
        results.push({
          row: i + 1, rut: row.rut || '—',
          nombre: `${row.nombre || '?'} ${row.apellido || '?'}`,
          ok: false, error: 'Faltan campos requeridos (rut, nombre, apellido)',
        });
        errorCount++;
        continue;
      }

      const formData = {
        rut: row.rut.trim(), nombre: row.nombre.trim(), apellido: row.apellido.trim(),
        email: row.email?.trim() || '', telefono: row.telefono?.trim() || '',
        cargo: row.cargo?.trim() || '', organizacion: row.organizacion?.trim() || '',
        tipo_medio: row.tipo_medio?.trim() || '',
        datos_extra: {} as Record<string, string>,
      };

      for (const [key, val] of Object.entries(row)) {
        if (!BASE_FIELDS.includes(key) && val) {
          formData.datos_extra[key] = val.trim();
        }
      }

      validRows.push({ index: i, row, formData });
    }

    if (validRows.length === 0) {
      return NextResponse.json({ total: rows.length, success: 0, errors: errorCount, results });
    }

    // ── 4. Batch lookup/upsert de profiles ──
    // Fetch all existing profiles by RUT in one query
    const allRuts = [...new Set(validRows.map(v => v.formData.rut))];
    const existingProfiles = new Map<string, { id: string; user_id: string | null }>();

    for (const rutChunk of chunk(allRuts, 100)) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, rut, user_id')
        .in('rut', rutChunk);
      if (profiles) {
        for (const p of profiles) {
          existingProfiles.set(p.rut, { id: p.id, user_id: p.user_id });
        }
      }
    }

    // Separate new profiles from existing ones
    const profilesToCreate: { rut: string; nombre: string; apellido: string; email: string | null; telefono: string | null; cargo: string | null; medio: string | null; tipo_medio: string | null }[] = [];
    const profilesToUpdate: { id: string; updates: Record<string, string> }[] = [];

    for (const { formData } of validRows) {
      const existing = existingProfiles.get(formData.rut);
      if (existing) {
        // Collect updates for existing profiles (non-empty fields only)
        const updates: Record<string, string> = {};
        if (formData.nombre) updates.nombre = formData.nombre;
        if (formData.apellido) updates.apellido = formData.apellido;
        if (formData.email) updates.email = formData.email;
        if (formData.telefono) updates.telefono = formData.telefono;
        if (formData.cargo) updates.cargo = formData.cargo;
        if (formData.tipo_medio) updates.tipo_medio = formData.tipo_medio;
        if (formData.organizacion) updates.medio = formData.organizacion;
        if (Object.keys(updates).length > 0) {
          profilesToUpdate.push({ id: existing.id, updates });
        }
      } else if (!existingProfiles.has(formData.rut)) {
        // Only add once per unique RUT
        existingProfiles.set(formData.rut, { id: '', user_id: null }); // placeholder
        profilesToCreate.push({
          rut: formData.rut, nombre: formData.nombre, apellido: formData.apellido,
          email: formData.email || null, telefono: formData.telefono || null,
          cargo: formData.cargo || null, medio: formData.organizacion || null,
          tipo_medio: formData.tipo_medio || null,
          // NO user_id — bulk profiles are anonymous
        });
      }
    }

    // Batch insert new profiles
    if (profilesToCreate.length > 0) {
      for (const profileChunk of chunk(profilesToCreate, CHUNK_SIZE)) {
        const { data: created, error } = await supabase
          .from('profiles')
          .upsert(profileChunk, { onConflict: 'rut', ignoreDuplicates: false })
          .select('id, rut');
        if (error) {
          console.error('[BulkAccreditation] Error upserting profiles:', error.message);
        }
        if (created) {
          for (const p of created) {
            existingProfiles.set(p.rut, { id: p.id, user_id: null });
          }
        }
      }
    }

    // Batch update existing profiles (parallel, fire-and-forget for non-critical)
    if (profilesToUpdate.length > 0) {
      const updatePromises = profilesToUpdate.map(({ id, updates }) =>
        supabase.from('profiles').update(updates).eq('id', id)
      );
      await Promise.allSettled(updatePromises);
    }

    // Re-fetch any profiles that didn't get their IDs (from upsert returning existing)
    const missingIdRuts = allRuts.filter(rut => !existingProfiles.get(rut)?.id);
    if (missingIdRuts.length > 0) {
      for (const rutChunk of chunk(missingIdRuts, 100)) {
        const { data: fetched } = await supabase
          .from('profiles')
          .select('id, rut, user_id')
          .in('rut', rutChunk);
        if (fetched) {
          for (const p of fetched) {
            existingProfiles.set(p.rut, { id: p.id, user_id: p.user_id });
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
      const profile = existingProfiles.get(formData.rut);
      if (!profile?.id) {
        skippedResults.push({
          row: index + 1,
          rut: formData.rut,
          nombre: `${formData.nombre} ${formData.apellido}`,
          ok: false,
          error: `Perfil no encontrado para RUT ${formData.rut}`,
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

    // ★ Single RPC call for ALL registrations
    if (rpcRows.length > 0) {
      const { data: rpcResults, error: rpcError } = await supabase.rpc(
        'bulk_check_and_create_registrations',
        {
          p_event_id: event_id,
          p_submitted_by: submitterProfileId || null,
          p_rows: rpcRows as unknown as import('@/lib/supabase/database.types').Json,
        }
      );

      if (rpcError) {
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
      } else {
        // Parse individual results from the RPC response
        const rowResults = (rpcResults || []) as Array<{
          row_index: number;
          ok: boolean;
          error?: string;
          reg_id?: string;
        }>;

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

    // ── 7. Batch save tenant profile data (parallel) ──
    try {
      const tenantId = event.tenant_id;
      const formKeys = ((event.form_fields || []) as unknown as Array<{ key: string }>).map(f => f.key);

      if (tenantId && formKeys.length > 0) {
        const dataToSave = validRows
          .filter(vr => results.find(r => r.rut === vr.formData.rut && r.ok))
          .filter(vr => Object.keys(vr.formData.datos_extra).length > 0)
          .map(vr => ({
            profileId: existingProfiles.get(vr.formData.rut)?.id,
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
