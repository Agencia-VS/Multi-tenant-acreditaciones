'use client';

import { useState, useRef, useEffect } from 'react';
import type { QRValidationResult, EventDay } from '@/types';
import { BackButton } from '@/components/shared/ui';

/**
 * Scanner QR para control de acceso en puerta.
 * Lee QR desde cámara o input manual.
 * Soporta check-in por día para eventos multidía.
 * 
 * Pantalla Verde = Aprobado + Foto
 * Pantalla Roja = Ya ingresó o No autorizado
 */
export default function QRScanner({
  backHref,
  eventDays,
}: {
  backHref?: string;
  eventDays?: EventDay[];
}) {
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState<QRValidationResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isMultidia = eventDays && eventDays.length > 0;

  // Auto-select today's day if available
  useEffect(() => {
    if (!isMultidia) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayDay = eventDays.find(d => d.fecha === today);
    if (todayDay) setSelectedDayId(todayDay.id);
    else if (eventDays.length > 0) setSelectedDayId(eventDays[0].id);
  }, [eventDays, isMultidia]);

  // Auto-focus en el input para que scanners USB funcionen directamente
  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  /** Extrae el token real de un QR. Soporta URLs (/qr/{token}) o tokens directos. */
  const extractToken = (raw: string): string => {
    const trimmed = raw.trim();
    // Match URL pattern: .../qr/{hex-token}
    const urlMatch = trimmed.match(/\/qr\/([a-f0-9]{64})$/i);
    if (urlMatch) return urlMatch[1];
    // Fallback: use raw value as token
    return trimmed;
  };

  const handleValidate = async (rawInput: string) => {
    if (!rawInput.trim()) return;
    const token = extractToken(rawInput);
    
    setScanning(true);
    try {
      const payload: Record<string, string> = { qr_token: token };
      if (isMultidia && selectedDayId) payload.event_day_id = selectedDayId;

      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        valid: false,
        status: 'not_found',
        message: 'Error de conexión',
      });
    } finally {
      setScanning(false);
      setQrInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleValidate(qrInput);
    }
  };

  const resetScanner = () => {
    setResult(null);
    setQrInput('');
    inputRef.current?.focus();
  };

  // ─── Pantalla de resultado ───
  if (result) {
    const isValid = result.valid && result.status === 'checked_in';
    const bgColor = isValid ? 'bg-green-500' : 'bg-red-500';
    const icon = isValid ? 'fa-check-circle' : result.status === 'already_checked_in' ? 'fa-exclamation-triangle' : 'fa-times-circle';

    return (
      <div className={`min-h-screen ${bgColor} flex flex-col items-center justify-center p-8 text-white transition-all duration-300`}>
        <div className="text-center max-w-md">
          <i className={`fas ${icon} text-8xl mb-6`} />
          
          <h1 className="text-4xl font-bold mb-2">{result.message}</h1>
          
          {result.nombre && (
            <div className="mt-6">
              {result.foto_url && (
                <img
                  src={result.foto_url}
                  alt={result.nombre}
                  className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-white shadow-lg"
                />
              )}
              <p className="text-3xl font-bold">{result.nombre}</p>
              {result.rut && <p className="text-xl opacity-80 mt-1">{result.rut}</p>}
              {result.organizacion && <p className="text-lg opacity-80 mt-1">{result.organizacion}</p>}
              {result.cargo && <p className="text-lg opacity-80">{result.cargo} — {result.tipo_medio}</p>}
              {result.event_nombre && <p className="text-lg opacity-60 mt-2">{result.event_nombre}</p>}
            </div>
          )}

          <button
            onClick={resetScanner}
            className="mt-8 px-8 py-4 bg-white text-gray-900 text-xl font-bold rounded-xl shadow-lg hover:bg-gray-100 transition"
          >
            <i className="fas fa-qrcode mr-2" /> Escanear Otro
          </button>
        </div>
      </div>
    );
  }

  // ─── Pantalla de escaneo ───
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-white relative">
      {backHref && <BackButton href={backHref} label="Volver al panel" />}
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-qrcode text-5xl" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Scanner QR</h1>
        <p className="text-gray-400 mb-8">Escanea el código QR del acreditado o ingresa el token manualmente</p>

        {/* Day selector for multidia events */}
        {isMultidia && (
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wider text-gray-400 mb-2 font-semibold">
              <i className="fas fa-calendar-day mr-1" /> Jornada activa
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {eventDays.map(d => {
                const isSelected = selectedDayId === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDayId(d.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {d.label || d.fecha}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escanea o ingresa el código QR..."
            className="w-full px-6 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <button
            onClick={() => handleValidate(qrInput)}
            disabled={!qrInput.trim() || scanning}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {scanning ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-arrow-right" />}
          </button>
        </div>

        <p className="text-gray-500 text-sm mt-4">
          <i className="fas fa-info-circle mr-1" />
          El cursor está activo — un scanner USB/Bluetooth leerá directamente aquí
        </p>
      </div>
    </div>
  );
}
