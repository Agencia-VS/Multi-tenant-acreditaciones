/**
 * API: Admin Export
 * GET — Exportar registros a Excel/CSV/PuntoTicket
 * Supports filters: event_id, tenant_id, status, tipo_medio, search, format
 *
 * Formatos:
 *   xlsx        → Excel completo (18 columnas) para gestión interna del admin
 *   puntoticket → Formato PuntoTicket (7 columnas) para envío a PuntoTicket
 */

import { NextRequest, NextResponse } from 'next/server';
import { listRegistrations } from '@/lib/services';
import { requireAuth } from '@/lib/services/requireAuth';
import type { RegistrationStatus } from '@/types';
import { STATUS_MAP } from '@/types';
import ExcelJS from 'exceljs';

/* ── helpers ─────────────────────────────────────────── */

/** Try to extract a field: datos_extra → profile datos_base → '' */
function extractField(r: Record<string, unknown>, key: string): string {
  const extras = (r.datos_extra ?? {}) as Record<string, unknown>;
  if (extras[key]) return String(extras[key]);
  const db = (r.profile_datos_base ?? {}) as Record<string, unknown>;
  if (db[key]) return String(db[key]);
  return '';
}

/** Split "apellido" into [primer_apellido, segundo_apellido] if segundo not explicit */
function splitApellidos(
  apellido: string,
  segundoApellido: string
): [string, string] {
  if (segundoApellido) return [apellido, segundoApellido];
  const parts = apellido.trim().split(/\s+/);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(' ')];
  return [apellido, ''];
}

