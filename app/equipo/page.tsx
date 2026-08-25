"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  Mail,
  Trash2,
  Pencil,
  Clock,
  LayoutDashboard,
  Building2,
  FileText,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Sidebar } from "@/components/sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { FeatureLockedPage } from "@/components/feature-locked"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useFeatureAccess, getAccessBlockReason } from "@/lib/plan-access"
import { startTeamPreview } from "@/lib/storage/team-preview"
import { useRouter } from "next/navigation"
import { Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getAllBusinesses } from "@/lib/storage/businesses"
import { getTeamMembers, inviteTeamMember, updateTeamMember, removeTeamMember, ensureTeamMembersLoaded } from "@/lib/storage/team"
import { MAX_TEAM_MEMBERS, type TeamMember, type TeamMemberPdfAccess } from "@/types/team"
import type { FeatureKey } from "@/lib/plans"
import type { Business } from "@/types/business"

// Herramientas asignables — se deja "team" fuera a propósito: una persona invitada no
// puede a su vez invitar/gestionar el equipo, sin importar qué más se le habilite.
// "recipes"/"ingredients" son las únicas dos que NO limitan el plan real de la cuenta
// (Ficha Técnica/Mis Recetas/Ingredientes están en todos los planes, incluido Foodie)
// — existen como FeatureKey solo para poder restringirlas por persona acá mismo (ver
// lib/plan-access.ts, DEFAULT_ALWAYS_ON_FEATURES).
const ASSIGNABLE_FEATURE_DEFS: { key: FeatureKey; labelKey: "equipo_feature_recipes" | "equipo_feature_ingredients" | "equipo_feature_merma" | "equipo_feature_purchase_orders_manual" | "equipo_feature_purchase_orders_auto" | "equipo_feature_inventory" | "equipo_feature_menus" | "equipo_feature_stats_panorama" | "equipo_feature_stats_finance" }[] = [
  { key: "recipes", labelKey: "equipo_feature_recipes" },
  { key: "ingredients", labelKey: "equipo_feature_ingredients" },
  { key: "merma", labelKey: "equipo_feature_merma" },
  { key: "purchase_orders_manual", labelKey: "equipo_feature_purchase_orders_manual" },
  { key: "purchase_orders_auto", labelKey: "equipo_feature_purchase_orders_auto" },
  { key: "inventory", labelKey: "equipo_feature_inventory" },
  { key: "menus", labelKey: "equipo_feature_menus" },
  { key: "stats_panorama", labelKey: "equipo_feature_stats_panorama" },
  { key: "stats_finance", labelKey: "equipo_feature_stats_finance" },
]

interface MemberFormState {
  email: string
  name: string
  scope: string
  allowedFeatures: FeatureKey[]
  pdfAccess: TeamMemberPdfAccess
}

const emptyForm = (): MemberFormState => ({
  email: "",
  name: "",
  scope: "dashboard",
  allowedFeatures: [],
  pdfAccess: "ninguno",
})

export default function EquipoPage() {
  const canAccessTeam = useFeatureAccess("team")
  const { t } = useLanguage()

  if (canAccessTeam === null) return null

  if (!canAccessTeam) {
    return getAccessBlockReason("team") === "admin" ? (
      <AdminRestrictedPage sectionName={t("equipo_title")} />
    ) : (
      <FeatureLockedPage feature="team" title={t("equipo_locked_title")} description={t("equipo_locked_desc")} />
    )
  }

  return (
    <AuthGuard>
      <EquipoContent />
    </AuthGuard>
  )
}

