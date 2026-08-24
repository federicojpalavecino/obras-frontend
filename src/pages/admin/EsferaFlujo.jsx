import { useEffect, useRef, useState } from "react";

/**
 * El flujo de la aplicación, sobre una esfera que gira.
 *
 * Cada nodo es un módulo y cada arco es un dato que viaja de verdad: el precio
 * que va del catálogo al análisis, el ítem que se vuelve tarea del Gantt, el
 * cobro que entra solo al control financiero. Los pulsos van en el sentido del
 * dato, no de la navegación — que es la diferencia entre un mapa del menú y un
 * mapa de cómo funciona.
 *
 * Vive solo en /admin y se carga con React.lazy: es su propio chunk y ningún
 * estudio lo descarga.
 */

// ── El mapa ──────────────────────────────────────────────────────────────────
// lat va de -90 (abajo) a 90 (arriba); lon, 0 a 360. Están puestos a mano y no
// al azar: el trabajo baja de polo a polo —catálogo arriba, plata abajo— así
// que mientras gira se lee el orden real de las cosas.
const NODOS = [
  { id: "catalogo",    nombre: "Catálogo",           lat:  62, lon:   0,  color: "#a78bfa" },
  { id: "analisis",    nombre: "Análisis de costos", lat:  48, lon: 130,  color: "#8b5cf6" },
  { id: "presupuesto", nombre: "Presupuesto",        lat:  26, lon:  40,  color: "#34d399" },
  { id: "materiales",  nombre: "Listado de materiales", lat: 22, lon: 210, color: "#fbbf24" },
  { id: "gantt",       nombre: "Plan de obra",       lat:  30, lon: 300,  color: "#60a5fa" },
  { id: "obra",        nombre: "Obra",               lat:   0, lon:  90,  color: "#10b981" },
  { id: "contrato",    nombre: "Contrato",           lat:  -4, lon: 165,  color: "#2dd4bf" },
  { id: "avance",      nombre: "Avance y certificados", lat: 6, lon: 250, color: "#38bdf8" },
  { id: "compras",     nombre: "Compras y contratistas", lat: -26, lon: 195, color: "#f59e0b" },
  { id: "personal",    nombre: "Personal",           lat: -30, lon:  35,  color: "#f472b6" },
  { id: "panol",       nombre: "Pañol y depósito",   lat: -22, lon: 315,  color: "#94a3b8" },
  { id: "cobros",      nombre: "Cobros",             lat: -34, lon: 120,  color: "#22c55e" },
  { id: "finanzas",    nombre: "Control financiero", lat: -62, lon: 165,  color: "#fb7185" },
  { id: "portal",      nombre: "Portal del cliente", lat: -50, lon: 285,  color: "#7dd3fc" },
  { id: "asistente",   nombre: "Asistente",          lat: -70, lon:  40,  color: "#c4b5fd" },
];

// `peso` es cada cuántos pulsos: 1 es el flujo constante, 3 el ocasional. Es el
// enganche para que más adelante lo mueva el uso real de la plataforma.
const ARCOS = [
  ["catalogo",    "analisis",    "precio del ítem",            1],
  ["analisis",    "presupuesto", "costo unitario",             1],
  ["presupuesto", "materiales",  "cómputo",                    2],
  ["presupuesto", "gantt",       "una tarea por ítem",         2],
  ["presupuesto", "obra",        "al cerrar, nace la obra",    1],
  ["obra",        "contrato",    "monto y desembolsos",        2],
  ["contrato",    "cobros",      "cada tramo pactado",         1],
  ["obra",        "avance",      "lo ejecutado",               2],
  ["gantt",       "avance",      "progreso de la tarea",       2],
  ["avance",      "cobros",      "certificado a cobrar",       1],
  ["materiales",  "compras",     "lista de compra",            3],
  ["obra",        "compras",     "proveedores y contratistas", 2],
  ["panol",       "obra",        "herramienta a la obra",      3],
  ["personal",    "obra",        "jornadas trabajadas",        1],
  ["personal",    "finanzas",    "jornal imputado a la obra",  1],
  ["cobros",      "finanzas",    "entra sin cargarlo de nuevo", 1],
  ["compras",     "finanzas",    "lo que salió",               2],
  ["contrato",    "portal",      "qué firmó",                  3],
  ["gantt",       "portal",      "cuándo termina",             2],
  ["avance",      "portal",      "cómo viene",                 3],
  ["obra",        "asistente",   "todo de esta obra",          2],
  ["finanzas",    "asistente",   "cuánto te deben",            2],
  ["personal",    "asistente",   "quién trabaja ahí",          3],
];

