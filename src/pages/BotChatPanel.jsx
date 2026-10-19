// FAIM OBRAS — Chat del bot de WhatsApp, como página propia.
// Mismo backend y mismo login (/admin/login, get_admin_user) que el panel de
// admin — solo que acá vive sola, sin el resto de la gestión de cuentas, para
// poder tenerla en un dominio/página aparte (ej: faimobras.online).
// Dinámica de uso calcada de WhatsApp/Mensajes.jsx: una sola pantalla a la
// vez (lista de conversaciones O la conversación abierta, con "volver"), para
// que funcione igual de bien instalada en el celular que en escritorio.
import { useState, useEffect, useRef } from "react";
import { Bell, BellOff, ChevronLeft, Send } from "lucide-react";
import { pushSoportado, pushEstado, activarPushAdmin } from "../pushAdmin";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", warn:"#d97706",
  red:"#ef4444", green:"#10b981",
};

// ── Bot WhatsApp ────────────────────────────────────────────────────────────
// Leads comerciales de FAIM OBRAS (no son de ningún tenant). El backend los
// protege con get_admin_user, no con get_tenant_id.
const ESTADOS_LEAD_BOT = ["nuevo", "calificando", "cotizado", "esperando_pago", "cliente", "perdido", "derivado"];

function BadgeEstadoLead({ estado }) {
  const colors = {
    nuevo:          { bg:"#eef2ff", color:"#4338ca", border:"#c7d2fe" },
    calificando:    { bg:"#fffbeb", color:"#d97706", border:"#fde68a" },
    cotizado:       { bg:"#f5f3ff", color:"#7c3aed", border:"#ddd6fe" },
    esperando_pago: { bg:"#fff7ed", color:"#c2410c", border:"#fed7aa" },
    cliente:        { bg:"#f0fdf4", color:"#059669", border:"#bbf7d0" },
    perdido:        { bg:"#f1f5f9", color:"#64748b", border:"#e2e8f0" },
    derivado:       { bg:"#fef2f2", color:"#ef4444", border:"#fecaca" },
  };
  const s = colors[estado] || colors.nuevo;
  return <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}`, textTransform:"capitalize" }}>{estado?.replace("_"," ")}</span>;
}

function fmtHora(iso) {
  if (!iso) return "";
  // El backend manda el datetime sin zona (naive UTC, como lo guarda Postgres
  // con server_default=func.now()). Sin la "Z", new Date() lo toma como hora
  // local y el horario del bot queda mostrado 3hs adelantado.
  const conZona = /[Zz]|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  const d = new Date(conZona);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function PanelBotWhatsApp({ token, onLogout }) {
  const [leads, setLeads]           = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda]     = useState("");
  const [seleccionado, setSeleccionado] = useState(null); // detalle del lead abierto
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [textoHumano, setTextoHumano] = useState("");
  const [enviando, setEnviando]     = useState(false);
  const [permisoPush, setPermisoPush] = useState(pushEstado());
  const chatRef = useRef(null);          // contenedor con scroll de la conversación
  const ultimoLeadScrolleado = useRef(null);
  const cantMensajesPrevia = useRef(0);

  useEffect(() => { cargarLista(); }, [filtroEstado]);

  // Como en WhatsApp: al abrir una conversación se ve el último mensaje. Cuando entra uno
  // nuevo (polling) baja solo, salvo que el usuario esté leyendo más arriba.
  useEffect(() => {
    const el = chatRef.current;
    if (!el || !seleccionado) return;
    const cant = seleccionado.mensajes?.length || 0;
    const abrioOtro = ultimoLeadScrolleado.current !== seleccionado.id;
    const cercaDelFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (abrioOtro || (cant > cantMensajesPrevia.current && cercaDelFinal)) {
      el.scrollTop = el.scrollHeight;
    }
    ultimoLeadScrolleado.current = seleccionado.id;
    cantMensajesPrevia.current = cant;
  }, [seleccionado]);

  // Polling: la lista de leads y la conversación abierta se refrescan solas,
  // para no depender de que alguien recargue la página a mano para ver un
  // mensaje nuevo entrar.
  useEffect(() => {
    const t = setInterval(() => { cargarLista(true); }, 8000);
    return () => clearInterval(t);
  }, [filtroEstado]);

  useEffect(() => {
    if (!seleccionado) return;
    const t = setInterval(() => { abrirLead(seleccionado.id, true); }, 5000);
    return () => clearInterval(t);
  }, [seleccionado?.id]);

  const cargarLista = async (silencioso) => {
    if (!silencioso) setLoadingLista(true);
    try {
      const qs = filtroEstado !== "todos" ? `?estado=${filtroEstado}` : "";
      const r = await fetch(`${API}/whatsapp/admin/leads${qs}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setLeads(await r.json());
    } catch {}
    if (!silencioso) setLoadingLista(false);
  };

  const abrirLead = async (id, silencioso) => {
    if (!silencioso) setLoadingDetalle(true);
    try {
      const r = await fetch(`${API}/whatsapp/admin/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setSeleccionado(await r.json());
    } catch {}
    if (!silencioso) setLoadingDetalle(false);
  };

  // Borra un mensaje del panel y de la memoria del bot. No lo saca del WhatsApp del
  // cliente: la API de WhatsApp Business no permite "eliminar para todos".
  const borrarMensaje = async (m) => {
    if (!m.id) return;
    if (!window.confirm("¿Borrar este mensaje del panel y de la memoria del bot?\n\nOjo: al cliente le sigue apareciendo en su WhatsApp (WhatsApp no permite borrarlo desde la API).")) return;
    try {
      const r = await fetch(`${API}/whatsapp/admin/mensajes/${m.id}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setSeleccionado(s => s ? { ...s, mensajes: s.mensajes.filter(x => x.id !== m.id) } : s);
      } else {
        alert("No se pudo borrar el mensaje");
      }
    } catch { alert("Error de conexión"); }
  };

  const refrescarDetalle = () => { if (seleccionado) abrirLead(seleccionado.id); };

  const enviarComoHumano = async () => {
    if (!textoHumano.trim() || !seleccionado) return;
    setEnviando(true);
    try {
      const r = await fetch(`${API}/whatsapp/admin/leads/${seleccionado.id}/mensaje`, {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoHumano.trim() }),
      });
      if (r.ok) { setTextoHumano(""); await refrescarDetalle(); await cargarLista(); }
      else {
        const err = await r.json().catch(() => ({}));
        alert(err.detail || "No se pudo enviar el mensaje");
      }
    } catch { alert("Error de conexión"); }
    setEnviando(false);
  };

  // Los archivos se sirven con el token de admin, así que no alcanza con un <a href>:
  // se bajan como blob y se abren en una pestaña nueva.
  const abrirArchivo = async (archivoId) => {
    const ventana = window.open("", "_blank");
    try {
      const r = await fetch(`${API}/whatsapp/admin/archivos/${archivoId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { ventana?.close(); alert("No se pudo abrir el archivo"); return; }
      const url = URL.createObjectURL(await r.blob());
      if (ventana) ventana.location.href = url; else window.open(url, "_blank");
    } catch { ventana?.close(); alert("Error de conexión"); }
  };

  const togglePausa = async () => {
    if (!seleccionado) return;
    const accion = seleccionado.bot_activo ? "pausar" : "reactivar";
    await fetch(`${API}/whatsapp/admin/leads/${seleccionado.id}/${accion}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` },
    });
    await refrescarDetalle();
    await cargarLista();
  };

  const cambiarEstadoLead = async (estado) => {
    if (!seleccionado) return;
    await fetch(`${API}/whatsapp/admin/leads/${seleccionado.id}/estado`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await refrescarDetalle();
    await cargarLista();
  };

  const leadsFiltrados = leads.filter(l => {
    if (!busqueda.trim()) return true;
    const q = busqueda.trim().toLowerCase();
    return (l.nombre || "").toLowerCase().includes(q) || (l.telefono || "").includes(q) || (l.email || "").toLowerCase().includes(q);
  });

  const abrir = (l) => { setSeleccionado(null); abrirLead(l.id); };
  const volverALista = () => { setSeleccionado(null); cargarLista(); };

  const pedirPush = async () => {
    const r = await activarPushAdmin(token);
    setPermisoPush(pushEstado());
    if (!r.ok && r.motivo === "sin_permiso") {
      alert("El navegador no te dejó activar notificaciones. Podés habilitarlas desde los permisos del sitio.");
    }
  };

  // ── Pantalla de conversación (una por vez, como WhatsApp) ──────────────────
  if (seleccionado || loadingDetalle) {
    return (
      <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:C.bg, fontFamily:"'Syne',sans-serif" }}>
        <div style={{ padding:"10px 14px", borderBottom:`1px solid ${C.border}`, background:C.surface,
          display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <button onClick={volverALista} title="Volver"
            style={{ display:"flex", alignItems:"center", background:"none", border:"none", cursor:"pointer", color:C.text, padding:4, flexShrink:0 }}>
            <ChevronLeft size={22} />
          </button>
          {seleccionado && (
            <>
              <div style={{ flex:1, minWidth:120 }}>
                <div style={{ fontWeight:800, fontSize:14.5, color:C.text }}>{seleccionado.nombre || "Sin nombre"}</div>
                <div style={{ fontSize:11.5, color:C.muted }}>{seleccionado.telefono}{seleccionado.email ? ` · ${seleccionado.email}` : ""}</div>
              </div>
              <select value={seleccionado.estado} onChange={e=>cambiarEstadoLead(e.target.value)}
                style={{ padding:"6px 8px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:"pointer" }}>
                {ESTADOS_LEAD_BOT.map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}
              </select>
              <button onClick={togglePausa}
                style={{ padding:"6px 10px", fontSize:12, fontWeight:700, borderRadius:8, cursor:"pointer", whiteSpace:"nowrap",
                  background: seleccionado.bot_activo ? "#fef2f2" : "#f0fdf4",
                  color: seleccionado.bot_activo ? C.red : C.green,
                  border: `1px solid ${seleccionado.bot_activo ? "#fecaca" : "#bbf7d0"}` }}>
                {seleccionado.bot_activo ? "⏸ Pausar" : "▶ Reactivar"}
              </button>
            </>
          )}
        </div>

        {loadingDetalle ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:C.muted, fontSize:13 }}>Cargando...</div>
        ) : (
          <>
            {seleccionado.archivos?.length > 0 && (
              <div style={{ padding:"8px 14px", borderBottom:`1px solid ${C.border}`, background:C.surface, display:"flex", gap:8, flexWrap:"wrap" }}>
                {seleccionado.archivos.map((a) => (
                  <button key={a.id} onClick={() => abrirArchivo(a.id)}
                    style={{ fontSize:12, color:C.accent2, border:"none", cursor:"pointer", fontWeight: a.tipo === "comprobante" ? 700 : 400,
                      background:C.surface2, padding:"3px 8px", borderRadius:6 }}>
                    📎 {a.tipo === "comprobante" ? "Comprobante" : (a.nombre_archivo || "Adjunto")}
                  </button>
                ))}
              </div>
            )}

            <div ref={chatRef} style={{ flex:1, overflowY:"auto", padding:14, display:"flex", flexDirection:"column", gap:8 }}>
              {seleccionado.mensajes.length === 0 ? (
                <div style={{ color:C.muted, fontSize:13, textAlign:"center", marginTop:20 }}>Todavía no hay mensajes</div>
              ) : seleccionado.mensajes.map((m,i) => {
                const deLead = m.direccion === "in";
                return (
                  <div key={m.id || i} style={{ display:"flex", alignItems:"center", gap:4, justifyContent: deLead ? "flex-start" : "flex-end" }}>
                    {!deLead && m.id && (
                      <button onClick={() => borrarMensaje(m)} title="Borrar mensaje"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.muted, padding:2, opacity:0.5 }}>🗑</button>
                    )}
                    <div style={{ maxWidth:"78%", padding:"8px 12px", borderRadius:14, fontSize:13.5, lineHeight:1.4,
                      background: deLead ? C.surface : (m.autor === "humano" ? C.accent : "#f0fdf4"),
                      color: deLead ? C.text : (m.autor === "humano" ? "#fff" : C.text),
                      border: deLead ? `1px solid ${C.border}` : "none" }}>
                      {m.tipo !== "texto" && <div style={{ fontSize:10, opacity:0.75, textTransform:"uppercase", marginBottom:2 }}>{m.tipo}{m.autor === "humano" ? " · humano" : m.autor === "bot" ? " · bot" : ""}</div>}
                      <div style={{ whiteSpace:"pre-wrap" }}>{m.contenido || (m.media_url ? "[archivo adjunto]" : "")}</div>
                      <div style={{ fontSize:10, opacity:0.7, marginTop:3, textAlign:"right" }}>{fmtHora(m.created_at)}</div>
                    </div>
                    {deLead && m.id && (
                      <button onClick={() => borrarMensaje(m)} title="Borrar mensaje"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.muted, padding:2, opacity:0.5 }}>🗑</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ borderTop:`1px solid ${C.border}`, background:C.surface, padding:10, display:"flex", gap:8 }}>
              <input value={textoHumano} onChange={e=>setTextoHumano(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); enviarComoHumano(); } }}
                placeholder="Responder como humano..."
                style={{ flex:1, padding:"10px 14px", borderRadius:20, border:`1px solid ${C.border}`, background:C.surface2, color:C.text, fontFamily:"inherit", fontSize:14, outline:"none" }} />
              <button onClick={enviarComoHumano} disabled={enviando || !textoHumano.trim()}
                style={{ width:40, height:40, borderRadius:"50%", border:"none", cursor: textoHumano.trim() ? "pointer" : "default", flexShrink:0,
                  background: textoHumano.trim() ? C.accent : C.surface2, color: textoHumano.trim() ? "#fff" : C.muted,
                  display:"flex", alignItems:"center", justifyContent:"center", opacity: enviando ? 0.6 : 1 }}>
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Pantalla de lista (conversaciones, más reciente arriba) ────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", background:C.bg, fontFamily:"'Syne',sans-serif" }}>
      <div style={{ padding:"12px 16px", borderBottom:`1px solid ${C.border}`, background:C.surface, display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:17, fontWeight:800, color:C.text }}>Chat del bot</div>
          <div style={{ fontSize:11, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>FAIM OBRAS</div>
        </div>
        {pushSoportado() && permisoPush !== "granted" && (
          <button onClick={pedirPush} title="Activar notificaciones"
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 10px", borderRadius:18, cursor:"pointer",
              fontFamily:"inherit", fontSize:12, fontWeight:600, border:`1px solid ${C.accent}`, background:"rgba(5,150,105,.08)", color:C.accent }}>
            <Bell size={13} /> Notificaciones
          </button>
        )}
        {onLogout && (
          <button onClick={onLogout} style={{ fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>Salir</button>
        )}
      </div>

      {pushSoportado() && permisoPush !== "granted" && (
        <div style={{ padding:"7px 16px", background:"rgba(217,119,6,.08)", color:C.warn, fontSize:11.5, display:"flex", alignItems:"center", gap:6 }}>
          <BellOff size={12} /> Si instalaste esta página como app en el celular, activá las notificaciones para enterarte de las derivaciones sin tener que estar mirando.
        </div>
      )}

      <div style={{ padding:10, borderBottom:`1px solid ${C.border}`, background:C.surface, display:"flex", flexDirection:"column", gap:8 }}>
        <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre, tel o email..."
          style={{ padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13.5, outline:"none", background:C.surface2 }} />
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
          style={{ padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", cursor:"pointer", background:C.surface2 }}>
          <option value="todos">Todos los estados</option>
          {ESTADOS_LEAD_BOT.map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}
        </select>
      </div>

      <div style={{ flex:1, overflowY:"auto" }}>
        {loadingLista ? (
          <div style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13.5 }}>Cargando...</div>
        ) : leadsFiltrados.length === 0 ? (
          <div style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13.5 }}>Sin leads</div>
        ) : leadsFiltrados.map(l => (
          <button key={l.id} onClick={()=>abrir(l)}
            style={{ width:"100%", background:"none", border:"none", borderBottom:`1px solid ${C.border}`,
              padding:"13px 16px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:C.surface2, border:`1px solid ${C.border}`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:C.muted, flexShrink:0,
              fontFamily:"'IBM Plex Mono', monospace" }}>
              {(l.nombre || l.telefono || "??").trim().slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{l.nombre || l.telefono}</span>
                {!l.bot_activo && <span title="Bot pausado" style={{ fontSize:11 }}>⏸</span>}
              </div>
              <div style={{ fontSize:12, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.telefono}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
              <span style={{ fontSize:10.5, color:C.muted }}>{fmtHora(l.ultimo_mensaje_at)}</span>
              <BadgeEstadoLead estado={l.estado} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main (login + página) ──────────────────────────────────────────────────
export default function BotChatPanel() {
  const [token, setToken]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass]   = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("obras_admin_token");
    if (t) setToken(t);
    setLoading(false);
  }, []);

  const loginAdmin = async () => {
    setLoginError("");
    try {
      const res = await fetch(`${API}/admin/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("obras_admin_token", data.token);
        setToken(data.token);
      } else setLoginError("Credenciales incorrectas");
    } catch { setLoginError("Error de conexión"); }
  };

  const logout = () => {
    localStorage.removeItem("obras_admin_token");
    setToken(null);
  };

  if (loading) return null;

  if (!token) return (
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:48, width:320, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.accent, marginBottom:4 }}>FAIM OBRAS</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:32, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"2px" }}>CHAT DEL BOT</div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Email</label>
          <input value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} type="email"
            style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, boxSizing:"border-box", background:C.surface2, outline:"none" }} />
        </div>
        <div style={{ marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Contraseña</label>
          <input value={loginPass} onChange={e=>setLoginPass(e.target.value)} type="password" onKeyDown={e=>e.key==="Enter"&&loginAdmin()}
            style={{ width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, boxSizing:"border-box", background:C.surface2, outline:"none" }} />
        </div>
        {loginError && <div style={{ color:C.red, fontSize:13, marginBottom:12, textAlign:"center" }}>{loginError}</div>}
        <button onClick={loginAdmin} style={{ width:"100%", padding:12, background:C.accent, color:"white", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>
          Ingresar
        </button>
      </div>
    </div>
  );

  return <PanelBotWhatsApp token={token} onLogout={logout} />;
}
