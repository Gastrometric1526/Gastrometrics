"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react"
import { Notification } from "@/components/ui/notification"
import { simpleAudioManager } from "@/lib/simple-audio-manager"

export interface NotificationData {
  id: string
  type: "success" | "error" | "info" | "warning"
  title: string
  description?: string
  duration?: number
}

interface NotificationContextType {
  showNotification: (notification: Omit<NotificationData, "id">) => void
  showSuccess: (title: string, description?: string) => void
  showError: (title: string, description?: string) => void
  showInfo: (title: string, description?: string) => void
  showWarning: (title: string, description?: string) => void
  testAudioSystem: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationData[]>([])

  useEffect(() => {
    const checkAudio = () => {
      simpleAudioManager.getStatus()
    }

    const timer = setTimeout(checkAudio, 1000)
    return () => {
      clearTimeout(timer)
      simpleAudioManager.cleanup()
    }
  }, [])

  const showNotification = useCallback((notification: Omit<NotificationData, "id">) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const newNotification: NotificationData = {
      ...notification,
      id,
      duration: notification.duration || 3000,
    }

    setNotifications((prev) => [...prev, newNotification])

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    }, newNotification.duration)
  }, [])

  const showSuccess = useCallback(
    (title: string, description?: string) => {
      showNotification({ type: "success", title, description })
    },
    [showNotification],
  )

  const showError = useCallback(
    (title: string, description?: string) => {
      showNotification({ type: "error", title, description })
    },
    [showNotification],
  )

  const showInfo = useCallback(
    (title: string, description?: string) => {
      showNotification({ type: "info", title, description })
    },
    [showNotification],
  )

  const showWarning = useCallback(
    (title: string, description?: string) => {
      showNotification({ type: "warning", title, description })
    },
    [showNotification],
  )

  const testAudioSystem = useCallback(async () => {
    try {
      const success = await simpleAudioManager.testAudio()

      if (success) {
        showSuccess("Audio Test", "Audio system is working correctly")
      } else {
        showError("Audio Test Failed", "Check console for details")
      }
    } catch (error) {
      showError("Audio Test Error", "Unexpected error occurred")
    }
  }, [showSuccess, showError])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const contextValue = useMemo(
    () => ({
      showNotification,
      showSuccess,
      showError,
      showInfo,
      showWarning,
      testAudioSystem,
    }),
    [showNotification, showSuccess, showError, showInfo, showWarning, testAudioSystem],
  )

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}

      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <Notification
            key={notification.id}
            notification={notification}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotification() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotification must be used within a NotificationProvider")
  }
  return context
}
