import { useState, useEffect } from "react";
import api from "../cotizador/api";

const fmt = (n) => n != null ? "$ " + Math.round(n).toLocaleString("es-AR") : "—";
const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", warn: "#d97706", red: "#ef4444",
};

export default function PersonalPortal({ user, userInfo, onLogout }) {
  const { nombre, rol, presupuestos_asignados } = userInfo || {};
  // Las obras asignadas llegan a veces como la cadena "1,2,3" de la columna y a
  // veces como lista. Un array vacio es truthy, asi que el `|| ""` de antes no
  // lo atajaba: se iba a .split(), que no existe en un array, y la pantalla
  // entera quedaba en blanco. Se aceptan las dos formas.
  const presIds = (Array.isArray(presupuestos_asignados)
    ? presupuestos_asignados
    : String(presupuestos_asignados ?? "").split(","))
    .map((x) => Number(String(x).trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  const [tab, setTab] = useState("egresos");
  const [presupuestos, setPresupuestos] = useState([]);
  const [presSelec, setPresSelec] = useState(null);
  const [loading, setLoading] = useState(true);
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [obraEg, setObraEg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState("");
  const [herramienta, setHerramienta] = useState({ nombre: "", cantidad: 1, obra: "" });

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    api.get('/presupuestos')
      .then((r) => r.data)
      .then((data) => {
        let todos = [];
        if (Array.isArray(data)) todos = data;
        else if (data.por_cliente) todos = (data.por_cliente || []).flatMap((c) => c.presupuestos || []);
        const filtrados = presIds.length > 0 ? todos.filter((p) => presIds.includes(p.id)) : todos;
        setPresupuestos(filtrados);
        if (filtrados.length > 0 && !presSelec) setPresSelec(filtrados[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const agregarEgreso = async () => {
    if (!concepto || !monto) return;
    setEnviando(true);
    try {
      await api.post('/portal/personal/egreso', { concepto, monto: parseFloat(monto), obra: obraEg || presSelec?.nombre_obra || "" });
      setConcepto(""); setMonto(""); setObraEg(""); showToast("✓ Egreso cargado correctamente");
    } catch { showToast("Error de conexión"); }
    setEnviando(false);
  };

  const agregarHerramienta = async () => {
    if (!herramienta.nombre) return;
    setEnviando(true);
    try {
      await api.post('/portal/personal/herramienta', { ...herramienta, obra: herramienta.obra || presSelec?.nombre_obra || "" });
      setHerramienta({ nombre: "", cantidad: 1, obra: "" }); showToast("✓ Herramienta registrada");
    } catch { showToast("Error de conexión"); }
    setEnviando(false);
  };

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit" };

  const tenantNombre = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.nombre || "FAIM OBRAS"; } catch { return "FAIM OBRAS"; } })();
  const tenantColor = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.color_primario || C.accent; } catch { return C.accent; } })();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: tenantColor }}>{tenantNombre}</div>
          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: C.warn + "18", color: C.warn, fontWeight: 700 }}>{rol}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{nombre}</span>
          <button onClick={onLogout} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Obra selector */}
      {presupuestos.length > 1 && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presupuestos.map((p) => (
            <button key={p.id} onClick={() => setPresSelec(p)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${presSelec?.id === p.id ? tenantColor : C.border}`, background: presSelec?.id === p.id ? tenantColor + "12" : "transparent", color: presSelec?.id === p.id ? tenantColor : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {p.nombre_obra}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 20px" }}>
        {[["egresos", "Cargar egreso"], ["herramientas", "Herramientas"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? tenantColor : "transparent"}`, color: tab === id ? tenantColor : C.muted, cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        {toast && <div style={{ background: tenantColor + "18", border: `1px solid ${tenantColor}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: tenantColor }}>{toast}</div>}

        {/* ── EGRESOS ── */}
        {tab === "egresos" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Cargar egreso / material</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Concepto *</label>
                <input style={inp} placeholder="Ej: Cemento Portland 50kg" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Monto *</label>
                <input style={inp} type="number" placeholder="0" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Obra</label>
                <select style={inp} value={obraEg} onChange={(e) => setObraEg(e.target.value)}>
                  <option value="">— Seleccionar obra</option>
                  {presupuestos.map((p) => <option key={p.id} value={p.nombre_obra}>{p.nombre_obra}</option>)}
                </select></div>
              <button onClick={agregarEgreso} disabled={enviando || !concepto || !monto} style={{ padding: "10px 0", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", opacity: (!concepto || !monto) ? 0.5 : 1 }}>
                {enviando ? "Guardando..." : "Cargar egreso"}
              </button>
            </div>
          </div>
        )}

        {/* ── HERRAMIENTAS ── */}
        {tab === "herramientas" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Registrar herramienta</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Herramienta *</label>
                <input style={inp} placeholder="Ej: Andamio, Hormigonera..." value={herramienta.nombre} onChange={(e) => setHerramienta((h) => ({ ...h, nombre: e.target.value }))} /></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Cantidad</label>
                <input style={inp} type="number" min="1" value={herramienta.cantidad} onChange={(e) => setHerramienta((h) => ({ ...h, cantidad: parseInt(e.target.value) || 1 }))} /></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Obra</label>
                <select style={inp} value={herramienta.obra} onChange={(e) => setHerramienta((h) => ({ ...h, obra: e.target.value }))}>
                  <option value="">— Seleccionar obra</option>
                  {presupuestos.map((p) => <option key={p.id} value={p.nombre_obra}>{p.nombre_obra}</option>)}
                </select></div>
              <button onClick={agregarHerramienta} disabled={enviando || !herramienta.nombre} style={{ padding: "10px 0", background: C.warn, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", opacity: !herramienta.nombre ? 0.5 : 1 }}>
                {enviando ? "Guardando..." : "Registrar herramienta"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
