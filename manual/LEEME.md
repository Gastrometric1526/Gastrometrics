# Manual de usuario (PDF, 6 idiomas)

Fuente del manual que la app sirve en Configuración → «Manual de usuario (PDF)»
(`app/api/manual/route.ts` lee `lib/assets/manual-{idioma}.pdf` según el idioma de la cuenta).
Antes de `docs/132` la fuente vivía en una carpeta temporal de una sesión de Claude y se
podía perder; ahora vive aquí, versionada.

## Estructura

- `content/{es,en,da,fr,pt,zh}.mjs` — el texto, como datos (capítulos → bloques). **El español
  es la referencia**: el build falla si otro idioma no tiene exactamente los mismos capítulos,
  bloques y cantidad de filas/pasos/ítems. Así una traducción incompleta nunca se publica.
- `theme/manual.css` — diseño de impresión (A4). `theme/logo.png` — logo oficial.
- `shots/{idioma}/*.jpg` — capturas reales de la app en cada idioma.
- `scripts/take-screenshots.mjs` — toma las capturas (login de desarrollo local).
- `scripts/build.mjs` — genera los PDF.

Tipos de bloque: `p`, `h3`, `list`, `steps`, `tip`/`warn`/`info` (aviso con título), `formula`
(etiqueta, líneas con ` = × ÷ + − ` rodeados de espacios para resaltarlos, explicación),
`example` (filas `[texto, valor, esTotal]`), `table`, `chips`, `cards` (`[etiqueta, título,
texto]`), `figure` (archivo de `shots/`, pie), `flow` (diagrama de módulos). HTML permitido
dentro del texto: `<strong>`, `<em>`, `<br>`.

## Regenerar

```bash
cd manual
npm install                      # puppeteer-core, pdf-lib, pdfjs-dist (no toca el package.json raíz)
node scripts/take-screenshots.mjs http://localhost:3001 es,da,fr,pt,zh,en   # opcional, con next dev corriendo
node scripts/build.mjs           # o: node scripts/build.mjs es,en
```

Requiere Google Chrome instalado (`CHROME_PATH` para otra ruta) e internet (fuentes DM Sans /
Noto Sans SC de Google Fonts). El build escribe directo en `../lib/assets/` y deja una copia de
revisión (PDF + HTML) en `out/` (ignorada por git). El índice se pagina solo: el build renderiza
dos veces y ubica cada capítulo con un marcador invisible leído con pdf.js.

Notas de las capturas: el script escribe el correo de tester en el login y usa el botón
«Entrar como…» (solo existe con `NODE_ENV=development`); termina en el idioma `en` porque el
idioma de la pantalla se sincroniza al perfil de la cuenta — ordena los idiomas para terminar
en el que la cuenta tenía. La ruta de la receta de ejemplo se cambia con `MANUAL_RECIPE_PATH`; `MANUAL_ONLY=13-configuracion.jpg,…` retoma solo esas capturas. El script espera contenido real y reintenta capturas en blanco, y `build.mjs` falla si alguna pesa < 40 KB (docs/133). Diseño en flujo continuo: los capítulos no fuerzan página nueva.
