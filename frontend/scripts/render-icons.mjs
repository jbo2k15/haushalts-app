// Rendert die PWA-Icon-PNGs aus public/icons/icon.svg in den benötigten
// Größen. Nutzt das ohnehin für die E2E-Tests installierte Chromium (via
// @playwright/test), damit keine zusätzliche Bild-/SVG-Rasterizer-Dependency
// nötig ist. Ausführen nach jeder Änderung an icon.svg:
//   node scripts/render-icons.mjs
import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const iconsDir = path.resolve(__dirname, '../public/icons')
const svg = readFileSync(path.join(iconsDir, 'icon.svg'), 'utf8')
const SIZES = [192, 512]

const browser = await chromium.launch()
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    // Transparenter Hintergrund (omitBackground) erhält die abgerundeten Ecken
    // des Icons (rx im SVG); das SVG selbst wird exakt auf die Zielgröße
    // skaliert.
    await page.setContent(
      `<!doctype html><meta charset="utf-8">` +
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>` +
      svg,
      { waitUntil: 'load' },
    )
    await page.locator('svg').screenshot({
      path: path.join(iconsDir, `icon-${size}.png`),
      omitBackground: true,
    })
    await page.close()
    console.log(`render-icons: icon-${size}.png geschrieben`)
  }
} finally {
  await browser.close()
}
