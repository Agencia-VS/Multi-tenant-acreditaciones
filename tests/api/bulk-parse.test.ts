/**
 * Tests: API /api/bulk/parse — generación de plantilla dinámica
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetEventById = vi.fn();

const workbookState = vi.hoisted(() => ({
  lastWorksheet: null as { columns: Array<{ header: string; key: string; width: number }> } | null,
}));

vi.mock('exceljs', () => ({
  default: {
    Workbook: class MockWorkbook {
      public xlsx = {
        writeBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      };

      addWorksheet(_name: string) {
        class MockWorksheet {
          columns: Array<{ header: string; key: string; width: number }> = [];
          private cells = new Map<string, { dataValidation?: unknown }>();

          getRow(rowNum: number) {
            if (rowNum !== 1) {
              return {
                eachCell: (_cb: (cell: { font?: unknown; fill?: unknown }, colNum: number) => void) => undefined,
              };
            }

            return {
              eachCell: (cb: (cell: { font?: unknown; fill?: unknown }, colNum: number) => void) => {
                this.columns.forEach((_, idx) => cb({}, idx + 1));
              },
            };
          }

          getCell(rowNum: number, colNum: number) {
            const key = `${rowNum}:${colNum}`;
            if (!this.cells.has(key)) this.cells.set(key, {});
            return this.cells.get(key)!;
          }

          addRow(_row: Record<string, string> | Record<string, never>) {
            return {
              getCell: (_col: number) => ({
                value: '',
                font: {},
              }),
            };
          }
        }

        const ws = new MockWorksheet();
        workbookState.lastWorksheet = ws;
        return ws;
      }
    },
  },
}));

vi.mock('@/lib/services', () => ({
  getEventById: (...args: unknown[]) => mockGetEventById(...args),
}));

import { GET } from '@/app/api/bulk/parse/route';

describe('GET /api/bulk/parse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workbookState.lastWorksheet = null;
  });

  it('uses custom bulk template as-is (same order, no fallback extras)', async () => {
    mockGetEventById.mockResolvedValue({
      id: 'event-1',
      nombre: 'Evento Clonado',
      config: {
        zonas: ['Staff', 'VIP'],
        bulk_template_columns: [
          { key: 'email', header: 'Email', required: true, width: 30 },
          { key: 'nombre', header: 'Nombre', required: true, width: 20 },
        ],
      },
      form_fields: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
        { key: 'cargo', label: 'Cargo', type: 'text', required: false },
      ],
    });

    const req = new NextRequest('http://localhost/api/bulk/parse?tenant=uc&color=112233&event_id=event-1');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetEventById).toHaveBeenCalledTimes(1);

    const keys = (workbookState.lastWorksheet?.columns || []).map(c => c.key);
    expect(keys).toEqual(['email', 'nombre']);
  });

  it('returns 400 when custom bulk template signal exists but is invalid', async () => {
    mockGetEventById.mockResolvedValue({
      id: 'event-2',
      nombre: 'Evento Inválido',
      config: {
        bulk_template_columns: '{not-json}',
      },
      form_fields: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true },
      ],
    });

    const req = new NextRequest('http://localhost/api/bulk/parse?event_id=event-2');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('template bulk personalizado');
  });
});
