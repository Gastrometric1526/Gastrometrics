"use client"

import * as React from "react"
import type { DashboardStore, DashboardData } from "@/types/dashboard"
import { initializeDashboardData } from "@/types/dashboard"

interface DashboardContextType {
  currentDashboard: string
  dashboardData: DashboardStore
  setCurrentDashboard: (id: string) => void
  updateDashboardData: (id: string, data: Partial<DashboardData>) => void
}

const DashboardContext = React.createContext<DashboardContextType | undefined>(undefined)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [currentDashboard, setCurrentDashboard] = React.useState("main")
  const [dashboardData, setDashboardData] = React.useState<DashboardStore>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dashboardData")
      if (stored) {
        return JSON.parse(stored)
      }
    }
    return {
      main: initializeDashboardData(),
      businesses: {},
    }
  })

  React.useEffect(() => {
    localStorage.setItem("dashboardData", JSON.stringify(dashboardData))
  }, [dashboardData])

  const updateDashboardData = React.useCallback((id: string, data: Partial<DashboardData>) => {
    setDashboardData((prev) => {
      if (id === "main") {
        return {
          ...prev,
          main: {
            ...prev.main,
            ...data,
          },
        }
      }

      return {
        ...prev,
        businesses: {
          ...prev.businesses,
          [id]: {
            ...(prev.businesses[id] || initializeDashboardData()),
            ...data,
          },
        },
      }
    })
  }, [])

  const value = React.useMemo(
    () => ({
      currentDashboard,
      dashboardData,
      setCurrentDashboard,
      updateDashboardData,
    }),
    [currentDashboard, dashboardData, updateDashboardData],
  )

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboard() {
  const context = React.useContext(DashboardContext)
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider")
  }
  return context
}
