import { NextRequest, NextResponse } from "next/server";
import * as ExcelJS from "exceljs";
import * as XLSX from 'xlsx';
import { createClient } from "@supabase/supabase-js";

// Tipos para los datos multi-tenant
interface Acreditado {
  id: number;
  nombre: string;
  apellido?: string;
  rut?: string;
  email?: string;
  cargo?: string;
  tipo_credencial?: string;
  numero_credencial?: string;
  empresa?: string;
  area?: string;
  zona_id?: number;
  status: string;
  motivo_rechazo?: string;
  responsable_nombre?: string;
  responsable_email?: string;
  responsable_telefono?: string;
  updated_at: string;
}

interface Zona {
  id: number;
  nombre: string;
}

export async function GET(request: NextRequest, context: { params: Promise<{ tenant: string }> }) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // --- 1. Identificar tenant (slug) ---
    const { tenant } = await context.params;
    const tenantSlug = tenant;
    if (!tenantSlug) {
      return NextResponse.json({ error: 'No se pudo identificar el tenant.' }, { status: 400 });
    }
    // Buscar el tenant en la base de datos
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from('mt_tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();
    if (tenantError || !tenantData) {
      return NextResponse.json({ error: 'Tenant no válido o no existe.', details: tenantError?.message }, { status: 400 });
    }
    const tenant_id = tenantData.id;

    // --- 2. Validar admin ---
    // Obtener user_id del header Authorization (Bearer <user_id>)
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado. Falta token.' }, { status: 401 });
    }
    const user_id = authHeader.replace('Bearer ', '').trim();
    // Validar que el user_id sea admin de este tenant
    const { data: adminTenant, error: adminError } = await supabaseAdmin
      .from('mt_admin_tenants')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user_id)
      .eq('rol', 'admin')
      .single();
    if (adminError || !adminTenant) {
      return NextResponse.json({ error: 'No autorizado. No es admin de este tenant.' }, { status: 403 });
    }

    // --- 3. Parámetros de filtro ---
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "completo";
    const statusFilter = searchParams.get("status") || "all";
    const evento_id = searchParams.get("evento_id");
    if (!evento_id) {
      return NextResponse.json({ error: 'Falta evento_id.' }, { status: 400 });
    }

    // --- 4. Consultar acreditados multi-tenant ---
    let query = supabaseAdmin
      .from("mt_acreditados")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("evento_id", evento_id);
    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    const { data: acreditados, error: acreditadosError } = await query;
    if (acreditadosError) throw new Error(acreditadosError.message);
    if (!acreditados || acreditados.length === 0) {
      return NextResponse.json({ error: "No hay datos para exportar" }, { status: 404 });
    }

    // --- 5. Consultar zonas multi-tenant ---
    const { data: zonas } = await supabaseAdmin
      .from("mt_zonas_acreditacion")
      .select("id, nombre")
      .eq("tenant_id", tenant_id)
      .eq("evento_id", evento_id);
    const zonasMap = new Map(zonas?.map((z: Zona) => [z.id, z.nombre]) || []);

    const dateStr = new Date().toISOString().split("T")[0];

    // --- 6. Exportar CSV plano (puntoticket) ---
    if (format === "puntoticket") {
      const csvData = acreditados.map((a: Acreditado) => ({
        Nombre: a.nombre,
        Apellido: a.apellido || '',
        RUT: a.rut || '',
        Empresa: a.empresa || '',
        Área: a.area || '',
        Acreditación: a.zona_id ? zonasMap.get(a.zona_id) || "Sin asignar" : "Sin asignar",
        Patente: "",
      }));
      const ws = XLSX.utils.json_to_sheet(csvData);
      const csvContent = XLSX.utils.sheet_to_csv(ws);
      const encoder = new TextEncoder();
      const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
      const csvUint8 = encoder.encode(csvContent);
      const combined = new Uint8Array(bom.length + csvUint8.length);
      combined.set(bom);
      combined.set(csvUint8, bom.length);
      return new NextResponse(combined, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="acreditados_puntoticket_${dateStr}.csv"`,
        },
      });
    }
    // --- 7. Exportar Excel completo ---
    else {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Acreditados');
      worksheet.columns = [
        { key: 'nombre', header: 'Nombre', width: 20 },
        { key: 'apellido', header: 'Apellido', width: 25 },
        { key: 'rut', header: 'RUT', width: 18 },
        { key: 'email', header: 'Email', width: 30 },
        { key: 'cargo', header: 'Cargo', width: 20 },
        { key: 'tipo_credencial', header: 'Tipo Credencial', width: 20 },
        { key: 'numero_credencial', header: 'N° Credencial', width: 15 },
        { key: 'empresa', header: 'Empresa', width: 25 },
        { key: 'area', header: 'Área', width: 20 },
        { key: 'zona', header: 'Zona', width: 25 },
        { key: 'status', header: 'Estado', width: 15 },
        { key: 'motivo_rechazo', header: 'Motivo Rechazo', width: 25 },
        { key: 'responsable_nombre', header: 'Responsable', width: 25 },
        { key: 'responsable_email', header: 'Email Responsable', width: 30 },
        { key: 'responsable_telefono', header: 'Teléfono Responsable', width: 20 },
        { key: 'updated_at', header: 'Actualizado', width: 20 },
      ];
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E5799' } };
      worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
      acreditados.forEach((a: Acreditado) => {
        worksheet.addRow({
          nombre: a.nombre,
          apellido: a.apellido || '',
          rut: a.rut || '',
          email: a.email || '',
          cargo: a.cargo || '',
          tipo_credencial: a.tipo_credencial || '',
          numero_credencial: a.numero_credencial || '',
          empresa: a.empresa || '',
          area: a.area || '',
          zona: a.zona_id ? zonasMap.get(a.zona_id) || "Sin asignar" : "Sin asignar",
          status: a.status.charAt(0).toUpperCase() + a.status.slice(1),
          motivo_rechazo: a.motivo_rechazo || '',
          responsable_nombre: a.responsable_nombre || '',
          responsable_email: a.responsable_email || '',
          responsable_telefono: a.responsable_telefono || '',
          updated_at: a.updated_at,
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="acreditados_completo_${dateStr}.xlsx"`,
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
