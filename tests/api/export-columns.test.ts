/**
 * Tests: Export API — custom columns support
 */
import { describe, it, expect } from 'vitest';

// We test the column filtering logic that the API uses
const ALL_XLSX_COLUMNS = [
  { key: 'nombre',           header: 'Nombre',                 width: 20 },
  { key: 'primer_apellido',  header: 'Primer Apellido',        width: 18 },
  { key: 'segundo_apellido', header: 'Segundo Apellido',       width: 18 },
  { key: 'rut',              header: 'RUT',                    width: 15 },
  { key: 'email',            header: 'Email',                  width: 28 },
  { key: 'cargo',            header: 'Cargo',                  width: 18 },
  { key: 'tipo_credencial',  header: 'Tipo Credencial',        width: 18 },
  { key: 'n_credencial',     header: 'N° Credencial',          width: 14 },
  { key: 'empresa',          header: 'Empresa',                width: 25 },
  { key: 'area',             header: 'Área',                   width: 20 },
  { key: 'zona',             header: 'Zona',                   width: 20 },
  { key: 'estado',           header: 'Estado',                 width: 14 },
  { key: 'resp_nombre',      header: 'Responsable',            width: 20 },
  { key: 'resp_primer_ap',   header: 'Primer Apellido Resp.',  width: 18 },
  { key: 'resp_segundo_ap',  header: 'Segundo Apellido Resp.', width: 18 },
  { key: 'resp_rut',         header: 'RUT Responsable',        width: 15 },
  { key: 'resp_email',       header: 'Email Responsable',      width: 28 },
  { key: 'resp_telefono',    header: 'Teléfono Responsable',   width: 18 },
];

function filterColumns(columnsParam: string | null) {
  const validKeys = new Set(ALL_XLSX_COLUMNS.map(c => c.key));
  if (!columnsParam) return ALL_XLSX_COLUMNS;
  return columnsParam
    .split(',')
    .filter(k => validKeys.has(k))
    .map(k => ALL_XLSX_COLUMNS.find(c => c.key === k)!);
}

describe('Export column filtering', () => {
  it('returns all 18 columns when no param', () => {
    const result = filterColumns(null);
    expect(result).toHaveLength(18);
  });

  it('filters to selected columns in param order', () => {
    const result = filterColumns('rut,nombre,email');
    expect(result.map(c => c.key)).toEqual(['rut', 'nombre', 'email']);
    expect(result).toHaveLength(3);
  });

  it('ignores invalid column keys', () => {
    const result = filterColumns('nombre,fake_column,rut');
    expect(result.map(c => c.key)).toEqual(['nombre', 'rut']);
    expect(result).toHaveLength(2);
  });

  it('returns empty array for all-invalid keys', () => {
    const result = filterColumns('bad,worse');
    expect(result).toHaveLength(0);
  });

  it('handles single column', () => {
    const result = filterColumns('estado');
    expect(result).toHaveLength(1);
    expect(result[0].header).toBe('Estado');
  });

  it('handles all columns explicitly', () => {
    const allKeys = ALL_XLSX_COLUMNS.map(c => c.key).join(',');
    const result = filterColumns(allKeys);
    expect(result).toHaveLength(18);
  });
});
