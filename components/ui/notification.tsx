"use client"

import { useState, useEffect, useRef } from "react"
import type { NotificationData } from "@/contexts/notification-context"
import { simpleAudioManager } from "@/lib/simple-audio-manager"

interface NotificationProps {
  notification: NotificationData
  onClose: () => void
}

export function Notification({ notification, onClose }: NotificationProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const hasPlayedAudio = useRef(false)
  const isCleaningUp = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Simple audio playback on mount
  useEffect(() => {
    if (mounted && !hasPlayedAudio.current && !isCleaningUp.current) {
      // Small delay to sync with slide-in animation
      const audioTimer = setTimeout(() => {
        if (!isCleaningUp.current) {
          console.log("🔔 Playing notification audio...")
          simpleAudioManager.playNotificationSound()
          hasPlayedAudio.current = true
        }
      }, 300)

      return () => clearTimeout(audioTimer)
    }
  }, [mounted])

  useEffect(() => {
    // Start exit animation 500ms before duration ends
    const exitTimer = setTimeout(
      () => {
        if (!isCleaningUp.current) {
          setIsExiting(true)
          // Complete removal after exit animation
          setTimeout(() => {
            isCleaningUp.current = true
            onClose()
          }, 500)
        }
      },
      (notification.duration || 3000) - 500,
    )

    return () => {
      clearTimeout(exitTimer)
      isCleaningUp.current = true
    }
  }, [notification.duration, onClose])

  const handleClose = () => {
    if (!isCleaningUp.current) {
      isCleaningUp.current = true
      setIsExiting(true)
      setTimeout(onClose, 500)
    }
  }

  if (!mounted) return null

  // Get colors based on notification type and theme
  const getTypeColors = () => {
    switch (notification.type) {
      case "success":
        return {
          progressBar: "bg-success-soft0 dark:bg-green-400",
          badge: "bg-success-soft text-success",
        }
      case "error":
        return {
          progressBar: "bg-danger-soft0 dark:bg-red-400",
          badge: "bg-danger-soft text-destructive",
        }
      case "warning":
        return {
          progressBar: "bg-warning-soft0 dark:bg-amber-400",
          badge: "bg-warning-soft text-warning",
        }
      case "info":
        return {
          progressBar: "bg-blue-500 dark:bg-blue-400",
          badge: "bg-info-soft text-info border-blue-200 dark:border-blue-700/50",
        }
      default:
        return {
          progressBar: "bg-gray-500 dark:bg-gray-400",
          badge:
            "bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700/50",
        }
    }
  }

  const colors = getTypeColors()
  const progressDuration = ((notification.duration || 3000) - 500) / 1000

  return (
    <div
      className={`transition-all duration-500 ease-in-out ${
        isExiting ? "animate-slideOutToRight" : "animate-slideInFromRight"
      }`}
    >
      <div
        className={`
 notification-container group
 bg-card border border-border text-card-foreground
 rounded-xl p-4 max-w-sm backdrop-blur-sm
 transition-all duration-300
 relative overflow-hidden
 `}
        style={{
          // Única sombra del rediseño visual (ver docs/79), igual en claro y oscuro —
          // antes de esto cada modo tenía su propio valor ad-hoc.
          boxShadow: "0 24px 52px -20px rgba(18,18,18,0.18)",
        }}
        onMouseEnter={() => {
          const progressBar = document.querySelector(".auto-hide-progress")
          if (progressBar) {
            ;(progressBar as HTMLElement).style.animationPlayState = "paused"
          }
        }}
        onMouseLeave={() => {
          const progressBar = document.querySelector(".auto-hide-progress")
          if (progressBar) {
            ;(progressBar as HTMLElement).style.animationPlayState = "running"
          }
        }}
      >
        {/* Progress bar */}
        <div
          className={`absolute bottom-0 left-0 h-0.5 ${colors.progressBar} auto-hide-progress`}
          style={{
            width: "100%",
            transformOrigin: "left",
            animation: !isExiting ? `shrinkWidth ${progressDuration}s linear forwards` : "none",
          }}
        />

        <div className="flex items-start justify-between gap-3 relative z-10">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h4
                className="text-sm font-semibold text-foreground transition-all duration-300"
                style={{
                  animation: !isExiting ? "fadeInUp 0.5s ease-out 0.1s both" : "none",
                }}
              >
                {notification.title}
              </h4>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.badge} transition-all duration-300`}
                style={{
                  animation: !isExiting ? "fadeInUp 0.5s ease-out 0.2s both" : "none",
                }}
              >
                {notification.type}
              </span>
            </div>

            {notification.description && (
              <p
                className="text-xs text-muted-foreground transition-all duration-300"
                style={{
                  animation: !isExiting ? "fadeInUp 0.5s ease-out 0.3s both" : "none",
                }}
              >
                {notification.description}
              </p>
            )}
          </div>

          <button
            onClick={handleClose}
            className="flex-shrink-0 transition-all duration-200 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 hover:scale-110"
            style={{
              animation: !isExiting ? "notification-fade-in 0.3s ease-out 0.5s both" : "none",
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
