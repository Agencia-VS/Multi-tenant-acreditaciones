'use client';

import { useState, useRef, useEffect } from 'react';
import type { QRValidationResult } from '@/types';

/**
 * Scanner QR para control de acceso en puerta.
 * Lee QR desde cámara o input manual.
 * 
 * Pantalla Verde = Aprobado + Foto
 * Pantalla Roja = Ya ingresó o No autorizado
 */
export default function QRScanner() {
  const [qrInput, setQrInput] = useState('');
  const [result, setResult] = useState<QRValidationResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus en el input para que scanners USB funcionen directamente
  useEffect(() => {
    inputRef.current?.focus();
  }, [result]);

  const handleValidate = async (token: string) => {
    if (!token.trim()) return;
    
    setScanning(true);
    try {
      const res = await fetch('/api/qr/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_token: token.trim() }),
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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-8 text-white">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-qrcode text-5xl" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Scanner QR</h1>
        <p className="text-gray-400 mb-8">Escanea el código QR del acreditado o ingresa el token manualmente</p>

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
