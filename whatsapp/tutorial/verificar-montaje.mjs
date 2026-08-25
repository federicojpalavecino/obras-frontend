import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const S = 'C:/Users/feder/AppData/Local/Temp/claude/C--obras-frontend/441bad63-0948-447c-a671-c0d0b34b8ad0/scratchpad';
const c = readFileSync(S + '/sim.txt', 'utf8').split('\n');
const val = k => c.find(l => l.startsWith(k + '::')).slice(k.length + 2).trim();
const USER = JSON.parse(val('USER'));

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
await ctx.addInitScript(([t, te, u]) => {
  localStorage.setItem('obras_token', t); localStorage.setItem('obras_tenant', te);
  localStorage.setItem('obras_estudio', JSON.stringify({ rol: u.rol, email: u.email, nombre: u.nombre, usuario: u.usuario }));
  localStorage.setItem('anuncio_visto', '2');
}, [val('TOKEN'), val('TENANT'), USER]);

const p = await ctx.newPage();
p.on('console', m => { if (m.type() === 'error') console.log('  [js]', m.text().slice(0, 160)); });
// 131 "Muro cierre": cerrado y sin contrato, o sea el estado vacio de verdad.
await p.goto('http://127.0.0.1:4599/cotizador/presupuesto/131/obra', { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);
await p.addStyleTag({ content: '.aviso-arriba{display:none !important}' });
await p.getByRole('button', { name: 'Contrato', exact: true }).first().click();

const enlace = p.getByRole('button', { name: /Cómo se hace/ }).first();
await enlace.waitFor({ state: 'visible', timeout: 15000 });
console.log('enlace visible:', await enlace.innerText());
await p.screenshot({ path: 'whatsapp/tutorial/cap/montaje-1-vacio.png' });

await enlace.click();
await p.waitForTimeout(2600);
const v = await p.evaluate(() => {
  const el = document.querySelector('video');
  return el ? { src: el.getAttribute('src'), t: +el.currentTime.toFixed(2),
                dur: isNaN(el.duration) ? null : +el.duration.toFixed(1),
                w: el.videoWidth, h: el.videoHeight, pausado: el.paused } : null;
});
console.log('video:', JSON.stringify(v));
await p.screenshot({ path: 'whatsapp/tutorial/cap/montaje-2-modal.png' });

// Escape tiene que cerrarlo
await p.keyboard.press('Escape');
await p.waitForTimeout(600);
console.log('cierra con Escape:', (await p.locator('video').count()) === 0);
await b.close();
