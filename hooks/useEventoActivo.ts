// hooks/useEventoActivo.ts
// Hook simple para cargar el evento activo con todos los datos del tenant
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { EventoCompleto } from '../types/database';

interface UseEventoActivoReturn {
  evento: EventoCompleto | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isAccreditationOpen: boolean;
}

/**
 * Hook para cargar el evento activo de un tenant con todos sus datos.
 * Incluye información del tenant (colores, logos) y del oponente.
 * 
 * @param tenantSlug - El slug del tenant (ej: 'cruzados')
 * @returns Evento completo con datos del tenant y oponente
 */
export function useEventoActivo(tenantSlug: string): UseEventoActivoReturn {
  const [evento, setEvento] = useState<EventoCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvento = useCallback(async () => {
    if (!tenantSlug) {
      setError('Slug de tenant no proporcionado');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Usar la vista v_evento_completo si existe, sino hacer JOIN manual
      const { data, error: queryError } = await supabase
        .from('v_evento_completo')
        .select('*')
        .eq('tenant_slug', tenantSlug)
        .eq('is_active', true)
        .order('fecha', { ascending: false })
        .limit(1)
        .single();

      if (queryError) {
        // Si la vista no existe o no hay datos, hacer el query manual
        const manualResult = await fetchEventoManual(tenantSlug);
        if (manualResult) {
          setEvento(manualResult);
        } else {
          setError('Tenant no encontrado');
        }
      } else {
        setEvento(data as EventoCompleto);
      }
    } catch (err) {
      console.error('Error fetching evento:', err);
      // Intentar query manual como fallback
      try {
        const manualResult = await fetchEventoManual(tenantSlug);
        if (manualResult) {
          setEvento(manualResult);
        } else {
          setError('Tenant no encontrado');
        }
      } catch {
        setError(err instanceof Error ? err.message : 'Error al cargar el evento');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchEvento();
  }, [fetchEvento]);

  // Verificar si la acreditación está abierta
  const isAccreditationOpen = evento?.fecha_limite_acreditacion
    ? new Date(evento.fecha_limite_acreditacion) > new Date()
    : true; // Si no hay fecha límite, está abierta

  return {
    evento,
    loading,
    error,
    refetch: fetchEvento,
    isAccreditationOpen,
  };
}

/**
 * Query manual si la vista no existe
 */
async function fetchEventoManual(tenantSlug: string): Promise<EventoCompleto | null> {
  // Primero obtener el tenant
  const { data: tenant, error: tenantError } = await supabase
    .from('mt_tenants')
    .select('*')
    .eq('slug', tenantSlug)
    .single();

  if (tenantError || !tenant) return null;

  // Luego obtener el evento activo
  const { data: evento, error: eventoError } = await supabase
    .from('mt_eventos')
    .select('*')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('fecha', { ascending: false })
    .limit(1)
    .single();

  // Si no hay evento, devolver solo datos del tenant con evento vacío
  if (eventoError || !evento) {
    return {
      evento_id: 0,
      evento_nombre: 'Sin evento activo',
      descripcion: null,
      fecha: null,
      hora: null,
      venue: null,
      league: null,
      fecha_limite_acreditacion: null,
      is_active: false,
      // Tenant
      tenant_id: tenant.id,
      tenant_slug: tenant.slug,
      tenant_nombre: tenant.nombre,
      tenant_logo: tenant.logo_url,
      color_primario: tenant.color_primario,
      color_secundario: tenant.color_secundario,
      color_light: tenant.color_light,
      color_dark: tenant.color_dark,
      shield_url: tenant.shield_url,
      background_url: tenant.background_url,
      arena_logo_url: tenant.arena_logo_url,
      arena_nombre: tenant.arena_nombre,
      social_facebook: tenant.social_facebook,
      social_twitter: tenant.social_twitter,
      social_instagram: tenant.social_instagram,
      social_youtube: tenant.social_youtube,
      // Sin oponente
      opponent_id: null,
      opponent_slug: null,
      opponent_nombre: null,
      opponent_logo: null,
      opponent_shield_url: null,
      opponent_color_primario: null,
    };
  }

  // Si hay oponente, obtenerlo
  let opponent = null;
  if (evento.opponent_tenant_id) {
    const { data: opp } = await supabase
      .from('mt_tenants')
      .select('*')
      .eq('id', evento.opponent_tenant_id)
      .single();
    opponent = opp;
  }

  // Construir el objeto EventoCompleto
  return {
    evento_id: evento.id,
    evento_nombre: evento.nombre,
    descripcion: evento.descripcion,
    fecha: evento.fecha,
    hora: evento.hora,
    venue: evento.venue,
    league: evento.league,
    fecha_limite_acreditacion: evento.fecha_limite_acreditacion,
    is_active: evento.is_active,
    // Tenant
    tenant_id: tenant.id,
    tenant_slug: tenant.slug,
    tenant_nombre: tenant.nombre,
    tenant_logo: tenant.logo_url,
    color_primario: tenant.color_primario,
    color_secundario: tenant.color_secundario,
    color_light: tenant.color_light,
    color_dark: tenant.color_dark,
    shield_url: tenant.shield_url,
    background_url: tenant.background_url,
    arena_logo_url: tenant.arena_logo_url,
    arena_nombre: tenant.arena_nombre,
    social_facebook: tenant.social_facebook,
    social_twitter: tenant.social_twitter,
    social_instagram: tenant.social_instagram,
    social_youtube: tenant.social_youtube,
    // Oponente
    opponent_id: opponent?.id ?? null,
    opponent_slug: opponent?.slug ?? null,
    opponent_nombre: opponent?.nombre ?? null,
    opponent_logo: opponent?.logo_url ?? null,
    opponent_shield_url: opponent?.shield_url ?? null,
    opponent_color_primario: opponent?.color_primario ?? null,
  };
}

export default useEventoActivo;
