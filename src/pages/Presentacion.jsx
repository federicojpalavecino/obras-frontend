// Presentación comercial pública — faimobras.com/presentacion
// No pide login: es el link que se le manda a un prospecto antes de la demo
// (o directo desde un anuncio). Formato diapositivas, no scroll continuo:
// cada pantalla es un concepto, se pasa con swipe, flechas o el teclado —
// pensado primero para el celular, que es por donde entra la mayoría.
// Desde acá se puede ir derecho a probar la demo guiada o a registrarse,
// así que el precio y la promo ya están adentro, no solo en /precios.
import React, { useState, useEffect, useRef, useCallback } from 'react';

const PRECIO_BASE = 57000;
const PRECIO_EXTRA = 7000;
const PRECIO_PROMO = 35000; // primeros 3 meses — mismo valor que whatsapp_bot/config.PROMO_PRECIO
const USUARIOS_BASE = 2;

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
  font-size:16.5px; line-height:1.5; -webkit-font-smoothing:antialiased;
  height:100dvh; width:100vw; overflow:hidden; position:fixed; inset:0;
  overscroll-behavior:none;
}
.pv *{box-sizing:border-box}
.pv h1,.pv h2,.pv h3{text-wrap:balance;margin:0;font-family:var(--display)}
.pv h1{font-size:clamp(38px,10vw,84px);line-height:.98;font-weight:800;letter-spacing:-.04em;margin:0 0 18px}
.pv h1 .hi{color:var(--accent)}
.pv h2{font-size:clamp(34px,9vw,68px);line-height:.98;font-weight:800;letter-spacing:-.035em;margin-bottom:14px}
.pv .lead{font-size:clamp(15px,2.8vw,20px);color:var(--ink-soft);max-width:46ch;margin:0}
.pv .sub{color:var(--ink-soft);max-width:54ch;margin:0 0 clamp(16px,3.5vh,30px);font-size:clamp(15px,2.6vw,19px)}
.pv .tag{font-family:var(--mono);font-size:10.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);display:inline-flex;align-items:center;gap:9px;margin-bottom:14px}
.pv .tag::before{content:'';width:22px;height:2px;background:var(--accent);border-radius:2px}
.pv .marca{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.32em;text-transform:uppercase}
/* Un resplandor radial detrás de cada diapositiva — el mismo recurso de la
   portada, repetido en todas: nada de fondo plano, que se sienta una sola
   pieza continua, no una serie de tarjetas una atrás de la otra. */
.pv .slide::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(120% 70% at 85% -10%,rgba(5,150,105,.14),transparent 60%)}
.pv .slide.night::before{background:radial-gradient(120% 70% at 85% -10%,rgba(5,150,105,.26),transparent 60%)}
.pv .slide-in{position:relative;z-index:1}

/* ── Armazón de diapositivas ──────────────────────────────────────────────
   Todas las pantallas viven en el DOM a la vez, una al lado de la otra; el
   contenedor se corre en X. Así IntersectionObserver (lo usan las demos
   en vivo) sigue sabiendo cuál está realmente a la vista, sin reescribir
   esa lógica. */
.pv .track{display:flex;height:100dvh;width:100%;touch-action:pan-y;
  transition:transform .55s cubic-bezier(.22,.7,.2,1);will-change:transform}
.pv .slide{flex:0 0 100vw;width:100vw;height:100dvh;overflow:hidden;
  display:flex;flex-direction:column;align-items:stretch;justify-content:center;
  padding:clamp(56px,9vh,76px) 26px clamp(50px,8vh,64px);position:relative}
.pv .slide.night{background:var(--night);color:var(--night-ink)}
.pv .slide-in{max-width:1080px;margin:0 auto;width:100%}
.pv .slide-in.txt{max-width:760px}

/* Entrada del contenido: solo la diapositiva activa anima — las demás
   esperan quietas con opacity:0 hasta que les toca. */
.pv .slide .stag > *{opacity:0;transform:translateY(14px);
  transition:opacity .5s ease,transform .5s cubic-bezier(.2,.7,.3,1);
  transition-delay:calc(var(--i,0) * 70ms)}
.pv .slide.active .stag > *{opacity:1;transform:none}

/* ── Barra superior fija ──────────────────────────────────────────────── */
.pv .topbar{position:fixed;top:0;left:0;right:0;z-index:30;display:flex;
  justify-content:space-between;align-items:center;padding:16px 20px;
  pointer-events:none}
.pv .topbar > *{pointer-events:auto}
.pv .topbar .marca{text-decoration:none;transition:color .3s ease}
.pv .ingresar{background:rgba(14,20,17,.6);backdrop-filter:blur(6px);
  border:1px solid rgba(255,255,255,.16);color:#eef3f0;text-decoration:none;
  padding:7px 14px;border-radius:9px;font-size:12.5px;font-weight:600;
  font-family:var(--display)}
