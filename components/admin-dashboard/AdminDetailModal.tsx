/**
 * Modal de detalle de acreditación
 * 
 * Muestra la información completa del acreditado seleccionado
 * y permite modificar zona, estado y eliminar.
 */

"use client";

import { AREA_NAMES } from "./AdminContext";
import type { Acreditacion, Zona } from "./AdminContext";
import { useTenantColors } from "../tenant/TenantContext";

// ============================================================================
// TIPOS
// ============================================================================

export interface AdminDetailModalProps {
  /** Acreditación a mostrar */
  acreditacion: Acreditacion;
  /** Lista de zonas disponibles */
  zonas: Zona[];
  /** Si está procesando una operación */
  isProcessing: boolean;
  /** Callback para cerrar el modal */
  onClose: () => void;
  /** Callback para cambiar estado */
  onUpdateEstado: (estado: "pendiente" | "aprobado" | "rechazado") => void;
  /** Callback para aprobar (con confirmación) */
  onApproveClick: () => void;
  /** Callback para rechazar (con confirmación) */
  onRejectClick: () => void;
  /** Callback para asignar zona */
  onAssignZona: (zonaId: number) => void;
  /** Callback para eliminar (con confirmación) */
  onDeleteClick: () => void;
}

// ============================================================================
// COMPONENTES INTERNOS
// ============================================================================

/** Campo de información con label y valor */
function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-600">{label}</label>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

/** Sección con título y contenido */
function Section({ 
  title, 
  children, 
  className = "bg-gray-50",
  titleColor = "#374151"
}: { 
  title: string; 
  children: React.ReactNode;
  className?: string;
  titleColor?: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-3" style={{ color: titleColor }}>{title}</h3>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${className} p-4 rounded-lg`}>
        {children}
      </div>
    </div>
  );
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AdminDetailModal({
  acreditacion,
  zonas,
  isProcessing,
  onClose,
  onUpdateEstado,
  onApproveClick,
  onRejectClick,
  onAssignZona,
  onDeleteClick,
}: AdminDetailModalProps) {
  const colors = useTenantColors();
  const zonaNombre = acreditacion.zona_id
    ? zonas.find((z) => z.id === acreditacion.zona_id)?.nombre || "Desconocida"
    : "Sin asignar";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div 
          className="sticky top-0 text-white px-6 py-6 flex items-center justify-between"
          style={{ background: `linear-gradient(to right, ${colors.primario}, ${colors.dark})` }}
        >
          <h2 className="text-2xl font-bold">Detalles de Acreditación</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6">
          {/* Datos del Acreditado */}
          <Section title="Datos del Acreditado" titleColor={colors.primario}>
            <InfoField label="Nombre" value={acreditacion.nombre} />
            <InfoField label="Primer Apellido" value={acreditacion.primer_apellido} />
            <InfoField label="Segundo Apellido" value={acreditacion.segundo_apellido || "-"} />
            <InfoField label="RUT" value={acreditacion.rut} />
            <InfoField label="Email" value={acreditacion.email} />
            <InfoField label="Cargo" value={acreditacion.cargo} />
            <InfoField
              label="Credencial"
              value={`${acreditacion.tipo_credencial}${acreditacion.numero_credencial ? ` · ${acreditacion.numero_credencial}` : ""}`}
            />
          </Section>

          {/* Información Institucional */}
          <Section title="Información Institucional" titleColor={colors.primario}>
            <InfoField
              label="Área"
              value={AREA_NAMES[acreditacion.area] || acreditacion.area}
            />
            <InfoField label="Empresa" value={acreditacion.empresa} />
          </Section>

          {/* Contacto Responsable */}
          {acreditacion.responsable_nombre && (
            <div>
              <h3 className="text-lg font-bold mb-3" style={{ color: colors.primario }}>Contacto Responsable</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
                <InfoField label="Nombre" value={acreditacion.responsable_nombre} />
                <InfoField
                  label="Primer Apellido"
                  value={acreditacion.responsable_primer_apellido || "-"}
                />
                <InfoField
                  label="Segundo Apellido"
                  value={acreditacion.responsable_segundo_apellido || "-"}
                />
                <InfoField label="RUT" value={acreditacion.responsable_rut || "-"} />
                <InfoField label="Email" value={acreditacion.responsable_email || "-"} />
                <InfoField label="Teléfono" value={acreditacion.responsable_telefono || "-"} />
              </div>
            </div>
          )}

          {/* Información Adicional */}
          <div>
            <h3 className="text-lg font-bold mb-3" style={{ color: colors.primario }}>Información Adicional</h3>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <p>
                <strong>Fecha Solicitud:</strong>{" "}
                {new Date(acreditacion.created_at).toLocaleDateString("es-CL")}
              </p>
              <p>
                <strong>Zona Asignada:</strong> {zonaNombre}
              </p>
              <p>
                <strong>Estado:</strong>{" "}
                <span className="capitalize font-bold">{acreditacion.status}</span>
              </p>
              {acreditacion.motivo_rechazo && (
                <p>
                  <strong>Motivo Rechazo:</strong> {acreditacion.motivo_rechazo}
                </p>
              )}
            </div>
          </div>

          {/* Modificar Zona */}
          <div className="border-2 rounded-lg" style={{ borderColor: colors.light }}>
            <h3 
              className="text-lg font-bold text-white px-4 py-3 rounded-t-lg"
              style={{ background: `linear-gradient(to right, ${colors.primario}, ${colors.dark})` }}
            >
              Modificar Zona Asignada
            </h3>
            <div className="bg-blue-50 p-4">
              <div className="mb-3">
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Zona Actual:
                </label>
                <p className="text-base font-bold" style={{ color: colors.primario }}>{zonaNombre}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Cambiar Zona:
                </label>
                <select
                  value={acreditacion.zona_id || ""}
                  onChange={(e) => onAssignZona(Number(e.target.value))}
                  className="w-full px-4 py-3 border-2 rounded-lg focus:outline-none bg-white font-medium text-base"
                  style={{ borderColor: colors.light }}
                  onFocus={(e) => e.target.style.borderColor = colors.primario}
                  onBlur={(e) => e.target.style.borderColor = colors.light}
                >
                  <option value="">Sin asignar</option>
                  {zonas.map((zona) => (
                    <option key={zona.id} value={zona.id}>
                      {zona.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Estado actual:{" "}
              <span className="font-bold capitalize">{acreditacion.status}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onUpdateEstado("pendiente")}
                disabled={isProcessing || acreditacion.status === "pendiente"}
                className="px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Pendiente
              </button>
              <button
                onClick={onApproveClick}
                disabled={isProcessing || acreditacion.status === "aprobado"}
                className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aprobar
              </button>
              <button
                onClick={onRejectClick}
                disabled={isProcessing || acreditacion.status === "rechazado"}
                className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Rechazar
              </button>
              <button
                onClick={onDeleteClick}
                disabled={isProcessing}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
