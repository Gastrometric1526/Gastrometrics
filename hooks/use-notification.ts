"use client"

import { useNotification as useNotificationContext } from "@/contexts/notification-context"

// Standardized notification messages
export const NotificationMessages = {
  // General messages
  general: {
    success: "Operación exitosa",
    error: "Error en la operación",
    warning: "Advertencia",
    info: "Información",
    validation_error: "Error de validación",
    network_error: "Error de red",
    permission_error: "Error de permisos",
  },

  // Data operations
  data: {
    saved: "Datos guardados",
    updated: "Datos actualizados",
    deleted: "Datos eliminados",
    exported: "Datos exportados",
    imported: "Datos importados",
    error: {
      save: "Error al guardar datos",
      update: "Error al actualizar datos",
      delete: "Error al eliminar datos",
      export: "Error al exportar datos",
      import: "Error al importar datos",
      load: "Error al cargar datos",
    },
  },

  // Ingredient specific
  ingredient: {
    created: "Ingrediente creado",
    updated: "Ingrediente actualizado",
    deleted: "Ingrediente eliminado",
    duplicated: "Ingrediente duplicado",
    imported: "Ingredientes importados",
    error: {
      create: "Error al crear ingrediente",
      update: "Error al actualizar ingrediente",
      delete: "Error al eliminar ingrediente",
      duplicate: "Error al duplicar ingrediente",
      import: "Error al importar ingredientes",
    },
  },

  // Recipe specific
  recipe: {
    created: "Receta creada",
    updated: "Receta actualizada",
    deleted: "Receta eliminada",
    duplicated: "Receta duplicada",
    saved: "Receta guardada",
    exported: "Receta exportada",
    error: {
      create: "Error al crear receta",
      update: "Error al actualizar receta",
      delete: "Error al eliminar receta",
      duplicate: "Error al duplicar receta",
      save: "Error al guardar receta",
      export: "Error al exportar receta",
    },
  },

  // Business specific
  business: {
    created: "Negocio creado",
    updated: "Negocio actualizado",
    deleted: "Negocio eliminado",
    activated: "Negocio activado",
    deactivated: "Negocio desactivado",
    error: {
      create: "Error al crear negocio",
      update: "Error al actualizar negocio",
      delete: "Error al eliminar negocio",
      activate: "Error al activar negocio",
      deactivate: "Error al desactivar negocio",
    },
  },

  // Authentication
  auth: {
    login_success: "Inicio de sesión exitoso",
    logout_success: "Cierre de sesión exitoso",
    register_success: "Registro exitoso",
    error: {
      login: "Error al iniciar sesión",
      logout: "Error al cerrar sesión",
      register: "Error al registrarse",
      unauthorized: "No autorizado",
    },
  },

  // File operations
  file: {
    uploaded: "Archivo subido",
    downloaded: "Archivo descargado",
    deleted: "Archivo eliminado",
    error: {
      upload: "Error al subir archivo",
      download: "Error al descargar archivo",
      delete: "Error al eliminar archivo",
      invalid_format: "Formato de archivo inválido",
      too_large: "Archivo demasiado grande",
    },
  },

  // Feature specific
  feature: {
    enabled: "Función habilitada",
    disabled: "Función deshabilitada",
    configured: "Función configurada",
    error: {
      enable: "Error al habilitar función",
      disable: "Error al deshabilitar función",
      configure: "Error al configurar función",
    },
  },

  // Merma system specific
  merma: {
    activated: "Sistema de mermas activado",
    deactivated: "Sistema de mermas desactivado",
    configured: "Mermas configuradas",
    applied: "Mermas aplicadas",
    error: {
      activate: "Error al activar sistema de mermas",
      deactivate: "Error al desactivar sistema de mermas",
      configure: "Error al configurar mermas",
      apply: "Error al aplicar mermas",
      validation: "Error de validación en mermas",
    },
  },

  // Purchase order specific
  purchaseOrder: {
    created: "Orden de compra creada",
    updated: "Orden de compra actualizada",
    deleted: "Orden de compra eliminada",
    processed: "Orden de compra procesada",
    error: {
      create: "Error al crear orden de compra",
      update: "Error al actualizar orden de compra",
      delete: "Error al eliminar orden de compra",
      process: "Error al procesar orden de compra",
    },
  },

  // Inventory specific
  inventory: {
    updated: "Inventario actualizado",
    registered: "Inventario registrado",
    error: {
      update: "Error al actualizar inventario",
      register: "Error al registrar inventario",
    },
  },
}

// Re-export the notification hook for convenience
export const useNotification = useNotificationContext
