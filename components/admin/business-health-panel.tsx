"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { BellOff } from "lucide-react"

interface DormantBusiness {
  id: string
  name: string
  ownerEmail: string
  createdAt: string
  lastActivityAt: string | null
  daysSinceActivity: number
}

interface BusinessHealthData {
  businesses: DormantBusiness[]
  totalBusinesses: number
  dormantCount: number
  dormantThresholdDays: number
}

/**
 * Negocios "dormidos" — sin ninguna acción registrada en Actividad (docs/87) en los
 * últimos 30 días — pedido explícito del dueño del proyecto: "si ves otras cosas que
 * crees que debería poder ver desde /admin, agrégalas". Hoy esa señal solo se nota
 * abriendo una cuenta puntual desde Cuentas; acá se agrupan todas de una vez.
 */
export function BusinessHealthPanel() {
  const { t, language } = useLanguage()
  const [data, setData] = useState<BusinessHealthData | null>(null)

  useEffect(() => {
    fetch("/api/admin/business-health")
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json)
      })
      .catch((error) => console.error("Error cargando salud de negocios:", error))
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_business_health_title")}</CardTitle>
        <CardDescription>
          {data
            ? t("admin_business_health_summary")
                .replace("{dormant}", String(data.dormantCount))
                .replace("{total}", String(data.totalBusinesses))
                .replace("{days}", String(data.dormantThresholdDays))
            : <Skeleton className="h-4 w-64" />}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : data.businesses.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <BellOff className="h-6 w-6" />
            <p className="text-sm">{t("admin_business_health_empty")}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_business_health_table_business")}</TableHead>
                  <TableHead>{t("admin_business_health_table_owner")}</TableHead>
                  <TableHead>{t("admin_business_health_table_created")}</TableHead>
                  <TableHead>{t("admin_business_health_table_last_activity")}</TableHead>
                  <TableHead className="text-right">{t("admin_business_health_table_days")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.businesses.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="text-foreground font-medium">{b.name}</TableCell>
                    <TableCell className="text-muted-foreground">{b.ownerEmail}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString(getDateLocale(language))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.lastActivityAt ? (
                        new Date(b.lastActivityAt).toLocaleDateString(getDateLocale(language))
                      ) : (
                        <span className="text-xs">{t("admin_business_health_never")}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline">{b.daysSinceActivity}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
