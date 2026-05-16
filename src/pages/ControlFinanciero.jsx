import { useState, useEffect, useRef } from "react";

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

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}
function getFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -2 : 5 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function emptyWeek() {
  return {
    fecha: getMonday(),
    fecha_inicio: getMonday(),
    fecha_fin: getFriday(),
    ingresos: [],
    egresos: [],
    personal: [],
    herramientas: [],
    alimentacion_dias: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 },
    config: { honorarios: [], pctColchon: 10 },
  };
}

function calcHonorario(resultado, hon) {
  if (!hon || !hon.activo) return 0;
  if (hon.modo === "monto") return parseFloat(hon.monto) || 0;
  const pct = parseFloat(hon.pct) || 0;
  return resultado > 0 ? (resultado * pct) / 100 : 0;
}

function calcWeek(week) {
  const totalIng = (week.ingresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalEg = (week.egresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalPersonal = (week.personal || []).reduce((a, b) => a + (parseFloat(b.total) || 0), 0);
  const alim = Object.values(week.alimentacion_dias || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const resultado = totalIng - totalEg - totalPersonal - alim;
  const honorarios = (week.config?.honorarios || []).filter((h) => h.activo);
  const pctColchon = parseFloat(week.config?.pctColchon) || 0;
  const colchon = resultado > 0 ? (resultado * pctColchon) / 100 : 0;
  const totalHonorarios = honorarios.reduce((sum, h) => sum + calcHonorario(resultado, h), 0);
  const ganancia = resultado - totalHonorarios - colchon;
  return { totalIng, totalEg, totalPersonal, alimentacion: alim, resultado, colchon, totalHonorarios, honorarios, ganancia };
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

const DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes"];
const HERRAM_DEFAULT = ["Andamios", "Hormigonera", "Taladro", "Laser", "Escalera", "Pala", "Atornillador", "Alargue"];

// ── Componente principal ──────────────────────────────────────────────────────
export default function ControlFinanciero({ user }) {
  const [tab, setTab] = useState("carga");
  const [semanas, setSemanas] = useState([]);
  const [week, setWeek] = useState(emptyWeek());
  const [editingId, setEditingId] = useState(null);
  const editingIdRef = useRef(null);
  const setEditingIdSynced = (id) => { editingIdRef.current = id; setEditingId(id); };
  const [config, setConfig] = useState({ honorarios: [{ nombre: "Honorario 1", pct: 15, monto: 0, modo: "pct", activo: true }, { nombre: "Honorario 2", pct: 15, monto: 0, modo: "pct", activo: true }], pctColchon: 10 });
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [obras, setObras] = useState([]);
  const [showImportCert, setShowImportCert] = useState(false);
  const [importCertTab, setImportCertTab] = useState("items");
  const [certDisponibles, setCertDisponibles] = useState([]);
  const [certEgresosDisponibles, setCertEgresosDisponibles] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [certFiltro, setCertFiltro] = useState("");

  const weekLabel = (w) => {
    if (!w) return "";
    const di = new Date((w.fecha_inicio || w.fecha || "") + "T12:00:00");
    const df = new Date((w.fecha_fin || w.fecha_inicio || w.fecha || "") + "T12:00:00");
    if (di.toDateString() === df.toDateString()) return di.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    return di.toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) + " – " + df.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  // ── Cargar obras desde clientes ──────────────────────────────────────────
  useEffect(() => {
    const cargarObras = async () => {
      try {
        const res = await fetch(`${API}/clientes`, { headers: authH() });
        if (res.ok) {
          const data = await res.json();
          const clientes = Array.isArray(data) ? data : (data.clientes || []);
          setObras(clientes.map((c) => c.nombre).sort());
        }
      } catch (e) {}
    };
    const savedCfg = localStorage.getItem("obras-cf-config");
    if (savedCfg) { try { setConfig(JSON.parse(savedCfg)); } catch {} }
    cargarObras();
    loadSemanas(true);
  }, []);

  const saveConfig = (cfg) => {
    setConfig(cfg);
    localStorage.setItem("obras-cf-config", JSON.stringify(cfg));
  };

  // ── Load semanas from /cf/semanas ────────────────────────────────────────
  const loadSemanas = async (loadCurrent = false) => {
    try {
      const res = await fetch(`${API}/cf/semanas`, { headers: authH() });
      if (!res.ok) return;
      const data = await res.json();
      // Parse JSON strings from backend
      const parsed = data.map((s) => ({
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
        const monday = getMonday();
        const friday = getFriday();
        let current = parsed.find((s) => (s.fecha_inicio === monday || s.fecha === monday) && !s.cerrado);
        if (!current) current = parsed.find((s) => !s.cerrado && (s.fecha_inicio || s.fecha || "") >= monday && (s.fecha_inicio || s.fecha || "") <= friday);
        if (!current) { const unclosed = parsed.filter((s) => !s.cerrado); if (unclosed.length > 0) current = unclosed[unclosed.length - 1]; }
        if (current) {
          setWeek({ fecha: current.fecha || monday, fecha_inicio: current.fecha_inicio || current.fecha || monday, fecha_fin: current.fecha_fin || friday, ingresos: current.ingresos || [], egresos: current.egresos || [], personal: current.personal || [], herramientas: current.herramientas || [], alimentacion_dias: current.alimentacion_dias || { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 }, config: current.config || config });
          setEditingIdSynced(current.id);
        }
      }
    } catch (e) { console.error("loadSemanas error:", e); }
  };

  const configParaCalc = { ...(config || {}), ...(week.config || {}), honorarios: week.config?.honorarios?.length ? week.config.honorarios : (config.honorarios || []), pctColchon: week.config?.pctColchon ?? config.pctColchon ?? 10 };
  const calc = calcWeek({ ...week, config: configParaCalc });

  // ── Importar certificado ──────────────────────────────────────────────────
  const abrirImportCert = async () => {
    setCertFiltro(""); setLoadingCerts(true); setShowImportCert(true); setImportCertTab("items");
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/certificados/todos`, { headers: authH() }),
        fetch(`${API}/cf/cert-egresos/todos`, { headers: authH() }),
      ]);
      setCertDisponibles(r1.ok ? await r1.json() : []);
      setCertEgresosDisponibles(r2.ok ? await r2.json() : []);
    } catch { setCertDisponibles([]); setCertEgresosDisponibles([]); }
    setLoadingCerts(false);
  };

  const importarCert = (cert) => {
    const newW = { ...week, ingresos: [...week.ingresos, { concepto: "Certificado Nº " + cert.numero + " — " + (cert.obra || ""), monto: String(Math.round(cert.total_periodo || 0)), estado: "PENDIENTE", cliente: cert.cliente || "" }] };
    setWeek(newW); setTimeout(() => autoGuardar(newW), 300); setShowImportCert(false);
  };

  const importarCertEgresos = (ce) => {
    const label = ce.certificado_num ? " — Cert. Nº " + ce.certificado_num : "";
    const newW = { ...week, ingresos: [...week.ingresos, { concepto: "Egresos certificados" + label + " — " + (ce.obra || ""), monto: String(Math.round(ce.total || 0)), estado: "PENDIENTE", cliente: ce.obra || "" }] };
    setWeek(newW); setTimeout(() => autoGuardar(newW), 300); setShowImportCert(false);
  };

  // ── CRUD items ────────────────────────────────────────────────────────────
  const addIngreso = () => setWeek((w) => { const nw = { ...w, ingresos: [...w.ingresos, { concepto: "", monto: "", estado: "PENDIENTE", cliente: "", obra: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updIngreso = (i, f, v) => setWeek((w) => { const arr = [...w.ingresos]; arr[i] = { ...arr[i], [f]: v }; const nw = { ...w, ingresos: arr }; clearTimeout(window._cfTimer); window._cfTimer = setTimeout(() => autoGuardar(nw), 1000); return nw; });
  const delIngreso = (i) => { const nw = { ...week, ingresos: week.ingresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  const addEgreso = () => setWeek((w) => { const nw = { ...w, egresos: [...w.egresos, { concepto: "", monto: "", estado: "PENDIENTE", obra: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updEgreso = (i, f, v) => setWeek((w) => { const arr = [...w.egresos]; arr[i] = { ...arr[i], [f]: v }; const nw = { ...w, egresos: arr }; clearTimeout(window._cfTimer); window._cfTimer = setTimeout(() => autoGuardar(nw), 1000); return nw; });
  const delEgreso = (i) => { const nw = { ...week, egresos: week.egresos.filter((_, j) => j !== i) }; setWeek(nw); setTimeout(() => autoGuardar(nw), 300); };

  const addPersonal = () => setWeek((w) => { const nw = { ...w, personal: [...w.personal, { nombre: "", rango: "", dias: 5, hs: 8, costo: 0, total: 0, obra: "" }] }; setTimeout(() => autoGuardar(nw), 300); return nw; });
  const updPersonal = (i, f, v) => setWeek((w) => { const arr = [...w.personal]; arr[i] = { ...arr[i], [f]: v }; arr[i].total = (parseFloat(arr[i].dias) || 0) * (parseFloat(arr[i].hs) || 0) * (parseFloat(arr[i].costo) || 0); const nw = { ...w, personal: arr }; clearTimeout(window._cfTimer); window._cfTimer = setTimeout(() => autoGuardar(nw), 1000); return nw; });
  const delPersonal = (i) => setWeek((w) => { const nw = { ...w, personal: w.personal.filter((_, j) => j !== i) }; setTimeout(() => autoGuardar(nw), 300); return nw; });

  const addHerramienta = () => setWeek((w) => ({ ...w, herramientas: [...w.herramientas, { nombre: "", cantidad: 1, obra: "", propietario: "", fechaIn: "", fechaEx: "" }] }));
  const updHerramienta = (i, f, v) => setWeek((w) => { const arr = [...w.herramientas]; arr[i] = { ...arr[i], [f]: v }; return { ...w, herramientas: arr }; });
  const delHerramienta = (i) => setWeek((w) => ({ ...w, herramientas: w.herramientas.filter((_, j) => j !== i) }));

  // ── autoGuardar ───────────────────────────────────────────────────────────
  const autoGuardar = async (weekData) => {
    const c = calcWeek({ ...weekData, config: { ...(config || {}), ...(weekData.config || {}), honorarios: weekData.config?.honorarios?.length ? weekData.config.honorarios : (config.honorarios || []), pctColchon: weekData.config?.pctColchon ?? config.pctColchon ?? 10 } });
    const payload = {
      fecha: weekData.fecha, fecha_inicio: weekData.fecha_inicio || weekData.fecha, fecha_fin: weekData.fecha_fin || weekData.fecha,
      ingresos: weekData.ingresos, egresos: weekData.egresos, personal: weekData.personal, herramientas: weekData.herramientas,
      alimentacion_dias: weekData.alimentacion_dias,
      config: { ...(config || {}), ...(weekData.config || {}), honorarios: weekData.config?.honorarios?.length ? weekData.config.honorarios : (config.honorarios || []), pctColchon: weekData.config?.pctColchon ?? config.pctColchon ?? 10 },
      totalIng: c.totalIng, totalEg: c.totalEg, totalPersonal: c.totalPersonal, resultado: c.resultado, ganancia: c.ganancia, cerrado: false,
    };
    try {
      if (editingIdRef.current) {
        await fetch(`${API}/cf/semanas/${editingIdRef.current}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
      } else {
        // Check if exists
        const semana = semanas.find((s) => s.fecha === weekData.fecha || s.fecha_inicio === (weekData.fecha_inicio || weekData.fecha));
        if (semana) {
          await fetch(`${API}/cf/semanas/${semana.id}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
          setEditingIdSynced(semana.id);
        } else {
          const res = await fetch(`${API}/cf/semanas`, { method: "POST", headers: authH(), body: JSON.stringify(payload) });
          if (res.ok) { const d = await res.json(); setEditingIdSynced(d.id); }
        }
      }
      loadSemanas();
    } catch (e) { console.error("autoGuardar error:", e); }
  };

  const guardar = async () => {
    setLoading(true);
    const c = calcWeek({ ...week, config: week.config || config });
    const payload = {
      fecha: week.fecha, fecha_inicio: week.fecha_inicio || week.fecha, fecha_fin: week.fecha_fin || week.fecha,
      ingresos: week.ingresos, egresos: week.egresos, personal: week.personal, herramientas: week.herramientas,
      alimentacion_dias: week.alimentacion_dias, config: week.config || config,
      totalIng: c.totalIng, totalEg: c.totalEg, totalPersonal: c.totalPersonal, resultado: c.resultado, ganancia: c.ganancia, cerrado: false,
    };
    try {
      if (editingId) {
        const res = await fetch(`${API}/cf/semanas/${editingId}`, { method: "PUT", headers: authH(), body: JSON.stringify(payload) });
        if (!res.ok) { showToast("Error al guardar"); setLoading(false); return; }
      } else {
        const res = await fetch(`${API}/cf/semanas`, { method: "POST", headers: authH(), body: JSON.stringify(payload) });
        if (!res.ok) { showToast("Error al guardar"); setLoading(false); return; }
      }
      showToast("✓ Semana guardada");
      setEditingIdSynced(null);
      setWeek(emptyWeek());
      loadSemanas();
    } catch { showToast("Error de conexión"); }
    setLoading(false);
  };

  const editSemana = (s) => {
    setWeek({ fecha: s.fecha, fecha_inicio: s.fecha_inicio || s.fecha, fecha_fin: s.fecha_fin || s.fecha, ingresos: s.ingresos || [], egresos: s.egresos || [], personal: s.personal || [], herramientas: s.herramientas || [], alimentacion_dias: s.alimentacion_dias || { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 }, config: s.config || config });
    setEditingIdSynced(s.id);
    setTab("carga");
  };

  const eliminarSemana = async (id) => {
    if (!window.confirm("¿Eliminar esta semana?")) return;
    await fetch(`${API}/cf/semanas/${id}`, { method: "DELETE", headers: authH() });
    if (editingId === id) { setEditingIdSynced(null); setWeek(emptyWeek()); }
    loadSemanas();
  };

  const nuevaSemana = () => { setEditingIdSynced(null); setWeek(emptyWeek()); setTab("carga"); };

  // ── Render helpers ────────────────────────────────────────────────────────
  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, fontWeight: tab === id ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
      {label}
    </button>
  );

  const SectionHeader = ({ label, onAdd }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: C.muted }}>{label}</div>
      {onAdd && <button onClick={onAdd} style={{ padding: "4px 12px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Agregar</button>}
    </div>
  );

  const estadoBadge = (estado) => {
    const colors = { COBRADO: { bg: "#f0fdf4", color: C.accent }, PENDIENTE: { bg: "#fffbeb", color: C.warn }, "EN PROCESO": { bg: "#eff6ff", color: C.blue }, PAGADO: { bg: "#f0fdf4", color: C.accent } };
    const s = colors[estado] || { bg: C.surface2, color: C.muted };
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: s.bg, color: s.color }}>{estado}</span>;
  };

  const resumen = semanas.length > 0 ? semanas.reduce((acc, s) => {
    const c = calcWeek(s);
    return { totalIng: acc.totalIng + c.totalIng, totalEg: acc.totalEg + c.totalEg, totalPersonal: acc.totalPersonal + c.totalPersonal, ganancia: acc.ganancia + c.ganancia };
  }, { totalIng: 0, totalEg: 0, totalPersonal: 0, ganancia: 0 }) : null;

  const certFiltrados = certDisponibles.filter((c) => !certFiltro || (c.obra || "").toLowerCase().includes(certFiltro.toLowerCase()) || String(c.numero).includes(certFiltro));
  const certEgresosFiltrados = certEgresosDisponibles.filter((c) => !certFiltro || (c.obra || "").toLowerCase().includes(certFiltro.toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif" }}>
      {/* TABS */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", overflowX: "auto", position: "sticky", top: 0, zIndex: 50 }}>
        <TabBtn id="carga" label="📋 Semana actual" />
        <TabBtn id="historial" label="📅 Historial" />
        <TabBtn id="resumen" label="📊 Resumen" />
        <TabBtn id="config" label="⚙️ Config" />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 12, gap: 8 }}>
          <button onClick={abrirImportCert} style={{ padding: "6px 14px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: C.text }}>
            📄 Importar certificado
          </button>
          {editingId ? (
            <button onClick={nuevaSemana} style={{ padding: "6px 14px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              + Nueva semana
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 60px" }}>

        {/* ── TAB CARGA ── */}
        {tab === "carga" && (
          <>
            {/* Header semana */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Semana</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" value={week.fecha_inicio || week.fecha} onChange={(e) => setWeek((w) => ({ ...w, fecha_inicio: e.target.value, fecha: e.target.value }))} style={{ ...inp, width: "auto" }} />
                  <span style={{ color: C.muted, alignSelf: "center" }}>→</span>
                  <input type="date" value={week.fecha_fin || week.fecha_inicio || week.fecha} onChange={(e) => setWeek((w) => ({ ...w, fecha_fin: e.target.value }))} style={{ ...inp, width: "auto" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {[["Ingresos", calc.totalIng, C.green], ["Egresos", calc.totalEg + calc.totalPersonal + calc.alimentacion, C.red], ["Resultado", calc.resultado, calc.resultado >= 0 ? C.accent : C.red], ["Ganancia", calc.ganancia, calc.ganancia >= 0 ? C.accent : C.red]].map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ingresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <SectionHeader label={`💰 Ingresos (${fmt(calc.totalIng)})`} onAdd={addIngreso} />
              {week.ingresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>Sin ingresos — agregá uno</div>}
              {week.ingresos.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={inp} placeholder="Concepto" value={row.concepto || ""} onChange={(e) => updIngreso(i, "concepto", e.target.value)} />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="Monto" value={row.monto || ""} onChange={(e) => updIngreso(i, "monto", e.target.value)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={(e) => updIngreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "COBRADO", "EN PROCESO"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select style={inp} value={row.obra || ""} onChange={(e) => updIngreso(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button onClick={() => delIngreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>×</button>
                </div>
              ))}
            </div>

            {/* Egresos */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <SectionHeader label={`💸 Egresos (${fmt(calc.totalEg)})`} onAdd={addEgreso} />
              {week.egresos.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>Sin egresos</div>}
              {week.egresos.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "3fr 1.5fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={inp} placeholder="Concepto" value={row.concepto || ""} onChange={(e) => updEgreso(i, "concepto", e.target.value)} />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="Monto" value={row.monto || ""} onChange={(e) => updEgreso(i, "monto", e.target.value)} />
                  <select style={inp} value={row.estado || "PENDIENTE"} onChange={(e) => updEgreso(i, "estado", e.target.value)}>
                    {["PENDIENTE", "PAGADO"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <select style={inp} value={row.obra || ""} onChange={(e) => updEgreso(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <button onClick={() => delEgreso(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>×</button>
                </div>
              ))}
            </div>

            {/* Personal */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <SectionHeader label={`👷 Personal (${fmt(calc.totalPersonal)})`} onAdd={addPersonal} />
              {week.personal.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>Sin personal esta semana</div>}
              {week.personal.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 0.8fr 0.8fr 1.5fr 1.2fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <input style={inp} placeholder="Nombre" value={row.nombre || ""} onChange={(e) => updPersonal(i, "nombre", e.target.value)} />
                  <input style={inp} placeholder="Rango/Rol" value={row.rango || ""} onChange={(e) => updPersonal(i, "rango", e.target.value)} />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Días" value={row.dias || ""} onChange={(e) => updPersonal(i, "dias", e.target.value)} title="Días trabajados" />
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Hs" value={row.hs || ""} onChange={(e) => updPersonal(i, "hs", e.target.value)} title="Horas por día" />
                  <input style={{ ...inp, fontFamily: "'IBM Plex Mono', monospace" }} type="number" placeholder="$/hs" value={row.costo || ""} onChange={(e) => updPersonal(i, "costo", e.target.value)} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace", textAlign: "right" }}>{fmt(row.total)}</div>
                  <button onClick={() => delPersonal(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>×</button>
                </div>
              ))}
            </div>

            {/* Alimentación */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <SectionHeader label={`🍱 Alimentación (${fmt(Object.values(week.alimentacion_dias || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0))})`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
                {DIAS.map((dia) => (
                  <div key={dia}>
                    <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "capitalize", textAlign: "center" }}>{dia.charAt(0).toUpperCase() + dia.slice(1)}</label>
                    <input style={{ ...inp, textAlign: "center", fontFamily: "'IBM Plex Mono', monospace" }} type="number" value={week.alimentacion_dias?.[dia] || 0} onChange={(e) => { const nw = { ...week, alimentacion_dias: { ...(week.alimentacion_dias || {}), [dia]: parseFloat(e.target.value) || 0 } }; setWeek(nw); clearTimeout(window._cfTimer); window._cfTimer = setTimeout(() => autoGuardar(nw), 1000); }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Herramientas */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <SectionHeader label="🔧 Herramientas / Equipos" onAdd={addHerramienta} />
              {week.herramientas.length === 0 && <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "12px 0" }}>Sin herramientas registradas</div>}
              {week.herramientas.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 0.8fr 1.5fr 1fr 1fr auto", gap: 6, marginBottom: 6, alignItems: "center" }}>
                  <select style={inp} value={row.nombre || ""} onChange={(e) => updHerramienta(i, "nombre", e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {HERRAM_DEFAULT.map((h) => <option key={h} value={h}>{h}</option>)}
                    <option value="Otro">Otro</option>
                  </select>
                  <input style={{ ...inp, textAlign: "center" }} type="number" placeholder="Cant." value={row.cantidad || 1} onChange={(e) => updHerramienta(i, "cantidad", e.target.value)} />
                  <select style={inp} value={row.obra || ""} onChange={(e) => updHerramienta(i, "obra", e.target.value)}>
                    <option value="">— Obra —</option>
                    {obras.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <input type="date" style={inp} value={row.fechaIn || ""} onChange={(e) => updHerramienta(i, "fechaIn", e.target.value)} title="Fecha entrada" />
                  <input type="date" style={inp} value={row.fechaEx || ""} onChange={(e) => updHerramienta(i, "fechaEx", e.target.value)} title="Fecha salida" />
                  <button onClick={() => delHerramienta(i)} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>×</button>
                </div>
              ))}
            </div>

            {/* Honorarios */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: C.muted, marginBottom: 12 }}>Honorarios y colchón</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                {(week.config?.honorarios || config.honorarios || []).map((hon, i) => (
                  <div key={i} style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <input style={{ ...inp, fontWeight: 700, flex: 1, marginRight: 6 }} value={hon.nombre || ""} onChange={(e) => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], nombre: e.target.value }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); }} />
                      <input type="checkbox" checked={hon.activo !== false} onChange={(e) => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], activo: e.target.checked }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 500); }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <select style={{ ...inp, flex: 1 }} value={hon.modo || "pct"} onChange={(e) => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], modo: e.target.value }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); }}>
                        <option value="pct">% resultado</option>
                        <option value="monto">Monto fijo</option>
                      </select>
                      <input style={{ ...inp, width: 80, fontFamily: "'IBM Plex Mono', monospace" }} type="number" value={hon.modo === "monto" ? (hon.monto || 0) : (hon.pct || 0)} onChange={(e) => { const hs = [...(week.config?.honorarios || config.honorarios || [])]; hs[i] = { ...hs[i], [hon.modo === "monto" ? "monto" : "pct"]: parseFloat(e.target.value) || 0 }; const nw = { ...week, config: { ...week.config, honorarios: hs } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 1000); }} />
                    </div>
                    <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginTop: 6, textAlign: "right", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {fmt(calcHonorario(calc.resultado, hon))}
                    </div>
                  </div>
                ))}
                <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Colchón</div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input style={{ ...inp, width: 70, fontFamily: "'IBM Plex Mono', monospace" }} type="number" value={week.config?.pctColchon ?? config.pctColchon ?? 10} onChange={(e) => { const nw = { ...week, config: { ...week.config, pctColchon: parseFloat(e.target.value) || 0 } }; setWeek(nw); setTimeout(() => autoGuardar(nw), 1000); }} />
                    <span style={{ fontSize: 12, color: C.muted }}>%</span>
                    <div style={{ marginLeft: "auto", fontSize: 12, color: C.accent, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(calc.colchon)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resultado final */}
            <div style={{ background: calc.ganancia >= 0 ? "#f0fdf4" : "#fef2f2", border: `1px solid ${calc.ganancia >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
                {[["Total ingresos", calc.totalIng, C.green], ["Egresos", calc.totalEg, C.red], ["Personal", calc.totalPersonal, C.red], ["Alimentación", calc.alimentacion, C.red], ["Resultado", calc.resultado, calc.resultado >= 0 ? C.accent : C.red], ["Honorarios", calc.totalHonorarios, C.muted], ["Colchón", calc.colchon, C.muted], ["Ganancia neta", calc.ganancia, calc.ganancia >= 0 ? C.green : C.red]].map(([label, val, color]) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(val)}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={guardar} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? C.border : C.accent, color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "'Syne', sans-serif" }}>
              {loading ? "Guardando..." : editingId ? "💾 Actualizar semana" : "💾 Guardar semana"}
            </button>
          </>
        )}

        {/* ── TAB HISTORIAL ── */}
        {tab === "historial" && (
          <div>
            <div style={{ marginBottom: 16, fontSize: 13, color: C.muted }}>{semanas.length} semanas registradas</div>
            {semanas.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>Sin historial todavía</div>}
            {[...semanas].reverse().map((s) => {
              const c = calcWeek(s);
              return (
                <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{weekLabel(s)}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{(s.ingresos || []).length} ingresos · {(s.egresos || []).length} egresos · {(s.personal || []).length} personas</div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Ingresos</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(c.totalIng)}</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase" }}>Ganancia</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c.ganancia >= 0 ? C.accent : C.red, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(c.ganancia)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => editSemana(s)} style={{ padding: "6px 14px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Editar</button>
                    <button onClick={() => eliminarSemana(s.id)} style={{ padding: "6px 10px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 7, fontSize: 12, cursor: "pointer", color: C.red, fontFamily: "inherit" }}>×</button>
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
                {[["Total ingresado", resumen.totalIng, C.green], ["Total egresado", resumen.totalEg, C.red], ["Total personal", resumen.totalPersonal, C.warn], ["Ganancia total", resumen.ganancia, resumen.ganancia >= 0 ? C.accent : C.red]].map(([label, val, color]) => (
                  <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtShort(val)}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>en {semanas.length} semanas</div>
                  </div>
                ))}
              </div>
            )}
            {semanas.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>Sin datos todavía</div>}
          </div>
        )}

        {/* ── TAB CONFIG ── */}
        {tab === "config" && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Honorarios por defecto</div>
            {(config.honorarios || []).map((hon, i) => (
              <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                <input style={{ ...inp, flex: 2 }} value={hon.nombre || ""} onChange={(e) => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], nombre: e.target.value }; saveConfig({ ...config, honorarios: hs }); }} />
                <select style={{ ...inp, flex: 1 }} value={hon.modo || "pct"} onChange={(e) => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], modo: e.target.value }; saveConfig({ ...config, honorarios: hs }); }}>
                  <option value="pct">% resultado</option>
                  <option value="monto">Monto fijo</option>
                </select>
                <input style={{ ...inp, width: 80 }} type="number" value={hon.modo === "monto" ? (hon.monto || 0) : (hon.pct || 0)} onChange={(e) => { const hs = [...config.honorarios]; hs[i] = { ...hs[i], [hon.modo === "monto" ? "monto" : "pct"]: parseFloat(e.target.value) || 0 }; saveConfig({ ...config, honorarios: hs }); }} />
                <button onClick={() => { const hs = config.honorarios.filter((_, j) => j !== i); saveConfig({ ...config, honorarios: hs }); }} style={{ padding: "5px 9px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer" }}>×</button>
              </div>
            ))}
            <button onClick={() => saveConfig({ ...config, honorarios: [...(config.honorarios || []), { nombre: "Honorario " + ((config.honorarios || []).length + 1), pct: 10, monto: 0, modo: "pct", activo: true }] })} style={{ padding: "7px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 20 }}>
              + Agregar honorario
            </button>
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
              <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 6 }}>% Colchón por defecto</label>
              <input style={{ ...inp, width: 100 }} type="number" value={config.pctColchon || 0} onChange={(e) => saveConfig({ ...config, pctColchon: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL IMPORTAR CERTIFICADO ── */}
      {showImportCert && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 600, maxHeight: "80vh", overflow: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Importar certificado como ingreso</div>
              <button onClick={() => setShowImportCert(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: C.surface2, borderRadius: 8, padding: 4 }}>
              {[["items", "Certificados de avance"], ["egresos", "Certificados de egresos"]].map(([id, label]) => (
                <button key={id} onClick={() => setImportCertTab(id)} style={{ flex: 1, padding: "7px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, background: importCertTab === id ? C.surface : "transparent", color: importCertTab === id ? C.text : C.muted }}>
                  {label}
                </button>
              ))}
            </div>
            <input style={{ ...inp, width: "100%", marginBottom: 12 }} placeholder="Filtrar por obra..." value={certFiltro} onChange={(e) => setCertFiltro(e.target.value)} />
            {loadingCerts ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Cargando...</div>
            ) : importCertTab === "items" ? (
              certFiltrados.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Sin certificados</div> : certFiltrados.map((c) => (
                <div key={c.id} onClick={() => importarCert(c)} style={{ padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Cert. Nº {c.numero} — {c.obra}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.fecha} · Avance {c.avance_total_pct?.toFixed(1)}%</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(c.total_periodo)}</div>
                </div>
              ))
            ) : (
              certEgresosFiltrados.length === 0 ? <div style={{ textAlign: "center", color: C.muted, padding: 32 }}>Sin certificados de egresos</div> : certEgresosFiltrados.map((c) => (
                <div key={c.id} onClick={() => importarCertEgresos(c)} style={{ padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = C.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = C.border}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.certificado_num ? "Cert. Nº " + c.certificado_num : "Sin cert."} — {c.obra || "Sin obra"}</div>
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
