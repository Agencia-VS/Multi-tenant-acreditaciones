/**
 * API: Bulk File Parse (Server-side)
 * POST — Parsear archivo Excel/CSV y retornar filas estructuradas
 *
 * Mueve ExcelJS al servidor para reducir el bundle del cliente.
 * El client envía un FormData con el archivo, recibe JSON con las filas.
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

/* ── Header mapping (same as client-side) ─── */

const BULK_HEADER_MAP: Record<string, string> = {
  rut: 'rut', 'rut_xxxxxxxx-x': 'rut',
  nombre: 'nombre', first_name: 'nombre',
  apellido: 'apellido', last_name: 'apellido',
  email: 'email', correo: 'email', mail: 'email',
  telefono: 'telefono', celular: 'telefono', fono: 'telefono', phone: 'telefono',
  cargo: 'cargo', funcion: 'cargo', rol: 'cargo', acreditacion: 'cargo',
  empresa: 'empresa', organizacion: 'empresa', medio: 'empresa', organization: 'empresa',
  tipo_medio: 'tipo_medio', tipo: 'tipo_medio',
  area: 'area', 'area_claro_arena_/_cruzados': 'area',
  zona: 'zona', zone: 'zona',
  patente: 'patente', 'patente_(opcional)': 'patente',
  cantidad: 'cantidad',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

interface BulkRow {
  rut: string;
  nombre: string;
  apellido: string;
  [key: string]: string;
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(normalizeHeader);
  const mappedHeaders = headers.map(h => BULK_HEADER_MAP[h] || h);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: BulkRow = { rut: '', nombre: '', apellido: '' };
    mappedHeaders.forEach((header, i) => { if (values[i]) row[header] = values[i]; });
    return row;
  }).filter(row => row.rut || row.nombre);
}

async function parseExcel(buffer: ArrayBuffer): Promise<BulkRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 2) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber - 1] = normalizeHeader(cell.value?.toString() || '');
  });
  const mapped = headers.map(h => BULK_HEADER_MAP[h] || h);

  const rows: BulkRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const r: BulkRow = { rut: '', nombre: '', apellido: '' };
    row.eachCell((cell, colNumber) => {
      const h = mapped[colNumber - 1];
      if (h) r[h] = cell.value?.toString().trim() || '';
    });
    if (r.rut || r.nombre) rows.push(r);
  });

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    let rows: BulkRow[];

    if (ext === 'xlsx' || ext === 'xls') {
      const buffer = await file.arrayBuffer();
      rows = await parseExcel(buffer);
    } else {
      const text = await file.text();
      rows = parseCSV(text);
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No se encontraron datos válidos' }, { status: 400 });
    }

    return NextResponse.json({ rows, count: rows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error procesando archivo' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bulk/parse/template
 * Genera y descarga la plantilla Excel de carga masiva
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant') || 'accredia';
    const color = searchParams.get('color') || '1a1a2e';

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Acreditados');

    ws.columns = [
      { header: 'Nombre', key: 'nombre', width: 20 },
      { header: 'Apellido', key: 'apellido', width: 20 },
      { header: 'RUT', key: 'rut', width: 16 },
      { header: 'Patente', key: 'patente', width: 20 },
    ];

    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color.replace('#', '') } };
    });

    // Fila de ejemplo
    ws.addRow({ nombre: 'Juan', apellido: 'Pérez', rut: '12.345.678-9', patente: 'ABCD-12' });

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="plantilla-carga-masiva-${tenantSlug}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generando plantilla' },
      { status: 500 }
    );
  }
}