// ── Geometría ────────────────────────────────────────────────────────────────
const aVector = (lat, lon) => {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
};

// Camino sobre la superficie, no la cuerda que la atraviesa: un arco se lee
// como parte de la esfera y una recta la parte al medio.
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  d = Math.max(-1, Math.min(1, d));
  const o = Math.acos(d);
  if (o < 1e-6) return a;
  const s = Math.sin(o), k1 = Math.sin((1 - t) * o) / s, k2 = Math.sin(t * o) / s;
  return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

export default function EsferaFlujo() {
  const ref = useRef(null);
  const cajaRef = useRef(null);
  const [encima, setEncima] = useState(null);   // nodo bajo el mouse
  const encimaRef = useRef(null);
  const [quieto, setQuieto] = useState(false);
  // Los dos se leen adentro del loop de dibujo, que se monta una sola vez.
  const quietoRef = useRef(false);

  useEffect(() => { encimaRef.current = encima; }, [encima]);
  useEffect(() => { quietoRef.current = quieto; }, [quieto]);

  useEffect(() => {
    const cv = ref.current, caja = cajaRef.current;
    if (!cv || !caja) return;
    const ctx = cv.getContext("2d");

    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodos = NODOS.map(n => ({ ...n, v: aVector(n.lat, n.lon) }));
    const porId = Object.fromEntries(nodos.map(n => [n.id, n]));
    const arcos = ARCOS.map(([de, a, etiqueta, peso]) => ({
      de: porId[de], a: porId[a], etiqueta, peso,
      // Se arrancan desfasados para que no salgan todos en fila.
      pulsos: Array.from({ length: Math.max(1, 4 - peso) }, (_, i) => Math.random() * 0.9 + i * 0.12),
    }));

    let W = 0, H = 0, R = 0, cx = 0, cy = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const medir = () => {
      W = caja.clientWidth; H = caja.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + "px"; cv.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(W, H) * 0.36; cx = W / 2; cy = H / 2;
    };
    medir();
    const ro = new ResizeObserver(medir); ro.observe(caja);

    const TILT = -0.34;                       // una pizca de inclinación
    const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
    let giro = 0.6, ultimo = performance.now(), raf = 0;
    const posiciones = new Map();             // id -> {x,y} para el hover

    // Proyecta un punto de la esfera a la pantalla. `z` mayor = más lejos.
    const proyectar = ([x, y, z], escala = 1) => {
      const c = Math.cos(giro), s = Math.sin(giro);
      const rx = x * c + z * s, rz = -x * s + z * c;
      const ry = y * cosT - rz * sinT, rz2 = y * sinT + rz * cosT;
      const p = 2.6 / (2.6 + rz2);            // perspectiva suave
      return { x: cx + rx * R * escala * p, y: cy + ry * R * escala * p, z: rz2, p };
    };

    const dibujar = (ahora) => {
      const dt = Math.min((ahora - ultimo) / 1000, 0.05);
      ultimo = ahora;
      if (!sinMovimiento && !quietoRef.current) giro += dt * 0.16;

      ctx.clearRect(0, 0, W, H);
      const sel = encimaRef.current;

      // 1. La malla de la esfera, apenas insinuada.
      ctx.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        for (let i = 0; i <= 90; i++) {
          const q = proyectar(aVector(lat, (i / 90) * 360));
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = "rgba(148,163,184,0.10)";
        ctx.stroke();
      }
      for (let lon = 0; lon < 360; lon += 30) {
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
          const q = proyectar(aVector(-90 + (i / 60) * 180, lon));
          if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        }
        ctx.strokeStyle = "rgba(148,163,184,0.07)";
        ctx.stroke();
      }

      // 2. Los arcos. Se pintan de atrás para adelante para que los de adelante
      //    tapen a los de atrás, que es lo que da la sensación de volumen.
      const trazos = arcos.map(arco => {
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const v = slerp(arco.de.v, arco.a.v, i / 24);
          pts.push(proyectar(v, 1.015));
        }
        return { arco, pts, z: pts[12].z };
      }).sort((a, b) => b.z - a.z);

      for (const { arco, pts } of trazos) {
        const tocado = sel && (arco.de.id === sel || arco.a.id === sel);
        const atenuado = sel && !tocado;
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        const detras = pts[12].z > 0;
        ctx.strokeStyle = tocado
          ? arco.de.color
          : `rgba(148,163,184,${atenuado ? 0.05 : detras ? 0.10 : 0.22})`;
        ctx.lineWidth = tocado ? 1.6 : 1;
        ctx.stroke();

        // 3. Los pulsos: viajan en el sentido del dato.
        for (let k = 0; k < arco.pulsos.length; k++) {
          if (!sinMovimiento && !quietoRef.current) {
            arco.pulsos[k] += dt * (0.30 / arco.peso);
            if (arco.pulsos[k] > 1.25) arco.pulsos[k] -= 1.25 + Math.random() * 0.3;
          }
          const t = arco.pulsos[k];
          if (t < 0 || t > 1) continue;
          const q = proyectar(slerp(arco.de.v, arco.a.v, t), 1.015);
          const cerca = q.z < 0;
          const alfa = (atenuado ? 0.15 : 1) * (cerca ? 1 : 0.35);
          const r = (cerca ? 2.6 : 1.8) * q.p;
          // Una cola corta detrás del pulso: se ve la dirección sin flechas.
          const cola = proyectar(slerp(arco.de.v, arco.a.v, Math.max(0, t - 0.06)), 1.015);
          const g = ctx.createLinearGradient(cola.x, cola.y, q.x, q.y);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, arco.de.color);
          ctx.globalAlpha = alfa * 0.7;
          ctx.strokeStyle = g; ctx.lineWidth = r * 0.9;
          ctx.beginPath(); ctx.moveTo(cola.x, cola.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          ctx.globalAlpha = alfa;
          ctx.fillStyle = arco.de.color;
          ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // 4. Los nodos, también de atrás para adelante.
      posiciones.clear();
      const puntos = nodos.map(n => ({ n, q: proyectar(n.v) })).sort((a, b) => b.q.z - a.q.z);
      for (const { n, q } of puntos) {
        const cerca = q.z < 0;
        const tocado = sel === n.id;
        const atenuado = sel && !tocado &&
          !arcos.some(a => (a.de.id === sel && a.a.id === n.id) || (a.a.id === sel && a.de.id === n.id));
        posiciones.set(n.id, { x: q.x, y: q.y, r: 14 * q.p });
        const r = (tocado ? 7 : 5) * q.p;
        ctx.globalAlpha = atenuado ? 0.2 : cerca ? 1 : 0.4;
        // Halo
        const halo = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r * 4);
        halo.addColorStop(0, n.color); halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha *= 0.35;
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(q.x, q.y, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = atenuado ? 0.2 : cerca ? 1 : 0.4;
        ctx.fillStyle = n.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.fill();
        // El nombre solo adelante: atrás se amontona y no se lee nada.
        if (cerca || tocado) {
          ctx.globalAlpha = atenuado ? 0.25 : Math.min(1, 0.45 + -q.z * 1.1);
          ctx.fillStyle = tocado ? "#e7edea" : "rgba(226,232,240,0.85)";
          ctx.font = `${tocado ? 600 : 500} ${Math.round(11.5 * q.p)}px "IBM Plex Sans", system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(n.nombre, q.x, q.y - r - 7);
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(dibujar);
    };

    // Sin esto la pestaña en segundo plano sigue quemando CPU al pedo.
    const alCambiarVisibilidad = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else { ultimo = performance.now(); raf = requestAnimationFrame(dibujar); }
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);

    const alMover = (e) => {
      const r = cv.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      let encontrado = null, mejor = 1e9;
      posiciones.forEach((p, id) => {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < p.r * p.r && d < mejor) { mejor = d; encontrado = id; }
      });
      cv.style.cursor = encontrado ? "pointer" : "default";
      if (encontrado !== encimaRef.current) setEncima(encontrado);
    };
    const alSalir = () => setEncima(null);
    cv.addEventListener("mousemove", alMover);
    cv.addEventListener("mouseleave", alSalir);

    raf = requestAnimationFrame(dibujar);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      cv.removeEventListener("mousemove", alMover);
      cv.removeEventListener("mouseleave", alSalir);
    };
  }, []);

  const nodoEncima = NODOS.find(n => n.id === encima);
  const arcosDelNodo = encima
    ? ARCOS.filter(([d, a]) => d === encima || a === encima)
    : [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 260px", gap: 16 }}>
      <div style={{ position: "relative", background: "#0d1211", borderRadius: 14,
                    border: "1px solid #1f2825", overflow: "hidden" }}>
        <div ref={cajaRef} style={{ width: "100%", height: 520 }}>
          <canvas ref={ref} style={{ display: "block" }} />
        </div>

        <div style={{ position: "absolute", left: 16, top: 14, pointerEvents: "none" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10,
                        letterSpacing: 1.6, textTransform: "uppercase", color: "#6f7f78" }}>
            Flujo de la plataforma
          </div>
          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 19, fontWeight: 700,
                        color: "#e7edea", marginTop: 2 }}>
            {nodoEncima ? nodoEncima.nombre : "15 módulos, 23 caminos"}
          </div>
        </div>

        <button
          onClick={() => setQuieto(q => !q)}
          style={{ position: "absolute", right: 14, top: 14, background: "rgba(255,255,255,0.06)",
                   border: "1px solid rgba(255,255,255,0.14)", color: "#95a49d", borderRadius: 20,
                   padding: "5px 13px", fontSize: 11.5, cursor: "pointer" }}>
          {quieto ? "Girar" : "Frenar"}
        </button>

        <div style={{ position: "absolute", left: 16, bottom: 14, right: 16,
                      fontSize: 11.5, color: "#6f7f78", lineHeight: 1.5, pointerEvents: "none" }}>
          Cada pulso es un dato viajando en el sentido en que viaja de verdad. Pasá el mouse
          por un módulo para ver de dónde recibe y a dónde manda.
        </div>
      </div>

      {/* Leyenda / detalle */}
      <div style={{ background: "#0d1211", borderRadius: 14, border: "1px solid #1f2825",
                    padding: 14, overflowY: "auto", maxHeight: 520 }}>
        {!encima && (
          <>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.4,
                          textTransform: "uppercase", color: "#6f7f78", marginBottom: 10 }}>
              Módulos
            </div>
            {NODOS.map(n => (
              <div key={n.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                <span style={{ width: 8, height: 8, borderRadius: 8, background: n.color, flex: "0 0 auto" }} />
                <span style={{ fontSize: 12.5, color: "#c8d2cd" }}>{n.nombre}</span>
              </div>
            ))}
          </>
        )}

        {encima && (
          <>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: 1.4,
                          textTransform: "uppercase", color: "#6f7f78", marginBottom: 10 }}>
              {nodoEncima.nombre}
            </div>
            {["recibe", "manda"].map(dir => {
              const filas = arcosDelNodo.filter(([d, a]) => (dir === "manda" ? d === encima : a === encima));
              if (!filas.length) return null;
              return (
                <div key={dir} style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, color: "#6f7f78", textTransform: "uppercase",
                                letterSpacing: 1, marginBottom: 6 }}>
                    {dir === "manda" ? "Manda a" : "Recibe de"}
                  </div>
                  {filas.map(([d, a, etiqueta], i) => {
                    const otro = NODOS.find(n => n.id === (dir === "manda" ? a : d));
                    return (
                      <div key={i} style={{ display: "flex", gap: 8, padding: "5px 0",
                                            borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 8, background: otro.color,
                                       flex: "0 0 auto", marginTop: 5 }} />
                        <div>
                          <div style={{ fontSize: 12.5, color: "#c8d2cd" }}>{otro.nombre}</div>
                          <div style={{ fontSize: 11, color: "#6f7f78" }}>{etiqueta}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
