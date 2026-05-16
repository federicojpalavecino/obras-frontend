import React, { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";
const getToken = () => localStorage.getItem("obras_token") || "";
const authH = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` });

// ── Google Calendar ───────────────────────────────────────────────────────────
const GCAL_CLIENT_ID = "289602384269-rc91am6518mhnec4kr6ju0i19qq18ih4.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const gcalToken = () => localStorage.getItem("gcal_token");
const gcalTokenExp = () => localStorage.getItem("gcal_token_exp");
const gcalIsValid = () => { const t = gcalToken(); const e = gcalTokenExp(); return t && e && Date.now() < parseInt(e); };

const gcalLogin = () => {
  localStorage.setItem("gcal_return_path", window.location.pathname);
  const params = new URLSearchParams({ client_id: GCAL_CLIENT_ID, redirect_uri: window.location.origin, response_type: "token", scope: GCAL_SCOPE, prompt: "consent" });
  window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
};

const parseGcalToken = () => {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return false;
  const params = new URLSearchParams(hash.replace("#", ""));
  const token = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "3600");
  if (token) { localStorage.setItem("gcal_token", token); localStorage.setItem("gcal_token_exp", String(Date.now() + expiresIn * 1000)); window.history.replaceState(null, "", window.location.pathname); return true; }
  return false;
};

const gcalUpsertEvent = async (tarea, proyectoNombre) => {
  const token = gcalToken(); if (!token) return null;
  const startDate = tarea.fecha_inicio || new Date().toISOString().split("T")[0];
  const endDate = tarea.fecha_fin || startDate;
  const start = tarea.hora_inicio ? { dateTime: `${startDate}T${tarea.hora_inicio}`, timeZone: "America/Argentina/Buenos_Aires" } : { date: startDate };
  const end = tarea.hora_fin ? { dateTime: `${endDate}T${tarea.hora_fin}`, timeZone: "America/Argentina/Buenos_Aires" } : { date: endDate };
  const event = { summary: (proyectoNombre ? `[${proyectoNombre}] ` : "") + tarea.titulo, description: tarea.descripcion || "", start, end };
  try {
    const url = tarea.google_event_id ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${tarea.google_event_id}` : "https://www.googleapis.com/calendar/v3/calendars/primary/events";
    const method = tarea.google_event_id ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(event) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch { return null; }
};

