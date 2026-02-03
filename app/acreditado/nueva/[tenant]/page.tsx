'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { 
  PerfilConEquipo, 
  PersonaFrecuente, 
  EventoBasico, 
  TenantBasico,
  FormPersonaAcreditacion
} from '../../../../types/acreditado';

const initialFormData: FormPersonaAcreditacion = {
  nombre: '',
  apellido: '',
  rut: '',
  email: '',
  telefono: '',
  cargo: '',
  tipo_medio: 'Periodista',
  nacionalidad: 'Chilena',
};

const tiposMedio = [
  'Periodista',
  'Fotógrafo',
  'Camarógrafo',
  'Productor',
  'Editor',
  'Comentarista',
  'Técnico',
  'Otro',
];

export default function NuevaAcreditacionPage() {
  const router = useRouter();
  const params = useParams();
  const tenantSlug = params.tenant as string;

  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilConEquipo | null>(null);
  const [tenant, setTenant] = useState<TenantBasico | null>(null);
  const [evento, setEvento] = useState<EventoBasico | null>(null);
  const [frecuentes, setFrecuentes] = useState<PersonaFrecuente[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormPersonaAcreditacion>(initialFormData);
  const [acreditadosLista, setAcreditadosLista] = useState<FormPersonaAcreditacion[]>([]);
  const [showAddFrecuente, setShowAddFrecuente] = useState(false);
  const [searchFrecuente, setSearchFrecuente] = useState('');

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push(`/auth/acreditado?returnTo=/acreditado/nueva/${tenantSlug}`);
        return;
      }

      setUser(session.user);

      // Cargar perfil con equipo frecuente
      let { data: perfilData } = await supabase
        .from('mt_perfiles_acreditados')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      // Si no tiene perfil, intentar crearlo con datos del usuario
      if (!perfilData && session.user.user_metadata) {
        const meta = session.user.user_metadata;
        // Generar RUT temporal si no existe (la BD lo requiere)
        const rutValue = meta.rut || `TEMP-${session.user.id.substring(0, 8)}`;
        
        const { data: newPerfil, error: createError } = await supabase
          .from('mt_perfiles_acreditados')
          .insert({
            user_id: session.user.id,
            nombre: meta.nombre || session.user.email?.split('@')[0] || 'Usuario',
            apellido: meta.apellido || '',
            email: session.user.email || '',
            empresa: meta.empresa || null,
            telefono: meta.telefono || null,
            rut: rutValue,
            nacionalidad: 'Chile',
          })
          .select()
          .single();

        if (!createError && newPerfil) {
          perfilData = newPerfil;
        } else if (createError) {
          console.warn('Error creando perfil:', createError.message);
        }
      }

      if (perfilData) {
        setPerfil(perfilData);
        // Cargar frecuentes desde JSONB
        setFrecuentes(perfilData.equipo_frecuente || []);
      }

      // Cargar tenant
      const { data: tenantData } = await supabase
        .from('mt_tenants')
        .select('id, nombre, slug, shield_url, color_primario')
        .eq('slug', tenantSlug)
        .single();

      if (tenantData) {
        setTenant(tenantData);

        // Cargar evento activo del tenant (priorizar próximos, luego cualquier activo)
        const today = new Date().toISOString().split('T')[0];
        
        // Primero: eventos futuros activos
        let { data: eventoData } = await supabase
          .from('mt_eventos')
          .select('id, nombre, fecha, hora, venue, fecha_limite_acreditacion')
          .eq('tenant_id', tenantData.id)
          .eq('is_active', true)
          .gte('fecha', today)
          .order('fecha', { ascending: true })
          .limit(1)
          .single();

        // Si no hay futuros, buscar cualquier evento activo
        if (!eventoData) {
          const { data: eventoActivo } = await supabase
            .from('mt_eventos')
            .select('id, nombre, fecha, hora, venue, fecha_limite_acreditacion')
            .eq('tenant_id', tenantData.id)
            .eq('is_active', true)
            .order('fecha', { ascending: false })
            .limit(1)
            .single();
          
          eventoData = eventoActivo;
        }

        // Si aún no hay, buscar el más reciente del tenant
        if (!eventoData) {
          const { data: eventoReciente } = await supabase
            .from('mt_eventos')
            .select('id, nombre, fecha, hora, venue, fecha_limite_acreditacion')
            .eq('tenant_id', tenantData.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          
          eventoData = eventoReciente;
        }

        if (eventoData) {
          setEvento(eventoData);
        }
      }

      setLoading(false);
    };

    loadData();
  }, [router, tenantSlug]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Agregar persona desde frecuentes
  const addFromFrecuente = (frecuente: PersonaFrecuente) => {
    const newAcreditado: FormPersonaAcreditacion = {
      nombre: frecuente.nombre,
      apellido: frecuente.apellido,
      rut: frecuente.rut || '',
      email: frecuente.email || '',
      telefono: frecuente.telefono || '',
      cargo: frecuente.cargo || '',
      tipo_medio: frecuente.tipo_medio || 'Periodista',
      nacionalidad: frecuente.nacionalidad || 'Chilena',
    };
    setAcreditadosLista(prev => [...prev, newAcreditado]);
  };

  // Agregar persona desde formulario manual
  const addFromForm = () => {
    if (!formData.nombre || !formData.apellido) {
      setError('Nombre y apellido son requeridos');
      return;
    }
    setAcreditadosLista(prev => [...prev, { ...formData }]);
    setFormData(initialFormData);
    setError(null);
  };

  // Quitar persona de la lista
  const removeFromList = (index: number) => {
    setAcreditadosLista(prev => prev.filter((_, i) => i !== index));
  };

  // Guardar como frecuente en JSONB
  const saveAsFrecuente = async (data: FormPersonaAcreditacion) => {
    if (!perfil) return;
    
    // Verificar si ya existe (por RUT o por nombre+apellido)
    const yaExiste = frecuentes.some(f => 
      (f.rut && f.rut === data.rut) || 
      (f.nombre === data.nombre && f.apellido === data.apellido)
    );
    
    if (yaExiste) {
      setError('Esta persona ya está en tu equipo frecuente');
      return;
    }

    const nuevoFrecuente: PersonaFrecuente = {
      id: crypto.randomUUID(),
      nombre: data.nombre,
      apellido: data.apellido,
      rut: data.rut || null,
      email: data.email || null,
      telefono: data.telefono || null,
      cargo: data.cargo || null,
      empresa: perfil.empresa,
      nacionalidad: data.nacionalidad || null,
      tipo_medio: data.tipo_medio || null,
      veces_usado: 0,
    };

    const nuevoEquipo = [...frecuentes, nuevoFrecuente];

    // Guardar en BD
    const { error: updateError } = await supabase
      .from('mt_perfiles_acreditados')
      .update({ equipo_frecuente: nuevoEquipo })
      .eq('id', perfil.id);

    if (updateError) {
      setError('Error al guardar en equipo frecuente');
      return;
    }

    setFrecuentes(nuevoEquipo);
    setSuccess('Persona agregada a tu equipo frecuente');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Enviar solicitudes
  const handleSubmit = async () => {
    if (acreditadosLista.length === 0) {
      setError('Agrega al menos una persona para acreditar');
      return;
    }

    if (!tenant || !evento || !perfil) {
      setError('Faltan datos del evento');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Crear acreditaciones para cada persona
      const acreditaciones = acreditadosLista.map(persona => ({
        tenant_id: tenant.id,
        evento_id: evento.id,
        nombre: persona.nombre,
        apellido: persona.apellido,
        rut: persona.rut || null,
        email: persona.email || null,
        cargo: persona.cargo || null,
        empresa: perfil.empresa,
        tipo_credencial: persona.tipo_medio,
        responsable_nombre: `${perfil.nombre} ${perfil.apellido}`,
        responsable_email: perfil.email,
        responsable_telefono: perfil.telefono,
        perfil_acreditado_id: perfil.id,
        status: 'pendiente',
      }));

      const { error: insertError } = await supabase
        .from('mt_acreditados')
        .insert(acreditaciones);

      if (insertError) throw insertError;

      // Actualizar contador de uso de frecuentes en JSONB
      const frecuentesActualizados = frecuentes.map(f => {
        const fueUsado = acreditadosLista.some(persona => 
          f.nombre === persona.nombre && f.apellido === persona.apellido
        );
        if (fueUsado) {
          return { ...f, veces_usado: (f.veces_usado || 0) + 1 };
        }
        return f;
      });

      // Si hubo cambios, actualizar en BD
      if (JSON.stringify(frecuentesActualizados) !== JSON.stringify(frecuentes)) {
        await supabase
          .from('mt_perfiles_acreditados')
          .update({ equipo_frecuente: frecuentesActualizados })
          .eq('id', perfil.id);
        setFrecuentes(frecuentesActualizados);
      }

      setSuccess(`¡${acreditadosLista.length} solicitud(es) enviada(s) correctamente!`);
      setAcreditadosLista([]);

      // Redirigir después de 2 segundos
      setTimeout(() => {
        router.push('/acreditado/dashboard');
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar solicitudes');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtrar frecuentes por búsqueda
  const filteredFrecuentes = frecuentes.filter(f => 
    `${f.nombre} ${f.apellido}`.toLowerCase().includes(searchFrecuente.toLowerCase()) ||
    f.rut?.includes(searchFrecuente) ||
    f.email?.toLowerCase().includes(searchFrecuente.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!perfil) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Completa tu perfil</h2>
          <p className="text-gray-500 mb-6">Necesitas completar tu perfil antes de solicitar acreditaciones</p>
          <Link 
            href="/acreditado/perfil"
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Completar Perfil
          </Link>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">🏟️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Club no encontrado</h2>
          <p className="text-gray-500 mb-6">El club &quot;{tenantSlug}&quot; no existe</p>
          <Link 
            href="/acreditado/dashboard"
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Sin eventos</h2>
          <p className="text-gray-500 mb-6">{tenant.nombre} no tiene eventos disponibles actualmente</p>
          <Link 
            href="/acreditado/dashboard"
            className="px-6 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <Link 
                href="/acreditado/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="flex items-center gap-3">
                {tenant.shield_url && (
                  <img src={tenant.shield_url} alt={tenant.nombre} className="w-10 h-10 object-contain" />
                )}
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">{tenant.nombre}</h1>
                  <p className="text-sm text-gray-500">{evento.nombre}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {evento.fecha && new Date(evento.fecha).toLocaleDateString('es-CL', { 
                  weekday: 'long', 
                  day: 'numeric', 
                  month: 'long' 
                })}
              </p>
              <p className="text-xs text-gray-500">{evento.venue}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Mensajes */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 flex items-center gap-3">
            <span>⚠️</span> {error}
          </div>
        )}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-600 flex items-center gap-3">
            <span>✅</span> {success}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Panel izquierdo: Frecuentes */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border p-5 sticky top-4">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>⭐</span> Acreditados Frecuentes
              </h2>

              {/* Búsqueda */}
              <input
                type="text"
                placeholder="Buscar por nombre, RUT..."
                value={searchFrecuente}
                onChange={(e) => setSearchFrecuente(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />

              {/* Lista de frecuentes */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {filteredFrecuentes.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <div className="text-3xl mb-2">👤</div>
                    <p className="text-sm">No tienes frecuentes aún</p>
                  </div>
                ) : (
                  filteredFrecuentes.map((frecuente) => (
                    <div 
                      key={frecuente.id}
                      className="p-3 border rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {frecuente.nombre} {frecuente.apellido}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {frecuente.cargo || frecuente.tipo_medio || 'Sin cargo'}
                          </p>
                        </div>
                        <button
                          onClick={() => addFromFrecuente(frecuente)}
                          className="ml-2 p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Agregar a la lista"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Panel central/derecho: Formulario y lista */}
          <div className="lg:col-span-2 space-y-6">
            {/* Formulario manual */}
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>✏️</span> Agregar Persona Manualmente
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido *</label>
                  <input
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Pérez"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">RUT</label>
                  <input
                    type="text"
                    name="rut"
                    value={formData.rut}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="12.345.678-9"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="correo@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="+56 9 1234 5678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cargo</label>
                  <input
                    type="text"
                    name="cargo"
                    value={formData.cargo}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Periodista deportivo"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Medio</label>
                  <select
                    name="tipo_medio"
                    value={formData.tipo_medio}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white"
                  >
                    {tiposMedio.map(tipo => (
                      <option key={tipo} value={tipo}>{tipo}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nacionalidad</label>
                  <input
                    type="text"
                    name="nacionalidad"
                    value={formData.nacionalidad}
                    onChange={handleChange}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="Chilena"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button
                  onClick={addFromForm}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar a la Lista
                </button>
                <button
                  onClick={() => {
                    addFromForm();
                    saveAsFrecuente(formData);
                  }}
                  className="px-4 py-2.5 border-2 border-blue-500 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
                  title="Agregar y guardar como frecuente"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  Guardar Frecuente
                </button>
              </div>
            </div>

            {/* Lista de personas a acreditar */}
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>📋</span> Lista para Acreditar
                  {acreditadosLista.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-sm rounded-full">
                      {acreditadosLista.length}
                    </span>
                  )}
                </h2>
              </div>

              {acreditadosLista.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-5xl mb-3">📝</div>
                  <p>Agrega personas usando el formulario o desde tus frecuentes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {acreditadosLista.map((persona, index) => (
                    <div 
                      key={index}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                        {persona.nombre.charAt(0)}{persona.apellido.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">
                          {persona.nombre} {persona.apellido}
                        </p>
                        <p className="text-sm text-gray-500">
                          {persona.tipo_medio} • {persona.cargo || 'Sin cargo'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromList(index)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Quitar de la lista"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Botón enviar */}
              {acreditadosLista.length > 0 && (
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full mt-6 py-4 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3 shadow-lg shadow-green-500/25"
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Enviar {acreditadosLista.length} Solicitud{acreditadosLista.length > 1 ? 'es' : ''}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