.pv .ingresar:hover{color:#fff;border-color:var(--accent)}

/* ── Navegación: flechas, puntos, progreso ───────────────────────────── */
.pv .arrow{position:fixed;top:50%;transform:translateY(-50%);z-index:30;
  width:42px;height:42px;border-radius:50%;border:1px solid var(--line);
  background:rgba(255,255,255,.85);backdrop-filter:blur(6px);
  color:var(--ink);font-size:20px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:opacity .2s ease,transform .15s ease}
.pv .arrow:hover{transform:translateY(-50%) scale(1.06)}
.pv .arrow:disabled{opacity:0;pointer-events:none}
.pv .arrow.prev{left:14px}
.pv .arrow.next{right:14px}
.pv .dots{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:30;
  display:flex;gap:9px;padding:8px 12px;border-radius:20px;
  background:rgba(255,255,255,.7);backdrop-filter:blur(6px);border:1px solid var(--line)}
.pv .dot{width:7px;height:7px;border-radius:50%;border:none;padding:0;
  background:var(--line);cursor:pointer;transition:background .2s,transform .2s}
.pv .dot.on{background:var(--accent);transform:scale(1.35)}
.pv .progreso{position:fixed;top:0;left:0;height:2.5px;background:var(--accent);
  z-index:31;transition:width .5s cubic-bezier(.22,.7,.2,1)}
@media (max-width:640px){
  .pv .arrow{display:none}
  .pv .slide{padding:clamp(52px,9vh,70px) 20px clamp(46px,8vh,60px)}
}
/* Pantallas bajas (celular en apaisado, notebooks chicas con la barra de
   favoritos abierta, etc.): nada de scroll, así que achica todo lo que se
   pueda y saca lo decorativo antes que cortar el contenido principal. */
@media (max-height:700px){
  .pv h1{font-size:clamp(30px,8vw,52px);margin-bottom:10px}
  .pv h2{font-size:clamp(26px,7vw,44px);margin-bottom:8px}
  .pv .sub{margin-bottom:14px}
  .pv .hero-mock{display:none}
  .pv .destaque{display:none}
}
@media (max-height:560px){
  .pv .cifras{display:none}
}

/* ── CTAs ─────────────────────────────────────────────────────────────── */
.pv .ctas{display:flex;gap:13px;flex-wrap:wrap;margin-top:clamp(16px,3.5vh,28px);align-items:center}
.pv .cta{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;text-decoration:none;padding:17px 30px;border-radius:40px;font-weight:700;font-size:16px;letter-spacing:-.008em;transition:transform .16s ease,box-shadow .16s ease}
.pv .cta:hover{transform:translateY(-1px) scale(1.015);box-shadow:0 10px 30px rgba(5,150,105,.4)}
.pv .cta-2{display:inline-flex;align-items:center;gap:8px;color:var(--night-ink);text-decoration:none;padding:17px 26px;border-radius:40px;border:1px solid var(--night-line);font-weight:600;font-size:15.5px;transition:border-color .16s ease,color .16s ease}
.pv .cta-2:hover{border-color:var(--accent);color:var(--accent)}
.pv .slide:not(.night) .cta-2{color:var(--ink);border-color:var(--line)}
.pv .cta-3{font-size:12.5px;color:var(--night-soft);text-decoration:underline;text-underline-offset:3px}
.pv .slide:not(.night) .cta-3{color:var(--ink-soft)}

/* ── Cifras de portada ────────────────────────────────────────────────── */
.pv .cifras{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;
  margin-top:clamp(16px,3.5vh,30px);padding-top:16px;border-top:1px solid var(--night-line);max-width:460px}
.pv .cifra .n{font-family:var(--mono);font-size:clamp(20px,4.6vw,27px);font-weight:600;color:var(--accent);line-height:1;font-variant-numeric:tabular-nums}
.pv .cifra .l{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--night-soft);margin-top:6px;line-height:1.3}

/* ── Maqueta de la app ────────────────────────────────────────────────── */
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
.pv .frame{background:#0b100d;border:1px solid #2b3a33;border-radius:16px;padding:9px 9px 11px;
  box-shadow:0 22px 50px rgba(0,0,0,.4);max-width:360px;margin:0 auto}