/** Style header row with brand color */
function styleHeader(row: ExcelJS.Row, color: string, height = 24) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF333333' } } };
  });
  row.height = height;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const tenantId = searchParams.get('tenant_id');
    const format = searchParams.get('format') || 'xlsx';
    const statusFilter = searchParams.get('status') as RegistrationStatus | null;
    const tipoMedioFilter = searchParams.get('tipo_medio');
    const searchFilter = searchParams.get('search');

    if (!eventId && !tenantId) {
      return NextResponse.json({ error: 'event_id o tenant_id requerido' }, { status: 400 });
    }

    // Auth: requiere admin_tenant o superadmin
    await requireAuth(request, { role: 'admin_tenant', tenantId: tenantId || undefined });

    const { data: registrations } = await listRegistrations({
      event_id: eventId || undefined,
      tenant_id: tenantId || undefined,
      status: statusFilter || undefined,
      tipo_medio: tipoMedioFilter || undefined,
      search: searchFilter || undefined,
      limit: 10000,
    });

    // ─────────────────────────────────────────────────────
    // PuntoTicket XLSX  (7 columnas)
    // Nombre | Apellido | RUT | Empresa | Area claro arena/Cruzados | Zona | Patente
    //
    // Exporta según los filtros activos del dashboard (status, tipo_medio, search).
    // Si no hay filtro de status, exporta todos.
    // ─────────────────────────────────────────────────────
    if (format === 'puntoticket') {
      // Usar los registros ya filtrados por listRegistrations (respeta filtros del dashboard)
      const rows = registrations;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Accredia';
      const sheet = workbook.addWorksheet('Acreditaciones');

      sheet.columns = [
        { header: 'Nombre',                       key: 'nombre',   width: 22 },
        { header: 'Apellido',                     key: 'apellido', width: 22 },
        { header: 'RUT',                          key: 'rut',      width: 16 },
        { header: 'Empresa',                      key: 'empresa',  width: 25 },
        { header: 'Area claro arena/Cruzados',    key: 'area',     width: 28 },
        { header: 'Zona',                         key: 'zona',     width: 22 },
        { header: 'Patente',                      key: 'patente',  width: 14 },
      ];

      styleHeader(sheet.getRow(1), 'FF6b21a8');

      rows.forEach(r => {
        const rec = r as unknown as Record<string, unknown>;

        // Columna "Area claro arena/Cruzados":
        //   - Tenant cruzados → siempre "CRUZADOS"
        //   - Otros tenants → tipo_medio del registro
        const areaValue = r.tenant_slug === 'cruzados'
          ? 'CRUZADOS'
          : (r.tipo_medio || extractField(rec, 'area') || '');

        sheet.addRow({
          nombre:   r.profile_nombre || '',
          apellido: r.profile_apellido || '',
          rut:      r.rut || '',
          empresa:  r.organizacion || extractField(rec, 'empresa') || '',
          area:     areaValue,
          zona:     extractField(rec, 'zona') || '',
          patente:  extractField(rec, 'patente') || '',
        });
      });

      sheet.autoFilter = { from: 'A1', to: 'G1' };
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const eventName = rows[0]?.event_nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'export';
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="puntoticket-${eventName}-${Date.now()}.xlsx"`,
        },
      });
    }

    // ─────────────────────────────────────────────────────
    // Excel Admin completo (18 columnas — todos los estados)
    // ─────────────────────────────────────────────────────
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Accredia';
    const sheet = workbook.addWorksheet('Acreditaciones');

    sheet.columns = [
      { header: 'Nombre',                key: 'nombre',              width: 20 },
      { header: 'Primer Apellido',       key: 'primer_apellido',     width: 18 },
      { header: 'Segundo Apellido',      key: 'segundo_apellido',    width: 18 },
      { header: 'RUT',                   key: 'rut',                 width: 15 },
      { header: 'Email',                 key: 'email',               width: 28 },
      { header: 'Cargo',                 key: 'cargo',               width: 18 },
      { header: 'Tipo Credencial',       key: 'tipo_credencial',     width: 18 },
      { header: 'N° Credencial',         key: 'n_credencial',        width: 14 },
      { header: 'Empresa',               key: 'empresa',             width: 25 },
      { header: 'Área',                  key: 'area',                width: 20 },
      { header: 'Zona',                  key: 'zona',                width: 20 },
      { header: 'Estado',                key: 'estado',              width: 14 },
      { header: 'Responsable',           key: 'resp_nombre',         width: 20 },
      { header: 'Primer Apellido Resp.', key: 'resp_primer_ap',      width: 18 },
      { header: 'Segundo Apellido Resp.',key: 'resp_segundo_ap',     width: 18 },
      { header: 'RUT Responsable',       key: 'resp_rut',            width: 15 },
      { header: 'Email Responsable',     key: 'resp_email',          width: 28 },
      { header: 'Teléfono Responsable',  key: 'resp_telefono',       width: 18 },
    ];

    styleHeader(sheet.getRow(1), 'FF1a1a2e');

    const STATUS_LABELS = Object.fromEntries(
      Object.entries(STATUS_MAP).map(([k, v]) => [k, v.label])
    ) as Record<string, string>;

    registrations.forEach((r) => {
      const rec = r as unknown as Record<string, unknown>;
      const segundo = extractField(rec, 'segundo_apellido');
      const [primerAp, segundoAp] = splitApellidos(r.profile_apellido || '', segundo);

      // Responsable data from datos_extra
      const extras = (r.datos_extra ?? {}) as Record<string, string>;
      const respSegundo = extras.responsable_segundo_apellido || '';
      const respApellido = extras.responsable_apellido || '';
      const [respPrimerAp, respSegundoAp] = splitApellidos(respApellido, respSegundo);

      sheet.addRow({
        nombre:           r.profile_nombre || '',
        primer_apellido:  primerAp,
        segundo_apellido: segundoAp,
        rut:              r.rut || '',
        email:            r.profile_email || '',
        cargo:            r.cargo || '',
        tipo_credencial:  extractField(rec, 'tipo_credencial') || '',
        n_credencial:     extractField(rec, 'n_credencial') || '',
        empresa:          r.organizacion || extractField(rec, 'empresa') || '',
        area:             extractField(rec, 'area') || r.tipo_medio || '',
        zona:             extractField(rec, 'zona') || '',
        estado:           STATUS_LABELS[r.status] || r.status,
        resp_nombre:      extras.responsable_nombre || '',
        resp_primer_ap:   respPrimerAp,
        resp_segundo_ap:  respSegundoAp,
        resp_rut:         extras.responsable_rut || '',
        resp_email:       extras.responsable_email || '',
        resp_telefono:    extras.responsable_telefono || '',
      });
    });

    sheet.autoFilter = { from: 'A1', to: 'R1' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const eventName = registrations[0]?.event_nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'acreditaciones';

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${eventName}-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    if (error instanceof NextResponse) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
