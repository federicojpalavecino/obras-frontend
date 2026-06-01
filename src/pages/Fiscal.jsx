import { useState, useEffect, useCallback } from "react";
import { FileText, Package, BarChart2, User } from "lucide-react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";
const getToken = () => localStorage.getItem("obras_token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5", surface3: "#e9ecef",
  border: "#e0e0e8", border2: "#d0d0dc",
  text: "#1a1a2e", muted: "#6b7280", muted2: "#9ca3af",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6",
};

// ── Constantes fiscales ───────────────────────────────────────────────────────
const CATEGORIAS_MONO = {
  A: { limite: 2109574, cuota: 5280 }, B: { limite: 3132626, cuota: 6160 },
  C: { limite: 4387264, cuota: 7260 }, D: { limite: 5442418, cuota: 8800 },
  E: { limite: 6440381, cuota: 11000 }, F: { limite: 8053988, cuota: 13420 },
  G: { limite: 10067485, cuota: 17600 }, H: { limite: 13397490, cuota: 26070 },
  I: { limite: 16079988, cuota: 34980 }, J: { limite: 19294985, cuota: 47080 },
  K: { limite: 22641940, cuota: 61820 },
};
const CONDICION_LABEL = { monotributo: "Monotributista", responsable_inscripto: "Responsable Inscripto", exento: "Exento" };
const TIPOS_FACTURA = ["A", "B", "C", "M", "E"];
const IVA_ALICUOTAS = [0, 10.5, 21, 27];

const fmt = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const fmtM = (n) => { const v = Math.abs(Math.round(n || 0)); if (v >= 1000000) return (n < 0 ? "-" : "") + "$" + (v / 1000000).toFixed(2) + "M"; if (v >= 1000) return (n < 0 ? "-" : "") + "$" + (v / 1000).toFixed(0) + "k"; return fmt(n); };
const today = () => new Date().toISOString().split("T")[0];
const fmtFecha = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const inp = { background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" };

function Btn({ primary, danger, small, onClick, disabled, children, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? "5px 10px" : "8px 16px", borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: primary ? 600 : 500, cursor: disabled ? "not-allowed" : "pointer", border: `1px solid ${danger ? "rgba(248,113,113,.3)" : primary ? C.accent : C.border2}`, background: primary ? C.accent : danger ? "rgba(248,113,113,.08)" : "transparent", color: primary ? "#fff" : danger ? C.red : C.text, fontFamily: "inherit", opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
}

function Badge({ color, children }) {
  const bg = color === "green" ? "#f0fdf4" : color === "red" ? "#fef2f2" : C.surface2;
  const cl = color === "green" ? C.accent : color === "red" ? C.red : C.muted;
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: bg, color: cl, border: `1px solid ${cl}33` }}>{children}</span>;
}

function Semaforo({ pct }) {
  const color = pct >= 90 ? C.red : pct >= 70 ? C.warn : C.green;
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: C.muted }}>Uso del límite</span>
        <span style={{ color, fontWeight: 700 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: C.surface3, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: Math.min(100, pct) + "%", background: color, borderRadius: 3, transition: "width 0.4s" }} />
      </div>
    </div>
  );
}

