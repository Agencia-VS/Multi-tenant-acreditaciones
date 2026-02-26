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
import { getBulkTemplateColumnsFromConfig, hasBulkTemplateSignalInConfig } from '@/lib/bulkTemplate';

/* ── Default bulk template (fallback cuando evento no configura columnas) ─── */

const DEFAULT_BULK_COLUMNS: BulkTemplateColumn[] = [
  { key: 'nombre', header: 'Nombre', required: true, example: 'Juan', width: 20 },
  { key: 'apellido', header: 'Apellido', required: true, example: 'Pérez', width: 20 },
  { key: 'document_type', header: 'Tipo Documento', required: true, example: 'rut', width: 20, options: ['rut', 'dni_extranjero'] },
  { key: 'document_number', header: 'Documento', required: true, example: '12.345.678-9', width: 20 },
  { key: 'patente', header: 'Patente', required: false, example: 'ABCD-12', width: 20 },
];

function safeWorksheetName(input: string): string {
  const sanitized = input
    .replace(/[\\/*?:\[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (sanitized || 'Acreditados').substring(0, 31);
}

/* ── Header mapping (same as client-side) ─── */

const BULK_HEADER_MAP: Record<string, string> = {
  tipo_documento: 'document_type', tipo_de_documento: 'document_type', document_type: 'document_type', documento_tipo: 'document_type',
  documento: 'document_number', nro_documento: 'document_number', numero_documento: 'document_number', document_number: 'document_number',
  rut: 'rut', 'rut_xxxxxxxx-x': 'rut', 'rut_(xxxxxxxx-x)': 'rut',
  nombre: 'nombre', first_name: 'nombre', nombres: 'nombre',
  apellido: 'apellido', last_name: 'apellido', apellidos: 'apellido',
  segundo_apellido: 'segundo_apellido',
  email: 'email', correo: 'email', mail: 'email', 'correo_electronico': 'email',
  telefono: 'telefono', celular: 'telefono', fono: 'telefono', phone: 'telefono',
  cargo: 'cargo', funcion: 'cargo', rol: 'cargo', acreditacion: 'cargo',
  empresa: 'empresa', organizacion: 'empresa', medio: 'empresa', organization: 'empresa',
  tipo_medio: 'tipo_medio', tipo: 'tipo_medio', 'tipo_de_medio': 'tipo_medio',
  area: 'area', 'area_claro_arena_/_cruzados': 'area',
  zona: 'zona', zone: 'zona',
  patente: 'patente', 'patente_(opcional)': 'patente',
  cantidad: 'cantidad',
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')          // Remove * (required markers from template)
    .replace(/\s+/g, '_')
    .replace(/_+$/, '')          // Remove trailing underscores
    .replace(/^_+/, '');         // Remove leading underscores
}

interface BulkRow {
  document_type?: string;
  document_number?: string;
  rut: string;
  nombre: string;
  apellido: string;
  [key: string]: string | undefined;
}

function parseCSV(text: string): BulkRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[,;\t]/).map(normalizeHeader);
  const mappedHeaders = headers.map(h => BULK_HEADER_MAP[h] || h);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));
    const row: BulkRow = { rut: '', nombre: '', apellido: '', document_type: 'rut', document_number: '' };
    mappedHeaders.forEach((header, i) => { if (values[i]) row[header] = values[i]; });
    if (!row.document_number && row.rut) row.document_number = row.rut;
    return row;
  }).filter(row => row.document_number || row.rut || row.nombre);
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
    const r: BulkRow = { rut: '', nombre: '', apellido: '', document_type: 'rut', document_number: '' };
    // Detect instruction/note rows (e.g. "↑ Elimina esta fila...")
    const firstCellVal = row.getCell(1).value?.toString().trim() || '';
    if (firstCellVal.startsWith('↑') || firstCellVal.startsWith('Elimina')) return;
    row.eachCell((cell, colNumber) => {
      const h = mapped[colNumber - 1];
      if (h) r[h] = cell.value?.toString().trim() || '';
    });
    if (!r.document_number && r.rut) r.document_number = r.rut;
    if (r.document_number || r.rut || r.nombre) rows.push(r);
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
    let hasCustomBulkTemplate = false;
    let event: Awaited<ReturnType<typeof getEventById>> | null = null;

    if (eventId) {
      try {
        event = await getEventById(eventId);
        if (event) {
          eventName = event.nombre || '';
          const evConfig = (event.config || {}) as EventConfig;
          const normalizedBulkTemplate = getBulkTemplateColumnsFromConfig(evConfig);
          const hasTemplateSignal = hasBulkTemplateSignalInConfig(evConfig);
          if (normalizedBulkTemplate.length > 0) {
            hasCustomBulkTemplate = true;
            columns = normalizedBulkTemplate.map((col) => ({ ...col }));
          } else if (hasTemplateSignal) {
            return NextResponse.json(
              {
                error: 'El template bulk personalizado del evento tiene un formato inválido. Corrígelo en Super Admin antes de descargar.',
              },
              { status: 400 }
            );
          }

          if (!hasCustomBulkTemplate && event.form_fields && event.form_fields.length > 0) {
            // Fallback: generar columnas a partir de form_fields (excluyendo 'file' y 'foto')
            columns = event.form_fields
              .filter(f => f.type !== 'file' && f.key !== 'foto_url')
              .map(f => {
                // Extraer opciones de campos select
                let opts: string[] | undefined;
                if (f.type === 'select' && f.options && f.options.length > 0) {
                  opts = f.options.map((o: string | { value: string; label: string }) =>
                    typeof o === 'string' ? o : o.value
                  );
                }
                return {
                  key: f.key,
                  header: f.label,
                  required: f.required,
                  example: getFieldExample(f.key, f.type),
                  width: f.key === 'email' ? 28 : (f.key === 'rut' || f.key === 'document_number') ? 20 : 20,
                  ...(opts ? { options: opts } : {}),
                };
              });

            const hasDocumentType = columns.some(c => c.key === 'document_type');
            const hasDocumentNumber = columns.some(c => c.key === 'document_number' || c.key === 'rut');
            if (!hasDocumentType) {
              columns = [
                { key: 'document_type', header: 'Tipo Documento', required: true, example: 'rut', width: 20, options: ['rut', 'dni_extranjero'] },
                ...columns,
              ];
            }
            if (!hasDocumentNumber) {
              columns = [
                ...columns,
                { key: 'document_number', header: 'Documento', required: true, example: '12.345.678-9', width: 20 },
              ];
            }
          }
        }
      } catch {
        // Si falla obtener el evento, usar default
      }
    }

    // ── Auto-inyectar columna Zona solo en fallback (no tocar template custom) ──
    if (event && !hasCustomBulkTemplate) {
      try {
        const cfg = (event.config || {}) as EventConfig;
        const zonas = cfg.zonas || [];
        const hasZonaCol = columns.some(c => c.key === 'zona');
        if (zonas.length > 0 && !hasZonaCol) {
          columns = [
            ...columns,
            {
              key: 'zona',
              header: 'Zona',
              required: false,
              example: zonas[0] || '',
              width: 22,
              options: zonas,
            },
          ];
        }
      } catch { /* ignore */ }
    }

    const wb = new ExcelJS.Workbook();
    const wsName = safeWorksheetName(eventName || 'Acreditados');
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

    // Aplicar data validation (lista desplegable) para columnas con options
    columns.forEach((col, colIdx) => {
      if (col.options && col.options.length > 0) {
        const escapedOptions = col.options
          .map(opt => String(opt).replace(/"/g, '""'))
          .join(',');
        // Excel tiene límite práctico para listas inline; evitar archivos corruptos
        if (!escapedOptions || escapedOptions.length > 250) return;

        const colNumber = colIdx + 1;
        // Aplicar validación a filas 2..1000 (excluyendo header)
        for (let rowNum = 2; rowNum <= 1000; rowNum++) {
          const cell = ws.getCell(rowNum, colNumber);
          cell.dataValidation = {
            type: 'list',
            allowBlank: !col.required,
            formulae: [`"${escapedOptions}"`],
            showErrorMessage: true,
            errorTitle: 'Valor no válido',
            error: `Selecciona una opción: ${col.options.join(', ')}`,
          };
        }
      }
    });

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
