import * as XLSX from "xlsx"
import ExcelJS from "exceljs"

export interface ExcelParseResult {
  data: any[]
  headers: string[]
  rowCount: number
  errors: string[]
}

export async function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })

        // Get the first worksheet
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        })

        if (jsonData.length === 0) {
          reject(new Error("El archivo Excel está vacío"))
          return
        }

        // Get headers from first row
        const headers = jsonData[0] as string[]

        // Convert remaining rows to objects
        const rows = jsonData
          .slice(1)
          .map((row: any) => {
            const obj: any = {}
            headers.forEach((header, index) => {
              obj[header] = row[index] || ""
            })
            return obj
          })
          .filter((row) => {
            // Filter out completely empty rows
            return Object.values(row).some((value) => value !== "")
          })

        console.log(`Parsed Excel file: ${rows.length} rows, ${headers.length} columns`)
        console.log("Headers:", headers)
        console.log("Sample row:", rows[0])

        resolve(rows)
      } catch (error) {
        console.error("Error parsing Excel file:", error)
        reject(new Error(`Error al procesar el archivo Excel: ${error.message}`))
      }
    }

    reader.onerror = () => {
      reject(new Error("Error al leer el archivo"))
    }

    reader.readAsArrayBuffer(file)
  })
}

export function validateExcelData(data: any[], requiredFields: string[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  if (data.length === 0) {
    errors.push("No se encontraron datos en el archivo")
    return { isValid: false, errors }
  }

  // Check if required fields exist in headers
  const headers = Object.keys(data[0])
  const missingFields = requiredFields.filter(
    (field) =>
      !headers.some(
        (header) =>
          header.toLowerCase().includes(field.toLowerCase()) || field.toLowerCase().includes(header.toLowerCase()),
      ),
  )

  if (missingFields.length > 0) {
    errors.push(`Faltan las siguientes columnas requeridas: ${missingFields.join(", ")}`)
  }

  // Validate data types and required values
  data.forEach((row, index) => {
    const rowNumber = index + 2 // +2 because Excel rows start at 1 and we skip header

    // Check for completely empty rows
    const hasData = Object.values(row).some((value) => value !== "" && value !== null && value !== undefined)
    if (!hasData) {
      errors.push(`Fila ${rowNumber}: Fila completamente vacía`)
      return
    }

    // Validate specific fields based on context
    if (requiredFields.includes("nombre") || requiredFields.includes("name")) {
      const nameField = headers.find((h) => h.toLowerCase().includes("nombre") || h.toLowerCase().includes("name"))
      if (nameField && (!row[nameField] || row[nameField].toString().trim() === "")) {
        errors.push(`Fila ${rowNumber}: El nombre es requerido`)
      }
    }

    if (requiredFields.includes("precio") || requiredFields.includes("price")) {
      const priceField = headers.find((h) => h.toLowerCase().includes("precio") || h.toLowerCase().includes("price"))
      if (priceField) {
        const price = Number.parseFloat(row[priceField])
        if (isNaN(price) || price < 0) {
          errors.push(`Fila ${rowNumber}: El precio debe ser un número válido mayor o igual a 0`)
        }
      }
    }
  })

  return {
    isValid: errors.length === 0,
    errors: errors.slice(0, 10), // Limit to first 10 errors
  }
}

export function exportToExcel(data: any[], filename: string, sheetName = "Datos"): void {
  try {
    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(data)

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Generate Excel file and trigger download
    XLSX.writeFile(workbook, `${filename}.xlsx`)

    console.log(`Exported ${data.length} rows to ${filename}.xlsx`)
  } catch (error) {
    console.error("Error exporting to Excel:", error)
    throw new Error(`Error al exportar a Excel: ${error.message}`)
  }
}

/**
 * Plantilla de importación de ingredientes con lista desplegable real de Excel en la
 * columna Categoría — restringida a las mismas categorías que ya ofrece la base de
 * datos (types/ingredient.ts, `categories`), para que lo que el usuario elija ahí
 * siempre se pueda emparejar 1 a 1 al importar (ver normalizeCategory en
 * app/ingredientes/page.tsx). El paquete `xlsx` (usado en el resto de este archivo)
 * no puede escribir validaciones de datos — por eso esta función usa `exceljs`.
 *
 * Estructura basada en un ejemplo real de planilla maestra de ingredientes que
 * aportó el dueño del proyecto (columnas y orden calcados de ese archivo).
 */
export async function createIngredientsExcelTemplate(
  categories: readonly string[],
  units: readonly string[],
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Ingredientes")

  sheet.columns = [
    { header: "CATEGORIA", key: "categoria", width: 22 },
    { header: "INGREDIENTES", key: "ingrediente", width: 40 },
    { header: "UNIDAD", key: "unidad", width: 14 },
    { header: "PRECIO DE COMPRA", key: "precio", width: 18 },
    { header: "CONTENIDO NETO", key: "contenido", width: 16 },
    { header: "PROVEEDOR", key: "proveedor", width: 22 },
  ]

  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEEEEE" } }

  const sampleRows = [
    { categoria: "HARINA", ingrediente: "Harina de trigo", unidad: "gramos", precio: 45, contenido: 1000, proveedor: "Distribuidora Central" },
    { categoria: "LÁCTEOS Y DERIVADOS", ingrediente: "Mantequilla sin sal", unidad: "gramos", precio: 80, contenido: 500, proveedor: "Lácteos del Valle" },
    { categoria: "BEBIDAS", ingrediente: "Agua embotellada", unidad: "litros", precio: 15, contenido: 1, proveedor: "" },
  ]
  sampleRows.forEach((row) => sheet.addRow(row))

  // Lista de categorías válidas, en una hoja aparte — Excel exige que el rango de una
  // validación de tipo "lista" venga de celdas reales, no de un arreglo inline cuando
  // hay más de ~10 valores (límite práctico de las fórmulas de validación de Excel).
  const catSheet = workbook.addWorksheet("Categorías válidas")
  catSheet.getColumn(1).width = 30
  catSheet.getCell("A1").value = "Categorías disponibles"
  catSheet.getCell("A1").font = { bold: true }
  categories.forEach((cat, i) => {
    catSheet.getCell(`A${i + 2}`).value = cat
  })
  catSheet.state = "veryHidden" // no estorba al usuario, pero la validación sigue funcionando

  const lastCatRow = categories.length + 1
  const unitsList = units.join(",")

  // Aplica el desplegable a las primeras 500 filas de datos (suficiente para
  // cualquier catálogo real, y Excel no permite validaciones "infinitas" por fila).
  for (let row = 2; row <= 500; row++) {
    sheet.getCell(`A${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`'Categorías válidas'!$A$2:$A$${lastCatRow}`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Categoría no reconocida",
      error: "Elige una categoría de la lista para que el sistema la reconozca al importar.",
    }
    // La unidad sí cabe inline porque la lista es corta (menos de 10 valores).
    sheet.getCell(`C${row}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${unitsList}"`],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "Unidad no reconocida",
      error: "Elige una unidad de la lista para que el sistema la reconozca al importar.",
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function createExcelTemplate(headers: string[], sampleData: any[] = []): Blob {
  try {
    const workbook = XLSX.utils.book_new()

    // Create template data with headers and sample rows
    const templateData = [headers, ...sampleData]

    const worksheet = XLSX.utils.aoa_to_sheet(templateData)

    // Style the header row
    const headerRange = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col })
      if (worksheet[cellAddress]) {
        worksheet[cellAddress].s = {
          font: { bold: true },
          fill: { fgColor: { rgb: "EEEEEE" } },
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla")

    // Convert to blob
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
    return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
  } catch (error) {
    console.error("Error creating Excel template:", error)
    throw new Error(`Error al crear plantilla Excel: ${error.message}`)
  }
}