function ModalFactura({ configs, onSave, onClose, prefill }) {
  const [form, setForm] = useState({ tipo: "C", numero: "", fecha: today(), emisor_email: configs[0]?.usuario_email || "", cliente_nombre: "", cliente_cuit: "", concepto: "", monto: "", iva_pct: 0, iva_monto: 0, monto_total: "", estado: "emitida", ...prefill });
  const calcIva = (monto, pct) => Math.round((parseFloat(monto) || 0) * (parseFloat(pct) || 0) / 100);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.border2}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Nueva factura</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Tipo</label>
            <select style={inp} value={form.tipo || "C"} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}>
              {TIPOS_FACTURA.map((t) => <option key={t}>{t}</option>)}
            </select></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>N° factura</label>
            <input style={inp} value={form.numero || ""} onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))} placeholder="0001-00001234" /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Fecha</label>
            <input type="date" style={inp} value={form.fecha || today()} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Emisor</label>
            <select style={inp} value={form.emisor_email || ""} onChange={(e) => setForm((f) => ({ ...f, emisor_email: e.target.value }))}>
              <option value="">— Seleccionar —</option>
              {configs.map((c) => <option key={c.id} value={c.usuario_email}>{c.nombre}</option>)}
            </select></div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Cliente</label>
            <input style={inp} value={form.cliente_nombre || ""} onChange={(e) => setForm((f) => ({ ...f, cliente_nombre: e.target.value }))} placeholder="Nombre del cliente" /></div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Concepto</label>
            <input style={inp} value={form.concepto || ""} onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))} placeholder="Descripción del servicio" /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Monto neto</label>
            <input type="number" style={inp} value={form.monto || ""} onChange={(e) => { const m = e.target.value; const iva = calcIva(m, form.iva_pct); setForm((f) => ({ ...f, monto: m, iva_monto: iva, monto_total: (parseFloat(m) || 0) + iva })); }} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>IVA</label>
            <select style={inp} value={form.iva_pct || 0} onChange={(e) => { const pct = parseFloat(e.target.value); const iva = calcIva(form.monto, pct); setForm((f) => ({ ...f, iva_pct: pct, iva_monto: iva, monto_total: (parseFloat(f.monto) || 0) + iva })); }}>
              {IVA_ALICUOTAS.map((v) => <option key={v} value={v}>{v}%</option>)}
            </select></div>
          <div style={{ gridColumn: "span 2", background: C.surface2, borderRadius: 8, padding: "10px 14px", textAlign: "right" }}>
            <span style={{ color: C.muted, fontSize: 12 }}>IVA: {fmt(form.iva_monto || 0)} · </span>
            <span style={{ fontWeight: 700, fontSize: 16, color: C.accent }}>Total: {fmt(form.monto_total || 0)}</span>
          </div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Estado</label>
            <select style={inp} value={form.estado || "emitida"} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
              {["emitida", "cobrada", "anulada"].map((s) => <option key={s}>{s}</option>)}
            </select></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Btn onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary onClick={() => onSave(form)} disabled={!form.monto} style={{ flex: 2 }}>Guardar factura</Btn>
        </div>
      </div>
    </div>
  );
}

