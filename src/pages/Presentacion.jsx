// Presentación comercial pública — faimobras.com/presentacion
// No pide login: es el link que se le manda a un prospecto antes de la demo.
// Las tipografías (Syne / IBM Plex Mono) ya vienen cargadas en public/index.html.
import React from 'react';

const CSS = `
.pv{
  --ground:#fbfcfb; --panel:#f2f5f3; --panel-2:#e8ede9; --line:#dde3df;
  --ink:#141916; --ink-soft:#5d6b64; --accent:#059669; --accent-soft:#f0fdf4;
  --accent-line:#bbf7d0; --bad:#c2410c; --shadow:rgba(20,25,22,.08);
  --display:'Syne',system-ui,sans-serif;
  --body:'Syne',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace;
  background:var(--ground); color:var(--ink); font-family:var(--body);
  font-size:16.5px; line-height:1.62; -webkit-font-smoothing:antialiased;
  min-height:100vh;
}
.pv *{box-sizing:border-box}
.pv .wrap{max-width:940px;margin:0 auto;padding:0 26px}
.pv section{padding:0 0 72px}
.pv h1,.pv h2,.pv h3{text-wrap:balance;margin:0;font-family:var(--display)}
.pv h1{font-size:clamp(34px,6vw,62px);line-height:1.02;font-weight:800;letter-spacing:-.035em;margin:20px 0 18px}
.pv h1 .hi{color:var(--accent)}
.pv h2{font-size:clamp(23px,3.4vw,33px);font-weight:800;letter-spacing:-.022em;margin-bottom:10px}
.pv .lead{font-size:clamp(16.5px,2.1vw,19.5px);color:var(--ink-soft);max-width:62ch;margin:0}
.pv .sub{color:var(--ink-soft);max-width:66ch;margin:0 0 34px}
.pv .tag{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);display:inline-flex;align-items:center;gap:9px;margin-bottom:13px}
.pv .tag::before{content:'';width:22px;height:2px;background:var(--accent);border-radius:2px}
.pv header{padding:64px 0 0}
.pv .marca{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--ink-soft)}
.pv .cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:26px;margin-top:42px;padding-top:26px;border-top:2px solid var(--ink)}
.pv .cifra .n{font-family:var(--mono);font-size:31px;font-weight:600;color:var(--accent);line-height:1;font-variant-numeric:tabular-nums}
.pv .cifra .l{font-size:11.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--ink-soft);margin-top:7px}
.pv .comp{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.pv .col{border:1px solid var(--line);border-radius:15px;padding:26px;background:var(--panel)}
.pv .col.si{background:var(--accent-soft);border-color:var(--accent-line)}
.pv .col h3{font-family:var(--mono);font-size:11.5px;font-weight:600;letter-spacing:.15em;text-transform:uppercase;margin-bottom:19px;color:var(--ink-soft)}
.pv .col.si h3{color:var(--accent)}
.pv .col ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:13px}
.pv .col li{padding-left:26px;position:relative;font-size:15.5px;line-height:1.5}
.pv .col.no li::before{content:'—';position:absolute;left:0;color:var(--bad);font-weight:700}
.pv .col.si li::before{content:'✓';position:absolute;left:0;color:var(--accent);font-weight:700}
.pv .cadena{display:flex;gap:14px;flex-wrap:wrap;counter-reset:paso}
.pv .eslabon{flex:1 1 158px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:19px 17px}
.pv .eslabon::before{counter-increment:paso;content:counter(paso);font-family:var(--mono);font-size:10.5px;font-weight:600;color:var(--accent);display:block;margin-bottom:9px}
.pv .eslabon .t{font-weight:700;font-size:15px;margin-bottom:5px;letter-spacing:-.012em}
.pv .eslabon .d{font-size:13px;color:var(--ink-soft);line-height:1.48}
.pv .destaque{margin-top:30px;padding:22px 26px;background:var(--panel-2);border-left:3px solid var(--accent);border-radius:0 12px 12px 0;font-size:15.5px}
.pv .destaque b{color:var(--accent)}
.pv .grilla{display:grid;grid-template-columns:repeat(auto-fit,minmax(238px,1fr));gap:17px}
.pv .item{border:1px solid var(--line);border-radius:13px;padding:21px;background:var(--panel)}
.pv .item .k{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:9px}
.pv .item .t{font-weight:700;font-size:15.5px;margin-bottom:6px;letter-spacing:-.012em}
.pv .item .d{font-size:13.8px;color:var(--ink-soft);line-height:1.52}
.pv .cierre{background:var(--ink);color:var(--ground);border-radius:19px;padding:48px 42px;margin-bottom:34px}
.pv .cierre h2{color:var(--ground)}
.pv .cierre p{color:#9aa8a1;max-width:54ch;margin:12px 0 28px}
.pv .cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:15px 32px;border-radius:11px;font-weight:700;font-size:15.5px;letter-spacing:-.01em;transition:transform .16s ease,box-shadow .16s ease}
.pv .cta:hover{transform:translateY(-1px);box-shadow:0 7px 22px var(--shadow)}
.pv .cta:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.pv .datos{margin-top:26px;font-family:var(--mono);font-size:13px;color:#9aa8a1;line-height:2.05}
.pv .datos b{color:var(--ground);font-weight:500}
.pv footer{padding:0 0 60px;font-size:12.5px;color:var(--ink-soft);display:flex;justify-content:space-between;flex-wrap:wrap;gap:9px}
.pv .ingresar{position:fixed;top:18px;right:20px;z-index:20;background:rgba(255,255,255,.9);backdrop-filter:blur(6px);border:1px solid var(--line);color:var(--ink-soft);text-decoration:none;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:600;font-family:var(--display)}
.pv .ingresar:hover{color:var(--accent);border-color:var(--accent-line)}
@media (max-width:700px){
  .pv .comp{grid-template-columns:1fr}
  .pv section{padding-bottom:52px}
  .pv .cierre{padding:34px 26px}
  .pv .ingresar{display:none}
}
@media (prefers-reduced-motion:reduce){ .pv *{transition:none!important;animation:none!important} }
@media print{
  .pv .ingresar{display:none}
  .pv section{padding-bottom:22px;break-inside:avoid}
  .pv .cierre{background:#fff;color:var(--ink);border:2px solid var(--ink)}
  .pv .cierre h2,.pv .datos b{color:var(--ink)}
  .pv .cierre p,.pv .datos{color:#444}
  .pv .cta{background:#fff;color:var(--ink);border:1.5px solid var(--ink)}
}
`;

