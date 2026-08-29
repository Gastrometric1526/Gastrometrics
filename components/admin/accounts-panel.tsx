"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"
import { plans, getPlanBySlug } from "@/lib/plans"
import { ArrowLeft, Search, Users, Building2, FileText, Package } from "lucide-react"

interface AccountRow {
  userId: string
  email: string
  createdAt: string
  emailConfirmed: boolean
  planSlug: string
  planExpiresAt: string | null
  businessCount: number
  teamMemberCount: number
  recipeCount: number
  ingredientCount: number
  salesImportCount: number
  lastSalesImportAt: string | null
}

interface AccountDetail {
  userId: string
  email: string
  createdAt: string
  emailConfirmed: boolean
  planSlug: string
  planExpiresAt: string | null
  businessCount: number
}

interface AccountBusiness {
  id: string
  name: string
  createdAt: string
  isActive: boolean
}

interface AccountTeamMember {
  id: string
  email: string
  name?: string
  status: string
  scope: string
  allowedFeatures: string[]
  pdfAccess: string
  invitedAt: string
  invitedUserId: string | null
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function dateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day, 23, 59, 59).toISOString()
}

/** Lista completa de cuentas + detalle (plan/negocios/equipo) de cualquiera de ellas — pedido explícito del dueño del proyecto ("ahi debo poder manejar TODO"), ver docs/63. */
export function AccountsPanel() {
  const { toast } = useToast()
  const { t, language } = useLanguage()

  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState("todos")
  const [loadingList, setLoadingList] = useState(false)

  const [selected, setSelected] = useState<AccountRow | null>(null)
  const [detail, setDetail] = useState<AccountDetail | null>(null)
  const [businesses, setBusinesses] = useState<AccountBusiness[]>([])
  const [team, setTeam] = useState<AccountTeamMember[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [selectedPlanSlug, setSelectedPlanSlug] = useState("")
  const [expiresAtInput, setExpiresAtInput] = useState("")
  const [applyingPlan, setApplyingPlan] = useState(false)

  const [presenceByUserId, setPresenceByUserId] = useState<
    Record<string, { online: boolean; lastSeenAt: string | null }>
  >({})

  const loadList = async (targetPage: number, targetSearch: string, targetPlan: string) => {
    setLoadingList(true)
    try {
      const planParam = targetPlan && targetPlan !== "todos" ? `&plan=${encodeURIComponent(targetPlan)}` : ""
      const res = await fetch(`/api/admin/accounts?page=${targetPage}&search=${encodeURIComponent(targetSearch)}${planParam}`)
      const data = await res.json()
      if (Array.isArray(data.accounts)) {
        setAccounts(data.accounts)
        setTotal(data.total || 0)
        setPageSize(data.pageSize || 25)
      }
    } catch (error) {
      console.error("Error listando cuentas:", error)
      toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    loadList(page, search, planFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  // Presencia: se sondea aparte de la lista completa (cada ~25s), solo para las
  // cuentas ya cargadas en la página actual — así el punto de "en línea" se mantiene
  // al día sin re-pedir plan/negocios/equipo/recetas/ingredientes en cada ciclo, y sin
  // tocar el estado de búsqueda/paginación/detalle expandido.
  useEffect(() => {
    if (accounts.length === 0) return
    const ids = accounts.map((a) => a.userId)

    const poll = () => {
      fetch("/api/admin/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ids }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.presence) setPresenceByUserId((prev) => ({ ...prev, ...data.presence }))
        })
        .catch(() => {})
    }

    poll()
    const interval = setInterval(poll, 25_000)
    return () => clearInterval(interval)
  }, [accounts])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadList(1, search, planFilter)
  }

  const handlePlanFilterChange = (value: string) => {
    setPlanFilter(value)
    setPage(1)
    loadList(1, search, value)
  }

  const loadDetail = async (account: AccountRow) => {
    setSelected(account)
    setLoadingDetail(true)
    try {
      const [planRes, businessesRes, teamRes] = await Promise.all([
        fetch(`/api/admin/account-plan?email=${encodeURIComponent(account.email)}`),
        fetch(`/api/admin/account-businesses?userId=${encodeURIComponent(account.userId)}`),
        fetch(`/api/admin/account-team?userId=${encodeURIComponent(account.userId)}`),
      ])
      const planData = await planRes.json()
      const businessesData = await businessesRes.json()
      const teamData = await teamRes.json()

      if (planData.found) {
        setDetail(planData)
        setSelectedPlanSlug(planData.planSlug)
        setExpiresAtInput(toDateInputValue(planData.planExpiresAt))
      }
      setBusinesses(Array.isArray(businessesData.businesses) ? businessesData.businesses : [])
      setTeam(Array.isArray(teamData.members) ? teamData.members : [])
    } catch (error) {
      console.error("Error cargando detalle de cuenta:", error)
      toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
    } finally {
      setLoadingDetail(false)
    }
  }

  const closeDetail = () => {
    setSelected(null)
    setDetail(null)
    setBusinesses([])
    setTeam([])
  }

  const handleApplyPlan = async () => {
    if (!detail || !selectedPlanSlug) return
    setApplyingPlan(true)
    try {
      const res = await fetch("/api/admin/account-plan", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: detail.email,
          planSlug: selectedPlanSlug,
          expiresAt: expiresAtInput ? dateInputToIso(expiresAtInput) : null,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setDetail((prev) => (prev ? { ...prev, planSlug: data.planSlug, planExpiresAt: data.planExpiresAt } : prev))
        toast({ title: t("admin_accounts_plan_applied_toast") })
      } else {
        toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
      }
    } catch (error) {
      console.error("Error cambiando el plan:", error)
      toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
    } finally {
      setApplyingPlan(false)
    }
  }

  const setExpiresInDays = (days: number) => {
    const target = new Date()
    target.setDate(target.getDate() + days)
    setExpiresAtInput(toDateInputValue(target.toISOString()))
  }

  const handleToggleBusiness = async (business: AccountBusiness) => {
    if (!selected) return
    const nextActive = !business.isActive
    try {
      const res = await fetch("/api/admin/account-businesses", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.userId, businessId: business.id, isActive: nextActive }),
      })
      if (!res.ok) throw new Error("failed")
      setBusinesses((prev) => prev.map((b) => (b.id === business.id ? { ...b, isActive: nextActive } : b)))
    } catch (error) {
      console.error("Error actualizando negocio:", error)
      toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
    }
  }

  const handleRevokeMember = async (member: AccountTeamMember) => {
    if (!selected) return
    const confirmed = window.confirm(t("admin_accounts_team_revoke_confirm").replace("{email}", member.email))
    if (!confirmed) return
    try {
      const res = await fetch(`/api/admin/account-team?id=${encodeURIComponent(member.id)}&userId=${encodeURIComponent(selected.userId)}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("failed")
      setTeam((prev) => prev.filter((m) => m.id !== member.id))
    } catch (error) {
      console.error("Error revocando miembro:", error)
      toast({ title: t("admin_accounts_error_toast"), variant: "destructive" })
    }
  }

  const planIsExpired = Boolean(detail?.planExpiresAt && new Date(detail.planExpiresAt).getTime() < Date.now())
  const hasUnappliedChanges =
    !!detail && (selectedPlanSlug !== detail.planSlug || expiresAtInput !== toDateInputValue(detail.planExpiresAt))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (selected) {
    return (
      <Card>
        <CardHeader>
          <Button variant="ghost" size="sm" className="gap-2 -ml-3 mb-2 w-fit" onClick={closeDetail}>
            <ArrowLeft className="h-4 w-4" />
            {t("admin_accounts_back_to_list")}
          </Button>
          <CardTitle>{selected.email}</CardTitle>
          {detail && (
            <CardDescription>
              {t("admin_accounts_created")} {new Date(detail.createdAt).toLocaleDateString(getDateLocale(language))}
              {" · "}
              {detail.emailConfirmed ? t("admin_accounts_confirmed") : t("admin_accounts_unconfirmed")}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingDetail ? (
            <p className="text-sm text-muted-foreground">{t("admin_accounts_searching")}</p>
          ) : (
            <>
              {detail && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{getPlanBySlug(detail.planSlug).name}</Badge>
                    {detail.planExpiresAt && (
                      <Badge variant={planIsExpired ? "destructive" : "outline"}>
                        {planIsExpired
                          ? t("admin_accounts_expired_badge")
                          : t("admin_accounts_expires_badge").replace(
                              "{date}",
                              new Date(detail.planExpiresAt).toLocaleDateString(getDateLocale(language)),
                            )}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{t("admin_accounts_plan_label")}</Label>
                      <Select value={selectedPlanSlug} onValueChange={setSelectedPlanSlug}>
                        <SelectTrigger className="w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.map((plan) => (
                            <SelectItem key={plan.slug} value={plan.slug}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="plan-expires-at" className="text-xs text-muted-foreground">
                        {t("admin_accounts_expires_label")}
                      </Label>
                      <Input
                        id="plan-expires-at"
                        type="date"
                        className="w-44"
                        value={expiresAtInput}
                        onChange={(e) => setExpiresAtInput(e.target.value)}
                      />
                    </div>
                    <Button size="sm" onClick={handleApplyPlan} disabled={applyingPlan || !hasUnappliedChanges}>
                      {applyingPlan ? t("admin_accounts_applying") : t("admin_accounts_apply_button")}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">{t("admin_accounts_expires_quick_label")}</span>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setExpiresInDays(7)}>
                      {t("admin_accounts_expires_7d")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setExpiresInDays(30)}>
                      {t("admin_accounts_expires_30d")}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setExpiresInDays(90)}>
                      {t("admin_accounts_expires_90d")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => setExpiresAtInput("")}
                      disabled={!expiresAtInput}
                    >
                      {t("admin_accounts_expires_clear")}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{t("admin_accounts_businesses_title")}</h3>
                {businesses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin_accounts_businesses_empty")}</p>
                ) : (
                  <div className="space-y-2">
                    {businesses.map((b) => (
                      <div key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{b.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(b.createdAt).toLocaleDateString(getDateLocale(language))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={b.isActive ? "secondary" : "outline"}>
                            {b.isActive ? t("admin_accounts_business_active") : t("admin_accounts_business_inactive")}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={() => handleToggleBusiness(b)}>
                            {b.isActive ? t("admin_accounts_business_deactivate") : t("admin_accounts_business_activate")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">{t("admin_accounts_team_title")}</h3>
                {team.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("admin_accounts_team_empty")}</p>
                ) : (
                  <div className="space-y-2">
                    {team.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{m.name || m.email}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.email} · {m.scope === "dashboard" ? t("admin_accounts_team_scope_dashboard") : m.scope}
                          </p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleRevokeMember(m)}>
                          {t("admin_accounts_team_revoke")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_accounts_list_title")}</CardTitle>
        <CardDescription>{t("admin_accounts_subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2">
          <Input
            type="email"
            placeholder={t("admin_accounts_email_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Select value={planFilter} onValueChange={handlePlanFilterChange}>
            <SelectTrigger className="w-48 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{t("admin_accounts_filter_plan_all")}</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan.slug} value={plan.slug}>
                  {plan.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={loadingList} className="shrink-0 gap-2">
            <Search className="h-4 w-4" />
            {loadingList ? t("admin_accounts_searching") : t("admin_accounts_search_button")}
          </Button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border">
                <th className="py-2 pr-2 font-medium">{t("admin_accounts_table_email")}</th>
                <th className="py-2 pr-2 font-medium">{t("admin_accounts_table_plan")}</th>
                <th className="py-2 pr-2 font-medium">
                  <Building2 className="h-3.5 w-3.5 inline mr-1" />
                  {t("admin_accounts_table_businesses")}
                </th>
                <th className="py-2 pr-2 font-medium">
                  <Users className="h-3.5 w-3.5 inline mr-1" />
                  {t("admin_accounts_table_team")}
                </th>
                <th className="py-2 pr-2 font-medium">
                  <FileText className="h-3.5 w-3.5 inline mr-1" />
                  {t("admin_accounts_table_recipes")}
                </th>
                <th className="py-2 pr-2 font-medium">
                  <Package className="h-3.5 w-3.5 inline mr-1" />
                  {t("admin_accounts_table_ingredients")}
                </th>
                <th className="py-2 pr-2 font-medium">{t("admin_accounts_table_pos_import")}</th>
                <th className="py-2 pr-2 font-medium">{t("admin_accounts_table_created")}</th>
                <th className="py-2 pr-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.userId} className="border-b border-border/50">
                  <td className="py-2 pr-2 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          presenceByUserId[a.userId]?.online ? "bg-green-500" : "bg-muted-foreground/30"
                        }`}
                        title={
                          presenceByUserId[a.userId]?.online
                            ? t("admin_accounts_online")
                            : presenceByUserId[a.userId]?.lastSeenAt
                              ? t("admin_accounts_last_seen").replace(
                                  "{date}",
                                  new Date(presenceByUserId[a.userId]!.lastSeenAt as string).toLocaleString(
                                    getDateLocale(language),
                                  ),
                                )
                              : t("admin_accounts_never_seen")
                        }
                      />
                      {a.email}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground">{getPlanBySlug(a.planSlug).name}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{a.businessCount}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{a.teamMemberCount}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{a.recipeCount}</td>
                  <td className="py-2 pr-2 text-muted-foreground">{a.ingredientCount}</td>
                  <td className="py-2 pr-2 text-muted-foreground">
                    {a.salesImportCount > 0 ? (
                      <Badge
                        variant="secondary"
                        title={
                          a.lastSalesImportAt
                            ? new Date(a.lastSalesImportAt).toLocaleDateString(getDateLocale(language))
                            : undefined
                        }
                      >
                        {t("admin_accounts_pos_imported").replace("{count}", String(a.salesImportCount))}
                      </Badge>
                    ) : (
                      <span className="text-xs">{t("admin_accounts_pos_none")}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground">
                    {new Date(a.createdAt).toLocaleDateString(getDateLocale(language))}
                  </td>
                  <td className="py-2 pr-2">
                    <Button size="sm" variant="ghost" onClick={() => loadDetail(a)}>
                      {t("admin_accounts_view_detail")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {total > pageSize && (
          <div className="flex items-center justify-between pt-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t("admin_accounts_pagination_prev")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("admin_accounts_page_of").replace("{page}", String(page)).replace("{total}", String(totalPages))}
            </span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              {t("admin_accounts_pagination_next")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
