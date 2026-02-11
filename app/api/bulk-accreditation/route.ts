/**
 * API: Acreditación Masiva (Bulk)
 * POST — Procesa un array de registros (CSV parseado en frontend)
 * Reutiliza la misma lógica de createRegistration pero en lote.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createRegistration, getEventById } from '@/lib/services';
import { getCurrentUser } from '@/lib/services/auth';
import { getProfileByUserId } from '@/lib/services/profiles';
import { logAuditAction } from '@/lib/services/audit';
import { isDeadlinePast } from '@/lib/dates';

interface BulkRow {
  rut: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  cargo?: string;
  organizacion?: string;
  tipo_medio?: string;
  [key: string]: string | undefined;
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

    // Verificar deadline
    const event = await getEventById(event_id);
    if (event && isDeadlinePast(event.fecha_limite_acreditacion)) {
      return NextResponse.json(
        { error: 'El plazo para solicitar acreditación ha cerrado' },
        { status: 403 }
      );
    }

    // Resolver usuario autenticado
    let authUserId: string | undefined;
    let submitterProfileId: string | undefined;

    try {
      const user = await getCurrentUser();
      if (user) {
        authUserId = user.id;
        const profile = await getProfileByUserId(user.id);
        if (profile) submitterProfileId = profile.id;
      }
    } catch { /* no bloquear */ }

    // Procesar cada fila
    const results: { row: number; rut: string; nombre: string; ok: boolean; error?: string }[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validación mínima
      if (!row.rut || !row.nombre || !row.apellido) {
        results.push({
          row: i + 1,
          rut: row.rut || '—',
          nombre: `${row.nombre || '?'} ${row.apellido || '?'}`,
          ok: false,
          error: 'Faltan campos requeridos (rut, nombre, apellido)',
        });
        errorCount++;
        continue;
      }

      try {
        const formData = {
          rut: row.rut.trim(),
          nombre: row.nombre.trim(),
          apellido: row.apellido.trim(),
          email: row.email?.trim() || '',
          telefono: row.telefono?.trim() || '',
          cargo: row.cargo?.trim() || '',
          organizacion: row.organizacion?.trim() || '',
          tipo_medio: row.tipo_medio?.trim() || '',
          datos_extra: {} as Record<string, string>,
        };

        // Campos extra (dinámicos)
        const baseFields = ['rut', 'nombre', 'apellido', 'email', 'telefono', 'cargo', 'organizacion', 'tipo_medio'];
        for (const [key, val] of Object.entries(row)) {
          if (!baseFields.includes(key) && val) {
            formData.datos_extra[key] = val.trim();
          }
        }

        const result = await createRegistration(
          event_id,
          formData,
          submitterProfileId,
          authUserId
        );

        await logAuditAction(authUserId || null, 'registration.created', 'registration', result.registration.id, {
          event_id,
          rut: formData.rut,
          organizacion: formData.organizacion,
          bulk: true,
          submitted_by_profile: submitterProfileId,
        });

        results.push({
          row: i + 1,
          rut: formData.rut,
          nombre: `${formData.nombre} ${formData.apellido}`,
          ok: true,
        });
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        results.push({
          row: i + 1,
          rut: row.rut,
          nombre: `${row.nombre} ${row.apellido}`,
          ok: false,
          error: msg,
        });
        errorCount++;
      }
    }

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
