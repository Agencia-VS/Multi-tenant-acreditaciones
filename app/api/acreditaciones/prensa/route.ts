import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";


interface Acreditado {
  nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  rut: string;
  email: string;
  cargo: string;
  tipo_credencial: string;
  numero_credencial: string;
}

interface AccreditacionRequest {
  responsable_nombre: string;
  responsable_primer_apellido: string;
  responsable_segundo_apellido: string;
  responsable_rut: string;
  responsable_email: string;
  responsable_telefono: string;
  empresa: string;
  area: string;
  acreditados: Acreditado[];
}

// Fallback areas data in case Supabase table doesn't exist
const FALLBACK_AREAS = [
  { id: 1, codigo: "prensa", cupo_maximo: 50, evento_id: 1 },
  { id: 2, codigo: "seguridad", cupo_maximo: 30, evento_id: 1 },
  { id: 3, codigo: "produccion", cupo_maximo: 40, evento_id: 1 },
  { id: 4, codigo: "catering", cupo_maximo: 20, evento_id: 1 },
];

type CupoRuleScope = "evento-empresa" | "evento-general" | "global-empresa" | "global-general";
type CupoRule = { cupo_maximo: number; scope: CupoRuleScope };

function getTipoMedio(acreditado: Acreditado): string {
  return (acreditado.tipo_credencial || acreditado.cargo || "").trim();
}

async function resolveCupoRule(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  tenantId: string;
  eventoId: number;
  area: string;
  tipoMedio: string;
  empresa: string;
}): Promise<CupoRule | null> {
  const { supabaseAdmin, tenantId, eventoId, area, tipoMedio, empresa } = params;
  const searchOrder: Array<{ scope: CupoRuleScope; eventoId: number | null; empresa: string }> = [
    { scope: "evento-empresa", eventoId, empresa },
    { scope: "evento-general", eventoId, empresa: "*" },
    { scope: "global-empresa", eventoId: null, empresa },
    { scope: "global-general", eventoId: null, empresa: "*" },
  ];

  for (const candidate of searchOrder) {
    let query = supabaseAdmin
      .from("mt_reglas_cupo")
      .select("cupo_maximo")
      .eq("tenant_id", tenantId)
      .eq("activo", true)
      .ilike("area", area)
      .ilike("tipo_medio", tipoMedio)
      .order("prioridad", { ascending: true })
      .limit(1);

    query = candidate.eventoId === null
      ? query.is("evento_id", null)
      : query.eq("evento_id", candidate.eventoId);

    query = candidate.empresa === "*"
      ? query.eq("empresa", "*")
      : query.ilike("empresa", empresa);

    const { data, error } = await query.single();
    if (error) {
      if (error.code === "PGRST116") {
        continue;
      }
      throw error;
    }

    if (data) {
      return { cupo_maximo: data.cupo_maximo, scope: candidate.scope };
    }
  }

  return null;
}

