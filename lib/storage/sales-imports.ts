import { getFromStorage, saveToStorage, STORAGE_KEYS } from "./core"
import type { SalesImport, POSColumnMapping, DishNameMapping } from "@/types/sales-import"

export function getSalesImports(businessId?: string | null): SalesImport[] {
  return getFromStorage<SalesImport[]>(STORAGE_KEYS.SALES_IMPORTS, businessId) || []
}

export function saveSalesImports(imports: SalesImport[], businessId?: string | null): void {
  saveToStorage(STORAGE_KEYS.SALES_IMPORTS, imports, businessId)
}

export function addSalesImport(salesImport: SalesImport, businessId?: string | null): void {
  const imports = getSalesImports(businessId)
  imports.unshift(salesImport)
  saveSalesImports(imports, businessId)
}

export function deleteSalesImport(id: string, businessId?: string | null): void {
  const imports = getSalesImports(businessId).filter((i) => i.id !== id)
  saveSalesImports(imports, businessId)
}

export function getPOSColumnMapping(businessId?: string | null): POSColumnMapping | null {
  return getFromStorage<POSColumnMapping>(STORAGE_KEYS.POS_COLUMN_MAPPING, businessId)
}

export function savePOSColumnMapping(mapping: POSColumnMapping, businessId?: string | null): void {
  saveToStorage(STORAGE_KEYS.POS_COLUMN_MAPPING, mapping, businessId)
}

export function getDishNameMappings(businessId?: string | null): DishNameMapping[] {
  return getFromStorage<DishNameMapping[]>(STORAGE_KEYS.DISH_NAME_MAPPINGS, businessId) || []
}

export function saveDishNameMapping(mapping: DishNameMapping, businessId?: string | null): void {
  const mappings = getDishNameMappings(businessId).filter((m) => m.normalizedPosName !== mapping.normalizedPosName)
  mappings.push(mapping)
  saveToStorage(STORAGE_KEYS.DISH_NAME_MAPPINGS, mappings, businessId)
}