const gcalDeleteEvent = async (eventId) => {
  const token = gcalToken(); if (!token) return;
  try { await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); } catch {}
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5", surface3: "#e9ecef",
  border: "#e0e0e8", border2: "#d0d0dc",
  text: "#1a1a2e", muted: "#6b7280", muted2: "#9ca3af",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6",
};
const inp = { background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" };
const hoy = () => new Date().toISOString().split("T")[0];
const addDays = (d, n) => { const dt = new Date(d + "T12:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().split("T")[0]; };
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—";

const ESTADOS = ["pendiente", "en_progreso", "completado", "cancelado"];
const ESTADO_LABEL = { pendiente: "Pendiente", en_progreso: "En progreso", completado: "Completado", cancelado: "Cancelado" };
const ESTADO_COLOR = { pendiente: C.muted, en_progreso: C.blue, completado: C.green, cancelado: C.red };
const PRIORIDADES = ["baja", "normal", "alta", "urgente"];
const PRIORIDAD_COLOR = { baja: C.muted, normal: C.blue, alta: C.warn, urgente: C.red };
const VISTAS = ["kanban", "lista", "semana", "mes"];

function Btn({ primary, danger, small, onClick, disabled, children, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? "5px 10px" : "8px 16px", borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: primary ? 600 : 500, cursor: disabled ? "not-allowed" : "pointer", border: `1px solid ${danger ? "rgba(248,113,113,.3)" : primary ? C.accent : C.border2}`, background: primary ? C.accent : danger ? "rgba(248,113,113,.08)" : "transparent", color: primary ? "#fff" : danger ? C.red : C.text, fontFamily: "inherit", opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
}

function TareaCard({ t, proyectos, onEdit, onDelete, onEstado }) {
  const proy = proyectos.find((p) => p.id === t.proyecto_id);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: "pointer" }} onClick={() => onEdit(t)}>
      {proy && <div style={{ fontSize: 10, fontWeight: 700, color: proy.color || C.accent2, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{proy.nombre}</div>}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t.titulo}</div>
      {t.descripcion && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.descripcion}</div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {t.fecha_inicio && <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(t.fecha_inicio)}{t.fecha_fin && t.fecha_fin !== t.fecha_inicio ? " → " + fmtDate(t.fecha_fin) : ""}</span>}
        {t.hora_inicio && <span style={{ fontSize: 11, color: C.muted }}>{t.hora_inicio.slice(0, 5)}{t.hora_fin ? " - " + t.hora_fin.slice(0, 5) : ""}</span>}
        <span style={{ fontSize: 10, fontWeight: 700, color: PRIORIDAD_COLOR[t.prioridad] }}>● {t.prioridad}</span>
        {t.asignado_a && <span style={{ fontSize: 11, color: C.muted }}>@{t.asignado_a}</span>}
        {t.google_event_id && <span style={{ fontSize: 10, color: "#4285f4" }}>📅</span>}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
        {ESTADOS.filter((s) => s !== t.estado).slice(0, 2).map((s) => (
          <button key={s} onClick={() => onEstado(t.id, s)} style={{ fontSize: 10, padding: "2px 8px", border: `1px solid ${C.border}`, borderRadius: 4, background: "transparent", color: ESTADO_COLOR[s], cursor: "pointer", fontFamily: "inherit" }}>{ESTADO_LABEL[s]}</button>
        ))}
        <button onClick={() => onDelete(t.id)} style={{ fontSize: 10, padding: "2px 8px", border: "1px solid rgba(239,68,68,.3)", borderRadius: 4, background: "transparent", color: C.red, cursor: "pointer", marginLeft: "auto" }}>×</button>
      </div>
    </div>
  );
}

function ViewKanban({ tareas, proyectos, onEdit, onDelete, onEstado }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
      {ESTADOS.map((estado) => (
        <div key={estado} style={{ background: C.surface2, borderRadius: 10, padding: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: ESTADO_COLOR[estado], textTransform: "uppercase", letterSpacing: "0.5px" }}>{ESTADO_LABEL[estado]}</div>
            <span style={{ fontSize: 11, color: C.muted, background: C.surface, borderRadius: 20, padding: "1px 7px" }}>{tareas.filter((t) => t.estado === estado).length}</span>
          </div>
          {tareas.filter((t) => t.estado === estado).map((t) => <TareaCard key={t.id} t={t} proyectos={proyectos} onEdit={onEdit} onDelete={onDelete} onEstado={onEstado} />)}
          {tareas.filter((t) => t.estado === estado).length === 0 && <div style={{ textAlign: "center", color: C.muted2, fontSize: 12, padding: "20px 0" }}>Sin tareas</div>}
        </div>
      ))}
    </div>
  );
}

function ViewLista({ tareas, proyectos, onEdit, onDelete, onEstado }) {
  return (
    <div>
      {tareas.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin tareas</div>}
      {tareas.map((t) => <TareaCard key={t.id} t={t} proyectos={proyectos} onEdit={onEdit} onDelete={onDelete} onEstado={onEstado} />)}
    </div>
  );
}

