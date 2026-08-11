/* Captura cuadros sueltos del reel para revisar el diseño sin renderizar todo.
   node whatsapp/pruebas.mjs 1 3 6 9 ...   (segundos)  → whatsapp/out/prueba-*.png */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, 'out');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const tiempos = process.argv.slice(2).map(Number);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(DIR, 'reel-wsp.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => {
  document.fonts.ready;
  document.getElementById('ui').style.display = 'none';
  document.getElementById('reel').style.setProperty('--z', 1);
});
await page.waitForTimeout(500);
for (const t of tiempos){
  await page.evaluate(tt => window.setT(tt), t);
  const f = 'prueba-' + String(t).replace('.', '_') + 's.png';
  await page.screenshot({ path: path.join(OUT, f), clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  console.log('  ✓ ' + f);
}
await browser.close();
