"use client"

import Link from "next/link"
import { MarketingHeader } from "@/components/marketing-header"
import { MarketingFooter } from "@/components/marketing-footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resourceArticles } from "@/lib/resource-articles"
import { useLanguage } from "@/contexts/language-context"
import { ArrowRight, BookOpen } from "lucide-react"

export function RecursosContent() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />

      <main className="container mx-auto px-4 py-16 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">{t("resource_index_title")}</h1>
          <p className="text-lg text-muted-foreground">{t("resource_index_subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {resourceArticles.map((article) => (
            <Link key={article.slug} href={`/recursos/${article.slug}`} className="block h-full">
              <Card className="h-full border-border hover:border-primary/40 transition-all duration-300 bg-card cursor-pointer">
                <CardHeader className="text-center">
                  <div className="mx-auto w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{t(article.titleKey)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-center">{t(article.taglineKey)}</p>
                  <p className="text-primary text-sm font-medium text-center mt-4 inline-flex items-center gap-1 justify-center w-full">
                    {t("resource_read_article")} <ArrowRight className="h-3.5 w-3.5" />
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
