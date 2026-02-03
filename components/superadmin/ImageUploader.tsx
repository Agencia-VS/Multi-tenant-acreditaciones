"use client";

import { useState, useRef, useCallback } from "react";
import { getSupabaseBrowserClient } from "../../lib/supabase/client";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  bucket?: string;
  folder?: string;
  aspectRatio?: "square" | "wide" | "tall";
  placeholder?: string;
}

export default function ImageUploader({
  value,
  onChange,
  label,
  bucket = "tenant-assets",
  folder = "images",
  aspectRatio = "square",
  placeholder,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<"upload" | "url">(value && value.startsWith("http") ? "url" : "upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = getSupabaseBrowserClient();

  const aspectRatioClasses = {
    square: "aspect-square",
    wide: "aspect-video",
    tall: "aspect-[3/4]",
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("La imagen no puede superar 5MB");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Simular progreso (Supabase no da progreso real en el cliente)
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 100);

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      clearInterval(progressInterval);

      if (uploadError) {
        // Si el bucket no existe, usar URL local como fallback
        console.warn("Error subiendo a Supabase Storage:", uploadError);
        
        // Crear URL de objeto local como fallback
        const localUrl = URL.createObjectURL(file);
        setUploadProgress(100);
        
        // Mostrar advertencia pero permitir continuar con URL local
        setError("Storage no disponible. Usa una URL externa.");
        setInputMode("url");
        return;
      }

      // Obtener URL pública
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      
      setUploadProgress(100);
      onChange(urlData.publicUrl);
    } catch (err) {
      console.error("Error uploading:", err);
      setError("Error al subir la imagen");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [folder, bucket]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setError(null);
  };

  const handleClear = () => {
    onChange("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setInputMode("upload")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              inputMode === "upload"
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Subir
          </button>
          <button
            type="button"
            onClick={() => setInputMode("url")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              inputMode === "url"
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            URL
          </button>
        </div>
      </div>

      {inputMode === "upload" ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-all ${
            isDragging
              ? "border-indigo-500 bg-indigo-50"
              : value
              ? "border-gray-200 bg-gray-50"
              : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
          } ${aspectRatioClasses[aspectRatio]}`}
        >
          {value ? (
            <div className="absolute inset-0 group">
              <img
                src={value}
                alt={label}
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/placeholder-image.png";
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="p-2 bg-white rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="p-2 bg-red-500 rounded-lg text-white hover:bg-red-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ) : isUploading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
              <div className="w-12 h-12 mb-3">
                <svg className="animate-spin text-indigo-500" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <div className="w-full max-w-[120px] h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Subiendo... {uploadProgress}%</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <div className="w-12 h-12 mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700">
                {isDragging ? "Suelta la imagen aquí" : "Arrastra una imagen"}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {placeholder || "o haz clic para seleccionar"}
              </p>
              <p className="text-xs text-gray-400 mt-2">PNG, JPG hasta 5MB</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={value}
            onChange={handleUrlChange}
            placeholder="https://ejemplo.com/imagen.png"
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-2.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Preview pequeño si está en modo URL */}
      {inputMode === "url" && value && (
        <div className="mt-2 flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
          <img
            src={value}
            alt="Preview"
            className="w-10 h-10 object-contain rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-xs text-gray-500 truncate flex-1">{value}</span>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
