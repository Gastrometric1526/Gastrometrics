import { describe, expect, it } from "vitest"
import { accountsToCsv } from "./accounts-csv"

describe("exportar cuentas a CSV (docs/195)", () => {
  it("BOM, comillas, fechas día/mes/año y minutos de uso", () => {
    const csv = accountsToCsv(
      [
        {
          email: 'a,"b"@x.com', createdAt: "2026-10-05T10:00:00Z", emailConfirmed: true, planName: "Home Cook", planExpiresAt: null,
          hasActiveSubscription: false, country: "HN", businessCount: 1, teamMemberCount: 0, recipeCount: 3, ingredientCount: 20,
          posImportCount: 0, manualSalesCount: 2, lastSalesAt: null, totalActiveSeconds: 125, referralSent: 1, referralCreated: 0, referralActive: 0,
        },
      ],
      Array.from({ length: 18 }, (_, i) => `c${i}`),
    )
    expect(csv.startsWith("﻿")).toBe(true)
    const [, row] = csv.slice(1).split("\r\n")
    expect(row.startsWith('"a,""b""@x.com",05/10/2026,1,Home Cook,,0,HN,1,0,3,20,0,2,,2,1,0,0')).toBe(true)
  })
})