const MODULOS = [
  ['Cotización', 'Cotizador', 'Catálogo de ítems con análisis real. Cómputo por m², m³ y ml integrado.'],
  ['Cotización', 'Análisis de costos', 'Catálogo global más tus propios precios y rendimientos por obra.'],
  ['Obra', 'Planificación', 'Gantt con vínculos entre tareas, camino crítico y curva de inversión.'],
  ['Obra', 'Certificados', 'Avance vinculado al presupuesto. Adicionales con coeficientes propios.'],
  ['Administración', 'Control financiero', 'Ingresos, egresos y personal por semana, quincena o mes.'],
  ['Administración', 'Gestión de obra', 'Contrato, cobros, subcontratos y compras en un solo lugar.'],
  ['Cliente', 'Portal de clientes', 'Tu cliente ve avance, contrato y cuenta corriente. Vos elegís qué.'],
  ['Cliente', 'Salida profesional', 'Presupuesto para el cliente o interno, con tu logo y tus colores.'],
];

const CADENA = [
  ['Presupuesto', 'Rubros, ítems y cómputo. Coeficientes GG, beneficio e IVA.'],
  ['Análisis de costos', 'Materiales, mano de obra y equipos por unidad. Editable por obra.'],
  ['Planificación', 'Gantt con dependencias y camino crítico, calculado desde las horas.'],
  ['Certificados', 'Avance sobre el presupuesto, con sus egresos.'],
  ['Cobranzas', 'Contrato, cuenta corriente y control financiero.'],
];

