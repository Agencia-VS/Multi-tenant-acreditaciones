/**
 * API: Bulk File Parse (Server-side)
 * POST — Parsear archivo Excel/CSV y retornar filas estructuradas
 * GET  — Generar plantilla Excel dinámica basada en event config
 *
 * Mueve ExcelJS al servidor para reducir el bundle del cliente.
 * El client envía un FormData con el archivo, recibe JSON con las filas.
 */

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getEventById } from '@/lib/services';
import type { BulkTemplateColumn, EventConfig } from '@/types';

/* ── Default bulk template (fallback cuando evento no configura columnas) ─── */

const DEFAULT_BULK_COLUMNS: BulkTemplateColumn[] = [
  { key: 'nombre', header: 'Nombre', required: true, example: 'Juan', width: 20 },
  { key: 'apellido', header: 'Apellido', required: true, example: 'Pérez', width: 20 },
  { key: 'rut', header: 'RUT', required: true, example: '12.345.678-9', width: 16 },
  { key: 'patente', header: 'Patente', required: false, example: 'ABCD-12', width: 20 },
];

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
 * GET /api/bulk/parse
 * Genera y descarga la plantilla Excel de carga masiva.
 * Si se pasa ?event_id=X, genera columnas dinámicas según event.config.bulk_template_columns.
 * Si no hay event_id o no hay config, usa la plantilla por defecto.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantSlug = searchParams.get('tenant') || 'accredia';
    const color = searchParams.get('color') || '1a1a2e';
    const eventId = searchParams.get('event_id');

    // Resolver columnas: dinámicas desde evento o fallback
    let columns = DEFAULT_BULK_COLUMNS;
    let eventName = '';

    if (eventId) {
      try {
        const event = await getEventById(eventId);
        if (event) {
          eventName = event.nombre || '';
          const evConfig = (event.config || {}) as EventConfig;
          if (evConfig.bulk_template_columns && evConfig.bulk_template_columns.length > 0) {
            columns = evConfig.bulk_template_columns;
          } else if (event.form_fields && event.form_fields.length > 0) {
            // Fallback: generar columnas a partir de form_fields (excluyendo 'file' y 'foto')
            columns = event.form_fields
              .filter(f => f.type !== 'file' && f.key !== 'foto_url')
              .map(f => ({
                key: f.key,
                header: f.label,
                required: f.required,
                example: getFieldExample(f.key, f.type),
                width: f.key === 'email' ? 28 : f.key === 'rut' ? 16 : 20,
              }));
          }
        }
      } catch {
        // Si falla obtener el evento, usar default
      }
    }

    const wb = new ExcelJS.Workbook();
    const wsName = eventName ? eventName.substring(0, 31) : 'Acreditados';
    const ws = wb.addWorksheet(wsName);

    // Configurar columnas
    ws.columns = columns.map(col => ({
      header: col.required ? `${col.header} *` : col.header,
      key: col.key,
      width: col.width || 20,
    }));

    // Estilo del header
    const headerColor = color.replace('#', '');
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
    });

    // Fila de ejemplo
    const exampleRow: Record<string, string> = {};
    for (const col of columns) {
      exampleRow[col.key] = col.example || '';
    }
    ws.addRow(exampleRow);

    // Agregar nota con instrucciones en una fila extra (gris)
    const noteRow = ws.addRow({});
    noteRow.getCell(1).value = '↑ Elimina esta fila de ejemplo antes de importar. Los campos con * son obligatorios.';
    noteRow.getCell(1).font = { italic: true, color: { argb: '888888' } };

    const buffer = await wb.xlsx.writeBuffer();

    const safeName = (eventName || tenantSlug).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="plantilla-carga-masiva-${safeName}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error generando plantilla' },
      { status: 500 }
    );
  }
}

/** Helper: genera ejemplo según tipo de campo */
function getFieldExample(key: string, type: string): string {
  const examples: Record<string, string> = {
    nombre: 'Juan',
    apellido: 'Pérez',
    segundo_apellido: 'González',
    rut: '12.345.678-9',
    email: 'juan@ejemplo.cl',
    telefono: '+56912345678',
    cargo: 'Periodista',
    tipo_medio: 'TV',
    medio: 'Canal 13',
    organizacion: 'Medio ABC',
    empresa: 'Medio ABC',
    patente: 'ABCD-12',
    zona: 'Tribuna Prensa',
    area: 'General',
  };
  if (examples[key]) return examples[key];
  if (type === 'email') return 'ejemplo@correo.cl';
  if (type === 'tel') return '+56900000000';
  if (type === 'number') return '0';
  return '';
}