function EquipoContent() {
  const { toast } = useToast()
  const { t } = useLanguage()
  const router = useRouter()

  const ASSIGNABLE_FEATURES = useMemo(
    () => ASSIGNABLE_FEATURE_DEFS.map((f) => ({ key: f.key, label: t(f.labelKey) })),
    [t],
  )
  const PDF_ACCESS_LABELS: Record<TeamMemberPdfAccess, string> = useMemo(
    () => ({
      ninguno: t("equipo_pdf_ninguno"),
      cliente: t("equipo_pdf_cliente"),
      administrativo: t("equipo_pdf_administrativo"),
    }),
    [t],
  )

  const [members, setMembers] = useState<TeamMember[]>([])
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MemberFormState>(emptyForm())
  // Cola de personas por invitar en esta misma sesión del diálogo — permite armar
  // hasta MAX_TEAM_MEMBERS invitaciones, cada una con su propio acceso/herramientas/
  // PDFs, y enviarlas todas juntas en vez de abrir y cerrar el diálogo por persona.
  const [inviteQueue, setInviteQueue] = useState<MemberFormState[]>([])
  const [isSending, setIsSending] = useState(false)

  const load = async () => {
    await ensureTeamMembersLoaded()
    setMembers(getTeamMembers())
    setBusinesses(getAllBusinesses())
  }

  useEffect(() => {
    load()
  }, [])

  const canInviteMore = members.length < MAX_TEAM_MEMBERS
  const slotsUsed = members.length + inviteQueue.length
  const hasRoomForForm = slotsUsed < MAX_TEAM_MEMBERS

  const businessNameById = useMemo(() => {
    const map = new Map<string, string>()
    businesses.forEach((b) => map.set(b.id, b.name))
    return map
  }, [businesses])

  const openInviteDialog = () => {
    setEditingId(null)
    setForm(emptyForm())
    setInviteQueue([])
    setDialogOpen(true)
  }

  const isEmailTaken = (email: string) => {
    const normalized = email.trim().toLowerCase()
    return (
      members.some((m) => m.email.toLowerCase() === normalized) ||
      inviteQueue.some((q) => q.email.trim().toLowerCase() === normalized)
    )
  }

  const addCurrentToQueue = () => {
    if (!form.email.trim() || !form.email.includes("@")) {
      toast({ title: t("equipo_toast_invalid_email_title"), description: t("equipo_toast_invalid_email_add_desc"), variant: "destructive" })
      return
    }
    if (isEmailTaken(form.email)) {
      toast({ title: t("equipo_toast_duplicate_email_title"), description: t("equipo_toast_duplicate_email_desc"), variant: "destructive" })
      return
    }
    setInviteQueue((prev) => [...prev, form])
    setForm(emptyForm())
  }

  const removeFromQueue = (index: number) => {
    setInviteQueue((prev) => prev.filter((_, i) => i !== index))
  }

  const openEditDialog = (member: TeamMember) => {
    setEditingId(member.id)
    setForm({
      email: member.email,
      name: member.name || "",
      scope: member.scope,
      allowedFeatures: member.allowedFeatures,
      pdfAccess: member.pdfAccess,
    })
    setDialogOpen(true)
  }

  const toggleFeature = (key: FeatureKey, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      allowedFeatures: checked ? [...prev.allowedFeatures, key] : prev.allowedFeatures.filter((f) => f !== key),
    }))
  }

  // Etiquetas legibles para el correo de invitación real (ver app/api/team/invite/route.ts)
  // — se calculan acá porque ya están traducidas al idioma de quien invita, evitando
  // tener que volver a traducir del lado del servidor.
  const scopeLabelFor = (scope: string) =>
    scope === "dashboard"
      ? t("equipo_scope_dashboard_badge")
      : `${t("equipo_scope_business_prefix")} ${businessNameById.get(scope) || scope}`
  const toolsLabelFor = (features: FeatureKey[]) =>
    features.length > 0
      ? features.map((key) => ASSIGNABLE_FEATURES.find((f) => f.key === key)?.label || key).join(", ")
      : "—"

  const handleSubmit = async () => {
    if (editingId) {
      await updateTeamMember(editingId, {
        name: form.name.trim() || undefined,
        scope: form.scope,
        allowedFeatures: form.allowedFeatures,
        pdfAccess: form.pdfAccess,
      })
      toast({ title: t("equipo_toast_access_updated_title"), description: t("equipo_toast_access_updated_desc").replace("{email}", form.email) })
      setDialogOpen(false)
      await load()
      return
    }

    // El formulario visible cuenta como "la última persona" de la tanda solo si
    // tiene un correo cargado — si el usuario ya armó su lista con "Agregar a la
    // lista" y deja el formulario en blanco, se ignora en vez de bloquear el envío.
    const formHasEmail = form.email.trim().length > 0
    if (inviteQueue.length === 0 && !formHasEmail) {
      toast({ title: t("equipo_toast_invalid_email_title"), description: t("equipo_toast_invalid_email_invite_desc"), variant: "destructive" })
      return
    }
    if (formHasEmail && !form.email.includes("@")) {
      toast({ title: t("equipo_toast_invalid_email_title"), description: t("equipo_toast_invalid_email_invite_desc"), variant: "destructive" })
      return
    }
    if (formHasEmail && isEmailTaken(form.email)) {
      toast({ title: t("equipo_toast_duplicate_email_title"), description: t("equipo_toast_duplicate_email_desc"), variant: "destructive" })
      return
    }

    const batch = formHasEmail ? [...inviteQueue, form] : inviteQueue
    const invited: string[] = []
    const emailFailed: string[] = []
    const failed: { email: string; message: string }[] = []

    setIsSending(true)
    for (const entry of batch) {
      // Manda primero la invitación real (crea/enlaza la cuenta real y otorga acceso
      // real de lectura al negocio — ver app/api/team/invite/route.ts) para conocer el
      // invitedUserId ANTES de guardar el roster, y así guardarlo junto con la fila —
      // es lo que permite revocar el acceso real después si se edita/quita a la persona.
      let invitedUserId: string | null = null
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: entry.email,
            scope: entry.scope,
            scopeLabel: scopeLabelFor(entry.scope),
            toolsLabel: toolsLabelFor(entry.allowedFeatures),
            pdfAccessLabel: PDF_ACCESS_LABELS[entry.pdfAccess],
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          emailFailed.push(entry.email)
        } else {
          invitedUserId = data.invitedUserId || null
        }
      } catch {
        emailFailed.push(entry.email)
      }

      // El correo/cuenta real es best-effort: si falla, la persona sigue guardada en
      // el roster (Vista previa sigue funcionando) — no se revierte la invitación por
      // esto, solo se avisa aparte para que el dueño le comparta el acceso él mismo
      // mientras tanto.
      try {
        await inviteTeamMember({
          email: entry.email,
          name: entry.name,
          scope: entry.scope,
          allowedFeatures: entry.allowedFeatures,
          pdfAccess: entry.pdfAccess,
          invitedUserId,
        })
        invited.push(entry.email)
      } catch (error) {
        failed.push({ email: entry.email, message: error instanceof Error ? error.message : t("equipo_error_generic") })
      }
    }
    setIsSending(false)

    await load()

    if (invited.length > 0) {
      toast({
        title: invited.length === 1 ? t("equipo_toast_invite_registered_title_singular") : t("equipo_toast_invite_registered_title_plural").replace("{count}", String(invited.length)),
        description: t("equipo_toast_invite_registered_desc").replace("{emails}", invited.join(", ")),
      })
    }
    if (emailFailed.length > 0) {
      toast({
        title: t("equipo_toast_email_failed_title"),
        description: t("equipo_toast_email_failed_desc").replace("{emails}", emailFailed.join(", ")),
        variant: "destructive",
      })
    }
    if (failed.length > 0) {
      toast({
        title: invited.length > 0 ? t("equipo_toast_some_failed_title") : t("equipo_toast_none_invited_title"),
        description: failed.map((f) => `${f.email}: ${f.message}`).join(" · "),
        variant: "destructive",
      })
    }

    if (failed.length === 0) {
      setDialogOpen(false)
    } else {
      // Deja en la lista solo a quienes fallaron, para que el usuario pueda corregir
      // (por ejemplo un correo duplicado) sin perder ni reescribir a los demás.
      setInviteQueue(batch.filter((entry) => failed.some((f) => f.email === entry.email)))
      setForm(emptyForm())
    }
  }

  const handleRemove = async (id: string, email: string) => {
    await removeTeamMember(id)
    toast({ title: t("equipo_toast_removed_title"), description: t("equipo_toast_removed_desc").replace("{email}", email) })
    await load()
  }

  // Sin backend real no hay forma de darle a esta persona su propia sesión (ver
  // disclaimer del diálogo de invitar) — "Vista previa" es la manera de que el dueño
  // de la cuenta compruebe, en la app real, que la configuración de acceso que armó
  // realmente restringe lo que dice restringir: activa la simulación (ver
  // lib/storage/team-preview.ts) y aterriza exactamente donde esa persona aterrizaría
  // según su alcance (scope).
  const handlePreview = (member: TeamMember) => {
    startTeamPreview(member.id)
    router.push(member.scope === "dashboard" ? "/dashboard" : `/business/${member.scope}`)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 md:gap-4">
              <Link href="/dashboard">
                <Button variant="outline" size="sm" className="gap-2 hover:bg-accent border-2 shadow-sm bg-transparent">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("mi_plan_back_to_dashboard")}</span>
                  <span className="sm:hidden">{t("common_back")}</span>
                </Button>
              </Link>
              <div data-tour="equipo-header">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  {t("equipo_title")}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground">
                  {t("equipo_subtitle").replace("{max}", String(MAX_TEAM_MEMBERS))}
                </p>
              </div>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button data-tour="equipo-invite" onClick={openInviteDialog} disabled={!canInviteMore} className="gap-2">
                  <Mail className="h-4 w-4" />
                  {t("equipo_invite_button")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? t("equipo_dialog_title_edit") : t("equipo_dialog_title_invite")}</DialogTitle>
                  <DialogDescription>
                    {editingId
                      ? t("equipo_dialog_desc_edit").replace("{email}", form.email)
                      : t("equipo_dialog_desc_invite").replace("{max}", String(MAX_TEAM_MEMBERS))}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  {!editingId && inviteQueue.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t("equipo_queue_label").replace("{count}", String(inviteQueue.length))}</Label>
                      <div className="space-y-1.5">
                        {inviteQueue.map((entry, index) => (
                          <div
                            key={`${entry.email}-${index}`}
                            className="flex items-center justify-between gap-2 text-sm bg-muted/40 rounded-lg px-3 py-2"
                          >
                            <span className="truncate">{entry.name ? `${entry.name} · ${entry.email}` : entry.email}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeFromQueue(index)}
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(editingId || hasRoomForForm) && (
                    <>
                  <div className="space-y-2">
                    <Label htmlFor="team-email">{t("equipo_field_email_label")}</Label>
                    <Input
                      id="team-email"
                      type="email"
                      placeholder={t("equipo_field_email_placeholder")}
                      value={form.email}
                      disabled={!!editingId}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team-name">{t("equipo_field_name_label")}</Label>
                    <Input
                      id="team-name"
                      placeholder={t("equipo_field_name_placeholder")}
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("equipo_field_access_label")}</Label>
                    <Select value={form.scope} onValueChange={(value) => setForm((prev) => ({ ...prev, scope: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">
                          <span className="flex items-center gap-2">
                            <LayoutDashboard className="h-4 w-4" />
                            {t("equipo_scope_dashboard_option")}
                          </span>
                        </SelectItem>
                        {businesses.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            <span className="flex items-center gap-2">
                              <Building2 className="h-4 w-4" />
                              {t("equipo_scope_business_prefix")} {b.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{t("equipo_scope_hint")}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("equipo_field_tools_label")}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-border rounded-lg p-3">
                      {ASSIGNABLE_FEATURES.map((feature) => (
                        <div key={feature.key} className="flex items-center gap-2">
                          <Checkbox
                            id={`feature-${feature.key}`}
                            checked={form.allowedFeatures.includes(feature.key)}
                            onCheckedChange={(checked) => toggleFeature(feature.key, checked === true)}
                          />
                          <Label htmlFor={`feature-${feature.key}`} className="text-sm font-normal cursor-pointer">
                            {feature.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {t("equipo_field_pdf_label")}
                    </Label>
                    <RadioGroup
                      value={form.pdfAccess}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, pdfAccess: value as TeamMemberPdfAccess }))}
                    >
                      {(Object.keys(PDF_ACCESS_LABELS) as TeamMemberPdfAccess[]).map((level) => (
                        <div key={level} className="flex items-center gap-2">
                          <RadioGroupItem value={level} id={`pdf-${level}`} />
                          <Label htmlFor={`pdf-${level}`} className="text-sm font-normal cursor-pointer">
                            {PDF_ACCESS_LABELS[level]}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {!editingId && slotsUsed + 1 < MAX_TEAM_MEMBERS && (
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addCurrentToQueue}>
                      <Mail className="h-4 w-4" />
                      {t("equipo_add_to_queue_button")}
                    </Button>
                  )}
                    </>
                  )}

                  {!editingId && !hasRoomForForm && (
                    <p className="text-sm text-muted-foreground">
                      {t("equipo_queue_full_notice").replace("{max}", String(MAX_TEAM_MEMBERS))}
                    </p>
                  )}

                  {!editingId && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" />
                      <p>{t("equipo_no_backend_notice")}</p>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    {t("common_cancel")}
                  </Button>
                  <Button onClick={handleSubmit} disabled={isSending}>
                    {isSending
                      ? t("equipo_sending_button")
                      : editingId
                        ? t("equipo_save_changes_button")
                        : inviteQueue.length > 0
                          ? t("equipo_send_invitations_button").replace("{count}", String(inviteQueue.length + (form.email.trim() ? 1 : 0)))
                          : t("equipo_send_invitation_button")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="text-sm text-muted-foreground">
            {t("equipo_members_count").replace("{count}", String(members.length)).replace("{max}", String(MAX_TEAM_MEMBERS))}
            {!canInviteMore && ` ${t("equipo_max_reached_suffix")}`}
          </div>

          {members.length === 0 ? (
            <Card className="border-2 border-dashed border-border bg-card">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <Users className="h-12 w-12 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold">{t("equipo_empty_title")}</h3>
                <p className="text-muted-foreground text-sm max-w-md">
                  {t("equipo_subtitle").replace("{max}", String(MAX_TEAM_MEMBERS))}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {members.map((member) => (
                <Card key={member.id} className="border border-border shadow-sm bg-card">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {member.name || member.email}
                          <Badge variant={member.status === "activo" ? "default" : "outline"} className="text-xs">
                            {member.status === "activo" ? t("equipo_status_active") : t("equipo_status_invited")}
                          </Badge>
                        </CardTitle>
                        {member.name && <CardDescription>{member.email}</CardDescription>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => handlePreview(member)} className="gap-1.5">
                          <Eye className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t("equipo_preview_button")}</span>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(member)} className="gap-1.5">
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{t("equipo_edit_button")}</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">{t("equipo_remove_button")}</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("equipo_remove_confirm_title").replace("{name}", member.name || member.email)}</AlertDialogTitle>
                              <AlertDialogDescription>{t("equipo_remove_confirm_desc")}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemove(member.id, member.email)}>
                                {t("equipo_remove_button")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="outline" className="gap-1.5">
                        {member.scope === "dashboard" ? (
                          <>
                            <LayoutDashboard className="h-3 w-3" />
                            {t("equipo_scope_dashboard_badge")}
                          </>
                        ) : (
                          <>
                            <Building2 className="h-3 w-3" />
                            {businessNameById.get(member.scope) || t("equipo_business_deleted")}
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="gap-1.5">
                        <FileText className="h-3 w-3" />
                        {t("equipo_pdf_badge_prefix")} {PDF_ACCESS_LABELS[member.pdfAccess]}
                      </Badge>
                    </div>

                    {member.allowedFeatures.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {member.allowedFeatures.map((key) => (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {ASSIGNABLE_FEATURES.find((f) => f.key === key)?.label || key}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                        {t("equipo_activity_label")}
                      </p>
                      {member.activity.length === 0 ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {t("equipo_activity_empty")}
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {member.activity.map((entry) => (
                            <li key={entry.id} className="text-xs text-muted-foreground">
                              {entry.description} — {new Date(entry.timestamp).toLocaleString()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