function ModalNegro({ onSave, onClose }) {
  const [form, setForm] = useState({ tipo: "ingreso", concepto: "", monto: "", fecha: today() });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", border: `1px solid ${C.border2}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Movimiento sin facturar</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={() => setForm((f) => ({ ...f, tipo: "ingreso" }))} style={{ padding: "8px", borderRadius: 8, border: `2px solid ${form.tipo === "ingreso" ? C.green : C.border}`, background: form.tipo === "ingreso" ? "#f0fdf4" : "transparent", color: form.tipo === "ingreso" ? C.green : C.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>↑ Ingreso</button>
            <button onClick={() => setForm((f) => ({ ...f, tipo: "egreso" }))} style={{ padding: "8px", borderRadius: 8, border: `2px solid ${form.tipo === "egreso" ? C.red : C.border}`, background: form.tipo === "egreso" ? "#fef2f2" : "transparent", color: form.tipo === "egreso" ? C.red : C.muted, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>↓ Egreso</button>
          </div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Concepto</label><input style={inp} value={form.concepto} onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Monto</label><input type="number" style={inp} value={form.monto} onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Fecha</label><input type="date" style={inp} value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} /></div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Btn onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary onClick={() => onSave(form)} disabled={!form.concepto || !form.monto} style={{ flex: 2 }}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

function ModalPerfil({ config, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(config || { nombre: "", cuit: "", usuario_email: "", condicion: "monotributo", categoria_actual: "", fecha_inicio_categoria: "", proxima_recategorizacion: "", activo: true, banco: "", cbu: "", notas: "" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.border2}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{form.id ? "Editar perfil" : "Nuevo perfil fiscal"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Nombre *</label><input style={inp} value={form.nombre || ""} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>CUIT</label><input style={inp} value={form.cuit || ""} onChange={(e) => setForm((f) => ({ ...f, cuit: e.target.value }))} placeholder="20-12345678-9" /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Email usuario</label><input style={inp} value={form.usuario_email || ""} onChange={(e) => setForm((f) => ({ ...f, usuario_email: e.target.value }))} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Condición fiscal</label>
            <select style={inp} value={form.condicion || "monotributo"} onChange={(e) => setForm((f) => ({ ...f, condicion: e.target.value }))}>
              <option value="monotributo">Monotributista</option>
              <option value="responsable_inscripto">Responsable Inscripto</option>
              <option value="exento">Exento</option>
            </select></div>
          {form.condicion === "monotributo" && (
            <>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Categoría</label>
                <select style={inp} value={form.categoria_actual || ""} onChange={(e) => setForm((f) => ({ ...f, categoria_actual: e.target.value }))}>
                  <option value="">—</option>
                  {Object.keys(CATEGORIAS_MONO).map((k) => <option key={k} value={k}>Cat. {k} — ${CATEGORIAS_MONO[k].limite.toLocaleString("es-AR")}</option>)}
                </select></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Próx. recategorización</label><input type="date" style={inp} value={form.proxima_recategorizacion || ""} onChange={(e) => setForm((f) => ({ ...f, proxima_recategorizacion: e.target.value }))} /></div>
            </>
          )}
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Banco</label><input style={inp} value={form.banco || ""} onChange={(e) => setForm((f) => ({ ...f, banco: e.target.value }))} /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>CBU/Alias</label><input style={inp} value={form.cbu || ""} onChange={(e) => setForm((f) => ({ ...f, cbu: e.target.value }))} /></div>
          <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Notas</label><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.notas || ""} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} /></div>
          <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.activo !== false} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} />
            <label style={{ fontSize: 13 }}>Perfil activo</label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          {form.id && <Btn danger small onClick={() => onDelete(form.id)}>Eliminar</Btn>}
          <div style={{ flex: 1 }} />
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn primary onClick={() => onSave(form)} disabled={!form.nombre}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

export default function Fiscal({ user }) {
  const [tab, setTab] = useState("facturas");
  const [configs, setConfigs] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [negro, setNegro] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [modalFactura, setModalFactura] = useState(false);
  const [modalNegro, setModalNegro] = useState(false);
  const [modalConfig, setModalConfig] = useState(null);
  const [toast, setToast] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const cargar = useCallback(async () => {
    const [cf, fa, ne, certs] = await Promise.all([
      fetch(`${API}/fiscal/perfiles`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/fiscal/facturas`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/fiscal/negro`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/certificados/todos`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]);
    setConfigs(Array.isArray(cf) ? cf : []);
    setFacturas(Array.isArray(fa) ? fa : []);
    setNegro(Array.isArray(ne) ? ne : []);
    setCertificados(Array.isArray(certs) ? certs : []);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const guardarConfig = async (form) => {
    if (form.id) await fetch(`${API}/fiscal/perfiles/${form.id}`, { method: "PUT", headers: authH(), body: JSON.stringify(form) });
    else await fetch(`${API}/fiscal/perfiles`, { method: "POST", headers: authH(), body: JSON.stringify(form) });
    setModalConfig(null); showToast("✓ Perfil guardado"); cargar();
  };

  const eliminarConfig = async (id) => {
    if (!window.confirm("¿Eliminar perfil?")) return;
    await fetch(`${API}/fiscal/perfiles/${id}`, { method: "DELETE", headers: authH() });
    setModalConfig(null); showToast("✓ Eliminado"); cargar();
  };

  const guardarFactura = async (form) => {
    await fetch(`${API}/fiscal/facturas`, { method: "POST", headers: authH(), body: JSON.stringify({ ...form, monto: parseFloat(form.monto || 0), iva_monto: parseFloat(form.iva_monto || 0), monto_total: parseFloat(form.monto_total || form.monto || 0) }) });
    setModalFactura(false); showToast("✓ Factura registrada"); cargar();
  };

  const eliminarFactura = async (id) => {
    if (!window.confirm("¿Eliminar factura?")) return;
    await fetch(`${API}/fiscal/facturas/${id}`, { method: "DELETE", headers: authH() });
    showToast("✓ Eliminada"); cargar();
  };

  const actualizarEstado = async (id, estado) => {
    await fetch(`${API}/fiscal/facturas/${id}`, { method: "PUT", headers: authH(), body: JSON.stringify({ estado }) });
    showToast("✓ Estado actualizado"); cargar();
  };

  const guardarNegro = async (form) => {
    await fetch(`${API}/fiscal/negro`, { method: "POST", headers: authH(), body: JSON.stringify({ ...form, monto: parseFloat(form.monto) }) });
    setModalNegro(false); showToast("✓ Guardado"); cargar();
  };

  const eliminarNegro = async (id) => {
    if (!window.confirm("¿Eliminar?")) return;
    await fetch(`${API}/fiscal/negro/${id}`, { method: "DELETE", headers: authH() });
    showToast("✓ Eliminado"); cargar();
  };

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const facturasAnio = facturas.filter((f) => f.fecha?.startsWith(anio.toString()) && f.estado !== "anulada");
  const negroAnio = negro.filter((n) => n.fecha?.startsWith(anio.toString()));

  const facturadoPorUsuario = {};
  configs.forEach((c) => { facturadoPorUsuario[c.usuario_email] = 0; });
  facturasAnio.forEach((f) => { if (facturadoPorUsuario[f.emisor_email] !== undefined) facturadoPorUsuario[f.emisor_email] += f.monto || 0; });

  const totalFacturado = Object.values(facturadoPorUsuario).reduce((a, b) => a + b, 0);
  const totalCobrado = facturas.filter((f) => f.fecha?.startsWith(anio.toString()) && f.estado === "cobrada").reduce((a, f) => a + (f.monto_total || f.monto || 0), 0);
  const totalPendiente = facturas.filter((f) => f.fecha?.startsWith(anio.toString()) && f.estado === "emitida").reduce((a, f) => a + (f.monto_total || f.monto || 0), 0);
  const totalNegroIng = negroAnio.filter((n) => n.tipo === "ingreso").reduce((a, b) => a + (b.monto || 0), 0);
  const totalNegroEg = negroAnio.filter((n) => n.tipo === "egreso").reduce((a, b) => a + (b.monto || 0), 0);

  const facturasFiltradas = facturasAnio
    .filter((f) => filtroEstado === "todos" || f.estado === filtroEstado)
    .filter((f) => !busqueda || (f.cliente_nombre || "").toLowerCase().includes(busqueda.toLowerCase()) || (f.concepto || "").toLowerCase().includes(busqueda.toLowerCase()) || (f.numero || "").includes(busqueda));

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ padding: "10px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, fontWeight: tab === id ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", color: C.text }}>
      {/* TABS */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", position: "sticky", top: 0, zIndex: 50, overflowX: "auto" }}>
        <TabBtn id="facturas" label="Facturas" />
        <TabBtn id="negro" label="Sin facturar" />
        <TabBtn id="resumen" label="Resumen" />
        <TabBtn id="config" label="Perfiles" />
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", paddingRight: 12, gap: 8 }}>
          <select value={anio} onChange={(e) => setAnio(parseInt(e.target.value))} style={{ padding: "5px 8px", border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, background: C.surface, fontFamily: "inherit" }}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "16px 16px 60px" }}>

        {/* ── FACTURAS ── */}
        {tab === "facturas" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...inp, flex: 1, minWidth: 180 }} placeholder="Buscar por cliente, concepto o número..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
              <select style={{ ...inp, width: "auto" }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                {["todos", "emitida", "cobrada", "anulada"].map((s) => <option key={s} value={s}>{s === "todos" ? "Todos los estados" : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
              <Btn primary small onClick={() => setModalFactura(true)}>+ Nueva factura</Btn>
              <Btn small onClick={() => setModalNegro(true)}>+ Sin facturar</Btn>
            </div>

            {/* Métricas rápidas */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
              {[["Facturado", fmtM(totalFacturado), C.accent], ["Cobrado", fmtM(totalCobrado), C.green], ["Pendiente", fmtM(totalPendiente), C.warn]].map(([label, val, color]) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{label} {anio}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{val}</div>
                </div>
              ))}
            </div>

            {facturasFiltradas.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 60, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <FileText size={32} strokeWidth={1} color={C.muted} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin facturas en {anio}</div>
                <Btn primary onClick={() => setModalFactura(true)} style={{ marginTop: 12 }}>Registrar primera factura</Btn>
              </div>
            ) : facturasFiltradas.map((f) => (
              <div key={f.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, background: C.surface2, padding: "2px 8px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}>Fac. {f.tipo} {f.numero}</span>
                      <Badge color={f.estado === "cobrada" ? "green" : f.estado === "anulada" ? "red" : ""}>{f.estado}</Badge>
                      <span style={{ fontSize: 12, color: C.muted }}>{fmtFecha(f.fecha)}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{f.cliente_nombre || "Sin cliente"}</div>
                    {f.concepto && <div style={{ fontSize: 12, color: C.muted }}>{f.concepto}</div>}
                    {f.emisor_email && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Emisor: {configs.find((c) => c.usuario_email === f.emisor_email)?.nombre || f.emisor_email}</div>}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(f.monto_total || f.monto)}</div>
                    {f.iva_monto > 0 && <div style={{ fontSize: 11, color: C.muted }}>IVA: {fmt(f.iva_monto)}</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
                      {f.estado === "emitida" && <Btn small onClick={() => actualizarEstado(f.id, "cobrada")} style={{ color: C.green, borderColor: C.green + "44" }}>Cobrada</Btn>}
                      <Btn small danger onClick={() => eliminarFactura(f.id)}>×</Btn>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── SIN FACTURAR ── */}
        {tab === "negro" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 13, color: C.muted }}>Ingresos: </span><span style={{ fontWeight: 700, color: C.green }}>{fmtM(totalNegroIng)}</span>
                <span style={{ fontSize: 13, color: C.muted, marginLeft: 12 }}>Egresos: </span><span style={{ fontWeight: 700, color: C.red }}>{fmtM(totalNegroEg)}</span>
              </div>
              <Btn primary small onClick={() => setModalNegro(true)}>+ Agregar</Btn>
            </div>
            {negroAnio.length === 0 ? (
              <div style={{ textAlign: "center", color: C.muted, padding: 60, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>Sin movimientos sin facturar en {anio}</div>
            ) : negroAnio.map((n) => (
              <div key={n.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: n.tipo === "ingreso" ? C.green : C.red }}>{n.tipo === "ingreso" ? "↑ Ingreso" : "↓ Egreso"}</span>
                    <span style={{ fontSize: 11, color: C.muted }}>{fmtFecha(n.fecha)}</span>
                  </div>
                  <div style={{ fontSize: 14 }}>{n.concepto}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: n.tipo === "ingreso" ? C.green : C.red }}>{fmt(n.monto)}</div>
                  <button onClick={() => eliminarNegro(n.id)} style={{ fontSize: 11, color: C.red, background: "none", border: `1px solid rgba(248,113,113,.3)`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", marginTop: 6 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[["Total facturado", totalFacturado, C.accent], ["Cobrado", totalCobrado, C.green], ["Pendiente", totalPendiente, C.warn], ["Sin facturar ing.", totalNegroIng, C.blue], ["Sin facturar eg.", totalNegroEg, C.red]].map(([label, val, color]) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtM(val)}</div>
                </div>
              ))}
            </div>
            {/* Certificados pendientes de facturar */}
            {certificados.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Certificados disponibles para facturar</div>
                {certificados.map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Cert. Nº {c.numero} — {c.obra}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{fmtFecha(c.fecha)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(c.total_periodo)}</span>
                      <Btn small onClick={() => { setModalFactura(true); }} style={{ fontSize: 11 }}>Facturar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PERFILES ── */}
        {tab === "config" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: C.muted }}>Perfiles fiscales del estudio</div>
              <Btn primary small onClick={() => setModalConfig({})}>+ Agregar perfil</Btn>
            </div>
            {configs.length === 0 && (
              <div style={{ textAlign: "center", color: C.muted, padding: 60, background: C.surface, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <User size={32} strokeWidth={1} color={C.muted} style={{ marginBottom: 12 }} />
                <div style={{ fontWeight: 600 }}>Sin perfiles configurados</div>
                <Btn primary onClick={() => setModalConfig({})} style={{ marginTop: 16 }}>Agregar primer perfil</Btn>
              </div>
            )}
            {configs.map((c) => (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{c.nombre}</div>
                      <Badge color={c.activo ? "green" : ""}>{c.activo ? "Activo" : "Inactivo"}</Badge>
                      <Badge color="">{CONDICION_LABEL[c.condicion]}</Badge>
                    </div>
                    {c.cuit && <div style={{ fontSize: 13, color: C.muted }}>CUIT: {c.cuit}</div>}
                    {c.categoria_actual && <div style={{ fontSize: 13, color: C.muted }}>Cat. {c.categoria_actual} — límite {fmtM(CATEGORIAS_MONO[c.categoria_actual]?.limite || 0)}/año</div>}
                    {c.proxima_recategorizacion && <div style={{ fontSize: 12, color: C.warn, marginTop: 4 }}>Próx. recategorización: {fmtFecha(c.proxima_recategorizacion)}</div>}
                    {c.cbu && <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>CBU/Alias: {c.cbu}</div>}
                  </div>
                  <Btn small onClick={() => setModalConfig(c)}>Editar</Btn>
                </div>
                {c.condicion === "monotributo" && c.categoria_actual && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: C.surface2, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: C.muted }}>Facturado en {anio}</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent, fontWeight: 700 }}>{fmtM(facturadoPorUsuario[c.usuario_email] || 0)}</span>
                    </div>
                    <Semaforo pct={CATEGORIAS_MONO[c.categoria_actual]?.limite > 0 ? (facturadoPorUsuario[c.usuario_email] || 0) / CATEGORIAS_MONO[c.categoria_actual].limite * 100 : 0} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALES */}
      {modalFactura && <ModalFactura configs={configs} onSave={guardarFactura} onClose={() => setModalFactura(false)} prefill={{}} />}
      {modalNegro && <ModalNegro onSave={guardarNegro} onClose={() => setModalNegro(false)} />}
      {modalConfig !== null && <ModalPerfil config={modalConfig?.id ? modalConfig : null} onSave={guardarConfig} onDelete={eliminarConfig} onClose={() => setModalConfig(null)} />}
      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
