/**
 * ImageUploadField — Campo de imagen con upload + URL manual
 *
 * Features:
 *   - Drag & drop de archivo
 *   - Click para seleccionar
 *   - URL manual (toggle)
 *   - Preview de la imagen actual
 *   - Indicador de carga
 *   - Límite 5MB, formatos: JPG, PNG, WebP, SVG, GIF
 */
'use client';

import { useState, useRef, useCallback } from 'react';

interface ImageUploadFieldProps {
  /** Label del campo */
  label: string;
  /** URL actual de la imagen */
  value: string;
  /** Callback cuando cambia la URL (upload exitoso o manual) */
  onChange: (url: string) => void;
  /** Carpeta en el bucket (ej: 'tenants', 'events') */
  folder?: string;
  /** Placeholder para input manual */
  placeholder?: string;
  /** Mostrar preview redondo (para logos) */
  rounded?: boolean;
  /** Tamaño del preview: 'sm' | 'md' | 'lg' */
  previewSize?: 'sm' | 'md' | 'lg';
  /** Clases adicionales para el contenedor */
  className?: string;
}

const SIZE_MAP = {
  sm: 'w-12 h-12',
  md: 'w-20 h-20',
  lg: 'w-28 h-28',
};

export default function ImageUploadField({
  label,
  value,
  onChange,
  folder = 'general',
  placeholder = 'https://...',
  rounded = false,
  previewSize = 'md',
  className = '',
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);
    setUploading(true);

    try {
      // Client-side validation
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif'];
      if (!allowed.includes(file.type)) {
        throw new Error('Formato no permitido. Usa JPG, PNG, WebP, SVG o GIF.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('El archivo excede 5MB.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Error ${res.status}`);
      }

      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagen');
    } finally {
      setUploading(false);
    }
  }, [folder, onChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [uploadFile]);

  const sizeClass = SIZE_MAP[previewSize];

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-sm font-medium text-label">{label}</label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[10px] text-muted hover:text-body transition px-1.5 py-0.5 rounded hover:bg-subtle"
          title={showUrlInput ? 'Cambiar a upload' : 'Ingresar URL manualmente'}
        >
          <i className={`fas ${showUrlInput ? 'fa-upload' : 'fa-link'} mr-1`} />
          {showUrlInput ? 'Subir archivo' : 'URL manual'}
        </button>
      </div>

      {showUrlInput ? (
        /* ── Modo URL manual ── */
        <input
          type="url"
          value={value}
          onChange={(e) => { setError(null); onChange(e.target.value); }}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-field-border text-heading text-sm"
        />
      ) : (
        /* ── Modo Upload ── */
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`
            relative flex items-center gap-4 p-3 rounded-xl border-2 border-dashed cursor-pointer
            transition-all duration-200
            ${dragOver
              ? 'border-brand bg-accent-light scale-[1.01]'
              : value
                ? 'border-field-border hover:border-edge bg-surface'
                : 'border-edge hover:border-brand bg-subtle/50'
            }
            ${uploading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/gif"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Preview / placeholder */}
          {value ? (
            <img
              src={value}
              alt={label}
              className={`${sizeClass} object-contain bg-white/80 border border-field-border ${
                rounded ? 'rounded-full' : 'rounded-lg'
              }`}
            />
          ) : (
            <div
              className={`${sizeClass} flex items-center justify-center bg-subtle border border-dashed border-edge ${
                rounded ? 'rounded-full' : 'rounded-lg'
              }`}
            >
              <i className="fas fa-image text-muted text-lg" />
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0">
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-body">Subiendo...</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-label truncate">
                  {value ? 'Click o arrastra para cambiar' : 'Click o arrastra una imagen'}
                </p>
                <p className="text-xs text-muted mt-0.5">JPG, PNG, WebP, SVG, GIF · máx 5MB</p>
              </>
            )}
          </div>

          {/* Remove button */}
          {value && !uploading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="shrink-0 w-7 h-7 rounded-full bg-danger-light text-danger-dark hover:bg-red-200 transition flex items-center justify-center"
              title="Quitar imagen"
            >
              <i className="fas fa-times text-xs" />
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-danger-dark mt-1">
          <i className="fas fa-exclamation-circle mr-1" />
          {error}
        </p>
      )}
    </div>
  );
}
