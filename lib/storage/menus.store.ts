/**
 * @deprecated This file is deprecated. Use `@/lib/menus` instead.
 *
 * This file redirects to the unified menu storage system in lib/menus.ts
 */

import { getMenus, getMenuById, createMenu, updateMenu, deleteMenu, duplicateMenu } from "../menus"

export { getMenus, getMenuById, createMenu, updateMenu, deleteMenu, duplicateMenu }

// Scenario operations - these should move to a separate analytics module
export type { ScenarioResult } from "@/lib/types/menus"

/**
 * @deprecated Implement scenario storage in your analytics module
 */
export function addScenarioResult(businessId: string, scenario: any): void {
  console.warn(`[DEPRECATED] addScenarioResult should be in an analytics module`)
  // Stub implementation
}

/**
 * @deprecated Implement scenario retrieval in your analytics module
 */
export function getScenarioResults(businessId: string): any[] {
  console.warn(`[DEPRECATED] getScenarioResults should be in an analytics module`)
  return []
}
