/* ═══════════════════════════════════════════════════════════════════
   Render del material de WhatsApp.

   node whatsapp/render.mjs           → placas PNG + reel MP4
   node whatsapp/render.mjs placas    → solo las placas
   node whatsapp/render.mjs reel      → solo el reel de WhatsApp
   node whatsapp/render.mjs venta     → solo el reel de venta (Instagram)
   node whatsapp/render.mjs historias → las 12 placas PNG + los 3 clips MP4,
                                        todo junto en out/historias/
   node whatsapp/render.mjs historias plazo → solo ese clip

   El reel se dibuja cuadro por cuadro llamando a window.setT(t) en la
   página y se codifica con el ffmpeg que trae imageio-ffmpeg (pip).
   ═══════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const DIR  = path.dirname(fileURLToPath(import.meta.url));
const OUT  = path.join(DIR, 'out');
const FPS  = 30;
const modo = (process.argv[2] || 'todo').toLowerCase();

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

function ffmpegExe(){
  const py = process.platform === 'win32' ? 'python' : 'python3';
  return execFileSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'])
    .toString().trim();
}

async function abrir(browser, archivo, ancho, alto){
  const page = await browser.newPage({
    viewport: { width: ancho, height: alto },
    deviceScaleFactor: 1
  });
  await page.goto(pathToFileURL(path.join(DIR, archivo)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);   // margen para el primer layout con la tipografía ya cargada
  return page;
}

/* ── PLACAS ──────────────────────────────────────────────────────── */
async function placas(browser){
  const page = await abrir(browser, 'placas-wsp.html', 1080, 1350);
  const ids = await page.$$eval('.placa', ns => ns.map(n => n.id));
  // Se captura el viewport, no el elemento: dejando una sola placa visible en 0,0
  // no hay scroll ni composición de por medio, que es de donde salían los artefactos.
  for (const id of ids){
    await page.evaluate(sel => {
      document.querySelectorAll('.rot').forEach(n => n.style.display = 'none');
      document.querySelectorAll('.placa').forEach(n => n.style.display = n.id === sel ? 'flex' : 'none');
      document.body.style.padding = '0';
      document.body.style.gap = '0';
      window.scrollTo(0, 0);
    }, id);
    await page.screenshot({ path: path.join(OUT, id + '.png'),
                            clip: { x: 0, y: 0, width: 1080, height: 1350 } });
    console.log('  ✓ ' + id + '.png');
  }
  await page.close();
  console.log('Placas listas: ' + ids.length + ' → whatsapp/out/');
}

/* ── HISTORIAS FIJAS ─────────────────────────────────────────────── */
// El archivo de historias es una hoja de contactos: muestra las placas
// reducidas dentro de tarjetas, con las franjas rojas que marcan lo que tapa
// Instagram. Para exportar hay que sacar todo ese andamiaje y dejar UNA placa
// sola, a tamaño real, pegada al origen — igual que en placas().
async function historiasFijas(browser, salidaDir){
  const page = await abrir(browser, '../instagram/historias-presentacion.html', 1080, 1920);
  const total = await page.$$eval('.h', ns => ns.length);

  for (let i = 0; i < total; i++){
    await page.evaluate(idx => {
      document.querySelectorAll('.barra,.sem,.meta').forEach(n => n.style.display = 'none');
      document.querySelectorAll('.safe').forEach(n => n.style.display = 'none');   // guías, no van al PNG
      document.body.style.cssText = 'margin:0;padding:0;background:#fff';
      document.querySelectorAll('.fila-h').forEach(n => { n.style.display = 'block'; n.style.gap = '0'; });
      document.querySelectorAll('.card').forEach((n, k) => {
        n.style.display = k === idx ? 'block' : 'none';
        n.style.cssText += ';border:none;border-radius:0;width:auto;margin:0';
      });
      document.querySelectorAll('.esc').forEach(n => { n.style.padding = '0'; n.style.background = '#fff'; });
      document.querySelectorAll('.h').forEach(n => { n.style.transform = 'none'; n.style.marginBottom = '0'; });
      window.scrollTo(0, 0);
    }, i);

    const nombre = `historia-${String(i + 1).padStart(2, '0')}.png`;
    await page.screenshot({ path: path.join(salidaDir, nombre),
                            clip: { x: 0, y: 0, width: 1080, height: 1920 } });
    console.log('  ✓ ' + nombre);
  }
  await page.close();
  console.log('Historias fijas: ' + total + ' PNG');
}

