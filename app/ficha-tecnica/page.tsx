"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Database, AlertTriangle } from "lucide-react"
import { Sidebar } from "@/components/sidebar"
import { TechnicalSheet } from "@/components/technical-sheet"
import { FichaTecnicaTour } from "@/components/page-tours"
import { useAuth } from "@/contexts/auth-context"
import { useFeatureAccess } from "@/lib/plan-access"
import { AdminRestrictedPage } from "@/components/admin-restricted"
import { useToast } from "@/hooks/use-toast"
import { useLanguage } from "@/contexts/language-context"
import { getIngredients, ensureIngredientsLoaded } from "@/lib/storage/ingredients"
import { getRecipes, ensureRecipesLoaded } from "@/lib/storage/recipes"
import type { Ingredient } from "@/types/ingredient"
import type { Recipe } from "@/types/recipe"

export default function FichaTecnicaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const businessId = searchParams.get("business") || "main"
  const { isLoggedIn, authChecked } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const canAccessRecipes = useFeatureAccess("recipes")

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)

        await Promise.all([ensureIngredientsLoaded(businessId), ensureRecipesLoaded(businessId)])
        const savedIngredients = getIngredients(businessId)
        const savedRecipes = getRecipes(businessId)

        setIngredients(savedIngredients)
        setRecipes(savedRecipes)
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
  }, [businessId, toast])

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

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 mb-8">
            <Link href={businessId !== "main" ? `/business/${businessId}` : "/dashboard"}>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("common_back")}
              </Button>
            </Link>
            <div className="flex-1" data-tour="ficha-header">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">{t("ficha_tecnica_title")}</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                {t("ficha_tecnica_subtitle")}
              </p>
            </div>
            <Button
              data-tour="ficha-ingredientes-btn"
              onClick={() => router.push(`/ingredientes${businessId !== "main" ? `?business=${businessId}` : ""}`)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {t("nav_ingredientes")}
            </Button>
          </div>
          {!isLoading && ingredients.length === 0 && (
            <Alert data-tour="ficha-warning" className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
              <AlertTitle className="text-amber-900 dark:text-amber-200">
                {t("ficha_tecnica_no_ingredients_alert_title")}
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-300">
                <p className="mb-3">
                  {t("ficha_tecnica_no_ingredients_alert_desc")}
                </p>
                <Button
                  size="sm"
                  onClick={() => router.push(`/ingredientes${businessId !== "main" ? `?business=${businessId}` : ""}`)}
                  className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Database className="h-4 w-4" />
                  {t("ficha_tecnica_go_to_ingredients_db")}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div data-tour="ficha-form">
            <TechnicalSheet mode="new" businessId={businessId} ingredients={ingredients} recipes={recipes} />
          </div>
          <FichaTecnicaTour hasIngredients={ingredients.length > 0} />
        </div>
      </div>
    </div>
  )
}
