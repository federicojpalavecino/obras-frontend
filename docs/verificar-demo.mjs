// QA sobre el build real; no usa servicios ni datos de clientes.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const raiz = resolve('build');
const salida = resolve('.demo-qa');
await mkdir(salida, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const archivo = resolve(raiz, '.' + decodeURIComponent(pathname));
    if (!archivo.startsWith(raiz + '\\') && !archivo.startsWith(raiz + '/') && archivo !== raiz) throw new Error('ruta');
    const objetivo = extname(pathname) ? archivo : resolve(raiz, 'index.html');
    res.setHeader('Content-Type', mime[extname(objetivo)] || 'application/octet-stream');
    res.end(await readFile(objetivo));
  } catch { res.statusCode = 404; res.end('No encontrado'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const url = process.argv[2] || `http://127.0.0.1:${server.address().port}`;
const navegador = await chromium.launch({ headless: true });
const resultados = [];
try {
  for (const [nombre, viewport] of [['escritorio', { width: 1440, height: 1050 }], ['celular', { width: 390, height: 844 }]]) {
    const contexto = await navegador.newContext({ viewport, locale: 'es-AR' });
    const pagina = await contexto.newPage();
    const errores = [], llamadas = [], eventos = [];
    pagina.on('pageerror', error => errores.push(error.message));
    await pagina.route('**/demo/eventos', async ruta => {
      const req = ruta.request();
      const headers = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
      if (req.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers });
      assert.equal(req.headers().authorization, undefined);
      eventos.push(req.postDataJSON());
      await ruta.fulfill({ status: 200, headers, contentType: 'application/json', body: '{"aceptado":true}' });
    });
    await pagina.route('**/obras-backend-production.up.railway.app/**', async ruta => {
      if (ruta.request().url().endsWith('/demo/eventos')) return ruta.fallback();
      llamadas.push(ruta.request().url());
      await ruta.abort();
    });
    const sesionPrivada = JSON.stringify({ user: { nombre: 'PRIVADO_NO_MOSTRAR' }, tenant: { nombre: 'PRIVADO_NO_MOSTRAR', ciudad: 'CIUDAD_PRIVADA', logo_url: 'https://privado.invalid/logo.png' }, token: 'token-cuenta-real-de-prueba' });
    await pagina.addInitScript(s => {
      localStorage.setItem('obras_session', s);
      localStorage.setItem('obras_token', 'token-cuenta-real-de-prueba');
      localStorage.setItem('obras_tenant', 'TENANT_PRIVADO');
      window.__ultimoImpreso = '';
      window.print = () => {};
    }, sesionPrivada);
    await pagina.goto(url + '/demo');
    await pagina.getByRole('heading', { name: /Probá lo fácil/ }).waitFor();
    assert.equal((await pagina.locator('body').innerText()).includes('PRIVADO_NO_MOSTRAR'), false);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('obras_session')), sesionPrivada);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('obras_token')), 'token-cuenta-real-de-prueba');
    const inicial = await pagina.getByTestId('demo-total').innerText();
    await pagina.getByLabel('Cantidad de Contrapiso de hormigón pobre · 10 cm').fill('45');
    await pagina.getByLabel('Cantidad de Contrapiso de hormigón pobre · 10 cm').blur();
    const recalculado = await pagina.getByTestId('demo-total').innerText();
    assert.notEqual(recalculado, inicial);
    await pagina.getByRole('button', { name: /Pintura látex en paredes.*Ver análisis/ }).click();
    await pagina.getByRole('dialog').waitFor();
    await pagina.keyboard.press('Escape');
    assert.equal(await pagina.getByRole('dialog').count(), 0);
    await pagina.getByRole('button', { name: 'Agregar trabajo', exact: true }).click();
    await pagina.getByLabel('Buscar trabajo').fill('zocalo');
    await pagina.getByRole('button', { name: /Zócalo de porcelanato/ }).click();
    assert.equal(await pagina.locator('.dv-budget tbody tr').count(), 7);
    await pagina.getByRole('button', { name: /Usá tus valores/ }).click();
    const antesPintura = await pagina.getByTestId('demo-total').innerText();
    await pagina.getByRole('button', { name: /Probar una suba/ }).click();
    assert.notEqual(await pagina.getByTestId('demo-total').innerText(), antesPintura);
    assert.match(await pagina.locator('.dv-affected').innerText(), /2 trabajos/);
    await pagina.getByRole('button', { name: 'Deshacer', exact: true }).click();
    assert.equal(await pagina.getByTestId('demo-total').innerText(), antesPintura);
    await pagina.getByRole('button', { name: /Probar una suba/ }).click();
    await pagina.getByRole('button', { name: /Ver el presupuesto listo/ }).click();
    assert.equal(await pagina.locator('.print-empresa').innerText(), 'ESTUDIO DE EJEMPLO');
    assert.equal((await pagina.locator('.dv-paper').innerText()).includes('CIUDAD_PRIVADA'), false);
    const totalDocumento = await pagina.locator('.print-total-block').last().locator('.print-total-val').innerText();
    assert.equal(totalDocumento, await pagina.getByTestId('demo-total').innerText());
    assert.equal(await pagina.locator('.print-row-subtotal').first().evaluate(tr => [...tr.cells].reduce((n, td) => n + td.colSpan, 0)), 5);
    await pagina.getByRole('tab', { name: 'Materiales', exact: true }).click();
    assert.match(await pagina.getByRole('tabpanel').innerText(), /Pintura látex interior/);
    assert.match(await pagina.getByRole('link', { name: /Verlo con una obra mía/ }).getAttribute('href'), /wa\.me\/5493625548783/);
    assert.match(await pagina.getByRole('link', { name: /Quiero crear mi cuenta/ }).getAttribute('href'), /demo_sesion=[a-f0-9-]{36}/);
    await pagina.getByRole('tab', { name: 'Para el cliente', exact: true }).click();
    await pagina.getByRole('button', { name: /Imprimir \/ PDF/ }).click();
    await pagina.waitForFunction(() => [...document.querySelectorAll('iframe')].some(f => f.contentDocument?.body?.innerText.includes('ESTUDIO DE EJEMPLO')));
    const impreso = await pagina.locator('iframe').last().evaluate(f => f.contentDocument.body.innerText);
    assert.match(impreso, /DEMOSTRACIÓN/);
    assert.equal(impreso.includes('PRIVADO_NO_MOSTRAR'), false);
    await pagina.screenshot({ path: resolve(salida, `demo-${nombre}.png`), fullPage: true });
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Desborde horizontal');
    const antesRecargar = await pagina.getByTestId('demo-total').innerText();
    await pagina.reload();
    await pagina.getByTestId('demo-total').waitFor();
    assert.equal(await pagina.getByTestId('demo-total').innerText(), antesRecargar);
    assert.equal(await pagina.evaluate(() => localStorage.getItem('obras_tenant')), 'TENANT_PRIVADO');
    await pagina.getByRole('button', { name: /Baño · 6/ }).click();
    await pagina.getByRole('button', { name: 'Cargar ejemplo', exact: true }).click();
    assert.equal(await pagina.getByRole('heading', { name: 'Terminaciones de un baño', exact: true }).count(), 1);
    await pagina.locator('.dv-reset').click();
    await pagina.getByRole('button', { name: 'Cargar ejemplo', exact: true }).click();
    assert.equal(await pagina.evaluate(() => localStorage.getItem('obras_token')), 'token-cuenta-real-de-prueba');
    await pagina.setViewportSize({ width: 320, height: 740 });
    if (await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      console.log(await pagina.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ tag: e.tagName, clase: e.className, ancho: e.getBoundingClientRect().width, derecha: e.getBoundingClientRect().right })).filter(e => e.derecha > innerWidth + 2).slice(0, 15)));
      await pagina.screenshot({ path: resolve(salida, `desborde-${nombre}.png`), fullPage: true });
    }
    assert.equal(await pagina.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Desborde a 320px');
    assert.equal(llamadas.length, 0, `Llamadas no permitidas a la API: ${llamadas}`);
    assert.deepEqual(errores, []);
    assert(eventos.some(e => e.tipo === 'demo_v2_documento'));
    resultados.push({ nombre, totalDocumento, eventos: [...new Set(eventos.map(e => e.tipo))], errores: errores.length });
    await contexto.close();
  }
  console.log(JSON.stringify({ ok: true, resultados, capturas: salida }, null, 2));
} finally {
  await navegador.close();
  await new Promise(done => server.close(done));
}