export async function POST(req: Request) {
  // Cliente anónimo para INSERT
  const supabaseAnon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // Cliente con service role para SELECT (sin restricciones RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // --- 1. Identificar tenant (subdominio o query param) ---
    const url = new URL(req.url);
    let tenantSlug = url.searchParams.get('tenant') || '';
    if (!tenantSlug) {
      // Extraer subdominio de host
      const host = req.headers.get('host') || '';
      const mainDomain = process.env.NEXT_PUBLIC_MAIN_DOMAIN || 'midominio.cl';
      if (host.endsWith(mainDomain)) {
        const sub = host.replace('.' + mainDomain, '');
        if (sub && sub !== host) tenantSlug = sub;
      } else if (host.match(/^([^.]+)\.localhost/)) {
        tenantSlug = host.split('.')[0];
      }
    }
    if (!tenantSlug) {
      return NextResponse.json({ error: 'No se pudo identificar el tenant.' }, { status: 400 });
    }

    // Buscar el tenant en la base de datos
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('mt_tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();
    if (tenantError || !tenant) {
      return NextResponse.json({ error: 'Tenant no válido o no existe.', details: tenantError?.message }, { status: 400 });
    }
    const tenant_id = tenant.id;

    // --- 2. Parsear body ---
    const data: AccreditacionRequest = await req.json();
    const {
      responsable_nombre,
      responsable_primer_apellido,
      responsable_segundo_apellido,
      responsable_rut,
      responsable_email,
      responsable_telefono,
      empresa,
      area,
      acreditados
    } = data;

    // Validaciones básicas
    if (!responsable_email || !responsable_nombre || !responsable_rut || !empresa || !area || !acreditados.length) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    // 1. Obtener información de áreas (multi-tenant)
    type AreaPrensa = { id: number; nombre: string; cupo_maximo: number; evento_id: number };
    let areasData: AreaPrensa[] = [];
    try {
      const { data, error: areasError } = await supabaseAdmin
        .from('mt_areas_prensa')
        .select('id, nombre, cupo_maximo, evento_id')
        .eq('tenant_id', tenant_id);
      if (areasError) {
        console.warn('Error al acceder a mt_areas_prensa:', areasError.message);
        areasData = [];
      } else {
        areasData = data || [];
      }
    } catch (err) {
      console.warn('Error al consultar áreas:', err);
      areasData = [];
    }

    // 2. Validar cupos por reglas (empresa + tipo medio + area)
    // IMPORTANTE: Contar existentes y considerar que estamos insertando múltiples
    const areaRecord = areasData?.find((a: AreaPrensa) => a.nombre === area);
    
    if (!areaRecord) {
      return NextResponse.json(
        { error: `Área ${area} no encontrada` },
        { status: 400 }
      );
    }


    const requestedByTipoMedio = new Map<string, number>();
    acreditados.forEach((acreditado) => {
      const tipoMedio = getTipoMedio(acreditado);
      const key = tipoMedio || "*";
      requestedByTipoMedio.set(key, (requestedByTipoMedio.get(key) || 0) + 1);
    });

    for (const [tipoMedio, requestedCount] of requestedByTipoMedio.entries()) {
      const rule = await resolveCupoRule({
        supabaseAdmin,
        tenantId: tenant_id,
        eventoId: areaRecord.evento_id,
        area,
        tipoMedio,
        empresa,
      });

      if (!rule) {
        continue;
      }

      const { count: countAll, error: countError1 } = await supabaseAdmin
        .from("mt_acreditados")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("evento_id", areaRecord.evento_id)
        .ilike("empresa", empresa)
        .ilike("area", area)
        .ilike("tipo_credencial", tipoMedio);
      if (countError1) throw countError1;

      const { count: countRechazados, error: countError2 } = await supabaseAdmin
        .from("mt_acreditados")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant_id)
        .eq("evento_id", areaRecord.evento_id)
        .ilike("empresa", empresa)
        .ilike("area", area)
        .ilike("tipo_credencial", tipoMedio)
        .eq("status", "rechazado");
      if (countError2) throw countError2;

      const currentCount = (countAll || 0) - (countRechazados || 0);
      const totalAfterInsert = currentCount + requestedCount;

      if (totalAfterInsert > rule.cupo_maximo) {
        return NextResponse.json(
          {
            error: `No hay cupos disponibles para ${empresa} en el área ${area} (${tipoMedio}). Máximo: ${rule.cupo_maximo}, Acreditados existentes: ${currentCount}, Solicitados: ${requestedCount}, Total: ${totalAfterInsert}`,
            area,
            empresa,
            tipo_medio: tipoMedio,
            cupos_disponibles: Math.max(0, rule.cupo_maximo - currentCount),
            cupo_maximo: rule.cupo_maximo,
            acreditados_existentes: currentCount,
            acreditados_solicitados: requestedCount,
            regla_scope: rule.scope,
          },
          { status: 400 }
        );
      }
    }

    // 3. Insertar acreditados

    // 3. Insertar acreditados en mt_acreditados
    const acreditadosToInsert = acreditados.map((acreditado: any) => ({
      tenant_id,
      evento_id: areaRecord?.evento_id,
      nombre: acreditado.nombre,
      apellido: `${acreditado.primer_apellido || ''} ${acreditado.segundo_apellido || ''}`.trim(),
      rut: acreditado.rut,
      email: acreditado.email,
      cargo: acreditado.cargo,
      tipo_credencial: acreditado.tipo_credencial,
      empresa: empresa,
      area: area,
      status: 'pendiente',
      motivo_rechazo: null,
      zona_id: acreditado.zona_id || null,
      responsable_nombre,
      responsable_email,
      responsable_telefono,
      updated_at: new Date().toISOString(),
    }));


    const { error: insertError } = await supabaseAnon
      .from('mt_acreditados')
      .insert(acreditadosToInsert);


    if (insertError) throw insertError;

    // 4. Crear o actualizar perfil del responsable (para auto-fill futuro)
    try {
      // Intentar usar la función de Supabase si existe
      const perfilResult = await supabaseAdmin.rpc('get_or_create_perfil', {
        p_user_id: null, // Sin usuario autenticado desde la API
        p_rut: responsable_rut,
        p_nombre: responsable_nombre,
        p_apellido: responsable_primer_apellido + (responsable_segundo_apellido ? ` ${responsable_segundo_apellido}` : ''),
        p_email: responsable_email,
        p_empresa: empresa,
        p_cargo: null,
        p_telefono: responsable_telefono || null,
        p_nacionalidad: 'Chile',
      });
      
      if (perfilResult.error) {
        // Si la función no existe, intentar upsert directo
        console.warn('get_or_create_perfil no disponible, intentando upsert directo:', perfilResult.error.message);
        
        // Upsert directo en la tabla
        await supabaseAdmin
          .from('mt_perfiles_acreditados')
          .upsert({
            rut: responsable_rut,
            nombre: responsable_nombre,
            apellido: responsable_primer_apellido + (responsable_segundo_apellido ? ` ${responsable_segundo_apellido}` : ''),
            email: responsable_email,
            empresa: empresa,
            telefono: responsable_telefono || null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'rut',
            ignoreDuplicates: false,
          });
      }
    } catch (perfilError) {
      // No fallar si el perfil no se puede crear (tabla puede no existir aún)
      console.warn('No se pudo crear/actualizar perfil:', perfilError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Acreditación enviada correctamente",
        acreditados_insertados: acreditados.length,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : error,
      },
      { status: 500 }
    );
  }
}
