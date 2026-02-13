/**
 * API: Admin Export
 * GET — Exportar registros a Excel/CSV/PuntoTicket
 * Supports filters: event_id, tenant_id, status, tipo_medio, search, format
 */

import { NextRequest, NextResponse } from 'next/server';
import { listRegistrations } from '@/lib/services';
import type { RegistrationStatus } from '@/types';
import ExcelJS from 'exceljs';

/* ── helpers ─────────────────────────────────────────── */

/** Try to extract a field from datos_extra → datos_base → top-level registration */
function extractField(r: Record<string, unknown>, key: string): string {
  // 1. datos_extra (dynamic form fields for THIS registration)
  const extras = (r.datos_extra ?? {}) as Record<string, unknown>;
  if (extras[key]) return String(extras[key]);
  // 2. profile datos_base
  const db = (r.profile_datos_base ?? {}) as Record<string, unknown>;
  if (db[key]) return String(db[key]);
  return '';
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

    const { data: registrations } = await listRegistrations({
      event_id: eventId || undefined,
      tenant_id: tenantId || undefined,
      status: statusFilter || undefined,
      tipo_medio: tipoMedioFilter || undefined,
      search: searchFilter || undefined,
      limit: 10000,
    });

    // ─── PuntoTicket XLSX format ────────────────────────
    // Matches the real PuntoTicket structure:
    // Nombre | Apellido | RUT | Empresa | Área | Zona | Patente | (reserved) | Acreditación | Cantidad
    if (format === 'puntoticket') {
      const approved = registrations.filter(r => r.status === 'aprobado');

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Accredia';
      const sheet = workbook.addWorksheet('Acreditaciones');

      sheet.columns = [
        { header: 'Nombre',       key: 'nombre',       width: 22 },
        { header: 'Apellido',     key: 'apellido',     width: 22 },
        { header: 'Rut xxxxxxxx-x', key: 'rut',        width: 16 },
        { header: 'Empresa',      key: 'empresa',      width: 25 },
        { header: 'Área',         key: 'area',         width: 22 },
        { header: 'Zona',         key: 'zona',         width: 20 },
        { header: 'Patente',      key: 'patente',      width: 12 },
      ];

      // Deep purple header matching PuntoTicket branding
      const headerRow = sheet.getRow(1);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6b21a8' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FF4a1480' } },
        };
      });
      headerRow.height = 24;

      approved.forEach(r => {
        const rec = r as unknown as Record<string, unknown>;
        sheet.addRow({
          nombre:   r.profile_nombre || '',
          apellido: r.profile_apellido || '',
          rut:      r.rut || '',
          empresa:  r.organizacion || extractField(rec, 'empresa') || '',
          area:     extractField(rec, 'area') || r.tipo_medio || '',
          zona:     extractField(rec, 'zona') || '',
          patente:  extractField(rec, 'patente') || '',
        });
      });

      // Auto-filter
      sheet.autoFilter = { from: 'A1', to: 'G1' };

      // Freeze header
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      const buffer = await workbook.xlsx.writeBuffer();
      const eventName = approved[0]?.event_nombre?.replace(/[^a-zA-Z0-9]/g, '_') || 'export';
      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="puntoticket-${eventName}-${Date.now()}.xlsx"`,
        },
      });
    }

    if (format === 'csv') {
      // Fallback CSV — redirigir a XLSX
      // Se mantiene compatibilidad pero genera XLSX
    }

    // Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Acreditaciones');

    sheet.columns = [
      { header: 'RUT', key: 'rut', width: 15 },
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Teléfono', key: 'telefono', width: 15 },
      { header: 'Organización', key: 'organizacion', width: 25 },
      { header: 'Tipo Medio', key: 'tipo_medio', width: 15 },
      { header: 'Cargo', key: 'cargo', width: 15 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Check-in', key: 'checked_in', width: 10 },
      { header: 'Evento', key: 'evento', width: 30 },
      { header: 'Fecha Registro', key: 'created_at', width: 15 },
    ];

    // Header style
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    sheet.getRow(1).height = 22;

    registrations.forEach((r) => {
      sheet.addRow({
        rut: r.rut,
        nombre: r.profile_nombre,
        apellido: r.profile_apellido,
        email: r.profile_email || '',
        telefono: r.profile_telefono || '',
        organizacion: r.organizacion || '',
        tipo_medio: r.tipo_medio || '',
        cargo: r.cargo || '',
        status: r.status,
        checked_in: r.checked_in ? 'Sí' : 'No',
        evento: r.event_nombre,
        created_at: new Date(r.created_at).toLocaleDateString('es-CL'),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="acreditaciones-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno' },
      { status: 500 }
    );
  }
}
