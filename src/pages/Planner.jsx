import React, { useState, useEffect, useRef, useCallback } from "react";
import api from "../cotizador/api";

// ── Google Calendar ───────────────────────────────────────────────────────────
const GCAL_CLIENT_ID = "289602384269-rc91am6518mhnec4kr6ju0i19qq18ih4.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";

const gcalIsValid = (token, exp) => token && exp && Date.now() < parseInt(exp || "0");

const gcalLogin = () => {
  localStorage.setItem("gcal_return_path", window.location.pathname);
  const params = new URLSearchParams({ client_id: GCAL_CLIENT_ID, redirect_uri: window.location.origin, response_type: "token", scope: GCAL_SCOPE, prompt: "consent" });
  window.location.href = "https://accounts.google.com/o/oauth2/v2/auth?" + params.toString();
};

const parseGcalToken = async () => {
  const hash = window.location.hash;
  if (!hash.includes("access_token")) return false;
  const params = new URLSearchParams(hash.replace("#", ""));
  const token = params.get("access_token");
  const expiresIn = parseInt(params.get("expires_in") || "3600");
  const expiresAt = String(Date.now() + expiresIn * 1000);
  if (token) {
    window.history.replaceState(null, "", window.location.pathname);
    await api.put('/estudio/usuarios/me/gcal-token', { token, expires_at: expiresAt });
    return { token, expires_at: expiresAt };
  }
  return false;
};

const gcalUpsertEvent = async (tarea, proyectoNombre, token) => {
  if (!token) return null;
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
    return (await res.json()).id;
  } catch { return null; }
};