export default function Presentacion() {
  return (
    <div className="pv">
      <style>{CSS}</style>
      <a className="ingresar" href="/">Ingresar</a>

      <header className="wrap">
        <div className="marca">FAIM OBRAS</div>
        <h1>Cotizá una obra en <span className="hi">minutos</span>, no en días.</h1>
        <p className="lead">
          El sistema de gestión para estudios de arquitectura e ingeniería.
          Presupuestos con análisis de costos reales, y todo lo que viene después
          —certificados, plazos, cobranzas— saliendo del mismo lugar.
        </p>
        <div className="cifras">
          {[['436','ítems con análisis'],['829','materiales'],['14','gremios · escala UOCRA'],['1','carga, todo vinculado']].map(([n,l]) => (
            <div className="cifra" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
          ))}
        </div>
      </header>

      <section className="wrap" style={{ paddingTop: 66 }}>
        <div className="tag">El problema</div>
        <h2>Cotizar bien cuesta demasiado tiempo</h2>
        <p className="sub">Y cuando por fin está lista, el Excel queda huérfano: el certificado
          se rehace, el plazo se estima aparte, la cobranza vive en otro archivo.</p>
        <div className="comp">
          <div className="col no">
            <h3>Con Excel</h3>
            <ul>
              <li>Días armando el presupuesto desde cero, ítem por ítem</li>
              <li>Precios de materiales que nadie sabe de cuándo son</li>
              <li>El certificado se vuelve a cargar a mano</li>
              <li>El plazo de obra se estima «a ojo»</li>
              <li>Un adicional obliga a rehacer medio Excel</li>
              <li>El cliente llama para preguntar cómo viene la obra</li>
            </ul>
          </div>
          <div className="col si">
            <h3>Con FAIM OBRAS</h3>
            <ul>
              <li>Catálogo con análisis de costos ya cargado: elegís y computás</li>
              <li>Precios con fuente y fecha, actualizables por rubro</li>
              <li>El certificado sale del presupuesto, con su avance</li>
              <li>El plazo lo calcula el sistema desde las horas de cada tarea</li>
              <li>Los adicionales se vinculan al presupuesto base</li>
              <li>El cliente entra a su portal y ve el avance solo</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="wrap">
        <div className="tag">Cómo funciona</div>
        <h2>Cargás una vez. Sirve para todo lo demás.</h2>
        <p className="sub">No son módulos sueltos que se parecen entre sí: es el mismo dato
          recorriendo la obra de punta a punta.</p>
        <div className="cadena">
          {CADENA.map(([t, d]) => (
            <div className="eslabon" key={t}><div className="t">{t}</div><div className="d">{d}</div></div>
          ))}
        </div>
        <div className="destaque">
          <b>Un ejemplo concreto.</b> Cambiás la cuadrilla de una tarea de 1 a 3 personas.
          El sistema recalcula la duración con las horas de mano de obra de tu propio análisis,
          corre las tareas que dependen de esa y te da la nueva fecha de fin de obra.
          Sin tocar una planilla.
        </div>
      </section>

      <section className="wrap">
        <div className="tag">Qué incluye</div>
        <h2>Todo lo que hoy tenés repartido en archivos</h2>
        <div className="grilla">
          {MODULOS.map(([k, t, d]) => (
            <div className="item" key={t}>
              <span className="k">{k}</span>
              <div className="t">{t}</div>
              <div className="d">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap">
        <div className="tag">Por qué importa</div>
        <h2>Tres cosas que cambian la semana</h2>
        <div className="grilla">
          <div className="item"><div className="t">Cotizás más rápido</div>
            <div className="d">El análisis de costos ya está armado. Elegís el ítem, cargás la
              cantidad y el precio sale solo, con tus coeficientes.</div></div>
          <div className="item"><div className="t">Cotizás mejor</div>
            <div className="d">Precios con fuente y fecha, y mano de obra según escala vigente.
              Se ve de un vistazo qué precio conviene revisar.</div></div>
          <div className="item"><div className="t">No perdés el hilo</div>
            <div className="d">Del presupuesto al certificado y a la cobranza sin volver a cargar
              nada. Cada obra con su historia completa.</div></div>
        </div>
      </section>

      <div className="wrap">
        <div className="cierre">
          <h2>Veámoslo con una obra tuya</h2>
          <p>La mejor forma de evaluarlo es con un presupuesto real de tu estudio.
            En una reunión de 30 minutos lo cargamos juntos y ves el flujo completo,
            de la cotización al certificado.</p>
          <a className="cta" href="https://wa.me/5493482305155" target="_blank" rel="noreferrer">Coordinar una demo →</a>
          <div className="datos">
            WhatsApp <b>+54 9 3482 30-5155</b><br />
            Email <b>faimobras@gmail.com</b><br />
            Web <b>faimobras.com</b>
          </div>
        </div>
      </div>

      <div className="wrap">
        <footer>
          <span>FAIM OBRAS — Gestión integral para estudios de arquitectura e ingeniería</span>
          <span>Resistencia, Chaco · Argentina</span>
        </footer>
      </div>
    </div>
  );
}
