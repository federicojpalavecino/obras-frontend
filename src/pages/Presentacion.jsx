// Presentación comercial pública — faimobras.com/presentacion
// No pide login: es el link que se le manda a un prospecto antes de la demo.
// Las tipografías (Syne / IBM Plex Mono) ya vienen cargadas en public/index.html.
//
// La portada no es un video: se anima en vivo con CSS y un poco de React. Pesa
// cero, queda nítida en cualquier pantalla y el texto se edita sin re-renderizar
// nada. Todo respeta prefers-reduced-motion.
import React, { useState, useEffect, useRef } from 'react';

const CSS = `
.pv{
  --ground:#fbfcfb; --panel:#f2f5f3; --panel-2:#e8ede9; --line:#dde3df;
  --ink:#141916; --ink-soft:#5d6b64; --accent:#059669; --accent-soft:#f0fdf4;
  --accent-line:#bbf7d0; --bad:#c2410c; --shadow:rgba(20,25,22,.08);
  --night:#0e1411; --night-2:#161f1a; --night-line:#24322b; --night-ink:#eef3f0;
  --night-soft:#8fa79b;
  --display:'Syne',system-ui,sans-serif;
  --body:'Syne',system-ui,sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Consolas,monospace;
  background:var(--ground); color:var(--ink); font-family:var(--body);
  font-size:16.5px; line-height:1.62; -webkit-font-smoothing:antialiased;
  min-height:100vh; overflow-x:hidden;
}
.pv *{box-sizing:border-box}
.pv .wrap{max-width:1080px;margin:0 auto;padding:0 26px}
.pv .wrap-txt{max-width:940px;margin:0 auto;padding:0 26px}
.pv section{padding:0 0 76px}
.pv h1,.pv h2,.pv h3{text-wrap:balance;margin:0;font-family:var(--display)}
.pv h1{font-size:clamp(34px,5.6vw,60px);line-height:1.01;font-weight:800;letter-spacing:-.038em;margin:0 0 20px}
.pv h1 .hi{color:var(--accent)}
.pv h2{font-size:clamp(23px,3.4vw,33px);font-weight:800;letter-spacing:-.022em;margin-bottom:10px}
.pv .lead{font-size:clamp(16.5px,2.1vw,19.5px);color:var(--ink-soft);max-width:52ch;margin:0}
.pv .sub{color:var(--ink-soft);max-width:66ch;margin:0 0 34px}
.pv .tag{font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);display:inline-flex;align-items:center;gap:9px;margin-bottom:13px}
.pv .tag::before{content:'';width:22px;height:2px;background:var(--accent);border-radius:2px}
.pv .marca{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.32em;text-transform:uppercase}

/* ── PORTADA ───────────────────────────────────────────────────────────── */
.pv .hero{background:var(--night);color:var(--night-ink);position:relative;overflow:hidden;padding:0 0 4px}
/* Trama de papel de obra: la misma referencia que el material de marca. */
.pv .hero::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(var(--night-line) 1px,transparent 1px),linear-gradient(90deg,var(--night-line) 1px,transparent 1px);
  background-size:34px 34px;opacity:.5;
  -webkit-mask-image:radial-gradient(120% 90% at 20% 0%,#000 20%,transparent 78%);
  mask-image:radial-gradient(120% 90% at 20% 0%,#000 20%,transparent 78%);
}
.pv .hero::after{
  content:'';position:absolute;width:640px;height:640px;right:-160px;top:-260px;border-radius:50%;
  background:radial-gradient(circle,rgba(5,150,105,.22),transparent 66%);pointer-events:none;
}
.pv .wrap-hero{max-width:1200px;margin:0 auto;padding:0 26px}
.pv .hero-in{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.18fr);
  gap:40px;align-items:center;padding:34px 0 78px}
.pv .hero .marca{color:var(--night-soft);margin-bottom:30px;display:block}
.pv .hero .lead{color:var(--night-soft)}
.pv .hero h1{color:var(--night-ink)}
.pv .hero-cta{display:flex;gap:13px;flex-wrap:wrap;margin-top:30px;align-items:center}
.pv .cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;padding:15px 30px;border-radius:11px;font-weight:700;font-size:15.5px;letter-spacing:-.01em;transition:transform .16s ease,box-shadow .16s ease}
.pv .cta:hover{transform:translateY(-1px);box-shadow:0 8px 26px rgba(5,150,105,.34)}
.pv .cta:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.pv .cta-2{display:inline-block;color:var(--night-ink);text-decoration:none;padding:15px 22px;border-radius:11px;
  border:1px solid var(--night-line);font-weight:600;font-size:15px;transition:border-color .16s ease,color .16s ease}
.pv .cta-2:hover{border-color:var(--accent);color:var(--accent)}
.pv .cifras{display:grid;grid-template-columns:repeat(auto-fit,minmax(98px,1fr));gap:16px;
  margin-top:44px;padding-top:24px;border-top:1px solid var(--night-line)}
.pv .cifra .n{font-family:var(--mono);font-size:29px;font-weight:600;color:var(--accent);line-height:1;font-variant-numeric:tabular-nums}
.pv .cifra .l{font-size:11px;text-transform:uppercase;letter-spacing:.09em;color:var(--night-soft);margin-top:7px;line-height:1.35}

/* ── Maqueta de la app (se usa en la portada y en la sección de dispositivos) */
.pv .app{background:#fff;color:var(--ink);border-radius:9px;overflow:hidden;
  box-shadow:0 26px 64px rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.09)}
.pv .app-bar{display:flex;align-items:center;gap:7px;padding:9px 12px;border-bottom:1px solid var(--line);background:#fff}
.pv .app-logo{font-family:var(--mono);font-size:9.5px;font-weight:700;letter-spacing:.12em;color:var(--accent)}
.pv .app-crumb{font-size:9.5px;color:var(--ink-soft);border-left:1px solid var(--line);padding-left:8px;margin-left:1px}
.pv .app-dot{width:6px;height:6px;border-radius:50%;background:var(--line)}
.pv .app-body{padding:11px 13px}
.pv .app-h{display:grid;gap:8px;font-family:var(--mono);font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:#9aa8a1;padding-bottom:6px;border-bottom:1px solid var(--line)}
.pv .row{display:grid;gap:8px;align-items:baseline;padding:7px 0;border-bottom:1px solid #f1f4f2}
.pv .row .nm{font-size:11px;font-weight:600;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv .row .un,.pv .row .ct,.pv .row .tt{font-family:var(--mono);font-size:10.5px;text-align:right;font-variant-numeric:tabular-nums}
.pv .row .un{color:#9aa8a1;text-align:center}
.pv .row .ct{color:var(--ink-soft)}
.pv .row .tt{color:var(--ink);font-weight:600}
.pv .cols{grid-template-columns:minmax(0,1fr) 30px 52px 82px}
.pv .row-in{animation:rowIn .42s cubic-bezier(.2,.7,.3,1) both}
@keyframes rowIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
.pv .app-tot{display:flex;justify-content:space-between;align-items:flex-end;
  margin-top:11px;padding-top:10px;border-top:2px solid var(--ink)}
.pv .app-tot .k{font-family:var(--mono);font-size:8.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft)}
.pv .app-tot .v{font-family:var(--mono);font-size:19px;font-weight:600;color:var(--accent);
  line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.pv .caret{display:inline-block;width:2px;height:.82em;background:var(--accent);margin-left:3px;
  vertical-align:-1px;animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}

/* ── Dispositivos de la portada ─────────────────────────────────────────── */
/* Van uno al lado del otro, no encimados: superpuesto, el celular tapaba o el
   total del presupuesto o los nombres de los ítems, que son lo que hay que
   dejar ver. Se pisan apenas el marco, lo justo para que se lea la profundidad. */
.pv .stack{display:flex;align-items:flex-end;gap:0;padding:6px 0}
.pv .stack .lap{flex:1 1 auto;min-width:0;position:relative;z-index:1}
.pv .stack .phone{flex:0 0 152px;width:152px;margin-left:-10px;margin-bottom:-16px;z-index:3;
  animation:floatY 6s ease-in-out infinite}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

/* Marcos de dispositivo */
.pv .frame{background:#0b100d;border:1px solid #2b3a33;border-radius:16px;padding:9px 9px 11px;
  box-shadow:0 22px 50px rgba(0,0,0,.4)}
.pv .frame.phone-f{border-radius:20px;padding:7px 6px 12px;position:relative}
.pv .frame.phone-f::after{content:'';position:absolute;left:50%;transform:translateX(-50%);bottom:5px;
  width:38%;height:3px;border-radius:3px;background:#2b3a33}
.pv .notch{width:34%;height:4px;border-radius:4px;background:#2b3a33;margin:0 auto 6px}
.pv .frame .app{box-shadow:none;border:none;border-radius:9px}
.pv .stand{width:44%;height:7px;margin:0 auto;border-radius:0 0 7px 7px;background:#1a241f;border:1px solid #2b3a33;border-top:none}

/* App en versión celular */
.pv .m-head{padding:8px 9px;border-bottom:1px solid var(--line)}
.pv .m-title{font-size:10px;font-weight:800;letter-spacing:-.01em}
.pv .m-sub{font-family:var(--mono);font-size:7.5px;color:#9aa8a1;letter-spacing:.06em}
.pv .m-item{padding:7px 9px;border-bottom:1px solid #f1f4f2;display:flex;justify-content:space-between;align-items:center;gap:6px}
.pv .m-item .t{font-size:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv .m-item .s{font-family:var(--mono);font-size:7.5px;color:#9aa8a1}
.pv .m-item .v{font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:600;white-space:nowrap}
/* Etiqueta arriba y monto abajo: al ancho de un celular, en una sola línea el
   total se partía al medio. */
.pv .m-tot{padding:8px 9px;background:var(--accent-soft)}
.pv .m-tot .k{font-family:var(--mono);font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);display:block}
.pv .m-tot .v{font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--accent);
  font-variant-numeric:tabular-nums;display:block;white-space:nowrap;margin-top:2px}

/* ── Sección de dispositivos ────────────────────────────────────────────── */
.pv .devices{display:grid;grid-template-columns:1.25fr .75fr;gap:30px;align-items:end;
  background:var(--panel);border:1px solid var(--line);border-radius:20px;padding:34px 34px 0;overflow:hidden}
.pv .devices .frame{box-shadow:0 16px 34px rgba(20,25,22,.13)}
.pv .dev-tab{max-width:420px;margin-left:auto}
.pv .dev-phone{max-width:186px;margin:0 auto}
.pv .dev-note{grid-column:1/-1;padding:22px 0 30px;border-top:1px solid var(--line);margin-top:30px;
  display:flex;gap:26px;flex-wrap:wrap}
.pv .dev-note div{flex:1 1 190px}
.pv .dev-note .t{font-weight:700;font-size:14.5px;margin-bottom:3px}
.pv .dev-note .d{font-size:13.2px;color:var(--ink-soft);line-height:1.5}

/* ── Gantt animado ──────────────────────────────────────────────────────── */
.pv .gantt{background:#fff;border:1px solid var(--line);border-radius:15px;padding:20px;box-shadow:0 8px 26px var(--shadow)}
.pv .g-top{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:15px}
.pv .g-crew{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
.pv .g-crew b{color:var(--accent);font-size:15px}
.pv .g-fin{font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
.pv .g-fin b{color:var(--ink);font-size:15px;transition:color .3s}
.pv .g-fin b.up{color:var(--accent)}
.pv .g-row{display:grid;grid-template-columns:132px minmax(0,1fr);gap:11px;align-items:center;margin-bottom:7px}
.pv .g-nm{font-size:12px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv .g-track{position:relative;height:16px;background:var(--panel-2);border-radius:4px;overflow:hidden}
.pv .g-bar{position:absolute;top:0;height:100%;border-radius:4px;background:var(--accent);opacity:.85;
  transition:left .7s cubic-bezier(.3,.8,.3,1),width .7s cubic-bezier(.3,.8,.3,1)}
.pv .g-bar.crit{background:#dc2626}
.pv .g-foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);
  font-size:13px;color:var(--ink-soft);display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.pv .chip{font-family:var(--mono);font-size:10.5px;padding:3px 9px;border-radius:20px;border:1px solid var(--line);color:var(--ink-soft)}
.pv .chip.crit{border-color:#fecaca;color:#dc2626;background:#fef2f2}

/* ── Resto ──────────────────────────────────────────────────────────────── */
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
.pv .item{border:1px solid var(--line);border-radius:13px;padding:21px;background:var(--panel);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}
.pv .item:hover{transform:translateY(-2px);box-shadow:0 10px 26px var(--shadow);border-color:var(--accent-line)}
.pv .item .k{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-soft);display:block;margin-bottom:9px}
.pv .item .t{font-weight:700;font-size:15.5px;margin-bottom:6px;letter-spacing:-.012em}
.pv .item .d{font-size:13.8px;color:var(--ink-soft);line-height:1.52}
.pv .cierre{background:var(--ink);color:var(--ground);border-radius:19px;padding:48px 42px;margin-bottom:34px}
.pv .cierre h2{color:var(--ground)}
.pv .cierre p{color:#9aa8a1;max-width:54ch;margin:12px 0 28px}
.pv .datos{margin-top:26px;font-family:var(--mono);font-size:13px;color:#9aa8a1;line-height:2.05}
.pv .datos b{color:var(--ground);font-weight:500}
.pv footer{padding:0 0 60px;font-size:12.5px;color:var(--ink-soft);display:flex;justify-content:space-between;flex-wrap:wrap;gap:9px}
.pv .ingresar{position:fixed;top:18px;right:20px;z-index:20;background:rgba(14,20,17,.72);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.16);color:#eef3f0;text-decoration:none;padding:8px 16px;border-radius:9px;font-size:13px;font-weight:600;font-family:var(--display)}
.pv .ingresar:hover{color:#fff;border-color:var(--accent)}

/* Aparición al hacer scroll.
   Solo esconde si el JS pudo poner la clase .anim en la raíz. Sin eso —sin JS,
   sin IntersectionObserver, con movimiento reducido— la página se ve entera:
   nunca se esconde contenido que después no haya quien vuelva a mostrar. */
.pv.anim .rev{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s cubic-bezier(.2,.7,.3,1)}
.pv.anim .rev.on{opacity:1;transform:none}

@media (max-width:900px){
  .pv .hero-in{grid-template-columns:1fr;gap:52px;padding-bottom:60px}
  .pv .devices{grid-template-columns:1fr;padding:26px 22px 0}
  .pv .dev-tab{margin:0 auto}
  .pv .stack .phone{flex-basis:112px;width:112px}
}
@media (max-width:700px){
  .pv .comp{grid-template-columns:1fr}
  .pv section{padding-bottom:56px}
  .pv .cierre{padding:34px 26px}
  .pv .ingresar{display:none}
  .pv .g-row{grid-template-columns:96px minmax(0,1fr)}
  .pv .stack .phone{display:none}
}
@media (prefers-reduced-motion:reduce){
  .pv *{transition:none!important;animation:none!important}
  .pv.anim .rev{opacity:1;transform:none}
}
@media print{
  .pv .ingresar,.pv .stack .phone{display:none}
  .pv .hero{background:#fff;color:var(--ink)}
  .pv .hero h1,.pv .hero .lead,.pv .hero .marca,.pv .cifra .l{color:var(--ink)}
  .pv .hero::before,.pv .hero::after{display:none}
  .pv section{padding-bottom:22px;break-inside:avoid}
  .pv .cierre{background:#fff;color:var(--ink);border:2px solid var(--ink)}
  .pv .cierre h2,.pv .datos b{color:var(--ink)}
  .pv .cierre p,.pv .datos{color:#444}
  .pv .cta{background:#fff;color:var(--ink);border:1.5px solid var(--ink)}
  .pv.anim .rev{opacity:1!important;transform:none!important}
}
`;