.pv .stand{width:44%;height:7px;margin:0 auto;border-radius:0 0 7px 7px;background:#1a241f;border:1px solid #2b3a33;border-top:none}
.pv .hero-mock{margin-top:clamp(14px,3vh,28px)}
.pv .stack{display:flex;align-items:flex-end;gap:0;justify-content:center}
.pv .stack .lap{flex:0 1 auto;min-width:0;position:relative;z-index:1}
.pv .stack .phone{flex:0 0 118px;width:118px;margin-left:-10px;margin-bottom:-14px;z-index:3;
  animation:floatY 6s ease-in-out infinite}
@keyframes floatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
.pv .frame.phone-f{border-radius:20px;padding:7px 6px 12px;position:relative}
.pv .frame.phone-f::after{content:'';position:absolute;left:50%;transform:translateX(-50%);bottom:5px;
  width:38%;height:3px;border-radius:3px;background:#2b3a33}
.pv .notch{width:34%;height:4px;border-radius:4px;background:#2b3a33;margin:0 auto 6px}
.pv .frame .app{box-shadow:none;border:none;border-radius:9px}
.pv .m-head{padding:8px 9px;border-bottom:1px solid var(--line)}
.pv .m-title{font-size:10px;font-weight:800;letter-spacing:-.01em}
.pv .m-sub{font-family:var(--mono);font-size:7.5px;color:#9aa8a1;letter-spacing:.06em}
.pv .m-item{padding:7px 9px;border-bottom:1px solid #f1f4f2;display:flex;justify-content:space-between;align-items:center;gap:6px}
.pv .m-item .t{font-size:9px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv .m-item .s{font-family:var(--mono);font-size:7.5px;color:#9aa8a1}
.pv .m-item .v{font-family:var(--mono);font-size:9px;color:var(--accent);font-weight:600;white-space:nowrap}
.pv .m-tot{padding:8px 9px;background:var(--accent-soft)}
.pv .m-tot .k{font-family:var(--mono);font-size:7px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);display:block}
.pv .m-tot .v{font-family:var(--mono);font-size:12.5px;font-weight:600;color:var(--accent);
  font-variant-numeric:tabular-nums;display:block;white-space:nowrap;margin-top:2px}
.pv .hero-mock .solo-movil{display:none;max-width:200px;margin:0 auto}
@media (max-width:640px){
  .pv .hero-mock .stack{display:none}
  .pv .hero-mock .solo-movil{display:block}
}

/* ── Gantt animado ──────────────────────────────────────────────────────── */
.pv .gantt{background:#fff;border:1px solid var(--line);border-radius:15px;padding:18px;box-shadow:0 8px 26px var(--shadow);max-width:620px;margin:0 auto;width:100%}
.pv .g-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:13px}
.pv .g-crew{display:flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
.pv .g-crew b{color:var(--accent);font-size:15px}
.pv .g-fin{font-family:var(--mono);font-size:11.5px;color:var(--ink-soft)}
.pv .g-fin b{color:var(--ink);font-size:14px;transition:color .3s}
.pv .g-fin b.up{color:var(--accent)}
.pv .g-row{display:grid;grid-template-columns:118px minmax(0,1fr);gap:10px;align-items:center;margin-bottom:6px}
.pv .g-nm{font-size:11.5px;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pv .g-track{position:relative;height:15px;background:var(--panel-2);border-radius:4px;overflow:hidden}
.pv .g-bar{position:absolute;top:0;height:100%;border-radius:4px;background:var(--accent);opacity:.85;
  transition:left .7s cubic-bezier(.3,.8,.3,1),width .7s cubic-bezier(.3,.8,.3,1)}
.pv .g-bar.crit{background:#dc2626}
.pv .g-foot{margin-top:12px;padding-top:10px;border-top:1px solid var(--line);
  font-size:12px;color:var(--ink-soft);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.pv .chip{font-family:var(--mono);font-size:10px;padding:3px 9px;border-radius:20px;border:1px solid var(--line);color:var(--ink-soft)}
.pv .chip.crit{border-color:#fecaca;color:#dc2626;background:#fef2f2}

/* ── Contraste: un par antes/después a la vez, grande ────────────────────
   Reemplaza la tabla de dos columnas de antes (se leía como una grilla de
   feature comparison, no como un argumento). Ahora es una sola idea por
   vez, tipografía grande, con el signo de más/menos haciendo de puntuación
   visual — más cerca de cómo Apple contrasta "antes" y "ahora". */
.pv .contraste{max-width:680px;margin:0 auto;width:100%;text-align:center}
.pv .contraste .fila{min-height:clamp(170px,32vh,230px);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:18px;animation:contrasteIn .5s cubic-bezier(.2,.7,.3,1) both}
@keyframes contrasteIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.pv .contraste .antes{font-weight:800;letter-spacing:-.025em;line-height:1.14;
  font-size:clamp(21px,4.6vw,32px);color:var(--ink-soft);opacity:.6}
.pv .contraste .antes::before{content:'✕ ';color:var(--bad)}
.pv .contraste .flecha{width:28px;height:28px;border-radius:50%;background:var(--accent-soft);
  color:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px}
.pv .contraste .despues{font-weight:800;letter-spacing:-.025em;line-height:1.14;
  font-size:clamp(23px,5vw,36px);color:var(--ink)}
.pv .contraste .despues::before{content:'✓ ';color:var(--accent)}
.pv .contraste .puntos{display:flex;gap:7px;justify-content:center;margin-top:28px}
.pv .contraste .punto{width:6px;height:6px;border-radius:50%;background:var(--line);
  transition:background .25s,transform .25s}
.pv .contraste .punto.on{background:var(--accent);transform:scale(1.5)}

/* ── Cadena ───────────────────────────────────────────────────────────── */
.pv .cadena{display:flex;gap:4px;flex-wrap:wrap;counter-reset:paso;max-width:960px;margin:0 auto;justify-content:center}
.pv .eslabon{flex:1 1 150px;max-width:190px;padding:14px 12px;border-radius:13px;
  transition:background .4s ease,transform .4s ease,opacity .4s ease}
.pv .eslabon::before{counter-increment:paso;content:counter(paso);font-family:var(--mono);
  font-size:clamp(20px,3.2vw,26px);font-weight:700;color:var(--line);display:block;margin-bottom:9px;
  transition:color .4s ease}
.pv .eslabon.act::before,.pv .eslabon.paso::before{color:var(--accent)}
.pv .eslabon .t{font-weight:800;font-size:14px;margin-bottom:4px;letter-spacing:-.015em}
.pv .eslabon .d{font-size:12px;color:var(--ink-soft);line-height:1.4}
.pv .cadena.vivo .eslabon{opacity:.45}
.pv .cadena.vivo .eslabon.act{opacity:1;background:var(--accent-soft);transform:translateY(-4px)}
.pv .cadena.vivo .eslabon.paso{opacity:1}
.pv .eslabon .barra{display:block;height:2px;background:var(--line);border-radius:2px;margin-top:10px;overflow:hidden}
.pv .eslabon .barra i{display:block;height:100%;width:0;background:var(--accent);border-radius:2px}
.pv .eslabon.act .barra i{width:100%;transition:width 1.5s linear}
.pv .eslabon.paso .barra i{width:100%}
.pv .destaque{margin-top:clamp(14px,3vh,26px);font-size:clamp(14px,2.4vw,18px);max-width:620px;margin-left:auto;margin-right:auto;
  color:var(--ink-soft);line-height:1.4}
.pv .destaque b{color:var(--ink);font-weight:800}
@media (max-width:640px){ .pv .eslabon{flex:1 1 42%} }

/* ── Módulos ──────────────────────────────────────────────────────────── */
/* Sin tarjetas con borde: columnas separadas por una línea fina y aire,
   el título hace de protagonista — se lee como una lista editorial, no
   como una grilla de pricing-page. */
.pv .grilla{display:grid;grid-template-columns:repeat(3,1fr);column-gap:34px;row-gap:28px;
  max-width:920px;margin:0 auto;width:100%}
.pv .item{padding-top:16px;border-top:1px solid var(--line)}
.pv .item .k{font-family:var(--mono);font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--accent);display:block;margin-bottom:8px}
.pv .item .t{font-weight:800;font-size:clamp(15px,2.4vw,18px);margin-bottom:5px;letter-spacing:-.018em}
.pv .item .d{font-size:13px;color:var(--ink-soft);line-height:1.45}
@media (max-width:640px){ .pv .grilla{grid-template-columns:1fr 1fr;column-gap:18px;row-gap:22px} }
@media (max-width:420px){ .pv .grilla{grid-template-columns:1fr} }

/* ── Tres cosas: cada tarjeta con su propia prueba, no un adorno ─────────
   Un numero que cambia en vivo convence mas que una lista de features. */
.pv .item .fig{margin-top:14px;padding-top:13px;border-top:1px solid var(--line)}
.pv .fig-t{display:flex;align-items:baseline;gap:9px;font-family:var(--mono);font-variant-numeric:tabular-nums}
.pv .fig-t .antes{font-size:14px;color:var(--bad);text-decoration:line-through;opacity:.75}
.pv .fig-t .flecha{color:var(--ink-soft);font-size:12px}
.pv .fig-t .desp{font-size:clamp(20px,4vw,26px);font-weight:700;color:var(--accent);letter-spacing:-.02em}
.pv .fig-p{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-family:var(--mono)}
.pv .fig-p .m{font-size:clamp(18px,3.4vw,23px);font-weight:700;color:var(--accent);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.pv .fig-p .f{font-size:10.5px;color:var(--ink-soft);letter-spacing:.04em}
.pv .fig-c{display:flex;align-items:center;gap:5px}
.pv .fig-c .n{width:9px;height:9px;border-radius:50%;background:var(--panel-2);flex-shrink:0;transition:background .3s ease,transform .3s ease}
.pv .fig-c .n.on{background:var(--accent);transform:scale(1.25)}
.pv .fig-c .l{flex:1;height:2px;background:var(--panel-2);border-radius:2px;overflow:hidden}
.pv .fig-c .l i{display:block;height:100%;width:0;background:var(--accent);transition:width .3s linear}
.pv .fig-c .l.on i{width:100%}
.pv .fig-lbl{font-size:11px;color:var(--ink-soft);margin-top:9px;font-family:var(--mono);letter-spacing:.03em}
.pv .catalogo{margin-top:clamp(20px,4vh,34px);text-align:center;font-size:clamp(14px,2.4vw,16.5px);
  color:var(--ink-soft);max-width:560px;margin-left:auto;margin-right:auto}
.pv .catalogo b{color:var(--ink);font-weight:800}

/* ── Cinta de capacidades: movimiento continuo, no una lista quieta ──────
   Para meter muchas cosas (dias perdidos, asistente 24/7, stock, flujo de
   caja...) sin que se sienta como una enumeracion: dos cintas se desplazan
   solas, en sentido contrario, en loop infinito. Nadie necesita leerlas
   todas de una — la sensacion de "hay mucho, y se mueve" es el punto. */
.pv .marquee-wrap{max-width:100%;overflow:hidden;width:100vw;margin-left:calc(50% - 50vw);
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.pv .marquee-wrap + .marquee-wrap{margin-top:16px}
.pv .marquee{display:flex;gap:14px;width:max-content;animation:marqueeL 38s linear infinite;
  padding:0 20px}
.pv .marquee.rev{animation-name:marqueeR}
@keyframes marqueeL{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes marqueeR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
.pv .mchip{flex:0 0 auto;font-family:var(--display);font-weight:700;letter-spacing:-.01em;
  font-size:clamp(14px,2.4vw,18px);padding:13px 24px;border-radius:40px;
  background:var(--panel);color:var(--ink);white-space:nowrap}
.pv .mchip.ac{background:var(--accent);color:#fff}
@media (prefers-reduced-motion:reduce){ .pv .marquee{animation:none} }

/* ── Precio ───────────────────────────────────────────────────────────── */
.pv .precio-card{max-width:520px;margin:0 auto;width:100%;text-align:center}
.pv .precio-promo{display:inline-flex;align-items:center;gap:7px;font-family:var(--mono);font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--accent);background:var(--accent-soft);border:1px solid var(--accent-line);padding:5px 11px;border-radius:20px;margin-bottom:18px}
.pv .precio-num{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;justify-content:center}
.pv .precio-tachado{font-family:var(--mono);font-size:19px;color:var(--ink-soft);text-decoration:line-through;opacity:.7}
.pv .precio-grande{font-family:var(--mono);font-size:clamp(50px,13vw,84px);font-weight:700;letter-spacing:-.04em;color:var(--ink);line-height:1}
.pv .precio-unidad{font-family:var(--mono);font-size:12px;color:var(--ink-soft)}
.pv .precio-sub{font-size:12.5px;color:var(--ink-soft);margin-top:4px}
.pv .precio-list{list-style:none;margin:clamp(14px,3vh,26px) 0 0;padding:0;display:inline-flex;flex-direction:column;
  gap:9px;text-align:left}
.pv .precio-list li{padding-left:20px;position:relative;font-size:14px;color:var(--ink-soft)}
.pv .precio-list li::before{content:'✓';position:absolute;left:0;color:var(--accent);font-weight:700}
.pv .precio-list li b{color:var(--ink)}

/* ── Cierre ───────────────────────────────────────────────────────────── */
.pv .datos{margin-top:18px;font-family:var(--mono);font-size:12px;color:var(--night-soft);line-height:1.9}
.pv .datos b{color:var(--night-ink);font-weight:500}

@media (prefers-reduced-motion:reduce){
  .pv *{transition:none!important;animation:none!important}
  .pv .track{transition:none!important}
  .pv .slide .stag > *{opacity:1!important;transform:none!important}
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
];

const CADENA = [
  ['Presupuesto', 'Rubros, ítems y cómputo.'],
  ['Análisis', 'Materiales, mano de obra y equipos.'],
  ['Planificación', 'Gantt con camino crítico.'],
  ['Certificados', 'Avance sobre el presupuesto.'],
  ['Cobranzas', 'Contrato y cuenta corriente.'],
];

// Fila de arriba de la cinta de capacidades (desplaza a la izquierda).
const CAPACIDADES_A = [
  'Presupuestos en minutos', 'Catálogo de +400 ítems', '+800 materiales con precio',
  'Precios actualizados cada mes', 'Gantt con camino crítico', 'Días de lluvia y feriados',
  'El plazo se recalcula solo', 'Curva de inversión',
];
// Fila de abajo (desplaza a la derecha, para que no se sientan como una
// sola cinta repetida sino dos capas de movimiento).
const CAPACIDADES_B = [
  'Listado de materiales', 'Certificaciones de avance', 'Contratos de obra',
  'Flujo de caja del estudio', 'Personal, herramientas y stock', 'Portal para tus clientes',
  'Asistente virtual 24/7', 'Gestión total, un solo lugar',
];

const TAREAS = [
  ['Cimientos y platea', 280, true],
  ['Mampostería', 460, true],
  ['Losa y encadenados', 240, true],
  ['Cubierta', 180, false],
  ['Instalaciones', 320, false],
  ['Terminaciones', 440, true],
];
const CUADRILLA_MIN = 3;
const CUADRILLA_MAX = 6;

const PARES = [
  ['Días armando el presupuesto desde cero',
   'Catálogo ya cargado: elegís y computás'],
  ['Precios de materiales sin fuente ni fecha',
   'Precios con fuente y fecha, actualizables'],
  ['El certificado se vuelve a cargar a mano',
   'El certificado sale del presupuesto'],
  ['El plazo de obra se estima «a ojo»',
   'El plazo lo calcula el sistema solo'],
  ['Un adicional obliga a rehacer medio Excel',
   'Los adicionales se vinculan al presupuesto'],
  ['El cliente llama para preguntar cómo viene',
   'El cliente entra a su portal y lo ve solo'],
];

const money = n => '$ ' + Math.round(n).toLocaleString('es-AR');
const pesos = n => '$ ' + n.toLocaleString('es-AR');
const reducido = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ¿El elemento está a la vista? El contenedor de diapositivas no hace scroll
// — mueve todo con transform — pero IntersectionObserver sigue calculando
// bien la intersección real contra el viewport después del transform, así
// que esto funciona igual que cuando la página scrolleaba.
function useEnPantalla(ref, umbral = 0.25) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current || !('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting), { threshold: umbral });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, umbral]);
  return visible;
}

function useCiclo(n, ms, activo) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!activo || reducido() || n < 2) return;
    const t = setInterval(() => setI(x => (x + 1) % n), ms);
    return () => clearInterval(t);
  }, [n, ms, activo]);
  return i;
}

function Comparacion() {
  const caja = useRef(null);
  const visible = useEnPantalla(caja, 0.2);
  const corre = visible && !reducido();
  const act = useCiclo(PARES.length, 2800, corre);
  const [antes, despues] = PARES[act];
  return (
    <div className="contraste" ref={caja}>
      <div className="fila" key={act}>
        <div className="antes">{antes}</div>
        <div className="flecha">↓</div>
        <div className="despues">{despues}</div>
      </div>
      <div className="puntos">
        {PARES.map((_, idx) => <span key={idx} className={'punto' + (idx === act ? ' on' : '')} />)}
      </div>
    </div>
  );
}

function Cadena() {
  const caja = useRef(null);
  const visible = useEnPantalla(caja, 0.3);
  const corre = visible && !reducido();
  const act = useCiclo(CADENA.length, 1600, corre);
  return (
    <div className={'cadena' + (corre ? ' vivo' : '')} ref={caja}>
      {CADENA.map(([t, d], i) => (
        <div className={'eslabon' + (corre ? (i === act ? ' act' : (i < act ? ' paso' : '')) : ' paso')} key={t}>
          <div className="t">{t}</div>
          <div className="d">{d}</div>
          <span className="barra"><i /></span>
        </div>
      ))}
    </div>
  );
}

const PRECIOS_EJEMPLO = [['$ 612', '12/05/2026'], ['$ 745', '03/07/2026'], ['$ 820', '07/08/2026']];

function Marquee({ items, reverse }) {
  const dup = [...items, ...items];
  return (
    <div className="marquee-wrap">
      <div className={'marquee' + (reverse ? ' rev' : '')}>
        {dup.map((t, idx) => (
          <span className={'mchip' + (idx % 3 === 0 ? ' ac' : '')} key={idx}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function TresCosas() {
  const caja = useRef(null);
  const visible = useEnPantalla(caja, 0.3);
  const corre = visible && !reducido();

  // 1) El tiempo de cotizar: dos días de planilla contra un rato en el sistema.
  const [rapido, setRapido] = useState(false);
  useEffect(() => {
    if (!corre) { setRapido(true); return; }
    setRapido(false);
    const t = setInterval(() => setRapido(v => !v), 2600);
    return () => clearInterval(t);
  }, [corre]);

  // 2) El precio con su fecha: se actualiza y queda fechado.
  const pi = useCiclo(PRECIOS_EJEMPLO.length, 2200, corre);
  const [precio, fecha] = corre ? PRECIOS_EJEMPLO[pi] : PRECIOS_EJEMPLO[PRECIOS_EJEMPLO.length - 1];

  // 3) La cadena: un dato que pasa por los módulos sin recargarse.
  const paso = useCiclo(CADENA.length, 900, corre);

  return (
    <div className="grilla stag" ref={caja}>
      <div className="item" style={{ '--i': 0 }}>
        <div className="t">Cotizás más rápido</div>
        <div className="d">El análisis ya está armado: elegís, cargás la cantidad y el precio sale solo.</div>
        <div className="fig">
          <div className="fig-t">
            <span className="antes">2 días</span>
            <span className="flecha">→</span>
            <span className="desp">{rapido ? '14 min' : '2 días'}</span>
          </div>
          <div className="fig-lbl">un presupuesto de 40 ítems</div>
        </div>
      </div>

      <div className="item" style={{ '--i': 1 }}>
        <div className="t">Cotizás mejor</div>
        <div className="d">Precios con fuente y fecha. De un vistazo sabés cuál conviene revisar.</div>
        <div className="fig">
          <div className="fig-p">
            <span className="m">{precio}</span>
            <span className="f">{fecha}</span>
          </div>
          <div className="fig-lbl">ladrillo hueco 15 · cada precio con su fecha</div>
        </div>
      </div>

      <div className="item" style={{ '--i': 2 }}>
        <div className="t">No perdés el hilo</div>
        <div className="d">Del presupuesto al cobro, sin volver a cargar nada.</div>
        <div className="fig">
          <div className="fig-c">
            {CADENA.map(([t], i) => (
              <React.Fragment key={t}>
                {i > 0 && <span className={'l' + (!corre || paso >= i ? ' on' : '')}><i /></span>}
                <span className={'n' + (!corre || paso >= i ? ' on' : '')} title={t} />
              </React.Fragment>
            ))}
          </div>
          <div className="fig-lbl">presupuesto → análisis → plazo → cobro</div>
        </div>
      </div>
    </div>
  );
}

function AppCotizador() {
  const [n, setN] = useState(reducido() ? ITEMS.length : 0);
  useEffect(() => {
    if (reducido()) return;
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
        <div style={{ minHeight: 6 * 30 }}>
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

function AppMovil() {
  return (
    <div className="app">
      <div className="m-head">
        <div className="m-title">Vivienda unifamiliar</div>
        <div className="m-sub">6 ÍTEMS · 4 RUBROS</div>
      </div>
      {[['Mampostería', '184,00 m²', '$ 3.312.000'],
        ['Cubierta de chapa', '112,00 m²', '$ 3.696.000'],
        ['Revoques', '310,00 m²', '$ 2.635.000']].map(([t, s, v]) => (
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

function GanttDemo() {
  const [personas, setPersonas] = useState(CUADRILLA_MIN);
  const [tocado, setTocado] = useState(false);
  const box = useRef(null);

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
  let cursor = 0;
  const barras = TAREAS.map(([nombre, hs, critica]) => {
    const dias = Math.max(1, Math.ceil(hs / (HS_DIA * personas)));
    const b = { nombre, critica, ini: cursor, dias };
    cursor += dias;
    return b;
  });
  const totalDias = cursor;
  const base = TAREAS.reduce((a, t) => a + Math.ceil(t[1] / (HS_DIA * CUADRILLA_MIN)), 0);
  const escala = Math.max(base, totalDias);

  const fin = new Date(2026, 8, 1);
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
          <button onClick={() => cambiar(-1)} aria-label="Sacar una persona de la cuadrilla" style={btnCrew}>−</button>
          <span>Cuadrilla <b>{personas}</b> {personas === 1 ? 'persona' : 'personas'}</span>
          <button onClick={() => cambiar(1)} aria-label="Sumar una persona a la cuadrilla" style={btnCrew}>+</button>
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
        <span className="chip">Días de lluvia y feriados</span>
        <span style={{ flex: 1, minWidth: 160 }}>
          {tocado ? 'Eso mismo hacés en el sistema, con tu obra.' : 'Tocá los botones y mirá moverse la fecha.'}
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

const SLIDES = ['hero', 'problema', 'como', 'plazo', 'incluye', 'todo', 'precio', 'cierre'];

export default function Presentacion() {
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const tocando = useRef(null);
  const trackRef = useRef(null);

  const ir = useCallback((delta) => {
    setI(x => Math.min(n - 1, Math.max(0, x + delta)));
  }, [n]);

  // Sin scroll de página: estas diapositivas ocupan toda la pantalla solas.
  // overscrollBehavior además de overflow:hidden, porque Safari en iOS
  // puede rebotar (bounce) igual en los bordes aunque overflow esté
  // apagado — overscroll-behavior es lo que corta ese rebote de verdad.
  useEffect(() => {
    const el = document.documentElement, b = document.body;
    const prev = [el.style.overflow, b.style.overflow, el.style.overscrollBehavior, b.style.overscrollBehavior];
    el.style.overflow = 'hidden'; b.style.overflow = 'hidden';
    el.style.overscrollBehavior = 'none'; b.style.overscrollBehavior = 'none';
    return () => {
      [el.style.overflow, b.style.overflow, el.style.overscrollBehavior, b.style.overscrollBehavior] = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = e => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); ir(1); }
      if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ir(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ir]);

  const onTouchStart = e => { tocando.current = e.touches[0].clientX; };
  const onTouchEnd = e => {
    if (tocando.current == null) return;
    const dx = e.changedTouches[0].clientX - tocando.current;
    if (Math.abs(dx) > 46) ir(dx < 0 ? 1 : -1);
    tocando.current = null;
  };

  return (
    <div className="pv">
      <style>{CSS}</style>

      <div className="topbar">
        <a className="marca" href="/" style={{ color: i === 0 || SLIDES[i] === 'cierre' ? 'var(--night-ink)' : 'var(--ink)', textDecoration: 'none' }}>FAIM OBRAS</a>
        <a className="ingresar" href="/">Ingresar</a>
      </div>
      <div className="progreso" style={{ width: ((i + 1) / n * 100) + '%' }} />

      <div className="track" ref={trackRef}
        style={{ transform: `translateX(-${i * 100}vw)` }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* ── 1. PORTADA ────────────────────────────────────────────────── */}
        <section className={'slide night' + (i === 0 ? ' active' : '')}>
          <div className="slide-in stag">
            <span className="tag" style={{ '--i': 0, color: 'var(--accent)' }}>FAIM OBRAS</span>
            <h1 style={{ '--i': 1 }}>Cotizá una obra en <span className="hi">minutos</span>, no en días.</h1>
            <p className="lead" style={{ '--i': 2 }}>
              El sistema de gestión para estudios de arquitectura e ingeniería.
              Ganás tiempo, no lo perdés: todo se calcula solo, en un solo lugar,
              desde cualquier pantalla.
            </p>
            <div className="ctas" style={{ '--i': 3 }}>
              <a className="cta" href="/demo">Probar la demo guiada →</a>
              <a className="cta-2" href="/?registro=1">Registrarme →</a>
            </div>
            <div className="cifras" style={{ '--i': 4 }}>
              {[['Automático', 'costos y plazos, calculados solos'], ['Un solo lugar', 'presupuesto, obra y cobranza'], ['Cualquier pantalla', 'PC, tablet o celular']].map(([v, l]) => (
                <div className="cifra" key={l}><div className="n" style={{ fontSize: 'clamp(13px,2.6vw,16px)' }}>{v}</div><div className="l">{l}</div></div>
              ))}
            </div>
            <div className="hero-mock" style={{ '--i': 5 }}>
              <div className="stack">
                <div className="lap">
                  <div className="frame"><AppCotizador /></div>
                  <div className="stand" />
                </div>
                <div className="phone">
                  <div className="frame phone-f"><div className="notch" /><AppMovil /></div>
                </div>
              </div>
              <div className="solo-movil">
                <div className="frame phone-f"><div className="notch" /><AppMovil /></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. EL PROBLEMA ───────────────────────────────────────────── */}
        <section className={'slide' + (i === 1 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Antes / Después</div>
            <h2 style={{ '--i': 1 }}>Dejá de perder la semana en Excel</h2>
            <p className="sub" style={{ '--i': 2 }}>Lo mismo, pero automático.</p>
            <div style={{ '--i': 3 }}><Comparacion /></div>
          </div>
        </section>

        {/* ── 3. CÓMO FUNCIONA ─────────────────────────────────────────── */}
        <section className={'slide' + (i === 2 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Un solo lugar</div>
            <h2 style={{ '--i': 1 }}>Cargás una vez. Listo.</h2>
            <p className="sub" style={{ '--i': 2 }}>El mismo dato recorre toda la obra, solo.</p>
            <div style={{ '--i': 3 }}><Cadena /></div>
            <div className="destaque" style={{ '--i': 4 }}>
              <b>Por ejemplo:</b> sumás una persona a una tarea y el plazo entero se recalcula y
              reacomoda solo. Nadie toca una planilla.
            </div>
          </div>
        </section>

        {/* ── 4. EL PLAZO SE CALCULA ───────────────────────────────────── */}
        <section className={'slide' + (i === 3 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Decisiones con datos</div>
            <h2 style={{ '--i': 1 }}>El plazo se calcula. Vos no.</h2>
            <p className="sub" style={{ '--i': 2 }}>Sumás gente, cargás un día de lluvia o un feriado — la
              fecha se recalcula sola, siempre.</p>
            <div style={{ '--i': 3 }}><GanttDemo /></div>
          </div>
        </section>

        {/* ── 5. POR QUÉ IMPORTA ───────────────────────────────────────── */}
        <section className={'slide' + (i === 4 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Por qué importa</div>
            <h2 style={{ '--i': 1, marginBottom: 20 }}>Tres cosas que cambian la semana</h2>
            <div style={{ '--i': 2 }}><TresCosas /></div>
            <div className="catalogo" style={{ '--i': 3 }}>
              Todo sale de un catálogo de <b>+400 ítems de obra</b> y <b>+800 materiales</b> con
              análisis de costo ya cargado — no lo armás vos, ya está.
            </div>
          </div>
        </section>

        {/* ── 6. TODO INCLUIDO (cinta en movimiento) ───────────────────── */}
        <section className={'slide' + (i === 5 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Todo incluido</div>
            <h2 style={{ '--i': 1, marginBottom: 26 }}>La gestión total, en un solo lugar</h2>
          </div>
          <div className="stag" style={{ width: '100%' }}>
            <div style={{ '--i': 2 }}><Marquee items={CAPACIDADES_A} /></div>
            <div style={{ '--i': 3 }}><Marquee items={CAPACIDADES_B} reverse /></div>
          </div>
        </section>

        {/* ── 7. PRECIO ─────────────────────────────────────────────────── */}
        <section className={'slide' + (i === 6 ? ' active' : '')}>
          <div className="slide-in txt stag">
            <div className="tag" style={{ '--i': 0 }}>Precio</div>
            <h2 style={{ '--i': 1 }}>Un plan. Todo adentro.</h2>
            <p className="sub" style={{ '--i': 2 }}>Nada de versiones básicas ni módulos aparte.</p>
            <div className="precio-card" style={{ '--i': 3 }}>
              <span className="precio-promo">★ {pesos(PRECIO_PROMO)}/mes los primeros 3 meses</span>
              <div className="precio-num">
                <span className="precio-tachado">{pesos(PRECIO_BASE)}</span>
                <span className="precio-grande">{pesos(PRECIO_PROMO)}</span>
                <span className="precio-unidad">POR MES · ARS</span>
              </div>
              <div className="precio-sub">IVA no incluido.</div>
              <ul className="precio-list">
                <li><b>{USUARIOS_BASE} usuarios</b> del estudio incluidos, + {pesos(PRECIO_EXTRA)} c/u extra</li>
                <li><b>Clientes sin límite</b>, sin costo adicional</li>
                <li><b>Catálogo incluido:</b> análisis de costos ya cargado, no armás nada de cero</li>
                <li><b>Sin permanencia</b> — débito por MercadoPago, lo das de baja cuando quieras</li>
              </ul>
            </div>
            <div className="ctas" style={{ '--i': 4, justifyContent: 'center' }}>
              <a className="cta" href="/?registro=1">Registrarme con la promo →</a>
              <a className="cta-2" href="/demo">Prefiero ver la demo primero →</a>
            </div>
          </div>
        </section>

        {/* ── 8. CIERRE ─────────────────────────────────────────────────── */}
        <section className={'slide night' + (i === 7 ? ' active' : '')}>
          <div className="slide-in stag" style={{ textAlign: 'center' }}>
            <div className="tag" style={{ '--i': 0, justifyContent: 'center' }}>Empezá ahora</div>
            <h2 style={{ '--i': 1 }}>Probalo con una obra tuya</h2>
            <p className="lead" style={{ '--i': 2, margin: '0 auto' }}>
              La demo arma un presupuesto en vivo, delante tuyo. O si ya sabés que es
              lo que necesitás, te registrás directo.
            </p>
            <div className="ctas" style={{ '--i': 3, justifyContent: 'center' }}>
              <a className="cta" href="/demo">Probar la demo guiada →</a>
              <a className="cta-2" href="/?registro=1">Registrarme →</a>
            </div>
            <div style={{ '--i': 4 }}>
              <a className="cta-3" href="https://wa.me/5493625548783" target="_blank" rel="noreferrer">
                o escribinos por WhatsApp
              </a>
            </div>
            <div className="datos" style={{ '--i': 5 }}>
              Email <b>contacto.faimobras@gmail.com</b><br />
              Web <b>faimobras.com</b>
            </div>
          </div>
        </section>
      </div>

      <button className="arrow prev" onClick={() => ir(-1)} disabled={i === 0} aria-label="Diapositiva anterior">‹</button>
      <button className="arrow next" onClick={() => ir(1)} disabled={i === n - 1} aria-label="Diapositiva siguiente">›</button>
      <div className="dots">
        {SLIDES.map((s, idx) => (
          <button key={s} className={'dot' + (idx === i ? ' on' : '')}
            onClick={() => setI(idx)} aria-label={`Ir a la diapositiva ${idx + 1}`} />
        ))}
      </div>
    </div>
  );
}
