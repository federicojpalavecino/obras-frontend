/* Arma el mp4 del tutorial a partir de las capturas y el guion.
   node whatsapp/tutorial/render-tutorial.mjs contrato                */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const DIR = 'whatsapp/tutorial';
const OUT = path.join(DIR, 'out');
const FPS = 30, W = 1280, H = 800;
const nombre = process.argv[2] || 'contrato';
mkdirSync(OUT, { recursive: true });

const ffmpegExe = () => execFileSync(process.platform === 'win32' ? 'python' : 'python3',
  ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();

// El guion se inyecta en el player como window.__GUION__: asi el mismo player
// sirve para los diez tutoriales sin tocar una linea.
const guion = JSON.parse(readFileSync(path.join(DIR, 'cap/guion.json'), 'utf8'));
const html  = readFileSync(path.join(DIR, 'player.html'), 'utf8')
  .replace('<script>', `<script>window.__GUION__ = ${JSON.stringify(guion)};</script>\n<script>`);
writeFileSync(path.join(DIR, '_run.html'), html);

const b    = await chromium.launch();
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('console', m => { if (m.type() === 'error') console.log('  [js]', m.text().slice(0, 160)); });
await page.goto(pathToFileURL(path.join(process.cwd(), DIR, '_run.html')).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.__LISTO__);
await page.waitForTimeout(300);

const dur   = await page.evaluate(() => window.DURACION);
const total = Math.round(dur * FPS);
const salida = path.join(OUT, `tutorial-${nombre}.mp4`);
console.log(`${nombre}: ${dur.toFixed(1)}s · ${total} cuadros · ${W}x${H}`);

const ff = spawn(ffmpegExe(), [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21',
  '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
  '-r', String(FPS), '-movflags', '+faststart', salida
], { stdio: ['pipe', 'ignore', 'pipe'] });
let err = ''; ff.stderr.on('data', d => err += d);
const fin = once(ff, 'close');

const clip = { x: 0, y: 0, width: W, height: H };
const t0 = Date.now();
for (let f = 0; f < total; f++){
  await page.evaluate(t => window.setT(t), f / FPS);
  const buf = await page.screenshot({ type: 'png', clip });
  if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
  if (f % 90 === 0 || f === total - 1)
    console.log(`  ${f + 1}/${total}  (${(f / total * 100).toFixed(0)}% · ${((Date.now()-t0)/1000).toFixed(0)}s)`);
}
ff.stdin.end();
const [code] = await fin;
await b.close();
if (code !== 0){ console.error(err.slice(-2000)); process.exit(1); }
console.log('listo → ' + salida);
