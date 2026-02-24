'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { QRValidationResult, EventDay } from '@/types';
import { BackButton } from '@/components/shared/ui';

/**
 * Scanner QR para control de acceso en puerta.
 * Lee QR desde cámara del dispositivo o input manual/USB/Bluetooth.
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
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  // ─── Camera scanning with BarcodeDetector API or jsQR fallback ───
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;

      // Activar cámara primero para que React renderice el <video>
      setCameraActive(true);

      // Esperar al siguiente frame para que videoRef esté disponible
      await new Promise<void>((resolve) => {
        const waitForVideo = () => {
          if (videoRef.current) {
            resolve();
          } else {
            requestAnimationFrame(waitForVideo);
          }
        };
        requestAnimationFrame(waitForVideo);
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Check if BarcodeDetector API is available (Chrome/Edge/Android)
      const hasBarcodeDetector = 'BarcodeDetector' in window;
      let detector: BarcodeDetector | null = null;
      if (hasBarcodeDetector) {
        detector = new BarcodeDetector({ formats: ['qr_code'] });
      }

      // Scan loop
      scanIntervalRef.current = setInterval(async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let decoded: string | null = null;

        // Try BarcodeDetector first (faster, native)
        if (detector) {
          try {
            const barcodes = await detector.detect(canvas);
            if (barcodes.length > 0) decoded = barcodes[0].rawValue;
          } catch { /* fallback below */ }
        }

        // Fallback: try jsQR if available
        if (!decoded) {
          try {
            const jsQR = (await import('jsqr')).default;
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, canvas.width, canvas.height);
            if (code) decoded = code.data;
          } catch { /* jsQR not available, rely on BarcodeDetector */ }
        }

        if (decoded) {
          stopCamera();
          handleValidate(decoded);
        }
      }, 250); // Scan every 250ms
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo acceder a la cámara';
      setCameraError(msg);
      setCameraActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopCamera]);

  const toggleCamera = useCallback(() => {
    if (cameraActive) {
      stopCamera();
    } else {
      startCamera();
    }
  }, [cameraActive, stopCamera, startCamera]);

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
    stopCamera();
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
      <div className="text-center max-w-md w-full">
        <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <i className="fas fa-qrcode text-5xl" />
        </div>
        
        <h1 className="text-3xl font-bold mb-2">Scanner QR</h1>
        <p className="text-gray-400 mb-6">Escanea con la cámara o ingresa el código manualmente</p>

        {/* Camera toggle */}
        <button
          onClick={toggleCamera}
          className={`mb-6 px-6 py-3 rounded-xl text-base font-semibold transition-all flex items-center gap-3 mx-auto ${
            cameraActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <i className={`fas ${cameraActive ? 'fa-video-slash' : 'fa-camera'}`} />
          {cameraActive ? 'Detener cámara' : 'Escanear con cámara'}
        </button>

        {cameraError && (
          <p className="text-red-400 text-sm mb-4">
            <i className="fas fa-exclamation-triangle mr-1" />
            {cameraError}
          </p>
        )}

        {/* Camera preview */}
        {cameraActive && (
          <div className="relative mb-6 rounded-xl overflow-hidden border-2 border-blue-500 shadow-lg shadow-blue-500/20">
            <video
              ref={videoRef}
              className="w-full rounded-xl"
              playsInline
              muted
              style={{ maxHeight: '320px', objectFit: 'cover' }}
            />
            {/* Scan overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-white/60 rounded-lg" />
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className="bg-black/60 px-3 py-1 rounded text-xs text-white">
                <i className="fas fa-crosshairs mr-1 animate-pulse" />
                Apunta al código QR
              </span>
            </div>
          </div>
        )}
        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

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

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 border-t border-gray-700" />
          <span className="text-gray-500 text-sm">o ingresa manualmente</span>
          <div className="flex-1 border-t border-gray-700" />
        </div>

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={qrInput}
            onChange={(e) => setQrInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pega la URL o token del QR..."
            className="w-full px-6 py-4 bg-gray-800 border border-gray-700 rounded-xl text-white text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus={!cameraActive}
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
          También funciona con scanner USB/Bluetooth
        </p>
      </div>
    </div>
  );
}
