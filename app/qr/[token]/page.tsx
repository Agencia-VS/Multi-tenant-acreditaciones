'use client';

/**
 * Página pública de verificación de QR.
 * Muestra los datos del acreditado como credencial digital verificable.
 * NO hace check-in — es solo lectura.
 */
import { useState, useEffect, use } from 'react';

interface QRInfo {
  valid: boolean;
  status: string;
  message: string;
  nombre?: string;
  rut?: string;
  foto_url?: string;
  organizacion?: string;
  cargo?: string;
  tipo_medio?: string;
  zona?: string;
  checked_in?: boolean;
  checked_in_at?: string;
  event?: { nombre: string; fecha: string; venue: string };
  tenant?: { nombre: string; slug: string; logo_url: string | null; color_primario: string; color_secundario: string };
}

export default function QRVerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<QRInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/qr/${token}`);
        const data = await res.json();
        setInfo(data);
      } catch {
        setInfo({ valid: false, status: 'error', message: 'Error de conexión' });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-gray-400 mb-4" />
          <p className="text-gray-500">Verificando acreditación...</p>
        </div>
      </div>
    );
  }

  if (!info || !info.valid) {
    const isNotFound = info?.status === 'not_found';
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <i className={`fas ${isNotFound ? 'fa-question-circle' : 'fa-times-circle'} text-4xl text-red-500`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isNotFound ? 'QR No Encontrado' : 'No Válido'}
          </h1>
          <p className="text-gray-500">{info?.message || 'Este código QR no es válido o ha expirado.'}</p>
        </div>
      </div>
    );
  }

  const color = info.tenant?.color_primario || '#2563eb';
  const textColor = info.tenant?.color_secundario || '#ffffff';
  const fecha = info.event?.fecha
    ? new Date(info.event.fecha).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Header con colores del tenant */}
        <div
          className="rounded-t-2xl p-6 text-center"
          style={{ background: color, color: textColor }}
        >
          {info.tenant?.logo_url && (
            <img
              src={info.tenant.logo_url}
              alt={info.tenant.nombre}
              className="h-10 mx-auto mb-3 object-contain"
            />
          )}
          <p className="text-sm opacity-80 font-medium uppercase tracking-wider">Acreditación verificada</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <i className="fas fa-check-circle text-lg" />
            <span className="font-semibold">{info.message}</span>
          </div>
        </div>

        {/* Cuerpo: datos del acreditado */}
        <div className="bg-white border border-t-0 border-gray-200 p-6">
          {/* Foto + nombre */}
          <div className="flex items-center gap-4 mb-5">
            {info.foto_url ? (
              <img
                src={info.foto_url}
                alt={info.nombre}
                className="w-20 h-20 rounded-xl object-cover shadow-sm border"
              />
            ) : (
              <div
                className="w-20 h-20 rounded-xl flex items-center justify-center text-2xl font-bold text-white shadow-sm"
                style={{ background: color }}
              >
                {(info.nombre || '?')[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{info.nombre}</h2>
              {info.rut && <p className="text-sm text-gray-500">{info.rut}</p>}
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-3">
            {info.organizacion && (
              <div className="flex items-start gap-3">
                <i className="fas fa-building text-gray-400 mt-0.5 w-5 text-center" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Organización</p>
                  <p className="text-sm font-medium text-gray-900">{info.organizacion}</p>
                </div>
              </div>
            )}
            {info.cargo && (
              <div className="flex items-start gap-3">
                <i className="fas fa-id-badge text-gray-400 mt-0.5 w-5 text-center" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Cargo</p>
                  <p className="text-sm font-medium text-gray-900">{info.cargo}</p>
                </div>
              </div>
            )}
            {info.tipo_medio && (
              <div className="flex items-start gap-3">
                <i className="fas fa-newspaper text-gray-400 mt-0.5 w-5 text-center" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Medio</p>
                  <p className="text-sm font-medium text-gray-900">{info.tipo_medio}</p>
                </div>
              </div>
            )}
            {info.zona && (
              <div className="flex items-start gap-3">
                <i className="fas fa-map-marker-alt text-gray-400 mt-0.5 w-5 text-center" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Zona</p>
                  <p className="text-sm font-medium text-gray-900">{info.zona}</p>
                </div>
              </div>
            )}
          </div>

          {/* Check-in status */}
          {info.checked_in && (
            <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-lg flex items-center gap-2">
              <i className="fas fa-door-open text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">Ya ingresó al evento</p>
                {info.checked_in_at && (
                  <p className="text-xs text-green-600">
                    {new Date(info.checked_in_at).toLocaleString('es-CL')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: evento */}
        <div className="bg-gray-50 border border-t-0 border-gray-200 rounded-b-2xl p-4">
          {info.event && (
            <div className="text-center">
              <p className="font-semibold text-gray-900 text-sm">{info.event.nombre}</p>
              {fecha && <p className="text-xs text-gray-500 mt-0.5">{fecha}</p>}
              {info.event.venue && (
                <p className="text-xs text-gray-400 mt-0.5">
                  <i className="fas fa-map-pin mr-1" />{info.event.venue}
                </p>
              )}
            </div>
          )}
          <p className="text-center text-[10px] text-gray-300 mt-3 uppercase tracking-widest">
            Verificado por {info.tenant?.nombre}
          </p>
        </div>
      </div>
    </div>
  );
}
