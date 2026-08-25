/* ═══════════════════════════════════════════════════════════════════
   Captura del tutorial "Cómo creo el contrato de una obra".

   Recorre el circuito real en produccion con el tenant de pruebas y
   guarda un PNG por estado, mas el guion con las coordenadas de cada
   clic. El cursor NO se dibuja aca: se dibuja despues, en el player,
   asi el gesto y el resultado no pueden quedar desfasados —que fue
   justo lo que salio mal en el demo grabado con la extension.
   ═══════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const S    = 'C:/Users/feder/AppData/Local/Temp/claude/C--obras-frontend/441bad63-0948-447c-a671-c0d0b34b8ad0/scratchpad';
const conf = readFileSync(S + '/sim.txt', 'utf8').split('\n');
const val  = k => conf.find(l => l.startsWith(k + '::')).slice(k.length + 2).trim();
const USER = JSON.parse(val('USER'));

const DIR = 'whatsapp/tutorial/cap';
const PID = 129;
mkdirSync(DIR, { recursive: true });

const b   = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });

await ctx.addInitScript(([tok, ten, usr]) => {
  localStorage.setItem('obras_token', tok);
  localStorage.setItem('obras_tenant', ten);
  localStorage.setItem('obras_estudio', JSON.stringify({
    rol: usr.rol, email: usr.email, nombre: usr.nombre, usuario: usr.usuario }));
  localStorage.setItem('anuncio_visto', '2');
}, [val('TOKEN'), val('TENANT'), USER]);

const p = await ctx.newPage();
p.on('console', m => { if (m.type() === 'error') console.log('  [js]', m.text().slice(0, 200)); });
p.on('response', async r => {
  if (r.url().includes('/contrato') && r.status() >= 400)
    console.log('  [HTTP ' + r.status() + ']', (await r.text().catch(() => '')).slice(0, 300));
});

/* Los avisos de arriba (anuncio de version, aviso de prueba) son transitorios y
   no ensenan nada: se tapan con CSS para que sobrevivan a los re-render. */
await p.addStyleTag; // no-op si aun no hay documento
const tapar = () => p.addStyleTag({ content: '.aviso-arriba{display:none !important}' }).catch(() => {});

const guion = [];
let n = 0;

/** Captura el estado actual y anota adonde va el proximo clic. */
const paso = async (rotulo, target, opts = {}) => {
  await tapar();
  await p.waitForTimeout(opts.asentar ?? 500);
  const nombre = `paso-${String(++n).padStart(2, '0')}.png`;
  await p.screenshot({ path: `${DIR}/${nombre}` });

  let click = null;
  if (target) {
    await target.waitFor({ state: 'visible', timeout: 30000 });
    const caja = await target.boundingBox();
    if (!caja) throw new Error('sin caja: ' + rotulo);
    click = [Math.round(caja.x + caja.width / 2), Math.round(caja.y + caja.height / 2)];
  }
  guion.push({ img: nombre, rotulo, click, hold: opts.hold ?? 1.6 });
  console.log(`  ${nombre}  ${click ? `clic(${click})` : 'final'}  ${rotulo}`);
};

// ── el recorrido ───────────────────────────────────────────────────────────
await p.goto(`https://www.faimobras.com/cotizador/presupuesto/${PID}/obra`,
             { waitUntil: 'networkidle', timeout: 60000 });
await p.waitForTimeout(2500);

const tabContrato = p.getByRole('button', { name: 'Contrato', exact: true }).first();
await tabContrato.waitFor({ state: 'visible', timeout: 30000 });
await paso('El presupuesto ya está cerrado y la obra existe.', tabContrato, { hold: 2.4 });
await tabContrato.click();

const btnCrear = p.getByRole('button', { name: /Crear contrato/ }).first();
await paso('Entrás a la pestaña Contrato.', btnCrear, { hold: 1.9 });
await btnCrear.click();

const plazo = p.locator('input').nth(3);   // Plazo (días)
await paso('El monto ya viene del presupuesto: no lo cargás de nuevo.', plazo, { hold: 2.8, asentar: 900 });
await plazo.click();

await paso('Ponés el plazo que pactaste.', null, { hold: 1.0 });
await plazo.fill('90');

const p403030 = p.getByRole('button', { name: '40 / 30 / 30' }).first();
await paso('Y elegís cómo se cobra.', p403030, { hold: 2.2 });
await p403030.click();

const guardar = p.getByRole('button', { name: /Guardar contrato/ }).first();
await guardar.scrollIntoViewIfNeeded();
await paso('Las etapas salen solas, con su porcentaje y su monto.', guardar, { hold: 2.8, asentar: 800 });
await guardar.click();
await p.getByRole('button', { name: 'Editar', exact: true }).first()
       .waitFor({ state: 'visible', timeout: 30000 });

await paso('El contrato queda hecho, y cada etapa se cobra desde acá.', null,
           { hold: 3.8, asentar: 1400 });

writeFileSync(`${DIR}/guion.json`, JSON.stringify(guion, null, 2));
console.log('\nguion.json con', guion.length, 'estados');
await b.close();
