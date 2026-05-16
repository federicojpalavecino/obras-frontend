"""
write_cf_nuevo.py
Reescribe ControlFinanciero.jsx con:
- Periodos: semana / quincena / mes (una sola entrada por periodo)
- Sin alimentacion
- Colchon -> Reserva
- Egresos vinculados automaticamente a cert-egresos
- Imprimir periodo con datos del tenant
- Resumen filtrable por obra/proyecto
- Proporciones mejoradas
"""

content = r'''import { useState, useEffect, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";
const getToken = () => localStorage.getItem("obras_token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

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

function calcPeriod(week, cfg) {
  const totalIng = (week.ingresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalEg = (week.egresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalPersonal = (week.personal || []).reduce((a, b) => a + (parseFloat(b.total) || 0), 0);
  const resultado = totalIng - totalEg - totalPersonal;
  const honorarios = (week.config?.honorarios || cfg?.honorarios || []).filter(h => h.activo);
  const pctReserva = parseFloat(week.config?.pctReserva ?? cfg?.pctReserva ?? 10);
  const reserva = resultado > 0 ? resultado * pctReserva / 100 : 0;
  const totalHonorarios = honorarios.reduce((s, h) => s + calcHonorario(resultado, h), 0);
  const ganancia = resultado - totalHonorarios - reserva;
  return { totalIng, totalEg, totalPersonal, resultado, reserva, totalHonorarios, honorarios, ganancia };
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
    fetch(`${API}/clientes`, { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then(d => { const clientes = Array.isArray(d) ? d : (d.clientes || []); setObras(clientes.map(c => c.nombre).sort()); })
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
      const res = await fetch(`${API}/cf/semanas`, { headers: authH() });
      if (!res.ok) return;
      const data = await res.json();
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
      fetch(`${API}/certificados/todos`, { headers: authH() }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/cf/cert-egresos/todos`, { headers: authH() }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);
    setCertDisponibles(Array.isArray(r1) ? r1 : []);
    setCertEgresosDisponibles(Array.isArray(r2) ? r2 : []);
    setLoadingCerts(false);
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
  const addIngreso = () => setWeek(w => { const nw = { ...w, ingresos: [...w.ingresos, { concepto: "", monto: "", estado: "PENDIENTE", obra: "", cliente: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updIngreso = (i, f, v) => setWeek(w => { const a = [...w.ingresos]; a[i] = { ...a[i], [f]: v }; const nw = { ...w, ingresos: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delIngreso = (i) => { const nw = { ...week, ingresos: week.ingresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  const addEgreso = () => setWeek(w => { const nw = { ...w, egresos: [...w.egresos, { concepto: "", monto: "", estado: "PENDIENTE", obra: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updEgreso = (i, f, v) => setWeek(w => { const a = [...w.egresos]; a[i] = { ...a[i], [f]: v }; const nw = { ...w, egresos: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delEgreso = (i) => { const nw = { ...week, egresos: week.egresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  const addPersonal = () => setWeek(w => { const nw = { ...w, personal: [...w.personal, { nombre: "", rango: "", dias: 5, hs: 8, costo: 0, total: 0, obra: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updPersonal = (i, f, v) => setWeek(w => { const a = [...w.personal]; a[i] = { ...a[i], [f]: v }; a[i].total = (parseFloat(a[i].dias) || 0) * (parseFloat(a[i].hs) || 0) * (parseFloat(a[i].costo) || 0); const nw = { ...w, personal: a }; clearTimeout(window._cfT); window._cfT = setTimeout(() => autoGuardar(nw), 900); return nw; });
  const delPersonal = (i) => setWeek(w => { const nw = { ...w, personal: w.personal.filter((_, j) => j !== i) }; setTimeout(() => autoGuardar(nw), 300); return nw; });

  const addHerramienta = () => setWeek(w => ({ ...w, herramientas: [...w.herramientas, { nombre: "", cantidad: 1, obra: "", fechaIn: "", fechaEx: "" }] }));
  const updHerramienta = (i, f, v) => setWeek(w => { const a = [...w.herramientas]; a[i] = { ...a[i], [f]: v }; return { ...w, herramientas: a }; });
  const delHerramienta = (i) => setWeek(w => ({ ...w, herramientas: w.herramientas.filter((_, j) => j !== i) }));

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
        await fetch(`${API}/cf/semanas/${editingIdRef.current}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
      } else {
        const existing = semanas.find(s => s.fecha === weekData.fecha || s.fecha_inicio === (weekData.fecha_inicio || weekData.fecha));
        if (existing) {
          await fetch(`${API}/cf/semanas/${existing.id}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
          setEditingIdSynced(existing.id);
        } else {
          const res = await fetch(`${API}/cf/semanas`, { method: "POST", headers: authH(), body: JSON.stringify(payload) });
          if (res.ok) { const d = await res.json(); setEditingIdSynced(d.id); }
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
      if (editingId) await fetch(`${API}/cf/semanas/${editingId}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
      else { const res = await fetch(`${API}/cf/semanas`, { method: "POST", headers: authH(), body: JSON.stringify(payload) }); if (!res.ok) { showToast("Error al guardar"); setLoading(false); return; } }
      showToast("✓ Guardado"); setEditingIdSynced(null); setWeek(emptyPeriod(tipoPeriodo)); loadPeriods();
    } catch { showToast("Error de conexión"); }
    setLoading(false);
  };

  const editPeriod = (s) => { setWeek({ ...s }); setEditingIdSynced(s.id); setTab("carga"); };

  const eliminarPeriod = async (id) => {
    if (!window.confirm("¿Eliminar este período?")) return;
    await fetch(`${API}/cf/semanas/${id}`, { method: "DELETE", headers: authH() });
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
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", overflowX: "auto", position: "sticky", top: 0, zIndex: 50 }}>
        <TabBtn id="carga" label={`📋 ${TIPO_LABELS[tipoPeriodo]}`} />
        <TabBtn id="historial" label="📅 Historial" />
        <TabBtn id="resumen" label="📊 Resumen" />
        <TabBtn id="config" label="⚙️ Config" />

        {/* Tipo de período */}
        <div style={{ marginLeft: 12, display: "flex", gap: 2, background: C.surface2, borderRadius: 7, padding: 3 }}>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => cambiarTipo(k)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: tipoPeriodo === k ? C.accent : "transparent", color: tipoPeriodo === k ? "#fff" : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{v}</button>
          ))}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 12, gap: 6 }}>
          <button onClick={abrirImportCert} style={{ padding: "5px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit", color: C.text, whiteSpace: "nowrap" }}>
            📄 Importar cert.
          </button>
          {editingId && (
            <button onClick={nuevoPeriodo} style={{ padding: "5px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
              + Nuevo
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 16px 60px" }}>

        {/* ── TAB CARGA ── */}
        {tab === "carga" && (
          <>
            {/* Header período */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flex: 1, minWidth: 260 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{TIPO_LABELS[tipoPeriodo]}</div>
                  <input type="date" value={week.fecha_inicio || week.fecha} onChange={e => setWeek(w => ({ ...w, fecha_inicio: e.target.value, fecha: e.target.value }))} style={{ ...inp, flex: 1 }} />
                  <span style={{ color: C.muted }}>→</span>
                  <input type="date" value={week.fecha_fin || week.fecha_inicio || week.fecha} onChange={e => setWeek(w => ({ ...w, fecha_fin: e.target.value }))} style={{ ...inp, flex: 1 }} />
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[["Ingresos", calc.totalIng, C.green], ["Egresos", calc.totalEg + calc.totalPersonal, C.red], ["Resultado", calc.resultado, calc.resultado >= 0 ? C.accent : C.red], ["Ganancia", calc.ganancia, calc.ganancia >= 0 ? C.green : C.red]].map(([label, val, color]) => (
                    <div key={label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Ingresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <SectionHeader label="💰 Ingresos" total={calc.totalIng} onAdd={addIngreso} />
              {week.ingresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin ingresos — tocá Agregar</div>}
              {week.ingresos.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 130px 120px 1fr auto", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input style={inp} placeholder="Concepto" value={row.concepto || ""} onChange={e => updIngreso(i, "concepto", e.target.value)} />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="Monto" value={row.monto || ""} onChange={e => updIngreso(i, "monto", e.target.value)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={e => updIngreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "COBRADO", "EN PROCESO"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select style={inp} value={row.obra || ""} onChange={e => updIngreso(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button onClick={() => delIngreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            {/* Egresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <SectionHeader label="💸 Egresos" total={calc.totalEg} onAdd={addEgreso} />
              {week.egresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin egresos</div>}
              {week.egresos.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2.5fr 130px 120px 1fr auto", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input style={inp} placeholder="Concepto" value={row.concepto || ""} onChange={e => updEgreso(i, "concepto", e.target.value)} />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="Monto" value={row.monto || ""} onChange={e => updEgreso(i, "monto", e.target.value)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={e => updEgreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "PAGADO"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select style={inp} value={row.obra || ""} onChange={e => updEgreso(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <button onClick={() => delEgreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
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
              <SectionHeader label="👷 Personal" total={calc.totalPersonal} onAdd={addPersonal} />
              {week.personal.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin personal</div>}
              {week.personal.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 60px 60px 120px 100px auto", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input style={inp} placeholder="Nombre" value={row.nombre || ""} onChange={e => updPersonal(i, "nombre", e.target.value)} />
                  <input style={inp} placeholder="Rango/Rol" value={row.rango || ""} onChange={e => updPersonal(i, "rango", e.target.value)} />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Días" value={row.dias || ""} onChange={e => updPersonal(i, "dias", e.target.value)} title="Días trabajados" />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Hs" value={row.hs || ""} onChange={e => updPersonal(i, "hs", e.target.value)} title="Horas por día" />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="$/hs" value={row.costo || ""} onChange={e => updPersonal(i, "costo", e.target.value)} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right", paddingRight: 4 }}>{fmt(row.total || 0)}</div>
                  <button onClick={() => delPersonal(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>

            {/* Herramientas */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
              <SectionHeader label="🔧 Herramientas / Equipos" onAdd={addHerramienta} />
              {week.herramientas.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "10px 0" }}>Sin herramientas</div>}
              {week.herramientas.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 0.6fr 1.2fr 110px 110px auto", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <select style={inp} value={row.nombre || ""} onChange={e => updHerramienta(i, "nombre", e.target.value)}>
                    <option value="">— Herramienta —</option>
                    {HERRAM_LIST.map(h => <option key={h}>{h}</option>)}
                  </select>
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Cant." value={row.cantidad || 1} onChange={e => updHerramienta(i, "cantidad", e.target.value)} />
                  <select style={inp} value={row.obra || ""} onChange={e => updHerramienta(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map(o => <option key={o}>{o}</option>)}
                  </select>
                  <input type="date" style={inp} value={row.fechaIn || ""} onChange={e => updHerramienta(i, "fechaIn", e.target.value)} title="Fecha entrada" />
                  <input type="date" style={inp} value={row.fechaEx || ""} onChange={e => updHerramienta(i, "fechaEx", e.target.value)} title="Fecha salida" />
                  <button onClick={() => delHerramienta(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                </div>
              ))}
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
              <button onClick={() => imprimirPeriodo(week, calc, tipoPeriodo, tenant)} style={{ padding: "12px 20px", background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                🖨️ Imprimir
              </button>
              <button onClick={guardar} disabled={loading} style={{ flex: 1, padding: "12px", background: loading ? C.border : C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {loading ? "Guardando..." : editingId ? "💾 Actualizar" : "💾 Guardar período"}
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
                      <button onClick={() => imprimirPeriodo(s, c, tipoPeriodo, tenant)} style={{ padding: "5px 10px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🖨️</button>
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

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999, pointerEvents: "none" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
'''

with open(r'C:\obras-frontend\src\pages\ControlFinanciero.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to ControlFinanciero.jsx")
