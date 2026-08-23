import type { Ingredient } from "@/types/ingredient"
import type { ProcessedOrder, ProcessedOrderItem } from "@/types/purchase-order"

// Cache for previously processed PDFs to avoid duplicate processing
const processedPdfCache = new Map<string, ProcessedOrder>()

/**
 * Process a PDF file containing purchase order information
 * Optimized with caching and early returns
 */
export async function processPdfOrder(file: File, ingredients: Ingredient[]): Promise<ProcessedOrder> {
  // Generate a cache key based on file name and last modified time
  const cacheKey = `${file.name}_${file.lastModified}`

  // Check if we've already processed this file
  if (processedPdfCache.has(cacheKey)) {
    return processedPdfCache.get(cacheKey)!
  }

  // Create a FileReader to read the PDF file
  const fileReader = new FileReader()

  // Convert the file to an ArrayBuffer
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    fileReader.onload = () => resolve(fileReader.result as ArrayBuffer)
    fileReader.onerror = reject
    fileReader.readAsArrayBuffer(file)
  })

  // Use pdf.js to parse the PDF
  const pdf = await loadPdf(arrayBuffer)

  // Extract text content from all pages
  const textContent = await extractTextFromPdf(pdf)

  // Parse the text content to extract order information
  const orderInfo = extractOrderInfo(textContent)

  // Extract items from the order
  const items = extractOrderItems(textContent)

  // Create a suppliers index for faster lookups
  const suppliersIndex = createSuppliersIndex(ingredients)

  // Validate and enrich items with supplier information using the index
  const validatedItems = validateAndEnrichItems(items, ingredients, suppliersIndex)

  const result = {
    orderName: orderInfo.name,
    orderNumber: orderInfo.number,
    date: orderInfo.date,
    items: validatedItems,
  }

  // Store in cache for future requests
  processedPdfCache.set(cacheKey, result)

  // Limit cache size to prevent memory leaks
  if (processedPdfCache.size > 50) {
    const oldestKey = processedPdfCache.keys().next().value
    processedPdfCache.delete(oldestKey)
  }

  return result
}

/**
 * Create an index of suppliers for faster lookups
 */
function createSuppliersIndex(ingredients: Ingredient[]): Map<string, Ingredient[]> {
  const suppliersMap = new Map<string, Ingredient[]>()

  ingredients.forEach((ingredient) => {
    if (ingredient.supplier) {
      // Normalize supplier name for case-insensitive matching
      const normalizedSupplier = ingredient.supplier.toLowerCase()

      if (!suppliersMap.has(normalizedSupplier)) {
        suppliersMap.set(normalizedSupplier, [])
      }

      suppliersMap.get(normalizedSupplier)!.push(ingredient)
    }
  })

  return suppliersMap
}

/**
 * Validate and enrich items with supplier information using the supplier index
 * for faster lookups
 */
function validateAndEnrichItems(
  items: ProcessedOrderItem[],
  ingredients: Ingredient[],
  suppliersIndex: Map<string, Ingredient[]>,
): ProcessedOrderItem[] {
  // Create a name-based index for faster ingredient lookups
  const ingredientsByName = new Map<string, Ingredient>()
  ingredients.forEach((ing) => {
    ingredientsByName.set(ing.name.toLowerCase(), ing)
  })

  return items.map((item) => {
    // Normalized item name for case-insensitive matching
    const normalizedItemName = item.name.toLowerCase()

    // First try to find an exact match by name
    let matchingIngredient = ingredientsByName.get(normalizedItemName)

    // If no exact match, try partial matches
    if (!matchingIngredient) {
      matchingIngredient = ingredients.find(
        (ing) =>
          ing.name.toLowerCase().includes(normalizedItemName) || normalizedItemName.includes(ing.name.toLowerCase()),
      )
    }

    if (matchingIngredient) {
      // Try to match supplier if we have one
      if (item.supplier && matchingIngredient.supplier) {
        const normalizedItemSupplier = item.supplier.toLowerCase()
        const normalizedIngredientSupplier = matchingIngredient.supplier.toLowerCase()

        const supplierMatches =
          normalizedIngredientSupplier === normalizedItemSupplier ||
          normalizedIngredientSupplier.includes(normalizedItemSupplier) ||
          normalizedItemSupplier.includes(normalizedIngredientSupplier)

        if (supplierMatches) {
          return {
            ...item,
            validation: { isValid: true, message: "Proveedor validado" },
          }
        } else {
          // Supplier mismatch
          return {
            ...item,
            supplier: item.supplier || matchingIngredient.supplier,
            validation: {
              isValid: false,
              message: `Proveedor esperado: ${matchingIngredient.supplier}`,
            },
          }
        }
      } else {
        // Ingredient found but no supplier info
        return {
          ...item,
          validation: {
            isValid: true,
            message: "Ingrediente encontrado, sin info de proveedor",
          },
        }
      }
    } else if (item.supplier) {
      // No matching ingredient by name, but we have a supplier
      // Check if we know this supplier from other ingredients
      const normalizedItemSupplier = item.supplier.toLowerCase()

      if (suppliersIndex.has(normalizedItemSupplier)) {
        return {
          ...item,
          validation: {
            isValid: false,
            message: "Proveedor conocido, ingrediente no encontrado",
          },
        }
      }
    }

    // No matching ingredient
    return {
      ...item,
      validation: {
        isValid: false,
        message: "Ingrediente no encontrado en base de datos",
      },
    }
  })
}