// Ítems del catálogo global del sistema (no son datos de ningún estudio).
const ITEMS = [
  ['EXCAVACIÓN MANUAL PARA CIMIENTOS', 'm³', '18,40', 1104000],
  ['HORMIGÓN ARMADO EN PLATEA', 'm³', '26,00', 4914000],
  ['MAMPOSTERÍA LADRILLO HUECO 12', 'm²', '184,00', 3312000],
  ['LOSA CERÁMICA CON VIGUETAS', 'm²', '96,00', 3264000],
  ['REVOQUE GRUESO Y FINO INTERIOR', 'm²', '310,00', 2635000],
  ['CUBIERTA DE CHAPA C-25', 'm²', '112,00', 3696000],
  ['INSTALACIÓN SANITARIA COMPLETA', 'Gl', '1,00', 2480000],
  ['PINTURA LÁTEX INTERIOR Y EXTERIOR', 'm²', '420,00', 1890000],
];

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

// Tareas del Gantt de ejemplo. hs = horas de mano de obra que salen del análisis;
// la duración se calcula dividiéndolas por la cuadrilla, igual que en el sistema.
// Están calibradas para que con la cuadrilla de arranque den un plazo creíble
// para una vivienda: ~4 meses, no dos años.
const TAREAS = [
  ['Cimientos y platea', 280, true],
  ['Mampostería', 460, true],
  ['Losa y encadenados', 240, true],
  ['Cubierta', 180, false],
  ['Instalaciones', 320, false],
  ['Terminaciones', 440, true],
];
const CUADRILLA_MIN = 3;   // el plan contra el que se comparan las barras
const CUADRILLA_MAX = 6;

