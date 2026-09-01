import type React from "react"
import { cn } from "@/lib/utils"

export function Metric({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-3xl font-bold tracking-tight", className)}>{children}</p>
}

export function ProgressBar({
  value,
  color = "blue",
  showAnimation = false,
  tooltip,
  className,
}: {
  value: number
  color?: "blue" | "green" | "red" | "amber"
  showAnimation?: boolean
  tooltip?: string
  className?: string
}) {
  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-success-soft0",
    red: "bg-danger-soft0",
    amber: "bg-warning-soft0",
  }

  return (
    <div className={cn("relative w-full h-2 bg-gray-200 rounded-full overflow-hidden", className)} title={tooltip}>
      <div
        className={cn(
          "absolute top-0 left-0 h-full rounded-full",
          colorClasses[color],
          showAnimation && "transition-all duration-1000",
        )}
        style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
      ></div>
    </div>
  )
}

export function BadgeDelta({
  children,
  deltaType = "neutral",
  className,
}: {
  children: React.ReactNode
  deltaType: "increase" | "decrease" | "neutral"
  className?: string
}) {
  const colors = {
    increase: "bg-success-soft text-success",
    decrease: "bg-danger-soft text-destructive",
    neutral: "bg-gray-100 text-gray-800",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        colors[deltaType],
        className,
      )}
    >
      {children}
    </span>
  )
}
