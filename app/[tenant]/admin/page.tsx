"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ConfirmationModal from "../../../components/common/ConfirmationModal";
import Modal from "../../../components/common/Modal";
import { 
  AdminProvider, 
  AdminStats, 
  AdminFilters, 
  AdminExportActions, 
  AdminTable, 
  AdminDetailModal, 
  AdminHeader,
  AdminMessage,
  Acreditacion, 
  User, 
  AREA_NAMES, 
  ESTADO_COLORS 
} from "../../../components/admin-dashboard";
import { useTenant, useTenantColors } from "../../../components/tenant/TenantContext";
import { useAdminData, useAdminUI, useAdminMutations } from "../../../hooks";

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [localAcreditaciones, setLocalAcreditaciones] = useState<Acreditacion[]>([]);
  const router = useRouter();
  const { tenant } = useTenant();
  const colors = useTenantColors();

  // ---- Hooks de datos ----
  const {
    acreditaciones: fetchedAcreditaciones,
    zonas,
    isLoading,
    fetchAcreditaciones,
  } = useAdminData({
    eventoId: 1,
    autoFetch: false, // Controlamos manualmente después del auth check
  });

  // Sincronizar acreditaciones fetched con local
  useEffect(() => {
    setLocalAcreditaciones(fetchedAcreditaciones);
  }, [fetchedAcreditaciones]);

  // ---- Hooks de UI ----
  const {
    searchTerm,
    setSearchTerm,
    estadoFilter,
    setEstadoFilter,
    filteredAcreditaciones,
    selectedAcreditacion,
    setSelectedAcreditacion,
    isModalOpen,
    openDetailModal,
    closeDetailModal,
    message,
    setMessage,
    showSuccess,
    showError,
    isProcessing,
    setProcessing,
    isLoggingOut,
    setLoggingOut,
    confirmDeleteModal,
    openConfirmDelete,
    closeConfirmDelete,
    confirmActionModal,
    openConfirmAction,
    closeConfirmAction,
    successModal,
    openSuccessModal,
    closeSuccessModal,
  } = useAdminUI({
    acreditaciones: localAcreditaciones,
  });

  // ---- Hooks de mutaciones ----
  const {
    updateEstado: mutateEstado,
    updateEstadoWithConfirm,
    assignZona,
    deleteAcreditacion: mutateDelete,
    handleLogout: mutateLogout,
  } = useAdminMutations({
    zonas,
    onSuccess: (msg) => {
      if (msg) {
        showSuccess(msg);
        openSuccessModal(msg);
      }
    },
    onError: showError,
    onUpdateLocal: setLocalAcreditaciones,
    onUpdateSelected: setSelectedAcreditacion,
    onCloseModal: closeDetailModal,
    tenantSlug: tenant.slug,
  });

  // ---- Auth check ----
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push(`/${tenant.slug}/admin/login`);
        return;
      }
      setUser(data.session.user);
      fetchAcreditaciones();
    };
    checkAuth();
  }, [router, tenant.slug, fetchAcreditaciones]);

  // ---- Handlers ----
  const openDetail = useCallback((acred: Acreditacion) => {
    openDetailModal(acred);
  }, [openDetailModal]);

  const updateEstado = useCallback(async (newEstado: "pendiente" | "aprobado" | "rechazado") => {
    if (!selectedAcreditacion) return;
    setProcessing(true);
    try {
      await updateEstadoWithConfirm(selectedAcreditacion, newEstado);
    } finally {
      setProcessing(false);
    }
  }, [selectedAcreditacion, updateEstadoWithConfirm, setProcessing]);

  const handleApproveClick = useCallback(() => {
    if (!selectedAcreditacion) return;
    openConfirmAction(
      "aprobado",
      `¿Estás seguro de que quieres aprobar la acreditación de ${selectedAcreditacion.nombre} ${selectedAcreditacion.primer_apellido} de ${selectedAcreditacion.empresa}?`
    );
  }, [selectedAcreditacion, openConfirmAction]);

  const handleRejectClick = useCallback(() => {
    if (!selectedAcreditacion) return;
    openConfirmAction(
      "rechazado",
      `¿Estás seguro de que quieres rechazar la acreditación de ${selectedAcreditacion.nombre} ${selectedAcreditacion.primer_apellido} de ${selectedAcreditacion.empresa}?`
    );
  }, [selectedAcreditacion, openConfirmAction]);

  const handleConfirmAction = useCallback(() => {
    if (confirmActionModal.type) {
      updateEstado(confirmActionModal.type);
      closeConfirmAction();
    }
  }, [confirmActionModal.type, updateEstado, closeConfirmAction]);

  const deleteAcreditacion = useCallback(async () => {
    if (!selectedAcreditacion) return;
    closeConfirmDelete();
    setProcessing(true);
    try {
      await mutateDelete(selectedAcreditacion);
    } finally {
      setProcessing(false);
    }
  }, [selectedAcreditacion, mutateDelete, closeConfirmDelete, setProcessing]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await mutateLogout();
    } catch {
      setLoggingOut(false);
    }
  }, [mutateLogout, setLoggingOut]);

  const handleAsignZona = useCallback(async (zonaId: number) => {
    if (!selectedAcreditacion) return;
    await assignZona(selectedAcreditacion, zonaId);
  }, [selectedAcreditacion, assignZona]);

  const assignZonaDirect = useCallback(async (acred: Acreditacion, zonaId: number | null) => {
    await assignZona(acred, zonaId);
  }, [assignZona]);

  const updateEstadoDirect = useCallback(async (acred: Acreditacion, newEstado: "pendiente" | "aprobado" | "rechazado") => {
    await mutateEstado(acred, newEstado);
  }, [mutateEstado]);

  if (isLoading) return <LoadingSpinner message="Cargando dashboard..." />;

  const contextValue = {
    acreditaciones: localAcreditaciones,
    filteredAcreditaciones,
    zonas,
    AREA_NAMES,
    ESTADO_COLORS,
    searchTerm,
    setSearchTerm,
    estadoFilter,
    setEstadoFilter,
    message,
    setMessage,
    selectedAcreditacion,
    setSelectedAcreditacion,
    isModalOpen,
    setIsModalOpen: (open: boolean) => open ? undefined : closeDetailModal(),
    isProcessing,
    setIsProcessing: setProcessing,
    confirmDeleteModal,
    setConfirmDeleteModal: (open: boolean) => open ? openConfirmDelete() : closeConfirmDelete(),
    fetchAcreditaciones,
    openDetail,
    handleAsignZona,
    assignZonaDirect,
    updateEstado,
    updateEstadoDirect,
  };

  return (
    <AdminProvider value={contextValue}>
      <div 
        className="min-h-screen"
        style={{ background: `linear-gradient(to bottom right, ${colors.primario}, ${colors.dark}, ${colors.light})` }}
      >
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Header */}
          <AdminHeader
            userEmail={user?.email}
            isLoggingOut={isLoggingOut}
            onLogout={handleLogout}
          />

          {/* Stats Cards */}
          <AdminStats acreditaciones={localAcreditaciones} />

          {/* Message */}
          <AdminMessage message={message} />

          {/* Panel de Filtros y Acciones */}
          <div className="mb-6">
            <AdminFilters
              searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            estadoFilter={estadoFilter}
            setEstadoFilter={setEstadoFilter}
            onRefresh={fetchAcreditaciones}
          />

          <AdminExportActions estadoFilter={estadoFilter} setMessage={setMessage} />
        </div>

        {/* Tabla */}
        <AdminTable
          filteredAcreditaciones={filteredAcreditaciones}
          AREA_NAMES={AREA_NAMES}
          ESTADO_COLORS={ESTADO_COLORS}
          onOpenDetail={openDetail}
        />
      </div>

      {/* Detail Modal */}
      {isModalOpen && selectedAcreditacion && (
        <AdminDetailModal
          acreditacion={selectedAcreditacion}
          zonas={zonas}
          isProcessing={isProcessing}
          onClose={closeDetailModal}
          onUpdateEstado={updateEstado}
          onApproveClick={handleApproveClick}
          onRejectClick={handleRejectClick}
          onAssignZona={handleAsignZona}
          onDeleteClick={openConfirmDelete}
        />
      )}

      {/* Modal de confirmación para eliminar */}
      <ConfirmationModal
        isOpen={confirmDeleteModal}
        title="Eliminar Acreditación"
        message="¿Estás seguro de que deseas eliminar esta acreditación permanentemente? Esta acción no se puede deshacer."
        details={selectedAcreditacion ? [
          {
            "Nombre": `${selectedAcreditacion.nombre} ${selectedAcreditacion.primer_apellido}`,
            "Email": selectedAcreditacion.email,
            "RUT": selectedAcreditacion.rut,
          }
        ] : []}
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={deleteAcreditacion}
        onCancel={closeConfirmDelete}
        isLoading={isProcessing}
      />

      {/* Modal de confirmación para aprobar/rechazar */}
      <ConfirmationModal
        isOpen={confirmActionModal.isOpen}
        title={confirmActionModal.type === "aprobado" ? "Confirmar Aprobación" : "Confirmar Rechazo"}
        message={confirmActionModal.message}
        onConfirm={handleConfirmAction}
        onCancel={closeConfirmAction}
        isLoading={isProcessing}
      />

      {/* Modal de éxito */}
      <Modal
        isOpen={successModal.isOpen}
        type="success"
        title="¡Éxito!"
        message={successModal.message}
        buttons={[
          {
            label: "Aceptar",
            onClick: closeSuccessModal,
            variant: "primary",
          },
        ]}
        onClose={closeSuccessModal}
        autoClose={3000}
      />
      </div>
    </AdminProvider>
  );
}