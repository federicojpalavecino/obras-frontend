import { useState, useEffect, useRef } from "react";
import { Printer, ArrowDownLeft, ArrowUpRight, Users, Wrench, BarChart2, FileDown } from "lucide-react";
import api from "../cotizador/api";
import MenuAcciones from "../shared/MenuAcciones";
import NumeroInput from "../cotizador/NumeroInput";

// ── Hook detección mobile ──────────────────────────────────────────────────────
function useIsMobile(bp = 720) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => {
    const fn = () => setM(window.innerWidth <= bp);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, [bp]);
  return m;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const fmtShort = (n) => {
  const v = Math.abs(Math.round(n || 0));
  if (v >= 1000000) return (n < 0 ? "-" : "") + "$" + (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return (n < 0 ? "-" : "") + "$" + (v / 1000).toFixed(0) + "k";
  return fmt(n);
};

const addDays = (dateStr, days) => {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const getTenant = () => {
  try {
    const s = JSON.parse(localStorage.getItem("obras_session") || "{}");
    if (s?.tenant) return s.tenant;
    const t = JSON.parse(localStorage.getItem("obras_tenant") || "null");
    return t;
  } catch { return null; }
};

function getPeriodDates(tipo) {
  const today = new Date();
  const d = today.toISOString().split("T")[0];
  if (tipo === "semana") {
    const day = today.getDay();
    const diffLun = day === 0 ? -6 : 1 - day;
    const diffVie = day === 0 ? -2 : 5 - day;
    const lun = new Date(today); lun.setDate(today.getDate() + diffLun);
    const vie = new Date(today); vie.setDate(today.getDate() + diffVie);
    return { inicio: lun.toISOString().split("T")[0], fin: vie.toISOString().split("T")[0] };
  }
  if (tipo === "quincena") {
    const dia = today.getDate();
    if (dia <= 15) return { inicio: `${d.slice(0,7)}-01`, fin: `${d.slice(0,7)}-15` };
    const ultimo = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return { inicio: `${d.slice(0,7)}-16`, fin: `${d.slice(0,7)}-${ultimo}` };
  }
  // mes
  const ultimo = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return { inicio: `${d.slice(0,7)}-01`, fin: `${d.slice(0,7)}-${ultimo}` };
}

function emptyPeriod(tipo = "semana") {
  const { inicio, fin } = getPeriodDates(tipo);
  return {
    fecha: inicio, fecha_inicio: inicio, fecha_fin: fin,
    ingresos: [], egresos: [], personal: [], herramientas: [],
    alimentacion_dias: {}, config: { honorarios: [], pctReserva: 10 },
  };
}

function calcHonorario(resultado, hon) {
  if (!hon || !hon.activo) return 0;
  if (hon.modo === "monto") return parseFloat(hon.monto) || 0;
  return resultado > 0 ? resultado * (parseFloat(hon.pct) || 0) / 100 : 0;
}

// Cuanto cuesta una herramienta del periodo. Se puede cargar el costo total o
// el costo por dia: con "por dia" el total sale de los dias entre entrada y
// salida, que es como se factura un alquiler.
function costoHerramienta(row) {
  const cant = parseFloat(row.cantidad) || 1;
  if (row.modoCosto === "dia") {
    if (!row.fechaIn || !row.fechaEx) return 0;
    const d = (new Date(row.fechaEx) - new Date(row.fechaIn)) / 86400000;
    const dias = d >= 0 ? Math.round(d) + 1 : 0;
    return (parseFloat(row.costoDia) || 0) * dias * cant;
  }
  return (parseFloat(row.costoTotal) || 0) * cant;
}

function calcPeriod(week, cfg) {
  const totalIng = (week.ingresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  // Las herramientas son un egreso mas: alquilar un martillo neumatico sale
  // plata igual que comprar cemento, y hasta ahora no entraba en el resultado.
  const totalHerram = (week.herramientas || []).reduce((a, b) => a + costoHerramienta(b), 0);
  const totalEg = (week.egresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0) + totalHerram;
  const totalPersonal = (week.personal || []).reduce((a, b) => a + (parseFloat(b.total) || 0), 0);
  const resultado = totalIng - totalEg - totalPersonal;
  const honorarios = (week.config?.honorarios || cfg?.honorarios || []).filter(h => h.activo);
  const pctReserva = parseFloat(week.config?.pctReserva ?? cfg?.pctReserva ?? 10);
  const reserva = resultado > 0 ? resultado * pctReserva / 100 : 0;
  const totalHonorarios = honorarios.reduce((s, h) => s + calcHonorario(resultado, h), 0);
  const ganancia = resultado - totalHonorarios - reserva;
  return { totalIng, totalEg, totalPersonal, totalHerram, resultado, reserva, totalHonorarios, honorarios, ganancia };
}

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", border2: "#d0d0dc",
  text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6",
};

const inp = {
  background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8,
  color: C.text, padding: "7px 10px", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
  // Sin esto, en una grilla el control nunca baja del ancho de su contenido y
  // se sale de la tarjeta en pantallas angostas. Se ve en un Galaxy de 320px.
  minWidth: 0, maxWidth: "100%",
};

const HERRAM_LIST = ["Andamios", "Ruedas de andamio", "Hormigonera", "Termofusora", "Taladro", "Laser", "Escalera madera", "Escalera metálica", "Pala ancha", "Pala de punta", "Atornillador", "Alargue", "Reglas", "Baldes", "Otro"];
const TIPO_LABELS = { semana: "Semana", quincena: "Quincena", mes: "Mes" };

// ── Imprimir periodo ──────────────────────────────────────────────────────────
function imprimirPeriodo(period, calc, tipo, tenant) {
  const nombreEstudio = tenant?.nombre || "FAIM OBRAS";
  const cuit = tenant?.cuit ? `CUIT: ${tenant.cuit}` : "";
  const telefono = tenant?.telefono ? `Tel: ${tenant.telefono}` : "";
  const direccion = tenant?.direccion ? tenant.direccion : "";
  const ciudad = [tenant?.ciudad, tenant?.provincia].filter(Boolean).join(", ");
  const fi = new Date((period.fecha_inicio || period.fecha) + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const ff = new Date((period.fecha_fin || period.fecha_inicio || period.fecha) + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
  const periodoLabel = TIPO_LABELS[tipo] || "Período";

  const rows = (arr, cols) => arr.map(r => `<tr>${cols.map(c => `<td>${r[c.key] ?? ""}</td>`).join("")}</tr>`).join("");

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${nombreEstudio} — ${periodoLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #059669; }
  .logo { font-size: 22px; font-weight: 900; color: #059669; letter-spacing: -0.5px; }
  .studio-info { font-size: 11px; color: #6b7280; line-height: 1.6; text-align: right; }
  .period-title { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
  .period-dates { font-size: 12px; color: #6b7280; }
  .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .metric { background: #f1f3f5; border-radius: 8px; padding: 12px 16px; }
  .metric-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
  .metric-val { font-size: 20px; font-weight: 800; font-family: monospace; }
  .green { color: #059669; } .red { color: #ef4444; } .blue { color: #3b82f6; }
  section { margin-bottom: 20px; }
  section h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e8; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e0e0e8; }
  td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #f1f3f5; }
  .total-row td { font-weight: 700; border-top: 1px solid #e0e0e8; padding-top: 8px; }
  .empty { color: #9ca3af; font-style: italic; font-size: 12px; padding: 8px 0; }
  @media print { body { padding: 16px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="logo">${nombreEstudio}</div>
    <div class="period-title" style="margin-top:8px">${periodoLabel}: ${fi} — ${ff}</div>
    <div class="period-dates">Emitido: ${new Date().toLocaleDateString("es-AR", { day:"2-digit", month:"long", year:"numeric" })}</div>
  </div>
  <div class="studio-info">
    ${cuit ? `<div>${cuit}</div>` : ""}
    ${telefono ? `<div>${telefono}</div>` : ""}
    ${direccion ? `<div>${direccion}</div>` : ""}
    ${ciudad ? `<div>${ciudad}</div>` : ""}
  </div>
</div>

<div class="metrics">
  <div class="metric"><div class="metric-label">Ingresos</div><div class="metric-val green">${fmt(calc.totalIng)}</div></div>
  <div class="metric"><div class="metric-label">Egresos</div><div class="metric-val red">${fmt(calc.totalEg)}</div></div>
  <div class="metric"><div class="metric-label">Personal</div><div class="metric-val red">${fmt(calc.totalPersonal)}</div></div>
  <div class="metric"><div class="metric-label">Ganancia neta</div><div class="metric-val ${calc.ganancia >= 0 ? "green" : "red"}">${fmt(calc.ganancia)}</div></div>
</div>

<section>
  <h3>Ingresos</h3>
  ${period.ingresos?.length ? `<table><thead><tr><th>Concepto</th><th>Estado</th><th>Obra</th><th style="text-align:right">Monto</th></tr></thead><tbody>
    ${(period.ingresos || []).map(r => `<tr><td>${r.concepto||""}</td><td>${r.estado||""}</td><td>${r.obra||r.cliente||""}</td><td style="text-align:right;font-weight:600">${fmt(r.monto)}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="3">Total ingresos</td><td style="text-align:right">${fmt(calc.totalIng)}</td></tr>
  </tbody></table>` : `<div class="empty">Sin ingresos</div>`}
</section>

<section>
  <h3>Egresos</h3>
  ${period.egresos?.length ? `<table><thead><tr><th>Concepto</th><th>Estado</th><th>Obra</th><th style="text-align:right">Monto</th></tr></thead><tbody>
    ${(period.egresos || []).map(r => `<tr><td>${r.concepto||""}</td><td>${r.estado||""}</td><td>${r.obra||""}</td><td style="text-align:right;font-weight:600">${fmt(r.monto)}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="3">Total egresos</td><td style="text-align:right">${fmt(calc.totalEg)}</td></tr>
  </tbody></table>` : `<div class="empty">Sin egresos</div>`}
</section>

<section>
  <h3>Personal</h3>
  ${period.personal?.length ? `<table><thead><tr><th>Nombre</th><th>Rango</th><th>Días</th><th>Hs/día</th><th style="text-align:right">$/hs</th><th style="text-align:right">Total</th></tr></thead><tbody>
    ${(period.personal || []).map(r => `<tr><td>${r.nombre||""}</td><td>${r.rango||""}</td><td>${r.dias||0}</td><td>${r.hs||0}</td><td style="text-align:right">${fmt(r.costo)}</td><td style="text-align:right;font-weight:600">${fmt(r.total)}</td></tr>`).join("")}
    <tr class="total-row"><td colspan="5">Total personal</td><td style="text-align:right">${fmt(calc.totalPersonal)}</td></tr>
  </tbody></table>` : `<div class="empty">Sin personal</div>`}
</section>

${period.herramientas?.length ? `<section>
  <h3>Herramientas</h3>
  <table><thead><tr><th>Herramienta</th><th>Cantidad</th><th>Obra</th><th>Entrada</th><th>Salida</th></tr></thead><tbody>
    ${(period.herramientas || []).map(r => `<tr><td>${r.nombre||""}</td><td>${r.cantidad||1}</td><td>${r.obra||""}</td><td>${r.fechaIn||""}</td><td>${r.fechaEx||""}</td></tr>`).join("")}
  </tbody></table>
</section>` : ""}

<section>
  <h3>Resultado</h3>
  <table><tbody>
    <tr><td>Resultado bruto</td><td style="text-align:right;font-weight:600">${fmt(calc.resultado)}</td></tr>
    ${calc.honorarios?.map(h => `<tr><td>${h.nombre} (${h.modo==="monto"?"fijo":h.pct+"%"})</td><td style="text-align:right">${fmt(calcHonorario(calc.resultado, h))}</td></tr>`).join("") || ""}
    <tr><td>Reserva</td><td style="text-align:right">${fmt(calc.reserva)}</td></tr>
    <tr class="total-row"><td><strong>Ganancia neta</strong></td><td style="text-align:right;font-size:16px" class="${calc.ganancia >= 0 ? "green" : "red"}">${fmt(calc.ganancia)}</td></tr>
  </tbody></table>
</section>

</body></html>`;

  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ControlFinanciero({ user }) {
  const isMobile = useIsMobile();
  // Mobile: grid de 2 columnas. Concepto/nombre ocupan toda la fila arriba, el resto fluye de a 2.
  const mobileRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12, alignItems: "center", paddingBottom: 12, borderBottom: "1px dashed var(--border, #e0e0e8)" };
  const rowGrid = isMobile ? mobileRow
    : { display: "grid", gridTemplateColumns: "2.2fr 120px 110px 1.1fr 0.9fr auto", gap: 5, marginBottom: 5, alignItems: "center" };
  const personalGrid = isMobile ? mobileRow
    : { display: "grid", gridTemplateColumns: "1.5fr 1fr 60px 60px 120px 100px auto", gap: 5, marginBottom: 5, alignItems: "center" };
  const herramGrid = isMobile ? mobileRow
    : { display: "grid", gridTemplateColumns: "2fr 0.6fr 1.2fr 110px 110px auto", gap: 5, marginBottom: 5, alignItems: "center" };
  const conceptoSpan = isMobile ? { gridColumn: "1 / -1" } : {};
  const fullSpan = isMobile ? { gridColumn: "1 / -1" } : {};
  const totalPersonalSpan = {};  // en mobile fluye naturalmente a una celda
  const [tab, setTab] = useState("carga");
  const [tipoPeriodo, setTipoPeriodo] = useState(() => localStorage.getItem("cf_tipo_periodo") || "semana");
  const [semanas, setSemanas] = useState([]);
  const [week, setWeek] = useState(() => emptyPeriod(localStorage.getItem("cf_tipo_periodo") || "semana"));
  const [editingId, setEditingId] = useState(null);
  const editingIdRef = useRef(null);
  const setEditingIdSynced = (id) => { editingIdRef.current = id; setEditingId(id); };
  const [config, setConfig] = useState({ honorarios: [{ nombre: "Honorario 1", pct: 15, monto: 0, modo: "pct", activo: true }, { nombre: "Honorario 2", pct: 15, monto: 0, modo: "pct", activo: true }], pctReserva: 10 });
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [obras, setObras] = useState([]);
  // Obras, clientes, proyectos y usuarios: todo lo que un gasto puede tener adelante
  const [imputables, setImputables] = useState({ obras: [], clientes: [], proyectos: [], usuarios: [] });
  const [resumenImp, setResumenImp] = useState(null);   // gasto por imputacion y por persona
  const [rango, setRango] = useState({ desde: '', hasta: '' });   // periodo del analisis
  // Quien esta cargando: queda escrito en cada fila que se agrega, para poder
  // preguntarle despues a la persona que la cargo y no adivinar.
  const usuarioActual = (() => {
    try {
      const s = JSON.parse(localStorage.getItem("obras_session") || "{}");
      return s?.user?.nombre || s?.user?.email || user?.nombre || user?.email || "";
    } catch { return user?.nombre || ""; }
  })();
  const [showImportarObra, setShowImportarObra] = useState(false);
  const [obraPendientes, setObraPendientes] = useState({ cobros: [], pagos_subcontrato: [], compras: [] });
  const [obraSeleccionados, setObraSeleccionados] = useState([]);
  const [loadingObra, setLoadingObra] = useState(false);
  const [showImportCert, setShowImportCert] = useState(false);
  const [importCertTab, setImportCertTab] = useState("items");
  const [certDisponibles, setCertDisponibles] = useState([]);
  const [certEgresosDisponibles, setCertEgresosDisponibles] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [certFiltro, setCertFiltro] = useState("");
  const [resumenObraFiltro, setResumenObraFiltro] = useState("");
  const tenant = getTenant();

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const periodLabel = (w) => {
    if (!w) return "";
    const di = new Date((w.fecha_inicio || w.fecha || "") + "T12:00:00");
    const df = new Date((w.fecha_fin || w.fecha_inicio || w.fecha || "") + "T12:00:00");
    if (di.toDateString() === df.toDateString()) return di.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    return di.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " – " + df.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  // ── Cargar obras y config ─────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("obras-cf-config");
    if (saved) { try { setConfig(JSON.parse(saved)); } catch {} }
    api.get('/cf/imputables')
      .then(r => setImputables(r.data || { obras: [], clientes: [], proyectos: [], usuarios: [] }))
      .catch(() => {});
    api.get('/presupuestos')
      .then(r => { const ps = Array.isArray(r.data) ? r.data : (r.data?.presupuestos || []); setObras(ps.map(p => ({ id: p.id, label: p.nombre_obra || `Presupuesto #${p.id}` })).sort((a, b) => a.label.localeCompare(b.label))); })
      .catch(() => {});
    loadPeriods(true);
  }, []);

  const saveConfig = (cfg) => { setConfig(cfg); localStorage.setItem("obras-cf-config", JSON.stringify(cfg)); };

  const cambiarTipo = (tipo) => {
    setTipoPeriodo(tipo);
    localStorage.setItem("cf_tipo_periodo", tipo);
    setEditingIdSynced(null);
    setWeek(emptyPeriod(tipo));
  };

  // ── Load periods ──────────────────────────────────────────────────────────
  const loadPeriods = async (loadCurrent = false) => {
    try {
      const res = await api.get('/cf/semanas');
      const data = res.data;
      const parsed = data.map(s => ({
        ...s,
        ingresos: typeof s.ingresos === "string" ? JSON.parse(s.ingresos || "[]") : (s.ingresos || []),
        egresos: typeof s.egresos === "string" ? JSON.parse(s.egresos || "[]") : (s.egresos || []),
        personal: typeof s.personal === "string" ? JSON.parse(s.personal || "[]") : (s.personal || []),
        herramientas: typeof s.herramientas === "string" ? JSON.parse(s.herramientas || "[]") : (s.herramientas || []),
        alimentacion_dias: typeof s.alimentacion_dias === "string" ? JSON.parse(s.alimentacion_dias || "{}") : (s.alimentacion_dias || {}),
        config: typeof s.config === "string" ? JSON.parse(s.config || "{}") : (s.config || {}),
      }));
      setSemanas(parsed);
      if (loadCurrent) {
        const tipo = localStorage.getItem("cf_tipo_periodo") || "semana";
        const { inicio } = getPeriodDates(tipo);
        let current = parsed.find(s => (s.fecha_inicio === inicio || s.fecha === inicio) && !s.cerrado);
        if (!current) { const unclosed = parsed.filter(s => !s.cerrado); if (unclosed.length) current = unclosed[unclosed.length - 1]; }
        if (current) {
          setWeek({ ...current });
          setEditingIdSynced(current.id);
        }
      }
    } catch (e) { console.error("loadPeriods", e); }
  };

  const cfgParaCalc = { ...config, ...(week.config || {}), honorarios: week.config?.honorarios?.length ? week.config.honorarios : (config.honorarios || []), pctReserva: week.config?.pctReserva ?? config.pctReserva ?? 10 };
  const calc = calcPeriod(week, cfgParaCalc);

  // ── Importar certificado como ingreso ─────────────────────────────────────
  const abrirImportCert = async () => {
    setCertFiltro(""); setLoadingCerts(true); setShowImportCert(true); setImportCertTab("items");
    const [r1, r2] = await Promise.all([
      api.get('/certificados/todos').then(r => r.data).catch(() => []),
      api.get('/cf/cert-egresos/todos').then(r => r.data).catch(() => []),
    ]);
    setCertDisponibles(Array.isArray(r1) ? r1 : []);
    setCertEgresosDisponibles(Array.isArray(r2) ? r2 : []);
    setLoadingCerts(false);
  };

  const cargarObraPendientes = async () => {
    setLoadingObra(true);
    try {
      const res = await api.get('/cf/obra-pendientes');
      setObraPendientes(res.data);
    } catch(e) {}
    setLoadingObra(false);
  };

  const importarDesdeObra = async () => {
    if (obraSeleccionados.length === 0) return;
    try {
      await api.post('/cf/importar-obra', { items: obraSeleccionados });
      showToast("✓ Importado al CF correctamente");
      setShowImportarObra(false);
      setObraSeleccionados([]);
      await cargar();
    } catch(e) { showToast("Error al importar"); }
  };

  const toggleSeleccionObra = (tipo, id) => {
    const key = `${tipo}-${id}`;
    setObraSeleccionados(prev => {
      const exists = prev.find(i => i.tipo === tipo && i.id === id);
      if (exists) return prev.filter(i => !(i.tipo === tipo && i.id === id));
      return [...prev, { tipo, id }];
    });
  };

  const importarCert = (cert) => {
    const nw = { ...week, ingresos: [...week.ingresos, { concepto: `Certificado Nº ${cert.numero} — ${cert.obra || ""}`, monto: String(Math.round(cert.total_periodo || 0)), estado: "PENDIENTE", obra: cert.obra || "", cliente: cert.cliente || "" }] };
    setWeek(nw); setTimeout(() => autoGuardar(nw), 300); setShowImportCert(false);
  };

  const importarCertEgresos = (ce) => {
    const label = ce.certificado_num ? ` — Cert. Nº ${ce.certificado_num}` : "";
    const nw = { ...week, ingresos: [...week.ingresos, { concepto: `Egresos certificados${label} — ${ce.obra || ""}`, monto: String(Math.round(ce.total || 0)), estado: "PENDIENTE", obra: ce.obra || "" }] };
    setWeek(nw); setTimeout(() => autoGuardar(nw), 300); setShowImportCert(false);
  };

  // ── CRUD rows ─────────────────────────────────────────────────────────────
  // El resumen se recalcula cuando cambia el periodo elegido. Va contra el
  // backend y no filtrando en memoria porque el corte tiene que ser el mismo
  // que usa cualquier otro reporte, y porque los periodos que se solapan con
  // el borde del rango tienen que contar.
  useEffect(() => {
    const q = [];
    if (rango.desde) q.push(`desde=${rango.desde}`);
    if (rango.hasta) q.push(`hasta=${rango.hasta}`);
    api.get(`/cf/resumen${q.length ? '?' + q.join('&') : ''}`)
      .then(r => setResumenImp(r.data)).catch(() => {});
  }, [rango.desde, rango.hasta]);

  // Atajos: el analisis casi siempre es "este mes", "este anio" o "todo".
  const rangoMes = () => { const d = new Date(); const p = n => String(n).padStart(2, '0');
    setRango({ desde: `${d.getFullYear()}-${p(d.getMonth() + 1)}-01`,
               hasta: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())}` }); };
  const rangoAnio = () => { const a = new Date().getFullYear();
    setRango({ desde: `${a}-01-01`, hasta: `${a}-12-31` }); };
  const rangoTodo = () => setRango({ desde: '', hasta: '' });

  const addIngreso = () => setWeek(w => { const nw = { ...w, ingresos: [...w.ingresos, { concepto: "", monto: "", estado: "PENDIENTE", obra: "", cliente: "" , usuario: usuarioActual }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updIngreso = (i, f, v) => setWeek(w => { const a = [...w.ingresos]; a[i] = { ...a[i], [f]: v }; const nw = { ...w, ingresos: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delIngreso = (i) => { const nw = { ...week, ingresos: week.ingresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  const addEgreso = () => setWeek(w => { const nw = { ...w, egresos: [...w.egresos, { concepto: "", monto: "", estado: "PENDIENTE", obra: "", presupuesto_id: null , usuario: usuarioActual }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updEgreso = (i, f, v) => setWeek(w => { const a = [...w.egresos]; a[i] = { ...a[i], [f]: v }; const nw = { ...w, egresos: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delEgreso = (i) => { const nw = { ...week, egresos: week.egresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };
  const updEgresoObra = (i, presupuestoId) => {
    const obra = obras.find(o => o.id === parseInt(presupuestoId));
    setWeek(w => {
      const a = [...w.egresos];
      a[i] = { ...a[i], obra: obra?.label || '', presupuesto_id: presupuestoId ? parseInt(presupuestoId) : null };
      const nw = { ...w, egresos: a };
      clearTimeout(window._cfT);
      window._cfT = setTimeout(() => autoGuardar(nw), 900);
      return nw;
    });
  };

  // ── Imputacion: contra que va este movimiento ────────────────────────────
  // Un solo desplegable agrupado en vez de dos controles encadenados: el que
  // carga gastos elige "Casa Perez" o "Gasto del estudio" de una lista, sin
  // tener que decidir primero de que tipo es.
  const valorImp = (row) => {
    if (row.imputacion) return `${row.imputacion}:${row.ref_id ?? ''}`;
    if (row.presupuesto_id) return `obra:${row.presupuesto_id}`;   // filas viejas
    return '';
  };
  const nombreImp = (tipo, id) => {
    if (tipo === 'estudio') return 'Gasto del estudio';
    const lista = { obra: imputables.obras, cliente: imputables.clientes, proyecto: imputables.proyectos }[tipo] || [];
    return lista.find(x => String(x.id) === String(id))?.nombre || '';
  };
  const updImputacion = (campo, i, valor) => {
    const [tipo, id] = (valor || '').split(':');
    const ref_id = id ? parseInt(id) : null;
    const nombre = tipo ? nombreImp(tipo, ref_id) : '';
    setWeek(w => {
      const a = [...w[campo]];
      a[i] = {
        ...a[i],
        imputacion: tipo || '', ref_id, ref_nombre: nombre,
        // Se sigue escribiendo obra/presupuesto_id cuando corresponde: de ahi
        // leen el resumen por obra y los certificados de egresos que ya existen.
        obra: tipo === 'obra' ? nombre : '',
        presupuesto_id: tipo === 'obra' ? ref_id : null,
      };
      const nw = { ...w, [campo]: a };
      clearTimeout(window._cfT);
      window._cfT = setTimeout(() => autoGuardar(nw), 900);
      return nw;
    });
  };
  const SelectImputacion = ({ campo, i, row, style }) => (
    <select style={style} value={valorImp(row)} onChange={e => updImputacion(campo, i, e.target.value)}
      title="Contra que se imputa">
      <option value="">— Sin imputar —</option>
      <option value="estudio:">Gasto del estudio</option>
      {imputables.obras.length > 0 && (
        <optgroup label="Obras">
          {imputables.obras.map(o => <option key={`o${o.id}`} value={`obra:${o.id}`}>{o.nombre}</option>)}
        </optgroup>
      )}
      {imputables.clientes.length > 0 && (
        <optgroup label="Clientes">
          {imputables.clientes.map(c => <option key={`c${c.id}`} value={`cliente:${c.id}`}>{c.nombre}</option>)}
        </optgroup>
      )}
      {imputables.proyectos.length > 0 && (
        <optgroup label="Proyectos">
          {imputables.proyectos.map(pr => <option key={`p${pr.id}`} value={`proyecto:${pr.id}`}>{pr.nombre}</option>)}
        </optgroup>
      )}
    </select>
  );
  const SelectQuien = ({ campo, i, row, style }) => (
    <select style={style} value={row.usuario || ''}
      onChange={e => (campo === 'egresos' ? updEgreso : updIngreso)(i, 'usuario', e.target.value)}
      title="Quien lo hizo">
      <option value="">— Quien —</option>
      {imputables.usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
    </select>
  );

  const addPersonal = () => setWeek(w => { const nw = { ...w, personal: [...w.personal, { nombre: "", rango: "", dias: 5, hs: 8, costo: 0, total: 0, obra: "" , usuario: usuarioActual }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updPersonal = (i, f, v) => setWeek(w => { const a = [...w.personal]; a[i] = { ...a[i], [f]: v }; a[i].total = (parseFloat(a[i].dias) || 0) * (parseFloat(a[i].hs) || 0) * (parseFloat(a[i].costo) || 0); const nw = { ...w, personal: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delPersonal = (i) => setWeek(w => { const nw = { ...w, personal: w.personal.filter((_, j) => j !== i) }; setTimeout(() => autoGuardar(nw), 300); return nw; });

  // Una herramienta alquilada es un egreso como cualquier otro. Se puede cargar
  // el costo total o el costo por dia: con "por dia", el total sale de los dias
  // entre la fecha de entrada y la de salida, que es como se factura un alquiler.
  const diasHerram = (row) => {
    if (!row.fechaIn || !row.fechaEx) return 0;
    const d = (new Date(row.fechaEx) - new Date(row.fechaIn)) / 86400000;
    return d >= 0 ? Math.round(d) + 1 : 0;
  };
  const totalHerram = costoHerramienta;
  const addHerramienta = () => setWeek(w => { const nw = { ...w, herramientas: [...w.herramientas, { nombre: "", cantidad: 1, obra: "", fechaIn: "", fechaEx: "", modoCosto: "total", costoTotal: "", costoDia: "", usuario: usuarioActual }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updHerramienta = (i, f, v) => setWeek(w => { const a = [...w.herramientas]; a[i] = { ...a[i], [f]: v }; const nw = { ...w, herramientas: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delHerramienta = (i) => { const nw = { ...week, herramientas: week.herramientas.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  // ── Auto-guardar ──────────────────────────────────────────────────────────
  const autoGuardar = async (weekData) => {
    const c = calcPeriod(weekData, { ...config, ...(weekData.config || {}), honorarios: weekData.config?.honorarios?.length ? weekData.config.honorarios : config.honorarios, pctReserva: weekData.config?.pctReserva ?? config.pctReserva ?? 10 });
    const payload = {
      fecha: weekData.fecha, fecha_inicio: weekData.fecha_inicio || weekData.fecha, fecha_fin: weekData.fecha_fin || weekData.fecha,
      ingresos: weekData.ingresos, egresos: weekData.egresos, personal: weekData.personal, herramientas: weekData.herramientas,
      alimentacion_dias: {}, config: { ...(config || {}), ...(weekData.config || {}), honorarios: weekData.config?.honorarios?.length ? weekData.config.honorarios : config.honorarios, pctReserva: weekData.config?.pctReserva ?? config.pctReserva ?? 10 },
      totalIng: c.totalIng, totalEg: c.totalEg, totalPersonal: c.totalPersonal, resultado: c.resultado, ganancia: c.ganancia, cerrado: false,
    };
    try {
      if (editingIdRef.current) {
        await api.put(`/cf/semanas/${editingIdRef.current}`, payload);
      } else {
        const existing = semanas.find(s => s.fecha === weekData.fecha || s.fecha_inicio === (weekData.fecha_inicio || weekData.fecha));
        if (existing) {
          await api.put(`/cf/semanas/${existing.id}`, payload);
          setEditingIdSynced(existing.id);
        } else {
          const res = await api.post('/cf/semanas', payload);
          setEditingIdSynced(res.data.id);
        }
      }
      loadPeriods();
    } catch (e) { console.error("autoGuardar", e); }
  };

  const guardar = async () => {
    setLoading(true);
    const c = calcPeriod(week, cfgParaCalc);
    const payload = {
      fecha: week.fecha, fecha_inicio: week.fecha_inicio || week.fecha, fecha_fin: week.fecha_fin || week.fecha,
      ingresos: week.ingresos, egresos: week.egresos, personal: week.personal, herramientas: week.herramientas,
      alimentacion_dias: {}, config: cfgParaCalc,
      totalIng: c.totalIng, totalEg: c.totalEg, totalPersonal: c.totalPersonal, resultado: c.resultado, ganancia: c.ganancia, cerrado: false,
    };
    try {
      if (editingId) await api.put(`/cf/semanas/${editingId}`, payload);
      else await api.post('/cf/semanas', payload);
      showToast("✓ Guardado"); setEditingIdSynced(null); setWeek(emptyPeriod(tipoPeriodo)); loadPeriods();
    } catch { showToast("Error de conexión"); }
    setLoading(false);
  };

  const editPeriod = (s) => { setWeek({ ...s }); setEditingIdSynced(s.id); setTab("carga"); };

  const eliminarPeriod = async (id) => {
    if (!window.confirm("¿Eliminar este período?")) return;
    await api.delete(`/cf/semanas/${id}`);
    if (editingId === id) { setEditingIdSynced(null); setWeek(emptyPeriod(tipoPeriodo)); }
    loadPeriods();
  };

  const nuevoPeriodo = () => { setEditingIdSynced(null); setWeek(emptyPeriod(tipoPeriodo)); setTab("carga"); };

  // ── Resumen por obra ──────────────────────────────────────────────────────
  const resumenPorObra = () => {
    const mapa = {};
    semanas.forEach(s => {
      [...(s.ingresos || []), ...(s.egresos || []), ...(s.personal || [])].forEach(r => {
        const obra = r.obra || r.cliente || "Sin obra";
        if (!mapa[obra]) mapa[obra] = { ingresos: 0, egresos: 0, personal: 0 };
        if (s.ingresos?.includes(r)) mapa[obra].ingresos += parseFloat(r.monto) || 0;
        else if (s.egresos?.includes(r)) mapa[obra].egresos += parseFloat(r.monto) || 0;
        else mapa[obra].personal += parseFloat(r.total) || 0;
      });
    });
    // Re-hacer correctamente
    const mapa2 = {};
    semanas.forEach(s => {
      (s.ingresos || []).forEach(r => { const o = r.obra || r.cliente || "Sin obra"; if (!mapa2[o]) mapa2[o] = { ingresos: 0, egresos: 0, personal: 0 }; mapa2[o].ingresos += parseFloat(r.monto) || 0; });
      (s.egresos || []).forEach(r => { const o = r.obra || "Sin obra"; if (!mapa2[o]) mapa2[o] = { ingresos: 0, egresos: 0, personal: 0 }; mapa2[o].egresos += parseFloat(r.monto) || 0; });
      (s.personal || []).forEach(r => { const o = r.obra || "Sin obra"; if (!mapa2[o]) mapa2[o] = { ingresos: 0, egresos: 0, personal: 0 }; mapa2[o].personal += parseFloat(r.total) || 0; });
    });
    return Object.entries(mapa2).map(([obra, v]) => ({ obra, ...v, resultado: v.ingresos - v.egresos - v.personal })).sort((a, b) => b.resultado - a.resultado);
  };

  // ── Cert-egresos: sincronizar egresos del CF como cert-egresos ────────────
  // Los egresos del CF se vinculan automáticamente: cuando se crea un cert-egresos,
  // el sistema lee los egresos del CF del período correspondiente al presupuesto.
  // Aquí mostramos los egresos disponibles para vincular.
  const egresosParaCert = week.egresos.filter(e => e.concepto && e.monto);

  // ── Render ────────────────────────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, fontWeight: tab === id ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );

  const SectionHeader = ({ label, total, onAdd }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: C.muted }}>
        {label} {total !== undefined && <span style={{ color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>({fmt(total)})</span>}
      </div>
      {onAdd && <button onClick={onAdd} style={{ padding: "4px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Agregar</button>}
    </div>
  );

  const resumen = semanas.length > 0 ? semanas.reduce((acc, s) => {
    const c = calcPeriod(s, config);
    return { totalIng: acc.totalIng + c.totalIng, totalEg: acc.totalEg + c.totalEg, totalPersonal: acc.totalPersonal + c.totalPersonal, ganancia: acc.ganancia + c.ganancia };
  }, { totalIng: 0, totalEg: 0, totalPersonal: 0, ganancia: 0 }) : null;

  const certFiltrados = certDisponibles.filter(c => !certFiltro || (c.obra || "").toLowerCase().includes(certFiltro.toLowerCase()) || String(c.numero).includes(certFiltro));
  const certEgresosFiltrados = certEgresosDisponibles.filter(c => !certFiltro || (c.obra || "").toLowerCase().includes(certFiltro.toLowerCase()));
  const resumenObras = resumenPorObra();
  const resumenFiltrado = resumenObraFiltro ? resumenObras.filter(r => r.obra.toLowerCase().includes(resumenObraFiltro.toLowerCase())) : resumenObras;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif" }}>

      {/* ── HEADER TABS ── */}
      {isMobile ? (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 14px", position: "sticky", top: 0, zIndex: 50, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={tab} onChange={e => setTab(e.target.value)}
              style={{ flex: 1, padding: "9px 12px", border: `1px solid ${C.border2}`, borderRadius: 8, fontSize: 14, fontWeight: 700, color: C.text, background: C.surface2, fontFamily: "inherit", outline: "none" }}>
              <option value="carga">{TIPO_LABELS[tipoPeriodo]}</option>
              <option value="historial">Historial</option>
              <option value="resumen">Resumen</option>
              <option value="config">Config</option>
            </select>
            <MenuAcciones C={C} label="Más" acciones={[
              { label: "Importar certificado", icon: <FileDown size={16} strokeWidth={1.5} />, onClick: abrirImportCert },
              ...(editingId ? [{ label: "Nuevo período", onClick: nuevoPeriodo }] : []),
            ]} />
          </div>
          {/* Tipo de período — segmentado full width */}
          <div style={{ display: "flex", gap: 2, background: C.surface2, borderRadius: 7, padding: 3 }}>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => cambiarTipo(k)} style={{ flex: 1, padding: "6px 8px", borderRadius: 5, border: "none", background: tipoPeriodo === k ? C.accent : "transparent", color: tipoPeriodo === k ? "#fff" : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 50 }}>
          <TabBtn id="carga" label={TIPO_LABELS[tipoPeriodo]} />
          <TabBtn id="historial" label="Historial" />
          <TabBtn id="resumen" label="Resumen" />
          <TabBtn id="config" label="Config" />

          {/* Tipo de período */}
          <div style={{ marginLeft: 12, display: "flex", gap: 2, background: C.surface2, borderRadius: 7, padding: 3 }}>
            {Object.entries(TIPO_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => cambiarTipo(k)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: tipoPeriodo === k ? C.accent : "transparent", color: tipoPeriodo === k ? "#fff" : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 12, gap: 6 }}>
            <button onClick={abrirImportCert} style={{ padding: "5px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: C.text, whiteSpace: "nowrap" }}>
              <FileDown size={13} strokeWidth={1.5} style={{ marginRight: 4, verticalAlign: "middle" }} /> Importar cert.
            </button>
            {editingId && (
              <button onClick={nuevoPeriodo} style={{ padding: "5px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                + Nuevo
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px 60px" }}>

        {/* ── TAB CARGA ── */}
        {tab === "carga" && (
          <>
            {/* Header período */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: isMobile ? "1 1 100%" : 1, minWidth: isMobile ? 0 : 260, marginBottom: isMobile ? 10 : 0 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{TIPO_LABELS[tipoPeriodo]}</div>
                  <input type="date" value={week.fecha_inicio || week.fecha} onChange={e => setWeek(w => ({ ...w, fecha_inicio: e.target.value, fecha: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 0 }} />
                  <span style={{ color: C.muted }}>→</span>
                  <input type="date" value={week.fecha_fin || week.fecha_inicio || week.fecha} onChange={e => setWeek(w => ({ ...w, fecha_fin: e.target.value }))} style={{ ...inp, flex: 1, minWidth: 0 }} />
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  {[["Ingresos", calc.totalIng, C.green], ["Egresos", calc.totalEg + calc.totalPersonal, C.red], ["Resultado", calc.resultado, calc.resultado >= 0 ? C.accent : C.red], ["Ganancia", calc.ganancia, calc.ganancia >= 0 ? C.green : C.red]].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
              {(week.updated_by || week.created_by) && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                  {week.updated_by ? `Última edición: ${week.updated_by}` : `Creó: ${week.created_by}`}
                </div>
              )}
            </div>

            {/* Ingresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <SectionHeader label="Ingresos" total={calc.totalIng} onAdd={addIngreso} />
              {week.ingresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin ingresos — tocá Agregar</div>}
              {week.ingresos.map((row, i) => (
                <div key={i} style={{ ...rowGrid, ...(row.origen === "obra" ? { opacity: .82 } : {}) }}
                  title={row.origen === "obra" ? "Viene de la obra: se edita desde ahí" : undefined}>
                  <input style={{ ...inp, ...conceptoSpan, ...(row.origen === "obra" ? { background: "var(--surface2)" } : {}) }}
                    placeholder="Concepto" value={row.concepto || ""} readOnly={row.origen === "obra"}
                    onChange={e => updIngreso(i, "concepto", e.target.value)} />
                  <NumeroInput style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} placeholder="Monto" value={row.monto || ""} onChange={v => updIngreso(i, "monto", v)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={e => updIngreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "COBRADO", "EN PROCESO"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <SelectImputacion campo="ingresos" i={i} row={row} style={inp} />
                  <SelectQuien campo="ingresos" i={i} row={row} style={inp} />
                  {row.origen === "obra"
                    ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }} title="Se edita desde la obra">obra</span>
                    : <button onClick={() => delIngreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>}
                </div>
              ))}
            </div>

            {/* Egresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <SectionHeader label="Egresos" total={calc.totalEg} onAdd={addEgreso} />
              {week.egresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin egresos</div>}
              {week.egresos.map((row, i) => (
                <div key={i} style={{ ...rowGrid, ...(row.origen === "obra" ? { opacity: .82 } : {}) }}
                  title={row.origen === "obra" ? "Viene de la obra: se edita desde ahí" : undefined}>
                  <input style={{ ...inp, ...conceptoSpan, ...(row.origen === "obra" ? { background: "var(--surface2)" } : {}) }}
                    placeholder="Concepto" value={row.concepto || ""} readOnly={row.origen === "obra"}
                    onChange={e => updEgreso(i, "concepto", e.target.value)} />
                  <NumeroInput style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} placeholder="Monto" value={row.monto || ""} onChange={v => updEgreso(i, "monto", v)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={e => updEgreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "PAGADO"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <SelectImputacion campo="egresos" i={i} row={row} style={inp} />
                  <SelectQuien campo="egresos" i={i} row={row} style={inp} />
                  {row.origen === "obra"
                    ? <span style={{ fontSize: 10, color: C.muted, whiteSpace: "nowrap" }} title="Se edita desde la obra">obra</span>
                    : <button onClick={() => delEgreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>}
                </div>
              ))}
              {/* Indicador de egresos disponibles para cert */}
              {egresosParaCert.length > 0 && (
                <div style={{ fontSize: 11, color: C.accent, marginTop: 6, padding: "5px 10px", background: "#f0fdf4", borderRadius: 6, border: "1px solid #bbf7d0" }}>
                  ✓ {egresosParaCert.length} egreso{egresosParaCert.length > 1 ? "s" : ""} disponible{egresosParaCert.length > 1 ? "s" : ""} para vincular en certificados de egresos del cotizador
                </div>
              )}
            </div>

            {/* Personal */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <SectionHeader label="Personal" total={calc.totalPersonal} onAdd={addPersonal} />
              {week.personal.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin personal</div>}
              {week.personal.map((row, i) => (
                <div key={i} style={personalGrid}>
                  <input style={{ ...inp, ...fullSpan }} placeholder="Nombre" value={row.nombre || ""} onChange={e => updPersonal(i, "nombre", e.target.value)} />
                  <input style={{ ...inp, ...fullSpan }} placeholder="Rango/Rol" value={row.rango || ""} onChange={e => updPersonal(i, "rango", e.target.value)} />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Días" value={row.dias || ""} onChange={e => updPersonal(i, "dias", e.target.value)} title="Días trabajados" />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Hs" value={row.hs || ""} onChange={e => updPersonal(i, "hs", e.target.value)} title="Horas por día" />
                  <NumeroInput style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} placeholder="$/hs" value={row.costo || ""} onChange={v => updPersonal(i, "costo", v)} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right", paddingRight: 4, ...totalPersonalSpan }}>{fmt(row.total || 0)}</div>
                  <button onClick={() => delPersonal(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            {/* Herramientas */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <SectionHeader label="Herramientas / Equipos" total={week.herramientas.reduce((a, r) => a + totalHerram(r), 0)} onAdd={addHerramienta} />
              {week.herramientas.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin herramientas</div>}
              {week.herramientas.map((row, i) => (
                <div key={i} style={herramGrid}>
                  <select style={{ ...inp, ...fullSpan }} value={row.nombre || ""} onChange={e => updHerramienta(i, "nombre", e.target.value)}>
                    <option value="">— Herramienta —</option>
                    {HERRAM_LIST.map(h => <option key={h}>{h}</option>)}
                  </select>
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Cant." value={row.cantidad || 1} onChange={e => updHerramienta(i, "cantidad", e.target.value)} />
                  <select style={inp} value={row.obra || ""} onChange={e => updHerramienta(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map(o => <option key={o.id} value={o.label}>{o.label}</option>)}
                  </select>
                  <input type="date" style={inp} value={row.fechaIn || ""} onChange={e => updHerramienta(i, "fechaIn", e.target.value)} title="Fecha entrada" />
                  <input type="date" style={inp} value={row.fechaEx || ""} onChange={e => updHerramienta(i, "fechaEx", e.target.value)} title="Fecha salida" />
                  <button onClick={() => delHerramienta(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                  {/* El costo va en su propia linea para no romper la grilla
                      de arriba, que estaba pensada para seis columnas. */}
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 6, alignItems: "center",
                                flexWrap: "wrap", marginTop: -1, marginBottom: 6 }}>
                    <select style={{ ...inp, width: 118, padding: "5px 8px", fontSize: 12 }}
                      value={row.modoCosto || "total"} onChange={e => updHerramienta(i, "modoCosto", e.target.value)}>
                      <option value="total">Costo total</option>
                      <option value="dia">Por día</option>
                    </select>
                    <NumeroInput style={{ ...inp, width: 118, padding: "5px 8px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace" }}
                      placeholder={row.modoCosto === "dia" ? "$/día" : "$ total"}
                      value={(row.modoCosto === "dia" ? row.costoDia : row.costoTotal) || ""}
                      onChange={v => updHerramienta(i, row.modoCosto === "dia" ? "costoDia" : "costoTotal", v)} />
                    {totalHerram(row) > 0 && (
                      <span style={{ fontSize: 11, color: C.muted }}>
                        {row.modoCosto === "dia" && diasHerram(row) > 0 ? `${diasHerram(row)} día${diasHerram(row) !== 1 ? "s" : ""} · ` : ""}
                        <b style={{ color: C.warn, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(totalHerram(row))}</b>
                        {row.usuario ? ` · cargó ${row.usuario}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
                Lo que cuesta una herramienta es un egreso de la obra: entra en el resultado del
                período junto con el resto.
              </div>
            </div>

            {/* Honorarios y Reserva */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: C.muted, marginBottom: 10 }}>Honorarios y Reserva</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {(week.config?.honorarios?.length ? week.config.honorarios : config.honorarios || []).map((hon, i) => (
                  <div key={i} style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}`, minWidth: 200, flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <input style={{ ...inp, fontWeight: 700, flex: 1, marginRight: 6, background: "transparent", border: "none", padding: "0", fontSize: 12 }} value={hon.nombre || ""} onChange={e => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], nombre: e.target.value }; setWeek(w => ({ ...w, config: { ...w.config, honorarios: hs } })); }} />
                      <input type="checkbox" checked={hon.activo !== false} onChange={e => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], activo: e.target.checked }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 500); }} />
                    </div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <select style={{ ...inp, flex: 1 }} value={hon.modo || "pct"} onChange={e => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], modo: e.target.value }; setWeek(w => ({ ...w, config: { ...w.config, honorarios: hs } })); }}>
                        <option value="pct">% resultado</option>
                        <option value="monto">Monto fijo</option>
                      </select>
                      <input style={{ ...inp, width: 70, fontFamily: "'IBM Plex Mono', monospace" }} type="number" value={hon.modo === "monto" ? (hon.monto || 0) : (hon.pct || 0)} onChange={e => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], [hon.modo === "monto" ? "monto" : "pct"]: parseFloat(e.target.value) || 0 }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 1000); }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginTop: 5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(calcHonorario(calc.resultado, hon))}</div>
                  </div>
                ))}
                {/* Reserva */}
                <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}`, minWidth: 140 }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 700 }}>Reserva</div>
                  <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                    <input style={{ ...inp, width: 60, fontFamily: "'IBM Plex Mono', monospace" }} type="number" value={week.config?.pctReserva ?? config.pctReserva ?? 10} onChange={e => { const nw = { ...week, config: { ...week.config, pctReserva: parseFloat(e.target.value) || 0 } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 1000); }} />
                    <span style={{ fontSize: 12, color: C.muted }}>%</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginTop: 5, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(calc.reserva)}</div>
                </div>
              </div>
            </div>

            {/* Resultado final */}
            <div style={{ background: calc.ganancia >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${calc.ganancia >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 12, padding: "16px 20px", marginBottom: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
                {[["Total ingresos", calc.totalIng, C.green], ["Egresos", calc.totalEg, C.red], ["Personal", calc.totalPersonal, C.red], ["Resultado", calc.resultado, calc.resultado >= 0 ? C.accent : C.red], ["Honorarios", calc.totalHonorarios, C.muted], ["Reserva", calc.reserva, C.muted], ["Ganancia neta", calc.ganancia, calc.ganancia >= 0 ? C.green : C.red]].map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 17, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => imprimirPeriodo(week, calc, tipoPeriodo, tenant)} style={{ padding: "12px 20px", background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display:"flex", alignItems:"center", gap:6 }}>
                <Printer size={15} strokeWidth={1.5} /> Imprimir
              </button>
              <button onClick={guardar} disabled={loading} style={{ flex: 1, padding: "12px", background: loading ? C.border : C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {loading ? "Guardando..." : editingId ? "Actualizar" : "Guardar período"}
              </button>
            </div>
          </>
        )}

        {/* ── TAB HISTORIAL ── */}
        {tab === "historial" && (
          <div>
            <div style={{ marginBottom: 14, fontSize: 13, color: C.muted }}>{semanas.length} período{semanas.length !== 1 ? "s" : ""} registrado{semanas.length !== 1 ? "s" : ""}</div>
            {semanas.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 60, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>Sin historial todavía</div>}
            {[...semanas].reverse().map(s => {
              const c = calcPeriod(s, config);
              return (
                <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{periodLabel(s)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{(s.ingresos || []).length} ing · {(s.egresos || []).length} eg · {(s.personal || []).length} pers.</div>
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase" }}>Ingresos</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(c.totalIng)}</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase" }}>Ganancia</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: c.ganancia >= 0 ? C.accent : C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(c.ganancia)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => imprimirPeriodo(s, c, tipoPeriodo, tenant)} style={{ padding: "5px 10px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display:"flex", alignItems:"center" }}><Printer size={13} strokeWidth={1.5} /></button>
                      <button onClick={() => editPeriod(s)} style={{ padding: "5px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Editar</button>
                      <button onClick={() => eliminarPeriod(s.id)} style={{ padding: "5px 10px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 7, fontSize: 12, cursor: "pointer", color: C.red, fontFamily: "inherit" }}>×</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── TAB RESUMEN ── */}
        {tab === "resumen" && (
          <div>
            {resumen && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
                {[["Total ingresado", resumen.totalIng, C.green], ["Total egresado", resumen.totalEg, C.red], ["Total personal", resumen.totalPersonal, C.warn], ["Ganancia total", resumen.ganancia, resumen.ganancia >= 0 ? C.accent : C.red]].map(([label, val, color]) => (
                  <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(val)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{semanas.length} período{semanas.length !== 1 ? "s" : ""}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Periodo del analisis */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".4px" }}>Desde</div>
                  <input type="date" style={inp} value={rango.desde} onChange={e => setRango(r => ({ ...r, desde: e.target.value }))} />
                </div>
                <div>
                  <div style={{ fontSize: 10.5, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".4px" }}>Hasta</div>
                  <input type="date" style={inp} value={rango.hasta} onChange={e => setRango(r => ({ ...r, hasta: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["Este mes", rangoMes], ["Este año", rangoAnio], ["Todo", rangoTodo]].map(([t, fn]) => (
                    <button key={t} onClick={fn}
                      style={{ padding: "7px 12px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>
                  ))}
                </div>
                {resumenImp && (
                  <div style={{ marginLeft: "auto", fontSize: 12, color: C.muted, textAlign: "right" }}>
                    {resumenImp.periodos} período{resumenImp.periodos !== 1 ? "s" : ""}
                    {resumenImp.alcance && (resumenImp.alcance.obras + resumenImp.alcance.clientes + resumenImp.alcance.proyectos) > 0 && (
                      <> · {[
                        resumenImp.alcance.obras ? `${resumenImp.alcance.obras} obra${resumenImp.alcance.obras !== 1 ? "s" : ""}` : null,
                        resumenImp.alcance.clientes ? `${resumenImp.alcance.clientes} cliente${resumenImp.alcance.clientes !== 1 ? "s" : ""}` : null,
                        resumenImp.alcance.proyectos ? `${resumenImp.alcance.proyectos} proyecto${resumenImp.alcance.proyectos !== 1 ? "s" : ""}` : null,
                      ].filter(Boolean).join(" · ")}</>
                    )}
                    {resumenImp.rango_real && (
                      <div style={{ fontSize: 10.5 }}>{resumenImp.rango_real.desde} → {resumenImp.rango_real.hasta}</div>
                    )}
                  </div>
                )}
              </div>
              {resumenImp?.totales && resumenImp.periodos > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginTop: 14 }}>
                  {[["Ingresos", resumenImp.totales.ingresos, C.green],
                    ["Egresos", resumenImp.totales.egresos, C.red],
                    ["Personal", resumenImp.totales.personal, C.warn],
                    ["Resultado", resumenImp.totales.resultado, resumenImp.totales.resultado >= 0 ? C.accent : C.red]].map(([l, v, col]) => (
                    <div key={l} style={{ background: C.surface2, borderRadius: 9, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px" }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: col, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(v)}</div>
                    </div>
                  ))}
                </div>
              )}
              {resumenImp?.periodos === 0 && (
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 12 }}>
                  No hay períodos cargados dentro de esas fechas.
                </div>
              )}
            </div>

            {/* Gasto imputado y por persona */}
            {resumenImp && (resumenImp.por_imputacion?.length > 0 || resumenImp.por_usuario?.length > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", gap: 12, marginBottom: 16 }}>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Contra qué se gastó</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
                    Obras, clientes, proyectos y lo que es del estudio, en todos los períodos.
                  </div>
                  {resumenImp.por_imputacion.map((r, i) => {
                    const col = { obra: C.accent, cliente: C.accent2, proyecto: C.warn, estudio: C.text, sin_imputar: C.muted }[r.imputacion] || C.muted;
                    const gasto = r.egresos + r.personal;
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.ref_nombre}</div>
                          <div style={{ fontSize: 10.5, color: col, textTransform: "uppercase", letterSpacing: ".4px" }}>
                            {r.imputacion === "sin_imputar" ? "sin imputar" : r.imputacion}
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(gasto)}</div>
                          {r.ingresos > 0 && <div style={{ fontSize: 10.5, color: C.green }}>+{fmtShort(r.ingresos)}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Quién lo hizo</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 12 }}>
                    Cuánto movió cada uno del estudio.
                  </div>
                  {resumenImp.por_usuario.map((r, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: r.usuario === "Sin asignar" ? C.muted : C.text }}>{r.usuario}</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.red, fontFamily: "'IBM Plex Mono', monospace", flexShrink: 0 }}>{fmtShort(r.egresos + r.personal)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen por obra */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Por obra / proyecto</div>
                <input style={{ ...inp, width: 200 }} placeholder="Filtrar por obra..." value={resumenObraFiltro} onChange={e => setResumenObraFiltro(e.target.value)} />
              </div>
              {resumenFiltrado.length === 0 ? (
                <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Sin datos</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: C.surface2 }}>
                      {["Obra / Proyecto", "Ingresos", "Egresos", "Personal", "Resultado"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Obra / Proyecto" ? "left" : "right", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: C.muted, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resumenFiltrado.map((r, i) => (
                      <tr key={r.obra} style={{ borderBottom: `1px solid ${C.border2}`, background: i % 2 === 0 ? "transparent" : C.surface2 }}>
                        <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600 }}>{r.obra}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.ingresos)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.egresos)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, color: C.warn, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.personal)}</td>
                        <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 14, fontWeight: 800, color: r.resultado >= 0 ? C.accent : C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(r.resultado)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: `2px solid ${C.border}` }}>
                      <td style={{ padding: "9px 12px", fontSize: 12, fontWeight: 700, color: C.muted }}>TOTAL</td>
                      {["ingresos", "egresos", "personal", "resultado"].map(k => (
                        <td key={k} style={{ padding: "9px 12px", textAlign: "right", fontSize: 14, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: k === "resultado" ? (resumenFiltrado.reduce((a, r) => a + r[k], 0) >= 0 ? C.accent : C.red) : k === "ingresos" ? C.green : C.red }}>
                          {fmt(resumenFiltrado.reduce((a, r) => a + r[k], 0))}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── TAB CONFIG ── */}
        {tab === "config" && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Honorarios por defecto</div>
            {(config.honorarios || []).map((hon, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={{ ...inp, flex: 2 }} value={hon.nombre || ""} onChange={e => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], nombre: e.target.value }; saveConfig({ ...config, honorarios: hs }); }} />
                <select style={{ ...inp, flex: 1 }} value={hon.modo || "pct"} onChange={e => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], modo: e.target.value }; saveConfig({ ...config, honorarios: hs }); }}>
                  <option value="pct">% resultado</option>
                  <option value="monto">Monto fijo</option>
                </select>
                <input style={{ ...inp, width: 80 }} type="number" value={hon.modo === "monto" ? (hon.monto || 0) : (hon.pct || 0)} onChange={e => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], [hon.modo === "monto" ? "monto" : "pct"]: parseFloat(e.target.value) || 0 }; saveConfig({ ...config, honorarios: hs }); }} />
                <input type="checkbox" checked={hon.activo !== false} onChange={e => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], activo: e.target.checked }; saveConfig({ ...config, honorarios: hs }); }} />
                <button onClick={() => { const hs = config.honorarios.filter((_, j) => j !== i); saveConfig({ ...config, honorarios: hs }); }} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button onClick={() => saveConfig({ ...config, honorarios: [...(config.honorarios || []), { nombre: `Honorario ${(config.honorarios || []).length + 1}`, pct: 10, monto: 0, modo: "pct", activo: true }] })} style={{ padding: "7px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 20 }}>
              + Agregar honorario
            </button>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>% Reserva por defecto</label>
              <input style={{ ...inp, width: 100 }} type="number" value={config.pctReserva ?? 10} onChange={e => saveConfig({ ...config, pctReserva: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL IMPORTAR CERT ── */}
      {showImportCert && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 580, maxHeight: "80vh", overflow: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Importar como ingreso</div>
              <button onClick={() => setShowImportCert(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 14, background: C.surface2, borderRadius: 8, padding: 4 }}>
              {[["items", "Certificados de avance"], ["egresos", "Cert. de egresos"]].map(([id, label]) => (
                <button key={id} onClick={() => setImportCertTab(id)} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: importCertTab === id ? C.surface : "transparent", color: importCertTab === id ? C.text : C.muted }}>
                  {label}
                </button>
              ))}
            </div>
            <input style={{ ...inp, width: "100%", marginBottom: 12 }} placeholder="Filtrar por obra o número..." value={certFiltro} onChange={e => setCertFiltro(e.target.value)} />
            {loadingCerts ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Cargando...</div>
            ) : importCertTab === "items" ? (
              certFiltrados.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Sin certificados</div> :
              certFiltrados.map(c => (
                <div key={c.id} onClick={() => importarCert(c)} style={{ padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Cert. Nº {c.numero} — {c.obra}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.fecha} · Avance {parseFloat(c.avance_total_pct || 0).toFixed(1)}%</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(c.total_periodo)}</div>
                </div>
              ))
            ) : (
              certEgresosFiltrados.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Sin certificados de egresos</div> :
              certEgresosFiltrados.map(c => (
                <div key={c.id} onClick={() => importarCertEgresos(c)} style={{ padding: "11px 14px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.certificado_num ? `Cert. Nº ${c.certificado_num}` : "Sin cert."} — {c.obra || "Sin obra"}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.fecha}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(c.total)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── MODAL IMPORTAR DESDE OBRA ── */}
      {showImportarObra && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, border: "1px solid #e0e0e8", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>Importar movimientos desde obra</div>
              <button onClick={() => setShowImportarObra(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>×</button>
            </div>

            {loadingObra ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>Cargando...</div>
            ) : (
              <>
                {/* Cobros */}
                {obraPendientes.cobros?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Cobros de clientes</div>
                    {obraPendientes.cobros.map(cb => {
                      const sel = obraSeleccionados.some(i => i.tipo === "cobro" && i.id === cb.id);
                      return (
                        <div key={cb.id} onClick={() => toggleSeleccionObra("cobro", cb.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#059669" : "#e0e0e8"}`, background: sel ? "#f0fdf4" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{cb.nombre_obra || "Sin obra"}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{cb.fecha} · {cb.forma_pago} {cb.referencia ? `· ${cb.referencia}` : ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#059669", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(cb.monto || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagos subcontrato */}
                {obraPendientes.pagos_subcontrato?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Pagos a subcontratistas</div>
                    {obraPendientes.pagos_subcontrato.map(ps => {
                      const sel = obraSeleccionados.some(i => i.tipo === "pago_sub" && i.id === ps.id);
                      return (
                        <div key={ps.id} onClick={() => toggleSeleccionObra("pago_sub", ps.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#d97706" : "#e0e0e8"}`, background: sel ? "#fffbeb" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{ps.nombre_contratista}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{ps.fecha} · {ps.concepto} · {ps.nombre_obra || ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#d97706", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(ps.monto || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compras */}
                {obraPendientes.compras?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Compras de materiales</div>
                    {obraPendientes.compras.map(cm => {
                      const sel = obraSeleccionados.some(i => i.tipo === "compra" && i.id === cm.id);
                      return (
                        <div key={cm.id} onClick={() => toggleSeleccionObra("compra", cm.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#7c3aed" : "#e0e0e8"}`, background: sel ? "#f5f3ff" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{cm.proveedor_nombre}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{cm.fecha_pedido} · {cm.nombre_obra || ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#7c3aed", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(cm.monto_pagado || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {obraPendientes.cobros?.length === 0 && obraPendientes.pagos_subcontrato?.length === 0 && obraPendientes.compras?.length === 0 && (
                  <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                    No hay movimientos pendientes de importar
                  </div>
                )}

                {obraSeleccionados.length > 0 && (
                  <button onClick={importarDesdeObra} style={{ width: "100%", padding: 12, background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                    Importar {obraSeleccionados.length} movimiento{obraSeleccionados.length !== 1 ? "s" : ""} al CF
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999, pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
