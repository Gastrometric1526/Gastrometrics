// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { labelTableCells } from "./table-labels"

describe("etiquetas de las tablas de /admin en el celular (docs/293)", () => {
  it("cada celda recibe el nombre de su columna, también con columnas unidas", () => {
    document.body.innerHTML = `
      <table>
        <thead><tr><th>Cuenta</th><th colspan="2">Recetas</th><th>Último uso</th></tr></thead>
        <tbody>
          <tr><td>chef@correo.com</td><td>3</td><td>con costo</td><td>12/11/2026</td></tr>
          <tr><td colspan="3">Sin datos</td><td>—</td></tr>
        </tbody>
      </table>
      <table><tbody><tr><td>sin encabezado</td></tr></tbody></table>`
    labelTableCells(document.body)
    const rows = document.querySelectorAll("table:first-of-type tbody tr")
    expect([...rows[0].children].map((c) => c.getAttribute("data-label"))).toEqual(["Cuenta", "Recetas", "Recetas", "Último uso"])
    expect([...rows[1].children].map((c) => c.getAttribute("data-label"))).toEqual(["Cuenta", "Último uso"])
    // Una tabla sin encabezado no se toca.
    expect(document.querySelector("table:last-of-type td")?.hasAttribute("data-label")).toBe(false)
  })
})
