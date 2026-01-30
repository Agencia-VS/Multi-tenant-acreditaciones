/**
 * Mensaje de feedback para el usuario
 * 
 * Muestra mensajes de éxito o error con estilos apropiados.
 */

"use client";

// ============================================================================
// TIPOS
// ============================================================================

export interface Message {
  type: "success" | "error";
  text: string;
}

export interface AdminMessageProps {
  /** Mensaje a mostrar (null si no hay mensaje) */
  message: Message | null;
}

// ============================================================================
// COMPONENTE
// ============================================================================

export default function AdminMessage({ message }: AdminMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`mb-6 p-4 rounded-lg text-sm font-medium ${
        message.type === "success"
          ? "bg-green-100 text-green-800 border border-green-300"
          : "bg-red-100 text-red-800 border border-red-300"
      }`}
    >
      {message.text}
    </div>
  );
}
