import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const API = "https://fima-backend-production.up.railway.app";
const SB_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SB_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sbH = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json", Prefer: "return=representation" };

const fmt = (n) => n != null ? "$ " + Math.round(n).toLocaleString("es-AR") : "—";

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706", red: "#ef4444",
};

// Gantt simplificado readonly
function GanttReadonly({ presupuestoId, obraNombre }) {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(SB_URL + `/rest/v1/gantt_tareas?presupuesto_id=eq.${presupuestoId}&order=orden`, { headers: sbH })
      .then(r => r.json()).then(d => { setTareas(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [presupuestoId]);

  if (loading) return <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Cargando Gantt...</div>;
  if (!tareas.length) return <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Sin planificación cargada</div>;

  // Calcular rango de fechas
  const fechas = tareas.flatMap(t => [t.fecha_inicio, t.fecha_fin]).filter(Boolean).map(f => new Date(f));
  if (!fechas.length) return null;
  const minDate = new Date(Math.min(...fechas));
  const maxDate = new Date(Math.max(...fechas));
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000) + 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
        {minDate.toLocaleDateString("es-AR")} → {maxDate.toLocaleDateString("es-AR")}
      </div>
      {tareas.map((t, i) => {
        const start = t.fecha_inicio ? new Date(t.fecha_inicio) : minDate;
        const end = t.fecha_fin ? new Date(t.fecha_fin) : start;
        const left = Math.max(0, Math.ceil((start - minDate) / 86400000) / totalDays * 100);
        const width = Math.max(1, Math.ceil((end - start) / 86400000) + 1) / totalDays * 100;
        return (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</div>
            <div style={{ height: 20, background: C.surface2, borderRadius: 4, position: "relative", border: `1px solid ${C.border}` }}>
              <div style={{
                position: "absolute", left: left + "%", width: width + "%",
                height: "100%", borderRadius: 3,
                background: t.color || C.accent2, opacity: 0.85,
                minWidth: 4,
              }} title={`${t.fecha_inicio} → ${t.fecha_fin}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PersonalPortal({ user, userInfo, onLogout }) {
  const { nombre, rol, presupuestos_asignados } = userInfo;
  const presIds = (presupuestos_asignados || "").split(",").map(x => x.trim()).filter(Boolean).map(Number);

  const [tab, setTab] = useState("egresos");
  const [presupuestos, setPresupuestos] = useState([]);
  const [presSelec, setPresSelec] = useState(null);
  const [loading, setLoading] = useState(true);

  // Formulario egresos
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [obraEg, setObraEg] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [toast, setToast] = useState("");

  // Herramientas
  const [herramienta, setHerramienta] = useState({ nombre: "", cantidad: 1, obra: "" });

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const res = await fetch(`${API}/presupuestos`);
    if (res.ok) {
      const data = await res.json();
      const todos = (data.por_cliente || []).flatMap(c => c.presupuestos);
      const filtrados = presIds.length > 0 ? todos.filter(p => presIds.includes(p.id)) : todos;
      setPresupuestos(filtrados);
      if (filtrados.length > 0 && !presSelec) setPresSelec(filtrados[0]);
    }
    setLoading(false);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Cargar semana actual de Supabase y agregar egreso
  const agregarEgreso = async () => {
    if (!concepto || !monto) return;
    setEnviando(true);
    try {
      // Get current week
      const { data: semanas } = await fetch(SB_URL + "/rest/v1/semanas?select=*&order=fecha.desc&limit=1&cerrado=eq.false", { headers: sbH }).then(r => r.json().then(d => ({ data: d })));
      const sem = Array.isArray(semanas) && semanas[0];
      if (!sem) { showToast("No hay semana activa"); setEnviando(false); return; }
      const egresos = [...(sem.egresos || []), { concepto, monto: parseFloat(monto), obra: obraEg || presSelec?.nombre_obra || "", estado: "PENDIENTE", _cargadoPor: nombre }];
      await fetch(SB_URL + `/rest/v1/semanas?id=eq.${sem.id}`, {
        method: "PATCH", headers: sbH,
        body: JSON.stringify({ egresos }),
      });
      setConcepto(""); setMonto(""); setObraEg("");
      showToast("Egreso cargado correctamente");
    } catch (e) { showToast("Error al cargar egreso"); }
    setEnviando(false);
  };

  const agregarHerramienta = async () => {
    if (!herramienta.nombre) return;
    setEnviando(true);
    try {
      const res = await fetch(SB_URL + "/rest/v1/semanas?select=*&order=fecha.desc&limit=1&cerrado=eq.false", { headers: sbH });
      const semanas = await res.json();
      const sem = Array.isArray(semanas) && semanas[0];
      if (!sem) { showToast("No hay semana activa"); setEnviando(false); return; }
      const herramientas = [...(sem.herramientas || []), { ...herramienta, obra: herramienta.obra || presSelec?.nombre_obra || "", _cargadoPor: nombre }];
      await fetch(SB_URL + `/rest/v1/semanas?id=eq.${sem.id}`, {
        method: "PATCH", headers: sbH,
        body: JSON.stringify({ herramientas }),
      });
      setHerramienta({ nombre: "", cantidad: 1, obra: "" });
      showToast("Herramienta registrada");
    } catch { showToast("Error"); }
    setEnviando(false);
  };

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: "'Syne', sans-serif" }}>FIMA</div>
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
          {presupuestos.map(p => (
            <button key={p.id} onClick={() => setPresSelec(p)}
              style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${presSelec?.id === p.id ? C.accent : C.border}`, background: presSelec?.id === p.id ? C.accent + "12" : "transparent", color: presSelec?.id === p.id ? C.accent : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {p.nombre_obra}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 20px" }}>
        {[["egresos", "💰 Cargar egreso"], ["herramientas", "🔧 Herramientas"], ["gantt", "📅 Planificación"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, cursor: "pointer", fontSize: 12, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        {toast && <div style={{ background: C.accent + "18", border: `1px solid ${C.accent}30`, borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: C.accent }}>{toast}</div>}

        {/* ── EGRESOS ── */}
        {tab === "egresos" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Cargar egreso / material</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Concepto *</label>
                <input style={inp} placeholder="Ej: Cemento Portland 50kg" value={concepto} onChange={e => setConcepto(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Monto *</label>
                <input style={inp} type="number" placeholder="0" value={monto} onChange={e => setMonto(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Obra</label>
                <select style={inp} value={obraEg} onChange={e => setObraEg(e.target.value)}>
                  <option value="">— Seleccionar obra</option>
                  {presupuestos.map(p => <option key={p.id} value={p.nombre_obra}>{p.nombre_obra}</option>)}
                </select>
              </div>
              <button onClick={agregarEgreso} disabled={enviando || !concepto || !monto}
                style={{ padding: "10px 0", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", opacity: (!concepto || !monto) ? 0.5 : 1 }}>
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
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Herramienta *</label>
                <input style={inp} placeholder="Ej: Andamio, Hormigonera..." value={herramienta.nombre} onChange={e => setHerramienta(h => ({ ...h, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Cantidad</label>
                <input style={inp} type="number" min="1" value={herramienta.cantidad} onChange={e => setHerramienta(h => ({ ...h, cantidad: parseInt(e.target.value) || 1 }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Obra</label>
                <select style={inp} value={herramienta.obra} onChange={e => setHerramienta(h => ({ ...h, obra: e.target.value }))}>
                  <option value="">— Seleccionar obra</option>
                  {presupuestos.map(p => <option key={p.id} value={p.nombre_obra}>{p.nombre_obra}</option>)}
                </select>
              </div>
              <button onClick={agregarHerramienta} disabled={enviando || !herramienta.nombre}
                style={{ padding: "10px 0", background: C.warn, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", opacity: !herramienta.nombre ? 0.5 : 1 }}>
                {enviando ? "Guardando..." : "Registrar herramienta"}
              </button>
            </div>
          </div>
        )}

        {/* ── GANTT ── */}
        {tab === "gantt" && presSelec && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Planificación — {presSelec.nombre_obra}</div>
            <GanttReadonly presupuestoId={presSelec.id} obraNombre={presSelec.nombre_obra} />
          </div>
        )}
        {tab === "gantt" && !presSelec && (
          <div style={{ ...card, textAlign: "center", color: C.muted, padding: 40 }}>No hay obra seleccionada</div>
        )}
      </div>
    </div>
  );
}
