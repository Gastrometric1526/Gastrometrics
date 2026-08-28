"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, FileDown, Pencil } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { TechnicalSheet } from "@/components/technical-sheet"
import { RecipePDFExportDialog } from "@/components/recipe-pdf-export-dialog"
import { FichaTecnicaTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useFeatureAccess } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getRecipes, getRecipeById, ensureRecipesLoaded } from "@/lib/storage/recipes"
import { getBusinessById, refreshBusinesses } from "@/lib/storage/businesses"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"
import type { Business } from "@/types/business"

export default function FichaTecnicaEditPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { business?: string; mode?: string }
}) {
  const router = useRouter()
  const businessId = searchParams.business || "main"
  const mode = (searchParams.mode as "view" | "edit") || "view"
  const recipeId = params.id
  const { isLoggedIn, authChecked } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const canAccessRecipes = useFeatureAccess("recipes")

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [business, setBusiness] = useState<Business | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showPDFExport, setShowPDFExport] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)

        await Promise.all([
          ensureIngredientsLoaded(businessId),
          ensureRecipesLoaded(businessId),
          refreshBusinesses(),
        ])

        const savedIngredients = getIngredients(businessId)
        const savedRecipes = getRecipes(businessId)
        const targetRecipe = getRecipeById(recipeId, businessId)

        setIngredients(savedIngredients)
        setRecipes(savedRecipes)
        setRecipe(targetRecipe)
        setBusiness(getBusinessById(businessId))

        if (!targetRecipe) {
          toast({
            title: t("ficha_tecnica_recipe_not_found_title"),
            description: t("ficha_tecnica_toast_recipe_not_found_desc"),
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error loading data:", error)
        toast({
          title: t("ficha_tecnica_toast_load_error_title"),
          description: t("ficha_tecnica_toast_load_error_desc"),
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [businessId, recipeId, mode, toast])

  useEffect(() => {
    const handleIngredientsUpdate = (event: CustomEvent) => {
      if (event.detail.businessId === businessId) {
        const updatedIngredients = getIngredients(businessId)
        setIngredients(updatedIngredients)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
      return () => window.removeEventListener("ingredientsUpdated", handleIngredientsUpdate as EventListener)
    }
  }, [businessId])

  if (!authChecked) {
    return null
  }

  if (!isLoggedIn) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <h3 className="text-xl font-semibold mb-2">{t("ficha_tecnica_access_required_title")}</h3>
            <p className="text-muted-foreground text-center mb-6">
              {t("ficha_tecnica_access_required_desc")}
            </p>
            <Button onClick={() => router.push("/login")}>{t("login_submit")}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (canAccessRecipes === null) {
    return null
  }

  if (!canAccessRecipes) {
    return <AdminRestrictedPage sectionName="Ficha Técnica" />
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            <Card className="max-w-md mx-auto mt-16">
              <CardContent className="p-6 text-center">
                <h2 className="text-xl font-semibold text-foreground mb-2">{t("ficha_tecnica_recipe_not_found_title")}</h2>
                <p className="text-sm md:text-base text-muted-foreground mb-4">
                  {t("ficha_tecnica_recipe_not_found_card_desc")}
                </p>
                <Button
                  onClick={() => router.push(`/mis-recetas${businessId !== "main" ? `?business=${businessId}` : ""}`)}
                >
                  {t("ficha_tecnica_back_to_my_recipes")}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4" data-tour="ficha-header">
            <div className="flex items-center gap-4">
              <Link href={`/mis-recetas${businessId !== "main" ? `?business=${businessId}` : ""}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common_back")}
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                  {mode === "view" ? t("ficha_tecnica_view_recipe_title") : t("ficha_tecnica_edit_recipe_title")}: {recipe.name}
                </h1>
                <p className="text-sm text-muted-foreground">{t("nav_ficha_tecnica")}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {mode === "view" && (
                <Button
                  onClick={() => router.push(`/ficha-tecnica/${recipeId}?business=${businessId}&mode=edit`)}
                  variant="outline"
                  className="gap-2"
                >
                  <Pencil className="h-4 w-4" />
                  {t("common_edit")}
                </Button>
              )}
              <Button onClick={() => setShowPDFExport(true)} variant="outline" className="gap-2">
                <FileDown className="h-4 w-4" />
                {t("ficha_tecnica_export_pdf")}
              </Button>
              <Button
                data-tour="ficha-ingredientes-btn"
                onClick={() => router.push(`/ingredientes${businessId !== "main" ? `?business=${businessId}` : ""}`)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {t("nav_ingredientes")}
              </Button>
            </div>
          </div>

          <TechnicalSheet
            mode={mode}
            businessId={businessId}
            recipeId={recipeId}
          />
          <FichaTecnicaTour hasIngredients={ingredients.length > 0} />
        </div>
      </div>

      <RecipePDFExportDialog
        recipe={recipe}
        open={showPDFExport}
        onOpenChange={setShowPDFExport}
        businessName={business?.name || t("ficha_tecnica_default_business_name")}
        businessLogo={business?.logo}
      />
    </div>
  )
}