/* ── REEL ────────────────────────────────────────────────────────── */
async function reel(browser, archivo = 'reel-wsp.html', nombre = 'faim-obras-reel.mp4', escena = null){
  const page = await abrir(browser, archivo, 1080, 1920);
  await page.evaluate(() => {
    document.getElementById('ui').style.display = 'none';
    document.getElementById('reel').style.setProperty('--z', 1);
  });

  // Un mismo archivo puede traer varias escenas y una duración por escena, así
  // que hay que elegirla ANTES de leer DURACION.
  if (escena) await page.evaluate(e => window.setEscena(e), escena);

  const dur    = await page.evaluate(() => window.DURACION);
  const total  = Math.round(dur * FPS);
  const salida = path.join(OUT, nombre);

  const ff = spawn(ffmpegExe(), [
    '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-movflags', '+faststart',
    '-c:a', 'aac', '-b:a', '64k',
    salida
  ], { stdio: ['pipe', 'ignore', 'pipe'] });

  let err = '';
  ff.stderr.on('data', d => { err += d.toString(); });
  const fin = once(ff, 'close');

  const clip = { x: 0, y: 0, width: 1080, height: 1920 };
  const t0 = Date.now();
  for (let f = 0; f < total; f++){
    const t = f / FPS;
    await page.evaluate(tt => window.setT(tt), t);
    const buf = await page.screenshot({ type: 'png', clip });
    if (!ff.stdin.write(buf)) await once(ff.stdin, 'drain');
    if (f % 60 === 0 || f === total - 1){
      const seg = (Date.now() - t0) / 1000;
      console.log(`  cuadro ${f + 1}/${total}  (${(f / total * 100).toFixed(0)}% · ${seg.toFixed(0)}s)`);
    }
  }
  ff.stdin.end();
  const [code] = await fin;
  await page.close();
  if (code !== 0){ console.error(err.slice(-3000)); throw new Error('ffmpeg salió con código ' + code); }
  console.log('Reel listo → ' + salida + `  (${dur}s · ${total} cuadros)`);
}

/* ── main ────────────────────────────────────────────────────────── */
const browser = await chromium.launch();
try {
  if (modo === 'todo' || modo === 'placas') await placas(browser);
  if (modo === 'todo' || modo === 'reel')   await reel(browser);
  if (modo === 'venta') await reel(browser, 'reel-venta.html', 'faim-obras-venta.mp4');
  if (modo === 'historias'){
    // Todo el material de historias en una sola carpeta: las fijas y los clips
    // juntos, que es como se sube después.
    const dir = path.join(OUT, 'historias');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const soloEsta = process.argv[3];
    if (!soloEsta) await historiasFijas(browser, dir);

    // Una historia por escena: son clips sueltos que se suben de a uno, no un
    // video largo. El tercer argumento del CLI permite rendir una sola.
    const page = await abrir(browser, 'historias-anim.html', 1080, 1920);
    const todas = await page.evaluate(() => window.ESCENAS);
    await page.close();
    const pedidas = soloEsta ? [soloEsta] : todas;
    for (const e of pedidas){
      if (!todas.includes(e)){ console.error('Escena desconocida: ' + e + ' (hay: ' + todas.join(', ') + ')'); continue; }
      await reel(browser, 'historias-anim.html', path.join('historias', `clip-${e}.mp4`), e);
    }
    console.log('\nTodo en whatsapp/out/historias/');
  }
} finally {
  await browser.close();
}