const gcalDeleteEvent = async (eventId, token) => {
  if (!token || !eventId) return;
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
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "—";
const fmtDateLong = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" }) : "";

const ESTADOS = ["pendiente", "en_progreso", "completado", "cancelado"];
const ESTADO_LABEL = { pendiente: "Pendiente", en_progreso: "En progreso", completado: "Completado", cancelado: "Cancelado" };
const ESTADO_COLOR = { pendiente: C.muted, en_progreso: C.blue, completado: C.green, cancelado: C.red };
const ESTADO_BG = { pendiente: C.surface2, en_progreso: "#eff6ff", completado: "#f0fdf4", cancelado: "#fef2f2" };
const PRIORIDADES = ["baja", "normal", "alta", "urgente"];
const PRIORIDAD_COLOR = { baja: C.muted2, normal: C.blue, alta: C.warn, urgente: C.red };
const PRIORIDAD_DOT = { baja: "○", normal: "●", alta: "●", urgente: "⬤" };
const COLORES_PROY = ["#6ee7b7", "#a78bfa", "#38bdf8", "#fbbf24", "#f87171", "#34d399", "#60a5fa", "#fb923c", "#e879f9", "#a3e635"];

function Btn({ primary, danger, small, onClick, disabled, children, style = {} }) {
  return <button onClick={onClick} disabled={disabled} style={{ padding: small ? "5px 10px" : "8px 16px", borderRadius: 8, fontSize: small ? 12 : 13, fontWeight: primary ? 600 : 500, cursor: disabled ? "not-allowed" : "pointer", border: `1px solid ${danger ? "rgba(248,113,113,.3)" : primary ? C.accent : C.border2}`, background: primary ? C.accent : danger ? "rgba(248,113,113,.08)" : "transparent", color: primary ? "#fff" : danger ? C.red : C.text, fontFamily: "inherit", opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ t, proyectos, presupuestos, onEdit, onDelete, onDragStart, onDragEnd }) {
  const proy = proyectos.find(p => p.id === t.proyecto_id);
  const pres = presupuestos.find(p => p.id === t.presupuesto_id);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={e => { setDragging(true); onDragStart(e, t.id); e.dataTransfer.effectAllowed = "move"; }}
      onDragEnd={() => { setDragging(false); onDragEnd(); }}
      onClick={() => onEdit(t)}
      style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
        padding: "10px 12px", marginBottom: 8, cursor: "grab",
        opacity: dragging ? 0.4 : 1, transition: "opacity 0.15s, box-shadow 0.15s",
        boxShadow: dragging ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
        userSelect: "none",
      }}
      onMouseEnter={e => !dragging && (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}
    >
      {/* Tags */}
      {(proy || pres) && (
        <div style={{ display: "flex", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
          {proy && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: (proy.color || C.accent2) + "22", color: proy.color || C.accent2 }}>{proy.nombre}</span>}
          {pres && !proy && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: C.blue + "15", color: C.blue }}>📋 {pres.nombre_obra}</span>}
        </div>
      )}
      {/* Titulo */}
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>{t.titulo}</div>
      {/* Descripcion */}
      {t.descripcion && <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.descripcion}</div>}
      {/* Footer */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: PRIORIDAD_COLOR[t.prioridad], fontWeight: 700 }}>{PRIORIDAD_DOT[t.prioridad]} {t.prioridad}</span>
        {t.fecha_inicio && <span style={{ fontSize: 10, color: C.muted }}>{fmtDate(t.fecha_inicio)}{t.fecha_fin && t.fecha_fin !== t.fecha_inicio ? " → " + fmtDate(t.fecha_fin) : ""}</span>}
        {t.hora_inicio && <span style={{ fontSize: 10, color: C.muted }}>{t.hora_inicio.slice(0,5)}</span>}
        {t.asignado_a && <span style={{ fontSize: 10, color: C.muted, marginLeft: "auto" }}>@{t.asignado_a.split(" ")[0]}</span>}
        {t.google_event_id && <span style={{ fontSize: 10, color: "#4285f4", marginLeft: t.asignado_a ? 0 : "auto" }} title="En Google Calendar">📅</span>}
        <button onClick={e => { e.stopPropagation(); onDelete(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted2, fontSize: 14, padding: "0 2px", marginLeft: "auto", lineHeight: 1 }} title="Eliminar">×</button>
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────
function KanbanColumn({ estado, tareas, proyectos, presupuestos, onEdit, onDelete, onDrop, onDragStart, onDragEnd, onAddTarea }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); e.dataTransfer.dropEffect = "move"; }}
      onDragLeave={() => setDragOver(false)}
      onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(e, estado); }}
      style={{
        background: dragOver ? "#f0fdf4" : C.surface2,
        borderRadius: 12, padding: 12,
        border: `2px solid ${dragOver ? C.accent : "transparent"}`,
        transition: "background 0.15s, border-color 0.15s",
        minHeight: 200, display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: ESTADO_COLOR[estado], display: "inline-block" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: ESTADO_COLOR[estado], textTransform: "uppercase", letterSpacing: "0.5px" }}>{ESTADO_LABEL[estado]}</span>
        </div>
        <span style={{ fontSize: 11, color: C.muted, background: C.surface, borderRadius: 20, padding: "1px 8px", border: `1px solid ${C.border}` }}>{tareas.length}</span>
      </div>
      <div style={{ flex: 1 }}>
        {tareas.map(t => (
          <KanbanCard key={t.id} t={t} proyectos={proyectos} presupuestos={presupuestos} onEdit={onEdit} onDelete={onDelete} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        ))}
      </div>
      <button onClick={() => onAddTarea(estado)} style={{ width: "100%", padding: "7px", background: "transparent", border: `1px dashed ${C.border2}`, borderRadius: 8, color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "inherit", marginTop: 4 }}>
        + Agregar tarea
      </button>
    </div>
  );
}

