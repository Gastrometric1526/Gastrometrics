"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

type BarChartProps = {
  data: any[]
  index: string
  categories: string[]
  colors: string[]
  valueFormatter?: (value: number) => string
  showLegend?: boolean
  height?: string
}

export function BarChart({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => `${value}`,
  showLegend = true,
  height = "h-80",
}: BarChartProps) {
  const [chartData, setChartData] = useState<{ label: string; values: { [key: string]: number } }[]>([])

  useEffect(() => {
    if (data.length > 0) {
      const formattedData = data.map((item) => ({
        label: item[index],
        values: categories.reduce((acc, cat) => {
          acc[cat] = item[cat] || 0
          return acc
        }, {}),
      }))
      setChartData(formattedData)
    }
  }, [data, index, categories])

  const maxValue = Math.max(...data.map((item) => Math.max(...categories.map((cat) => item[cat] || 0))), 0)

  const colorMap = categories.reduce((acc, cat, idx) => {
    acc[cat] = colors[idx % colors.length]
    return acc
  }, {})

  return (
    <div className="w-full">
      {showLegend && (
        <div className="flex flex-wrap gap-4 mb-4">
          {categories.map((cat, idx) => (
            <div key={cat} className="flex items-center">
              <div className={`w-3 h-3 rounded-full bg-${colors[idx % colors.length]}-500 mr-2`}></div>
              <span className="text-sm">{cat}</span>
            </div>
          ))}
        </div>
      )}

      <div className={cn("relative w-full", height)}>
        <div className="flex h-full">
          <div className="flex flex-col justify-between pr-2 text-xs text-gray-500">
            {[0, 25, 50, 75, 100].map((percent) => (
              <div key={percent}>{valueFormatter((maxValue * percent) / 100)}</div>
            ))}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-1 h-full gap-x-8 gap-y-4">
              {chartData.map((item, idx) => (
                <div key={`${item.label}-${idx}`} className="relative h-10">
                  <div className="absolute inset-0 flex items-center">
                    <div className="h-0.5 w-full bg-gray-100"></div>
                  </div>
                  <div className="relative h-full flex items-center">
                    <span className="text-sm text-gray-500 w-24 text-right pr-4">{item.label}</span>
                    <div className="flex-1 h-8">
                      {categories.map((cat) => (
                        <div
                          key={`${item.label}-${cat}`}
                          className={`absolute h-8 bg-${colorMap[cat]}-500 rounded`}
                          style={{
                            width: `${(item.values[cat] / maxValue) * 100}%`,
                            left: "0",
                            opacity: 0.8,
                          }}
                          title={`${cat}: ${valueFormatter(item.values[cat])}`}
                        ></div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

type LineChartProps = {
  data: any[]
  index: string
  categories: string[]
  colors: string[]
  valueFormatter?: (value: number) => string
  showLegend?: boolean
  showXAxis?: boolean
  showYAxis?: boolean
  yAxisWidth?: number
  height?: string
}

export function LineChart({
  data,
  index,
  categories,
  colors,
  valueFormatter = (value) => `${value}`,
  showLegend = true,
  showXAxis = true,
  showYAxis = true,
  yAxisWidth = 50,
  height = "h-80",
}: LineChartProps) {
  // Esta es una implementación simulada para propósitos de diseño
  // En una aplicación real, usarías una biblioteca como recharts o chart.js

  const maxValue = Math.max(...data.map((item) => Math.max(...categories.map((cat) => item[cat] || 0))), 0)

  return (
    <div className="w-full">
      {showLegend && (
        <div className="flex flex-wrap gap-4 mb-4">
          {categories.map((cat, idx) => (
            <div key={cat} className="flex items-center">
              <div className={`w-3 h-3 rounded-full bg-${colors[idx % colors.length]}-500 mr-2`}></div>
              <span className="text-sm">{cat}</span>
            </div>
          ))}
        </div>
      )}

      <div className={cn("relative w-full border border-gray-200 rounded-md p-4", height)}>
        {/* Aquí iría un gráfico real - Representación simplificada */}
        <div className="flex h-full items-end">
          {showYAxis && (
            <div className="flex flex-col justify-between h-full text-xs text-gray-500" style={{ width: yAxisWidth }}>
              {[0, 25, 50, 75, 100].reverse().map((percent) => (
                <div key={percent} className="py-1">
                  {valueFormatter((maxValue * percent) / 100)}
                </div>
              ))}
            </div>
          )}
          <div className="flex-1 h-full flex items-end">
            {data.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col justify-end items-center">
                <div
                  className="w-2 bg-blue-500 rounded-t-sm"
                  style={{
                    height: `${(item[categories[0]] / maxValue) * 100}%`,
                    maxHeight: "100%",
                  }}
                  title={valueFormatter(item[categories[0]])}
                ></div>
                {showXAxis && <div className="text-xs mt-2 text-gray-500">{item[index]}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

type DonutChartProps = {
  data: any[]
  category: string
  index: string
  valueFormatter?: (value: number) => string
  colors: string[]
  variant?: "donut" | "pie"
  height?: string
}

export function DonutChart({
  data,
  category,
  index,
  valueFormatter = (value) => `${value}`,
  colors,
  variant = "donut",
  height = "h-80",
}: DonutChartProps) {
  // Simulación de gráfico de dona/pastel
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="w-full">
      <div className={cn("relative mx-auto", height)}>
        <div className="flex flex-col md:flex-row h-full">
          <div className="flex-1 flex items-center justify-center">
            {/* Simulación visual del gráfico */}
            <div className="relative w-48 h-48 rounded-full border border-gray-200 overflow-hidden">
              {/* Secciones del gráfico */}
              {data.map((item, idx) => {
                // Este es un hacky visual simple - en producción usarías una biblioteca de gráficos
                const percentage = (item.value / total) * 100
                return (
                  <div
                    key={idx}
                    className={`absolute inset-0 bg-${colors[idx % colors.length]}-500`}
                    style={{
                      clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(0)} ${50 + 50 * Math.sin(0)}%, ${50 + 50 * Math.cos(Math.PI / 2)} ${50 + 50 * Math.sin(Math.PI / 2)}%)`,
                      opacity: 0.8,
                      transform: `rotate(${idx * 45}deg)`,
                    }}
                    title={`${item[index]}: ${valueFormatter(item.value)} (${percentage.toFixed(1)}%)`}
                  ></div>
                )
              })}
              {variant === "donut" && <div className="absolute inset-0 m-auto w-24 h-24 bg-white rounded-full"></div>}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col mt-4 md:mt-0 md:pl-4 max-h-full">
            <div className="space-y-2 overflow-y-auto pr-1 max-h-full">
              {data.map((item, idx) => (
                <div key={idx} className="flex items-center min-w-0">
                  <div className={`w-3 h-3 shrink-0 rounded-full bg-${colors[idx % colors.length]}-500 mr-2`}></div>
                  <span className="text-sm flex-1 min-w-0 truncate" title={String(item[index])}>
                    {item[index]}
                  </span>
                  <span className="text-sm font-medium shrink-0 ml-2">{valueFormatter(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