const money = n => '$ ' + Math.round(n).toLocaleString('es-AR');
const reducido = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Aparición al entrar en pantalla. Una sola vez por elemento.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    const nodes = root ? root.querySelectorAll('.rev') : [];
    if (!nodes.length) return;
    if (reducido() || !('IntersectionObserver' in window)) return;  // queda todo visible
    root.classList.add('anim');
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      }),
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}

// ── Maqueta del cotizador: los ítems entran de a uno y el total sube ───────
function AppCotizador() {
  const [n, setN] = useState(reducido() ? ITEMS.length : 0);
  useEffect(() => {
    if (reducido()) return;
    // El paso corre más allá de la última fila: así el presupuesto completo
    // queda unos segundos a la vista antes de volver a empezar.
    const PASOS = ITEMS.length + 4;
    let paso = 0;
    const t = setInterval(() => {
      paso = (paso + 1) % PASOS;
      setN(Math.min(paso, ITEMS.length));
    }, 850);
    return () => clearInterval(t);
  }, []);

  const visibles = ITEMS.slice(0, n);
  const total = visibles.reduce((a, it) => a + it[3], 0);
  const completo = n === ITEMS.length;

  return (
    <div className="app">
      <div className="app-bar">
        <span className="app-logo">TU ESTUDIO</span>
        <span className="app-crumb">Presupuesto · Vivienda unifamiliar</span>
        <span style={{ flex: 1 }} />
        <span className="app-dot" /><span className="app-dot" /><span className="app-dot" />
      </div>
      <div className="app-body">
        <div className="app-h cols">
          <div>Ítem</div><div style={{ textAlign: 'center' }}>Un.</div>
          <div style={{ textAlign: 'right' }}>Cant.</div><div style={{ textAlign: 'right' }}>Total</div>
        </div>
        {/* Alto fijo: si creciera con cada fila, la portada saltaría. */}
        <div style={{ minHeight: 8 * 30 }}>
          {visibles.map(([nom, un, ct, tt]) => (
            <div className="row cols row-in" key={nom}>
              <div className="nm">{nom}</div>
              <div className="un">{un}</div>
              <div className="ct">{ct}</div>
              <div className="tt">{money(tt)}</div>
            </div>
          ))}
        </div>
        <div className="app-tot">
          <div>
            <div className="k">Total del presupuesto</div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>
              {completo ? 'con GG, beneficio e IVA' : 'calculando…'}
            </div>
          </div>
          <div className="v">
            {money(total)}
            {!completo && <span className="caret" />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── La misma obra en el celular ───────────────────────────────────────────
function AppMovil() {
  return (
    <div className="app">
      <div className="m-head">
        <div className="m-title">Vivienda unifamiliar</div>
        <div className="m-sub">8 ÍTEMS · 6 RUBROS</div>
      </div>
      {[['Mampostería', '184,00 m²', '$ 3.312.000'],
        ['Cubierta de chapa', '112,00 m²', '$ 3.696.000'],
        ['Revoques', '310,00 m²', '$ 2.635.000'],
        ['Instalación sanitaria', '1,00 Gl', '$ 2.480.000']].map(([t, s, v]) => (
        <div className="m-item" key={t}>
          <div style={{ minWidth: 0 }}>
            <div className="t">{t}</div>
            <div className="s">{s}</div>
          </div>
          <div className="v">{v}</div>
        </div>
      ))}
      <div className="m-tot"><span className="k">Total</span><span className="v">$ 23.295.000</span></div>
    </div>
  );
}

// ── Gantt que se acorta al sumar gente ────────────────────────────────────
function GanttDemo() {
  const [personas, setPersonas] = useState(CUADRILLA_MIN);
  const [tocado, setTocado] = useState(false);
  const box = useRef(null);

  // Arranca solo la primera vez que entra en pantalla, y va y viene entre 2 y 4.
  useEffect(() => {
    if (reducido() || !box.current || !('IntersectionObserver' in window)) return;
    let timer = null;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !timer) {
          timer = setInterval(() => setPersonas(p => (p >= CUADRILLA_MAX ? CUADRILLA_MIN : p + 1)), 2200);
        } else if (!e.isIntersecting && timer) {
          clearInterval(timer); timer = null;
        }
      });
    }, { threshold: 0.3 });
    io.observe(box.current);
    return () => { if (timer) clearInterval(timer); io.disconnect(); };
  }, []);

  const HS_DIA = 8, DIAS_SEM = 5;
  // Misma cuenta que hace el planificador: horas / (horas por día × personas),
  // encadenando cada tarea después de la anterior en días hábiles.
  let cursor = 0;
  const barras = TAREAS.map(([nombre, hs, critica]) => {
    const dias = Math.max(1, Math.ceil(hs / (HS_DIA * personas)));
    const b = { nombre, critica, ini: cursor, dias };
    cursor += dias;
    return b;
  });
  const totalDias = cursor;
  // La escala queda anclada al plan de la cuadrilla más chica: así al sumar
  // gente las barras se ven acortarse de verdad, en vez de reescalarse y
  // quedar siempre igual de largas.
  const base = TAREAS.reduce((a, t) => a + Math.ceil(t[1] / (HS_DIA * CUADRILLA_MIN)), 0);
  const escala = Math.max(base, totalDias);

  const fin = new Date(2026, 8, 1); // 1 de septiembre de 2026
  let habiles = 0;
  while (habiles < totalDias) {
    fin.setDate(fin.getDate() + 1);
    const d = fin.getDay();
    if (d !== 0 && (DIAS_SEM < 6 ? d !== 6 : true)) habiles += 1;
  }
  const finTxt = fin.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

  const cambiar = d => {
    setTocado(true);
    setPersonas(p => Math.min(8, Math.max(1, p + d)));
  };

  return (
    <div className="gantt" ref={box}>
      <div className="g-top">
        <div className="g-crew">
          <button onClick={() => cambiar(-1)} aria-label="Sacar una persona de la cuadrilla"
            style={btnCrew}>−</button>
          <span>Cuadrilla <b>{personas}</b> {personas === 1 ? 'persona' : 'personas'}</span>
          <button onClick={() => cambiar(1)} aria-label="Sumar una persona a la cuadrilla"
            style={btnCrew}>+</button>
        </div>
        <div className="g-fin">
          Fin de obra <b className={personas > CUADRILLA_MIN ? 'up' : ''}>{finTxt}</b>
          <span style={{ marginLeft: 8 }}>· {totalDias} días hábiles</span>
        </div>
      </div>
      {barras.map(b => (
        <div className="g-row" key={b.nombre}>
          <div className="g-nm">{b.nombre}</div>
          <div className="g-track">
            <div className={'g-bar' + (b.critica ? ' crit' : '')}
              style={{ left: (b.ini / escala * 100) + '%', width: Math.max(1.4, b.dias / escala * 100) + '%' }} />
          </div>
        </div>
      ))}
      <div className="g-foot">
        <span className="chip crit">Camino crítico</span>
        <span className="chip">Horas del análisis de costos</span>
        <span style={{ flex: 1, minWidth: 160 }}>
          {tocado ? 'Eso mismo hacés en el sistema, con tu obra.' : 'Tocá los botones y mirá cómo se mueve la fecha de fin.'}
        </span>
      </div>
    </div>
  );
}