function ModalTarea({ tarea, proyectos, onSave, onClose, gcalConnected }) {
  const [form, setForm] = useState(tarea || { titulo: "", descripcion: "", estado: "pendiente", prioridad: "normal", proyecto_id: "", fecha_inicio: hoy(), fecha_fin: "", hora_inicio: "", hora_fin: "", asignado_a: "" });
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.border2}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{form.id ? "Editar tarea" : "Nueva tarea"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Título *</label><input style={inp} value={form.titulo || ""} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Nombre de la tarea" /></div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Descripción</label><textarea style={{ ...inp, minHeight: 70, resize: "vertical" }} value={form.descripcion || ""} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Estado</label>
              <select style={inp} value={form.estado || "pendiente"} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
                {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select></div>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Prioridad</label>
              <select style={inp} value={form.prioridad || "normal"} onChange={(e) => setForm((f) => ({ ...f, prioridad: e.target.value }))}>
                {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select></div>
          </div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Proyecto</label>
            <select style={inp} value={form.proyecto_id || ""} onChange={(e) => setForm((f) => ({ ...f, proyecto_id: e.target.value ? parseInt(e.target.value) : null }))}>
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Fecha inicio</label><input type="date" style={inp} value={form.fecha_inicio || ""} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} /></div>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Fecha fin</label><input type="date" style={inp} value={form.fecha_fin || ""} onChange={(e) => setForm((f) => ({ ...f, fecha_fin: e.target.value }))} /></div>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Hora inicio</label><input type="time" style={inp} value={form.hora_inicio || ""} onChange={(e) => setForm((f) => ({ ...f, hora_inicio: e.target.value }))} /></div>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Hora fin</label><input type="time" style={inp} value={form.hora_fin || ""} onChange={(e) => setForm((f) => ({ ...f, hora_fin: e.target.value }))} /></div>
          </div>
          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Asignado a</label><input style={inp} value={form.asignado_a || ""} onChange={(e) => setForm((f) => ({ ...f, asignado_a: e.target.value }))} placeholder="Nombre o email" /></div>
          {gcalConnected && <div style={{ fontSize: 12, color: "#4285f4", background: "#f0f4ff", padding: "8px 12px", borderRadius: 8 }}>📅 Se sincronizará con Google Calendar al guardar</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Btn onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary onClick={() => onSave(form)} disabled={!form.titulo} style={{ flex: 2 }}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

export default function Planner({ user }) {
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [vista, setVista] = useState("kanban");
  const [modalTarea, setModalTarea] = useState(null);
  const [modalProyecto, setModalProyecto] = useState(false);
  const [formProy, setFormProy] = useState({ nombre: "", color: "#6ee7b7" });
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [gcalConnected, setGcalConnected] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    const justConnected = parseGcalToken();
    setGcalConnected(gcalIsValid());
    if (justConnected) showToast("✓ Conectado a Google Calendar");
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const [tr, pr] = await Promise.all([
      fetch(`${API}/planner/tareas`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/planner/proyectos`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]);
    setTareas(Array.isArray(tr) ? tr : []);
    setProyectos(Array.isArray(pr) ? pr : []);
    setLoading(false);
  };

  const guardarTarea = async (form) => {
    const toNull = (v) => (!v || v === "") ? null : v;
    const data = { titulo: form.titulo, descripcion: toNull(form.descripcion), estado: form.estado || "pendiente", prioridad: form.prioridad || "normal", proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id) : null, fecha_inicio: form.fecha_inicio || hoy(), fecha_fin: toNull(form.fecha_fin), hora_inicio: toNull(form.hora_inicio), hora_fin: toNull(form.hora_fin), asignado_a: toNull(form.asignado_a), google_event_id: toNull(form.google_event_id) };
    let savedId = form.id;
    if (form.id) {
      await fetch(`${API}/planner/tareas/${form.id}`, { method: "PUT", headers: authH(), body: JSON.stringify(data) });
    } else {
      const res = await fetch(`${API}/planner/tareas`, { method: "POST", headers: authH(), body: JSON.stringify(data) });
      if (res.ok) { const d = await res.json(); savedId = d.id; }
    }
    setModalTarea(null);
    cargar();
    if (gcalConnected) {
      try {
        const proyecto = proyectos.find((p) => p.id === parseInt(form.proyecto_id));
        const eventId = await gcalUpsertEvent(data, proyecto?.nombre);
        if (eventId && savedId) { await fetch(`${API}/planner/tareas/${savedId}/estado`, { method: "PATCH", headers: authH(), body: JSON.stringify({ google_event_id: eventId }) }); }
      } catch {}
    }
    showToast(gcalConnected ? "✓ Guardado y sincronizado" : "✓ Guardado");
  };

  const eliminarTarea = async (id) => {
    if (!window.confirm("¿Eliminar tarea?")) return;
    if (gcalConnected) { const t = tareas.find((x) => x.id === id); if (t?.google_event_id) { try { await gcalDeleteEvent(t.google_event_id); } catch {} } }
    await fetch(`${API}/planner/tareas/${id}`, { method: "DELETE", headers: authH() });
    showToast("✓ Eliminado"); cargar();
  };

  const cambiarEstado = async (id, estado) => {
    await fetch(`${API}/planner/tareas/${id}/estado`, { method: "PATCH", headers: authH(), body: JSON.stringify({ estado }) });
    setTareas((t) => t.map((x) => x.id === id ? { ...x, estado } : x));
  };

  const guardarProyecto = async () => {
    if (!formProy.nombre) return;
    await fetch(`${API}/planner/proyectos`, { method: "POST", headers: authH(), body: JSON.stringify(formProy) });
    setModalProyecto(false); setFormProy({ nombre: "", color: "#6ee7b7" }); showToast("✓ Proyecto creado"); cargar();
  };

  const eliminarProyecto = async (id) => {
    if (!window.confirm("¿Eliminar proyecto?")) return;
    await fetch(`${API}/planner/proyectos/${id}`, { method: "DELETE", headers: authH() });
    if (filtroProyecto === String(id)) setFiltroProyecto(""); showToast("✓ Eliminado"); cargar();
  };

  const tareasFiltradas = tareas.filter((t) => {
    if (filtroProyecto && t.proyecto_id !== parseInt(filtroProyecto)) return false;
    if (filtroEstado && t.estado !== filtroEstado) return false;
    if (busqueda && !(t.titulo || "").toLowerCase().includes(busqueda.toLowerCase()) && !(t.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const COLORES = ["#6ee7b7", "#a78bfa", "#38bdf8", "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#fb923c"];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 50 }}>
        {/* Vista */}
        <div style={{ display: "flex", gap: 2, background: C.surface2, borderRadius: 8, padding: 3 }}>
          {VISTAS.map((v) => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: vista === v ? C.surface : "transparent", color: vista === v ? C.text : C.muted, fontSize: 12, fontWeight: vista === v ? 600 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {v === "kanban" ? "Kanban" : v === "lista" ? "Lista" : v === "semana" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        {/* Filtros */}
        <input style={{ ...inp, width: 160 }} placeholder="Buscar..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        <select style={{ ...inp, width: "auto" }} value={filtroProyecto} onChange={(e) => setFiltroProyecto(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        <select style={{ ...inp, width: "auto" }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
        </select>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {!gcalConnected ? (
            <button onClick={gcalLogin} style={{ padding: "6px 12px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, cursor: "pointer", color: C.muted, fontFamily: "inherit" }}>📅 Google Cal</button>
          ) : (
            <span style={{ fontSize: 11, color: "#4285f4", padding: "6px 10px" }}>📅 Conectado</span>
          )}
          <Btn small onClick={() => setModalProyecto(true)}>+ Proyecto</Btn>
          <Btn primary small onClick={() => setModalTarea({})}>+ Tarea</Btn>
        </div>
      </div>

      {/* Proyectos pills */}
      {proyectos.length > 0 && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {proyectos.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setFiltroProyecto(filtroProyecto === String(p.id) ? "" : String(p.id))} style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${filtroProyecto === String(p.id) ? p.color || C.accent : C.border}`, background: filtroProyecto === String(p.id) ? (p.color || C.accent) + "22" : "transparent", color: p.color || C.accent, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                {p.nombre}
              </button>
              <button onClick={() => eliminarProyecto(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 14, padding: "0 2px" }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>Cargando...</div>
        ) : vista === "kanban" ? (
          <ViewKanban tareas={tareasFiltradas} proyectos={proyectos} onEdit={setModalTarea} onDelete={eliminarTarea} onEstado={cambiarEstado} />
        ) : (
          <ViewLista tareas={tareasFiltradas} proyectos={proyectos} onEdit={setModalTarea} onDelete={eliminarTarea} onEstado={cambiarEstado} />
        )}
      </div>

      {/* Modal Tarea */}
      {modalTarea !== null && <ModalTarea tarea={modalTarea?.id ? modalTarea : null} proyectos={proyectos} onSave={guardarTarea} onClose={() => setModalTarea(null)} gcalConnected={gcalConnected} />}

      {/* Modal Proyecto */}
      {modalProyecto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 360, width: "100%", border: `1px solid ${C.border2}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 17, fontWeight: 700 }}>Nuevo proyecto</div>
              <button onClick={() => setModalProyecto(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Nombre *</label><input style={inp} value={formProy.nombre} onChange={(e) => setFormProy((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del proyecto" /></div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8 }}>Color</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLORES.map((c) => <button key={c} onClick={() => setFormProy((f) => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: 4, background: c, border: formProy.color === c ? `3px solid ${C.text}` : "2px solid transparent", cursor: "pointer" }} />)}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <Btn onClick={() => setModalProyecto(false)} style={{ flex: 1 }}>Cancelar</Btn>
              <Btn primary onClick={guardarProyecto} disabled={!formProy.nombre} style={{ flex: 2 }}>Crear proyecto</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999 }}>{toast}</div>}
    </div>
  );
}
