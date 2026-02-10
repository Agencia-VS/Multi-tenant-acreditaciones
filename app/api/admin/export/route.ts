/**
 * API: Admin Export
 * GET — Exportar registros a Excel/CSV/PuntoTicket
 * Supports filters: event_id, tenant_id, status, tipo_medio, search, format
 */

import { NextRequest, NextResponse } from 'next/server';
import { listRegistrations } from '@/lib/services';
import type { RegistrationStatus } from '@/types';
import ExcelJS from 'exceljs';

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

    // PuntoTicket CSV format — only approved registrations
    if (format === 'puntoticket') {
      const approved = registrations.filter(r => r.status === 'aprobado');
      const headers = ['RUT', 'Nombre Completo', 'Email', 'Tipo Medio', 'Organización', 'Cargo', 'Evento', 'Fecha'];
      const rows = approved.map(r => [
        r.rut,
        `${r.profile_nombre} ${r.profile_apellido}`,
        r.profile_email || '',
        r.tipo_medio || '',
        r.organizacion || '',
        r.cargo || '',
        r.event_nombre || '',
        r.event_fecha ? new Date(r.event_fecha).toLocaleDateString('es-CL') : '',
      ]);

      const csv = [headers.join(';'), ...rows.map(r => r.map(c => `"${c}"`).join(';'))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="puntoticket-${Date.now()}.csv"`,
        },
      });
    }

    if (format === 'csv') {
      const headers = ['RUT', 'Nombre', 'Apellido', 'Email', 'Teléfono', 'Organización', 'Tipo Medio', 'Cargo', 'Estado', 'Fecha Registro'];
      const rows = registrations.map((r) => [
        r.rut,
        r.profile_nombre,
        r.profile_apellido,
        r.profile_email || '',
        r.profile_telefono || '',
        r.organizacion || '',
        r.tipo_medio || '',
        r.cargo || '',
        r.status,
        new Date(r.created_at).toLocaleDateString('es-CL'),
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="acreditaciones-${Date.now()}.csv"`,
        },
      });
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
    });

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
