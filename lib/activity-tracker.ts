import type { useLanguage } from "@/contexts/language-context"

type Translator = ReturnType<typeof useLanguage>["t"]

export interface UserActivity {
  id: string
  action: string
  type: "recipe" | "ingredient" | "purchase-order" | "business" | "inventory"
  timestamp: string
  businessId?: string
  details?: any
}

export interface SystemAlert {
  id: string
  type: "info" | "warning" | "success" | "error"
  title: string
  message: string
  timestamp: string
  businessId?: string
  read: boolean
}

export class ActivityTracker {
  private static getStorageKey(businessId?: string): string {
    return businessId ? `user_activity_${businessId}` : "user_activity_global"
  }

  private static getAlertsKey(businessId?: string): string {
    return businessId ? `system_alerts_${businessId}` : "system_alerts_global"
  }

  static addActivity(action: string, type: UserActivity["type"], businessId?: string, details?: any): void {
    const activity: UserActivity = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      action,
      type,
      timestamp: new Date().toISOString(),
      businessId,
      details,
    }

    const storageKey = this.getStorageKey(businessId)
    const activities = this.getActivities(businessId)

    // Keep only the last 100 activities
    const updatedActivities = [activity, ...activities].slice(0, 100)

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedActivities))

      // Dispatch event for real-time updates
      window.dispatchEvent(
        new CustomEvent("activityUpdated", {
          detail: { businessId, activity },
        }),
      )
    } catch (error) {
      console.error("Error saving activity:", error)
    }
  }

  static getActivities(businessId?: string): UserActivity[] {
    try {
      const storageKey = this.getStorageKey(businessId)
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error loading activities:", error)
      return []
    }
  }

  static getRecentActivities(businessId?: string, limit = 10): UserActivity[] {
    return this.getActivities(businessId).slice(0, limit)
  }

  static addAlert(type: SystemAlert["type"], title: string, message: string, businessId?: string): void {
    const alert: SystemAlert = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      businessId,
      read: false,
    }

    const storageKey = this.getAlertsKey(businessId)
    const alerts = this.getAlerts(businessId)

    // Keep only the last 50 alerts
    const updatedAlerts = [alert, ...alerts].slice(0, 50)

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedAlerts))

      // Dispatch event for real-time updates
      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: { businessId, alert },
        }),
      )
    } catch (error) {
      console.error("Error saving alert:", error)
    }
  }

  static getAlerts(businessId?: string): SystemAlert[] {
    try {
      const storageKey = this.getAlertsKey(businessId)
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : []
    } catch (error) {
      console.error("Error loading alerts:", error)
      return []
    }
  }

  static markAlertAsRead(alertId: string, businessId?: string): void {
    const storageKey = this.getAlertsKey(businessId)
    const alerts = this.getAlerts(businessId)

    const updatedAlerts = alerts.map((alert) => (alert.id === alertId ? { ...alert, read: true } : alert))

    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedAlerts))

      // Dispatch event for real-time updates
      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: { businessId, action: "markRead", alertId },
        }),
      )
    } catch (error) {
      console.error("Error marking alert as read:", error)
    }
  }

  static getUnreadAlertsCount(businessId?: string): number {
    return this.getAlerts(businessId).filter((alert) => !alert.read).length
  }

  // `t` es la misma función de traducción de useLanguage() — se pasa como parámetro
  // porque esta clase es un utilitario plano sin acceso a contexto de React. BUG
  // CORREGIDO: antes devolvía siempre "Ahora mismo"/"Hace N minutos/horas/días" en
  // español sin importar el idioma seleccionado (ver auditoría de i18n). Reutiliza
  // las mismas claves de horas/días que ya usa app/menus/page.tsx (mismo significado,
  // no específico de menús) y agrega las de minutos/"ahora mismo" que faltaban.
  static formatTimeAgo(timestamp: string, t: Translator): string {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return t("activity_time_ago_just_now")
    if (diffInMinutes < 60)
      return t(diffInMinutes > 1 ? "activity_time_ago_minutes_plural" : "activity_time_ago_minutes_singular").replace(
        "{count}",
        String(diffInMinutes),
      )

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24)
      return t(diffInHours > 1 ? "menus_time_ago_hours_plural" : "menus_time_ago_hours_singular").replace(
        "{count}",
        String(diffInHours),
      )

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7)
      return t(diffInDays > 1 ? "menus_time_ago_days_plural" : "menus_time_ago_days_singular").replace(
        "{count}",
        String(diffInDays),
      )

    return time.toLocaleDateString()
  }

  static getActivityIcon(type: UserActivity["type"]): string {
    const icons = {
      recipe: "👨‍🍳",
      ingredient: "🥕",
      "purchase-order": "📋",
      business: "🏢",
      inventory: "📦",
    }
    return icons[type] || "📝"
  }

  static getAlertIcon(type: SystemAlert["type"]): string {
    const icons = {
      info: "💡",
      warning: "⚠️",
      success: "✅",
      error: "❌",
    }
    return icons[type] || "📢"
  }

  static clearActivities(businessId?: string): void {
    const storageKey = this.getStorageKey(businessId)
    try {
      localStorage.removeItem(storageKey)
      window.dispatchEvent(
        new CustomEvent("activityUpdated", {
          detail: { businessId, action: "clear" },
        }),
      )
    } catch (error) {
      console.error("Error clearing activities:", error)
    }
  }

  static clearAlerts(businessId?: string): void {
    const storageKey = this.getAlertsKey(businessId)
    try {
      localStorage.removeItem(storageKey)
      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: { businessId, action: "clear" },
        }),
      )
    } catch (error) {
      console.error("Error clearing alerts:", error)
    }
  }
}

// Make ActivityTracker globally available
if (typeof window !== "undefined") {
  ;(window as any).ActivityTracker = ActivityTracker
}