const btnCrew = {
  width: 24, height: 24, borderRadius: 6, border: '1px solid var(--line)',
  background: '#fff', color: 'var(--ink-soft)', cursor: 'pointer',
  fontSize: 15, lineHeight: 1, fontFamily: 'inherit', padding: 0,
};

export default function Presentacion() {
  const root = useReveal();

  return (
    <div className="pv" ref={root}>
      <style>{CSS}</style>
      <a className="ingresar" href="/">Ingresar</a>

      {/* ── PORTADA ─────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="wrap-hero">
          <div className="hero-in">
            <div>
              <span className="marca">FAIM OBRAS</span>
              <h1>Cotizá una obra en <span className="hi">minutos</span>, no en días.</h1>
              <p className="lead">
                El sistema de gestión para estudios de arquitectura e ingeniería.
                Presupuestos con análisis de costos reales, y todo lo que viene después
                —certificados, plazos, cobranzas— saliendo del mismo lugar.
              </p>
              <div className="hero-cta">
                <a className="cta" href="https://wa.me/5493482305155" target="_blank" rel="noreferrer">
                  Coordinar una demo →
                </a>
                <a className="cta-2" href="#como-funciona">Ver cómo funciona</a>
              </div>
              <div className="cifras">
                {[['436', 'ítems con análisis'], ['829', 'materiales'],
                  ['14', 'gremios · escala UOCRA'], ['1', 'carga, todo vinculado']].map(([n, l]) => (
                  <div className="cifra" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>
                ))}
              </div>
            </div>

            <div className="stack">
              <div className="lap">
                <div className="frame"><AppCotizador /></div>
                <div className="stand" />
              </div>
              <div className="phone">
                <div className="frame phone-f">
                  <div className="notch" />
                  <AppMovil />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── EN CUALQUIER PANTALLA ───────────────────────────────────────── */}
      <section className="wrap" style={{ paddingTop: 74 }}>
        <div className="rev">
          <div className="tag">En la obra y en el estudio</div>
          <h2>La misma obra, en la compu, en la tablet y en el celular</h2>
          <p className="sub">No es una app aparte con la mitad de las cosas: es el mismo sistema,
            que se acomoda a la pantalla. Cargás una medición parado en la obra y cuando llegás
            al estudio ya está en el presupuesto.</p>
        </div>
        <div className="devices rev">
          <div className="dev-tab">
            <div className="frame"><AppCotizador /></div>
          </div>
          <div className="dev-phone">
            <div className="frame phone-f"><div className="notch" /><AppMovil /></div>
          </div>
          <div className="dev-note">
            <div>
              <div className="t">Cómputo a pie de obra</div>
              <div className="d">Cargás largo por alto por cantidad y el total se aplica al ítem. Con signo
                menos para descontar aberturas.</div>
            </div>
            <div>
              <div className="t">Tu cliente, desde el teléfono</div>
              <div className="d">Entra a su portal y ve el avance, el contrato y la cuenta corriente.
                Vos elegís qué secciones ve.</div>
            </div>
            <div>
              <div className="t">Sin instalar nada</div>
              <div className="d">Abre en el navegador. Los datos viven en el servidor, así que el
                equipo ve siempre lo mismo.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── EL PLAZO SE CALCULA ─────────────────────────────────────────── */}
      <section className="wrap" id="como-funciona">
        <div className="rev">
          <div className="tag">El plazo</div>
          <h2>¿El plazo de obra lo estimás a ojo? No hace falta.</h2>
          <p className="sub">El sistema toma las horas de mano de obra de tu propio análisis de costos,
            las divide por la cuadrilla que le pongas y las reparte en los días que se trabajan
            por semana. Sumás gente y toda la cadena se reacomoda sola.</p>
        </div>
        <div className="rev"><GanttDemo /></div>
      </section>

      {/* ── EL PROBLEMA ─────────────────────────────────────────────────── */}
      <section className="wrap-txt">
        <div className="rev">
          <div className="tag">El problema</div>
          <h2>Cotizar bien cuesta demasiado tiempo</h2>
          <p className="sub">Y cuando por fin está lista, el Excel queda huérfano: el certificado
            se rehace, el plazo se estima aparte, la cobranza vive en otro archivo.</p>
        </div>
        <div className="comp rev">
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

      {/* ── LA CADENA ───────────────────────────────────────────────────── */}
      <section className="wrap-txt">
        <div className="rev">
          <div className="tag">Cómo funciona</div>
          <h2>Cargás una vez. Sirve para todo lo demás.</h2>
          <p className="sub">No son módulos sueltos que se parecen entre sí: es el mismo dato
            recorriendo la obra de punta a punta.</p>
        </div>
        <div className="cadena rev">
          {CADENA.map(([t, d]) => (
            <div className="eslabon" key={t}><div className="t">{t}</div><div className="d">{d}</div></div>
          ))}
        </div>
        <div className="destaque rev">
          <b>Un ejemplo concreto.</b> Cambiás la cuadrilla de una tarea de 1 a 3 personas.
          El sistema recalcula la duración con las horas de mano de obra de tu propio análisis,
          corre las tareas que dependen de esa y te da la nueva fecha de fin de obra.
          Sin tocar una planilla.
        </div>
      </section>

      {/* ── MÓDULOS ─────────────────────────────────────────────────────── */}
      <section className="wrap-txt">
        <div className="rev">
          <div className="tag">Qué incluye</div>
          <h2>Todo lo que hoy tenés repartido en archivos</h2>
        </div>
        <div className="grilla rev">
          {MODULOS.map(([k, t, d]) => (
            <div className="item" key={t}>
              <span className="k">{k}</span>
              <div className="t">{t}</div>
              <div className="d">{d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── POR QUÉ IMPORTA ─────────────────────────────────────────────── */}
      <section className="wrap-txt">
        <div className="rev">
          <div className="tag">Por qué importa</div>
          <h2>Tres cosas que cambian la semana</h2>
        </div>
        <div className="grilla rev">
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

      {/* ── CIERRE ──────────────────────────────────────────────────────── */}
      <div className="wrap-txt">
        <div className="cierre rev">
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

      <div className="wrap-txt">
        <footer>
          <span>FAIM OBRAS — Gestión integral para estudios de arquitectura e ingeniería</span>
          <span>Resistencia, Chaco · Argentina</span>
        </footer>
      </div>
    </div>
  );
}
