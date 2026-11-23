import { describe, expect, it } from "vitest"
import JSZip from "jszip"
import { documentKind, documentText, htmlToText, looksLikeText, odtXmlToText, rtfToText, UnreadableDocumentError, wordXmlToText } from "./file-text"

describe("cualquier formato de documento (docs/345)", () => {
  it("clasifica por extensión o tipo", () => {
    expect(documentKind({ name: "receta.DOCX" })).toBe("word")
    expect(documentKind({ name: "lista.ods" })).toBe("spreadsheet")
    expect(documentKind({ name: "lista.numbers" })).toBe("spreadsheet")
    expect(documentKind({ name: "ticket.heic" })).toBe("image")
    expect(documentKind({ name: "x", type: "application/pdf" })).toBe("pdf")
    expect(documentKind({ name: "notas.rtf" })).toBe("word")
    expect(documentKind({ name: "notas.md" })).toBe("text")
  })

  it("Word: párrafos como líneas y celdas con tabulador", () => {
    const xml =
      '<w:document><w:body><w:p><w:r><w:t>Salsa de tomate</w:t></w:r></w:p>' +
      "<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Tomate</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>500 g</w:t></w:r></w:p></w:tc></w:tr>" +
      "<w:tr><w:tc><w:p><w:r><w:t>Sal &amp; pimienta</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>5 g</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"
    expect(wordXmlToText(xml)).toBe("Salsa de tomate\nTomate\t500 g\nSal & pimienta\t5 g")
  })

  it("OpenDocument, HTML y RTF", () => {
    expect(odtXmlToText("<office:text><text:p>Pan</text:p><text:p>Harina<text:tab/>1 kg</text:p></office:text>")).toBe("Pan\nHarina\t1 kg")
    expect(htmlToText("<html><style>x{}</style><table><tr><td>Leche</td><td>1 l</td></tr></table><p>Fin</p></html>")).toBe("Leche\t1 l\n\nFin")
    expect(rtfToText("{\\rtf1\\ansi{\\fonttbl{\\f0 Arial;}}\\f0 Az\\'facar\\tab 200 g\\par Caf\\'e9\\par}")).toBe("Azúcar\t200 g\nCafé")
  })

  it("lee un .docx real y rechaza un binario", async () => {
    const zip = new JSZip()
    zip.file("word/document.xml", "<w:document><w:body><w:p><w:r><w:t>Arroz 1 kg</w:t></w:r></w:p></w:body></w:document>")
    const blob = await zip.generateAsync({ type: "arraybuffer" })
    expect(await documentText(new File([blob], "lista.docx"))).toBe("Arroz 1 kg")
    const bin = new File([new Uint8Array([0, 1, 2, 3, 0, 0, 5, 6, 7, 0, 8, 9])], "raro.bin")
    await expect(documentText(bin)).rejects.toBeInstanceOf(UnreadableDocumentError)
    expect(looksLikeText("Harina\t1 kg")).toBe(true)
  })
})