/**
 * The rest of the functions (loadPdf, extractTextFromPdf, extractOrderInfo,
 * extractOrderItems) remain the same as they were already optimized or
 * are placeholders in the example.
 */
async function loadPdf(arrayBuffer: ArrayBuffer) {
  // In a real implementation, we would use pdf.js
  // For this example, we'll simulate the PDF parsing
  console.log("Loading PDF from ArrayBuffer of size:", arrayBuffer.byteLength)

  // Simulate PDF loading
  return {
    numPages: 1,
    getPage: async (pageNum: number) => ({
      getTextContent: async () => ({
        items: [
          { str: "ORDEN DE COMPRA" },
          { str: "Número: OC-12345" },
          { str: "Fecha: 15/03/2024" },
          { str: "PROVEEDOR: Distribuidora Alimentos S.A." },
          { str: "ITEMS:" },
          { str: "1. Harina de Trigo" },
          { str: "Cantidad: 25 kg" },
          { str: "Precio Unitario: L45.00" },
          { str: "Total: L1125.00" },
          { str: "2. Azúcar Refinada" },
          { str: "Cantidad: 10 kg" },
          { str: "Precio Unitario: L35.00" },
          { str: "Total: L350.00" },
          { str: "3. Aceite Vegetal" },
          { str: "Cantidad: 5 L" },
          { str: "Precio Unitario: L120.00" },
          { str: "Total: L600.00" },
          { str: "TOTAL: L2075.00" },
        ],
      }),
    }),
  }
}

async function extractTextFromPdf(pdf: any): Promise<string> {
  let fullText = ""

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(" ")
    fullText += pageText + " "
  }

  return fullText
}

function extractOrderInfo(text: string): { name: string; number: number; date: string } {
  // In a real implementation, we would use regex or NLP to extract this information
  // For this example, we'll use simple string matching

  // Extract order number
  const orderNumberMatch = text.match(/Número:\s*([A-Za-z0-9-]+)/)
  const orderNumber = orderNumberMatch
    ? Number.parseInt(orderNumberMatch[1].replace(/\D/g, ""))
    : Math.floor(Math.random() * 10000)

  // Extract date
  const dateMatch = text.match(/Fecha:\s*(\d{1,2}\/\d{1,2}\/\d{4})/)
  const dateStr = dateMatch ? dateMatch[1] : new Date().toLocaleDateString()

  // Convert date to ISO format
  const dateParts = dateStr.split("/")
  const date = new Date(`${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`).toISOString()

  // Extract name (use provider name if available)
  const providerMatch = text.match(/PROVEEDOR:\s*([^\n]+)/)
  const name = providerMatch ? `Orden de ${providerMatch[1]}` : `Orden #${orderNumber}`

  return { name, number: orderNumber, date }
}

function extractOrderItems(text: string): ProcessedOrderItem[] {
  // In a real implementation, we would use regex or NLP to extract items
  // For this example, we'll simulate the extraction

  // Simulate extracted items
  return [
    {
      name: "Harina de Trigo",
      quantity: 25,
      unit: "kg",
      unitPrice: 45,
      totalPrice: 1125,
      supplier: "Distribuidora Alimentos S.A.",
      validation: { isValid: false, message: "Pendiente de validación" },
    },
    {
      name: "Azúcar Refinada",
      quantity: 10,
      unit: "kg",
      unitPrice: 35,
      totalPrice: 350,
      supplier: "Distribuidora Alimentos S.A.",
      validation: { isValid: false, message: "Pendiente de validación" },
    },
    {
      name: "Aceite Vegetal",
      quantity: 5,
      unit: "L",
      unitPrice: 120,
      totalPrice: 600,
      supplier: "Distribuidora Alimentos S.A.",
      validation: { isValid: false, message: "Pendiente de validación" },
    },
  ]
}
