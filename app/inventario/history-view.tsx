"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar, ChevronDown, Download, Eye, Filter, Search } from "lucide-react"
import type { InventorySnapshot } from "@/types/inventory"
import { formatCurrency } from "@/lib/currency"
import { useLanguage } from "@/contexts/language-context"
import { getDateLocale } from "@/lib/i18n/translations"

interface HistoryViewProps {
  inventoryHistory: InventorySnapshot[]
  exportInventory: (inventory: InventorySnapshot) => void
  isLoading: boolean
}

export function HistoryView({ inventoryHistory, exportInventory, isLoading }: HistoryViewProps) {
  const { t, language } = useLanguage()
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [periodFilter, setPeriodFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [selectedInventory, setSelectedInventory] = useState<InventorySnapshot | null>(null)
  const [isViewingDetails, setIsViewingDetails] = useState(false)
  const [selectedSnapshot, setSelectedSnapshot] = useState<InventorySnapshot | null>(null)

  // Filtrado
  const filteredHistory = inventoryHistory.filter((inv) => {
    // Búsqueda por texto (ID o fecha)
    const matchesSearch =
      searchTerm === "" || inv.id.toLowerCase().includes(searchTerm.toLowerCase()) || inv.date.includes(searchTerm)

    // Filtros específicos
    const matchesType = typeFilter === null || inv.type === typeFilter
    const matchesPeriod = periodFilter === null || inv.periodicity === periodFilter
    const matchesDate = dateFilter === "" || inv.date.includes(dateFilter)

    return matchesSearch && matchesType && matchesPeriod && matchesDate
  })

  // Paginación
  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedHistory = filteredHistory.slice(startIndex, startIndex + itemsPerPage)

  // Modificar la función formatDate para manejar valores undefined
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A"
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" }
    return new Date(dateString).toLocaleDateString(getDateLocale(language), options)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("inventario_history_title")}</CardTitle>
          <CardDescription>{t("inventario_history_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder={t("inventario_history_search_placeholder")}
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 bg-transparent">
                      <Filter className="mr-2 h-4 w-4" />
                      {t("inventario_type_label")}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t("inventario_filter_type_label")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setTypeFilter(null)}>{t("inventario_filter_all")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("inicial")}>{t("inventario_type_initial")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setTypeFilter("final")}>{t("inventario_type_final")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 bg-transparent">
                      <Filter className="mr-2 h-4 w-4" />
                      {t("inventario_period_label")}
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{t("inventario_filter_period_label")}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setPeriodFilter(null)}>{t("inventario_filter_all")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPeriodFilter("diario")}>{t("inventario_period_daily")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPeriodFilter("semanal")}>{t("inventario_period_weekly")}</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPeriodFilter("mensual")}>{t("inventario_period_monthly")}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    placeholder={t("inventario_filter_date_placeholder")}
                    className="pl-8 h-9 w-[180px]"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                  />
                </div>
              </div>
            </div>

            {typeFilter || periodFilter || dateFilter ? (
              <div className="flex flex-wrap gap-2 pb-2">
                {typeFilter && (
                  <Badge variant="secondary" className="flex gap-1 items-center">
                    {t("inventario_filter_badge_type").replace("{value}", typeFilter === "inicial" ? t("inventario_type_initial") : t("inventario_type_final"))}
                    <button className="ml-1 hover:text-primary" onClick={() => setTypeFilter(null)}>
                      ×
                    </button>
                  </Badge>
                )}
                {periodFilter && (
                  <Badge variant="secondary" className="flex gap-1 items-center">
                    {t("inventario_filter_badge_period").replace("{value}", periodFilter)}
                    <button className="ml-1 hover:text-primary" onClick={() => setPeriodFilter(null)}>
                      ×
                    </button>
                  </Badge>
                )}
                {dateFilter && (
                  <Badge variant="secondary" className="flex gap-1 items-center">
                    {t("inventario_filter_badge_date").replace("{value}", dateFilter)}
                    <button className="ml-1 hover:text-primary" onClick={() => setDateFilter("")}>
                      ×
                    </button>
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setTypeFilter(null)
                    setPeriodFilter(null)
                    setDateFilter("")
                  }}
                >
                  {t("inventario_clear_filters_button")}
                </Button>
              </div>
            ) : null}

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("inventario_date_label")}</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>{t("inventario_type_label")}</TableHead>
                    <TableHead>{t("inventario_period_label")}</TableHead>
                    <TableHead>{t("inventario_mode_label")}</TableHead>
                    <TableHead>{t("inventario_table_items_registered")}</TableHead>
                    <TableHead>{t("inventario_table_actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">{t("inventario_history_loading")}</div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-10">
                        <div className="text-muted-foreground">
                          {searchTerm || typeFilter || periodFilter || dateFilter
                            ? t("inventario_history_empty_search")
                            : t("inventario_history_empty_no_records")}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedHistory.map((inventory) => (
                      <TableRow key={inventory.id}>
                        <TableCell>{formatDate(inventory.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{inventory.id.substring(0, 8)}...</TableCell>
                        <TableCell>
                          <Badge variant={inventory.type === "initial" ? "outline" : "secondary"}>
                            {inventory.type === "initial"
                              ? t("inventario_type_initial")
                              : inventory.type === "final"
                                ? t("inventario_type_final")
                                : t("inventario_type_new_purchase")}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {inventory.periodicity || inventory.period || "N/A"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {inventory.inventoryMode === "presentation" ? t("inventario_mode_by_presentation") : t("inventario_mode_by_units")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {inventory.modifiedItems || (inventory.items && inventory.items.length) || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedInventory(inventory)
                                setIsViewingDetails(true)
                                setSelectedSnapshot(inventory)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => exportInventory(inventory)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginación */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("inventario_history_showing_count")
                  .replace("{shown}", String(paginatedHistory.length))
                  .replace("{total}", String(filteredHistory.length))}
              </div>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        label={t("inventario_history_previous_page")}
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage > 1) setCurrentPage(currentPage - 1)
                        }}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(pageNum)
                            }}
                            isActive={currentPage === pageNum}
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    })}
                    {totalPages > 5 && (
                      <>
                        <PaginationItem>
                          <span className="px-3 py-2">...</span>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              setCurrentPage(totalPages)
                            }}
                            isActive={currentPage === totalPages}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        label={t("inventario_history_next_page")}
                        onClick={(e) => {
                          e.preventDefault()
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                        }}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal para ver detalles de un inventario */}
      <Dialog open={isViewingDetails} onOpenChange={setIsViewingDetails}>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>{t("inventario_detail_title")}</DialogTitle>
            <DialogDescription>
              {selectedInventory && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline">{selectedInventory.id}</Badge>
                  <Badge variant={selectedInventory.type === "initial" ? "outline" : "secondary"}>
                    {selectedInventory.type === "initial" ? t("inventario_type_initial") : t("inventario_type_final")}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {selectedInventory.period}
                  </Badge>
                  <Badge variant="outline">
                    {selectedInventory.dateRange
                      ? `${formatDate(selectedInventory.dateRange.start)} - ${formatDate(selectedInventory.dateRange.end)}`
                      : t("inventario_detail_range_unavailable")}
                  </Badge>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedInventory && (
            <div className="py-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium">{t("inventario_detail_created_by").replace("{name}", selectedInventory.createdBy || "")}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedInventory.createdAt || selectedInventory.date).toLocaleString(getDateLocale(language))}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => exportInventory(selectedInventory)}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("common_export")}
                </Button>
              </div>

              {selectedSnapshot && selectedSnapshot.items && (
                <div className="mt-4">
                  <h3 className="text-lg font-semibold mb-2">{t("inventario_detail_items_title")}</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("inventario_table_name")}</TableHead>
                          <TableHead>{t("inventario_table_category")}</TableHead>
                          <TableHead>{t("inventario_table_quantity")}</TableHead>
                          <TableHead>{t("inventario_table_price")}</TableHead>
                          <TableHead>{t("inventario_table_total")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSnapshot.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>
                              {item.quantity} {item.unit}
                              {selectedSnapshot.inventoryMode === "presentation" &&
                                item.presentation &&
                                item.netContent &&
                                item.netContent > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({Math.round(item.quantity / item.netContent)} {item.presentation})
                                  </span>
                                )}
                            </TableCell>
                            <TableCell>{formatCurrency(item.price)}</TableCell>
                            <TableCell>{formatCurrency(item.quantity * item.price)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="mt-4 text-sm text-muted-foreground">
                <p className="font-medium">{t("inventario_note_label")}</p>
                <p>
                  {t("inventario_detail_snapshot_note")}
                </p>
              </div>
            </div>
          )}
          <div className="p-2 bg-muted rounded-md">
            <p className="text-xs font-medium text-white">{t("inventario_mode_label")}</p>
            <p className="font-medium text-sm text-white">
              {selectedInventory && selectedInventory.inventoryMode === "presentation"
                ? t("inventario_mode_by_presentation")
                : t("inventario_mode_by_units")}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsViewingDetails(false)}>{t("common_close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