// ── Vista Semana ──────────────────────────────────────────────────────────────
function VistaSemana({ tareas, proyectos, onEdit }) {
  const today = new Date();
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + mondayOffset + i);
    return d.toISOString().split("T")[0];
  });

  const tareasPorDia = (fecha) => tareas.filter(t => t.fecha_inicio <= fecha && (!t.fecha_fin || t.fecha_fin >= fecha));
  const todayStr = today.toISOString().split("T")[0];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: C.text }}>
        Semana del {fmtDateLong(weekDays[0])} al {fmtDateLong(weekDays[6])}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
        {weekDays.map(fecha => {
          const isToday = fecha === todayStr;
          const tareasDelDia = tareasPorDia(fecha);
          const d = new Date(fecha + "T12:00:00");
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <div key={fecha} style={{
              background: isToday ? "#f0fdf4" : isWeekend ? C.surface2 : C.surface,
              border: `1px solid ${isToday ? C.accent : C.border}`,
              borderRadius: 10, padding: "10px 8px", minHeight: 140,
            }}>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  {d.toLocaleDateString("es-AR", { weekday: "short" })}
                </div>
                <div style={{
                  fontSize: 18, fontWeight: isToday ? 800 : 600,
                  color: isToday ? C.accent : isWeekend ? C.muted : C.text,
                  width: 30, height: 30, borderRadius: "50%",
                  background: isToday ? C.accent + "15" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "2px auto 0",
                }}>
                  {d.getDate()}
                </div>
              </div>
              {tareasDelDia.map(t => {
                const proy = proyectos.find(p => p.id === t.proyecto_id);
                return (
                  <div key={t.id} onClick={() => onEdit(t)} style={{
                    fontSize: 11, padding: "3px 6px", borderRadius: 5, marginBottom: 3,
                    background: (proy?.color || ESTADO_COLOR[t.estado] || C.accent2) + "20",
                    color: proy?.color || ESTADO_COLOR[t.estado] || C.accent2,
                    border: `1px solid ${(proy?.color || ESTADO_COLOR[t.estado] || C.accent2)}40`,
                    cursor: "pointer", fontWeight: 600,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {t.hora_inicio && <span style={{ marginRight: 3, opacity: 0.7 }}>{t.hora_inicio.slice(0,5)}</span>}
                    {t.titulo}
                  </div>
                );
              })}
              {tareasDelDia.length === 0 && isWeekend && (
                <div style={{ fontSize: 10, color: C.muted2, textAlign: "center", marginTop: 12 }}>—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal Tarea ───────────────────────────────────────────────────────────────
function ModalTarea({ tarea, proyectos, presupuestos, onSave, onClose, gcalConnected }) {
  const [form, setForm] = useState(tarea || { titulo: "", descripcion: "", estado: "pendiente", prioridad: "normal", proyecto_id: "", presupuesto_id: "", fecha_inicio: hoy(), fecha_fin: "", hora_inicio: "", hora_fin: "", asignado_a: "" });
  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", border: `1px solid ${C.border2}`, boxShadow: "0 8px 32px rgba(0,0,0,0.16)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{form.id ? "Editar tarea" : "Nueva tarea"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Título *</label>
            <input style={inp} value={form.titulo || ""} onChange={e => f("titulo", e.target.value)} placeholder="Nombre de la tarea" autoFocus />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Descripción</label>
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={form.descripcion || ""} onChange={e => f("descripcion", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Estado</label>
              <select style={inp} value={form.estado || "pendiente"} onChange={e => f("estado", e.target.value)}>
                {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Prioridad</label>
              <select style={inp} value={form.prioridad || "normal"} onChange={e => f("prioridad", e.target.value)}>
                {PRIORIDADES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Proyecto</label>
              <select style={inp} value={form.proyecto_id || ""} onChange={e => f("proyecto_id", e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Sin proyecto</option>
                {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Presupuesto</label>
              <select style={inp} value={form.presupuesto_id || ""} onChange={e => f("presupuesto_id", e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Sin presupuesto</option>
                {presupuestos.map(p => <option key={p.id} value={p.id}>{p.nombre_obra}{p.cliente_nombre ? ` — ${p.cliente_nombre}` : ""}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha inicio</label>
              <input type="date" style={inp} value={form.fecha_inicio || ""} onChange={e => f("fecha_inicio", e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Fecha fin</label>
              <input type="date" style={inp} value={form.fecha_fin || ""} onChange={e => f("fecha_fin", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hora inicio</label>
              <input type="time" style={inp} value={form.hora_inicio || ""} onChange={e => f("hora_inicio", e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Hora fin</label>
              <input type="time" style={inp} value={form.hora_fin || ""} onChange={e => f("hora_fin", e.target.value)} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Asignado a</label>
              <input style={inp} value={form.asignado_a || ""} onChange={e => f("asignado_a", e.target.value)} placeholder="Nombre o email" />
            </div>
          </div>
          {gcalConnected && <div style={{ fontSize: 12, color: "#4285f4", background: "#f0f4ff", padding: "7px 11px", borderRadius: 7, border: "1px solid #bfdbfe" }}>📅 Se sincronizará con tu Google Calendar al guardar</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <Btn onClick={onClose} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary onClick={() => onSave(form)} disabled={!form.titulo} style={{ flex: 2 }}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Planner({ user }) {
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [vista, setVista] = useState("kanban");
  const [modalTarea, setModalTarea] = useState(null);
  const [modalProyecto, setModalProyecto] = useState(false);
  const [formProy, setFormProy] = useState({ nombre: "", color: COLORES_PROY[0], presupuesto_id: null });
  const [filtroProyecto, setFiltroProyecto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [gcalToken, setGcalToken] = useState(null);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const dragId = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    const init = async () => {
      // Check for OAuth callback
      const newToken = await parseGcalToken();
      if (newToken) {
        setGcalToken(newToken.token);
        setGcalConnected(true);
        showToast("✓ Google Calendar conectado");
      } else {
        // Load from backend
        try {
          const me = (await api.get('/estudio/me')).data;
          if (gcalIsValid(me.gcal_token, me.gcal_token_exp)) {
            setGcalToken(me.gcal_token);
            setGcalConnected(true);
          }
        } catch {}
      }
      cargar();
    };
    init();
  }, []);

  const cargar = async () => {
    setLoading(true);
    const [tr, pr, pres] = await Promise.all([
      api.get('/planner/tareas').then(r => r.data).catch(() => []),
      api.get('/planner/proyectos').then(r => r.data).catch(() => []),
      api.get('/planner/presupuestos').then(r => r.data).catch(() => []),
    ]);
    setTareas(Array.isArray(tr) ? tr : []);
    setProyectos(Array.isArray(pr) ? pr : []);
    setPresupuestos(Array.isArray(pres) ? pres : []);
    setLoading(false);
  };

  const desconectarGcal = async () => {
    await api.delete('/estudio/usuarios/me/gcal-token');
    setGcalToken(null); setGcalConnected(false);
    showToast("Google Calendar desconectado");
  };

  const guardarTarea = async (form) => {
    const toNull = v => (!v || v === "") ? null : v;
    const data = { titulo: form.titulo, descripcion: toNull(form.descripcion), estado: form.estado || "pendiente", prioridad: form.prioridad || "normal", proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id) : null, presupuesto_id: form.presupuesto_id ? parseInt(form.presupuesto_id) : null, fecha_inicio: form.fecha_inicio || hoy(), fecha_fin: toNull(form.fecha_fin), hora_inicio: toNull(form.hora_inicio), hora_fin: toNull(form.hora_fin), asignado_a: toNull(form.asignado_a), google_event_id: toNull(form.google_event_id) };
    let savedId = form.id;
    if (form.id) {
      await api.put(`/planner/tareas/${form.id}`, data);
    } else {
      const res = await api.post('/planner/tareas', data);
      savedId = res.data.id;
    }
    setModalTarea(null);
    cargar();
    if (gcalConnected && gcalToken) {
      try {
        const proyecto = proyectos.find(p => p.id === parseInt(form.proyecto_id));
        const eventId = await gcalUpsertEvent(data, proyecto?.nombre, gcalToken);
        if (eventId && savedId) {
          await api.patch(`/planner/tareas/${savedId}/estado`, { google_event_id: eventId });
        }
      } catch {}
    }
    showToast(gcalConnected ? "✓ Guardado y sincronizado" : "✓ Guardado");
  };

  const eliminarTarea = async (id) => {
    if (!window.confirm("¿Eliminar tarea?")) return;
    if (gcalConnected && gcalToken) {
      const t = tareas.find(x => x.id === id);
      if (t?.google_event_id) { try { await gcalDeleteEvent(t.google_event_id, gcalToken); } catch {} }
    }
    await api.delete(`/planner/tareas/${id}`);
    showToast("✓ Eliminado"); cargar();
  };

  // ── Drag & Drop ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, id) => { dragId.current = id; }, []);
  const handleDragEnd = useCallback(() => { dragId.current = null; }, []);

  const handleDrop = useCallback(async (e, nuevoEstado) => {
    const id = dragId.current;
    if (!id) return;
    const t = tareas.find(x => x.id === id);
    if (!t || t.estado === nuevoEstado) return;
    setTareas(prev => prev.map(x => x.id === id ? { ...x, estado: nuevoEstado } : x));
    await api.patch(`/planner/tareas/${id}/estado`, { estado: nuevoEstado });
  }, [tareas]);

  const guardarProyecto = async () => {
    if (!formProy.nombre) return;
    await api.post('/planner/proyectos', formProy);
    setModalProyecto(false); setFormProy({ nombre: "", color: COLORES_PROY[0], presupuesto_id: null });
    showToast("✓ Proyecto creado"); cargar();
  };

  const eliminarProyecto = async (id) => {
    if (!window.confirm("¿Eliminar proyecto?")) return;
    await api.delete(`/planner/proyectos/${id}`);
    if (filtroProyecto === String(id)) setFiltroProyecto("");
    showToast("✓ Eliminado"); cargar();
  };

  const addTareaEnEstado = (estado) => setModalTarea({ estado, titulo: "", descripcion: "", prioridad: "normal", proyecto_id: filtroProyecto ? parseInt(filtroProyecto) : null, presupuesto_id: null, fecha_inicio: hoy(), fecha_fin: "", hora_inicio: "", hora_fin: "", asignado_a: "" });

  const tareasFiltradas = tareas.filter(t => {
    if (filtroProyecto && t.proyecto_id !== parseInt(filtroProyecto)) return false;
    if (filtroEstado && t.estado !== filtroEstado) return false;
    if (busqueda && !(t.titulo || "").toLowerCase().includes(busqueda.toLowerCase()) && !(t.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", color: C.text }}>

      {/* ── TOOLBAR ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", position: "sticky", top: 0, zIndex: 50 }}>
        {/* Vista */}
        <div style={{ display: "flex", gap: 2, background: C.surface2, borderRadius: 8, padding: 3, flexShrink: 0 }}>
          {[["kanban", "Kanban"], ["semana", "Semana"], ["lista", "Lista"]].map(([v, label]) => (
            <button key={v} onClick={() => setVista(v)} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: vista === v ? C.surface : "transparent", color: vista === v ? C.text : C.muted, fontSize: 12, fontWeight: vista === v ? 600 : 400, cursor: "pointer", fontFamily: "inherit", boxShadow: vista === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              {label}
            </button>
          ))}
        </div>

        <input style={{ ...inp, width: 160 }} placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />

        <select style={{ ...inp, width: "auto" }} value={filtroProyecto} onChange={e => setFiltroProyecto(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        {vista === "kanban" && (
          <select style={{ ...inp, width: "auto" }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{ESTADO_LABEL[s]}</option>)}
          </select>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {!gcalConnected ? (
            <button onClick={gcalLogin} style={{ padding: "6px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 11, cursor: "pointer", color: C.muted, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 14 }}>📅</span> Conectar Google Cal
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 11, color: "#4285f4", background: "#eff6ff", padding: "4px 10px", borderRadius: 20, border: "1px solid #bfdbfe" }}>📅 Google Cal activo</span>
              <button onClick={desconectarGcal} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, padding: "0 4px" }} title="Desconectar">×</button>
            </div>
          )}
          <Btn small onClick={() => setModalProyecto(true)}>+ Proyecto</Btn>
          <Btn primary small onClick={() => setModalTarea({})}>+ Tarea</Btn>
        </div>
      </div>

      {/* ── PROYECTO PILLS ── */}
      {proyectos.length > 0 && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "8px 16px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setFiltroProyecto("")} style={{ padding: "3px 12px", borderRadius: 20, border: `1px solid ${!filtroProyecto ? C.accent : C.border}`, background: !filtroProyecto ? C.accent + "12" : "transparent", color: !filtroProyecto ? C.accent : C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
            Todos
          </button>
          {proyectos.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button onClick={() => setFiltroProyecto(filtroProyecto === String(p.id) ? "" : String(p.id))} style={{ padding: "3px 12px", borderRadius: 20, border: `1px solid ${filtroProyecto === String(p.id) ? (p.color || C.accent2) : C.border}`, background: filtroProyecto === String(p.id) ? (p.color || C.accent2) + "18" : "transparent", color: p.color || C.accent2, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || C.accent2, display: "inline-block" }} />
                {p.nombre}
              </button>
              <button onClick={() => eliminarProyecto(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted2, fontSize: 13, padding: "0 1px", lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ maxWidth: vista === "kanban" ? 1200 : 960, margin: "0 auto", padding: "16px 16px 60px" }}>

        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>Cargando...</div>
        ) : vista === "kanban" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {ESTADOS.map(estado => (
              <KanbanColumn key={estado} estado={estado} tareas={tareasFiltradas.filter(t => t.estado === estado)} proyectos={proyectos} presupuestos={presupuestos} onEdit={setModalTarea} onDelete={eliminarTarea} onDrop={handleDrop} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onAddTarea={addTareaEnEstado} />
            ))}
          </div>
        ) : vista === "semana" ? (
          <VistaSemana tareas={tareasFiltradas} proyectos={proyectos} onEdit={setModalTarea} />
        ) : (
          <div>
            {tareasFiltradas.length === 0 && <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Sin tareas</div>}
            {ESTADOS.map(estado => {
              const grupo = tareasFiltradas.filter(t => t.estado === estado);
              if (!grupo.length) return null;
              return (
                <div key={estado} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: ESTADO_COLOR[estado], marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ESTADO_COLOR[estado], display: "inline-block" }} />
                    {ESTADO_LABEL[estado]} ({grupo.length})
                  </div>
                  {grupo.map(t => {
                    const proy = proyectos.find(p => p.id === t.proyecto_id);
                    return (
                      <div key={t.id} onClick={() => setModalTarea(t)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{t.titulo}</div>
                          {t.descripcion && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.descripcion}</div>}
                        </div>
                        {proy && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: (proy.color || C.accent2) + "20", color: proy.color || C.accent2, fontWeight: 700 }}>{proy.nombre}</span>}
                        <span style={{ fontSize: 10, color: PRIORIDAD_COLOR[t.prioridad], fontWeight: 700 }}>{PRIORIDAD_DOT[t.prioridad]} {t.prioridad}</span>
                        {t.fecha_inicio && <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(t.fecha_inicio)}</span>}
                        <button onClick={e => { e.stopPropagation(); eliminarTarea(t.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted2, fontSize: 16, padding: "0 4px" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODALES */}
      {modalTarea !== null && <ModalTarea tarea={modalTarea?.id ? modalTarea : modalTarea} proyectos={proyectos} presupuestos={presupuestos} onSave={guardarTarea} onClose={() => setModalTarea(null)} gcalConnected={gcalConnected} />}

      {modalProyecto && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 380, width: "100%", border: `1px solid ${C.border2}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Nuevo proyecto</div>
              <button onClick={() => setModalProyecto(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.muted }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Nombre *</label>
                <input style={inp} value={formProy.nombre} onChange={e => setFormProy(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del proyecto" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Vincular a presupuesto (opcional)</label>
                <select style={inp} value={formProy.presupuesto_id || ""} onChange={e => { const pid = e.target.value ? parseInt(e.target.value) : null; const p = presupuestos.find(x => x.id === pid); setFormProy(f => ({ ...f, presupuesto_id: pid, nombre: pid && !f.nombre ? (p?.nombre_obra || f.nombre) : f.nombre })); }}>
                  <option value="">Sin presupuesto</option>
                  {presupuestos.map(p => <option key={p.id} value={p.id}>{p.nombre_obra}{p.cliente_nombre ? ` — ${p.cliente_nombre}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8 }}>Color</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLORES_PROY.map(c => <button key={c} onClick={() => setFormProy(f => ({ ...f, color: c }))} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: formProy.color === c ? `3px solid ${C.text}` : "2px solid transparent", cursor: "pointer" }} />)}
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

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999, pointerEvents: "none", whiteSpace: "nowrap" }}>{toast}</div>}
    </div>
  );
}
