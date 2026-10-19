// FAIM OBRAS — Chat del bot de WhatsApp, como página propia.
// Mismo backend y mismo login (/admin/login, get_admin_user) que el panel de
// admin — solo que acá vive sola, sin el resto de la gestión de cuentas, para
// poder tenerla en un dominio/página aparte (ej: faimobras.online).
import { useState, useEffect, useRef } from "react";

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

function PanelBotWhatsApp({ token }) {
  const [leads, setLeads]           = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda]     = useState("");
  const [seleccionado, setSeleccionado] = useState(null); // detalle del lead abierto
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [textoHumano, setTextoHumano] = useState("");
  const [enviando, setEnviando]     = useState(false);
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

  return (
    <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
      {/* Lista de leads */}
      <div style={{ width:320, flexShrink:0, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:12, borderBottom:`1px solid ${C.border}`, display:"flex", flexDirection:"column", gap:8 }}>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar por nombre, tel o email..."
            style={{ padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:"none" }} />
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
            style={{ padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:"none", cursor:"pointer" }}>
            <option value="todos">Todos los estados</option>
            {ESTADOS_LEAD_BOT.map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}
          </select>
        </div>
        <div style={{ maxHeight:560, overflowY:"auto" }}>
          {loadingLista ? (
            <div style={{ padding:20, textAlign:"center", color:C.muted, fontSize:13 }}>Cargando...</div>
          ) : leadsFiltrados.length === 0 ? (
            <div style={{ padding:20, textAlign:"center", color:C.muted, fontSize:13 }}>Sin leads</div>
          ) : leadsFiltrados.map(l => (
            <div key={l.id} onClick={()=>abrirLead(l.id)}
              style={{ padding:"10px 12px", borderBottom:`1px solid ${C.border}`, cursor:"pointer",
                background: seleccionado?.id === l.id ? C.surface2 : "transparent" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{l.nombre || l.telefono}</span>
                {!l.bot_activo && <span title="Bot pausado" style={{ fontSize:11 }}>⏸</span>}
              </div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{l.telefono}</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:6 }}>
                <BadgeEstadoLead estado={l.estado} />
                <span style={{ fontSize:10, color:C.muted }}>{fmtHora(l.ultimo_mensaje_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detalle / conversación */}
      <div style={{ flex:1, background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, minHeight:400 }}>
        {!seleccionado ? (
          <div style={{ padding:40, textAlign:"center", color:C.muted, fontSize:13 }}>Elegí un lead de la lista para ver la conversación</div>
        ) : loadingDetalle ? (
          <div style={{ padding:40, textAlign:"center", color:C.muted, fontSize:13 }}>Cargando...</div>
        ) : (
          <>
            <div style={{ padding:"14px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color:C.text }}>{seleccionado.nombre || "Sin nombre"}</div>
                <div style={{ fontSize:12, color:C.muted }}>{seleccionado.telefono}{seleccionado.email ? ` · ${seleccionado.email}` : ""}</div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <select value={seleccionado.estado} onChange={e=>cambiarEstadoLead(e.target.value)}
                  style={{ padding:"6px 10px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:"pointer" }}>
                  {ESTADOS_LEAD_BOT.map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}
                </select>
                <button onClick={togglePausa}
                  style={{ padding:"6px 12px", fontSize:12, fontWeight:700, borderRadius:8, cursor:"pointer",
                    background: seleccionado.bot_activo ? "#fef2f2" : "#f0fdf4",
                    color: seleccionado.bot_activo ? C.red : C.green,
                    border: `1px solid ${seleccionado.bot_activo ? "#fecaca" : "#bbf7d0"}` }}>
                  {seleccionado.bot_activo ? "⏸ Pausar bot" : "▶ Reactivar bot"}
                </button>
              </div>
            </div>

            {seleccionado.archivos?.length > 0 && (
              <div style={{ padding:"10px 16px", borderBottom:`1px solid ${C.border}`, display:"flex", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, color:C.muted, fontWeight:700 }}>Archivos:</span>
                {seleccionado.archivos.map((a) => (
                  <button key={a.id} onClick={() => abrirArchivo(a.id)}
                    style={{ fontSize:12, color:C.accent2, border:"none", cursor:"pointer", fontWeight: a.tipo === "comprobante" ? 700 : 400,
                      background:C.surface2, padding:"3px 8px", borderRadius:6 }}>
                    📎 {a.tipo === "comprobante" ? "Comprobante" : (a.nombre_archivo || "Adjunto")}
                  </button>
                ))}
              </div>
            )}

            <div ref={chatRef} style={{ padding:16, display:"flex", flexDirection:"column", gap:10, maxHeight:380, overflowY:"auto" }}>
              {seleccionado.mensajes.length === 0 ? (
                <div style={{ color:C.muted, fontSize:13, textAlign:"center" }}>Todavía no hay mensajes</div>
              ) : seleccionado.mensajes.map((m,i) => {
                const deLead = m.direccion === "in";
                return (
                  <div key={m.id || i} style={{ display:"flex", alignItems:"center", gap:6, justifyContent: deLead ? "flex-start" : "flex-end" }}>
                    {!deLead && m.id && (
                      <button onClick={() => borrarMensaje(m)} title="Borrar mensaje"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.muted, padding:2, opacity:0.6 }}>🗑</button>
                    )}
                    <div style={{ maxWidth:"70%", padding:"8px 12px", borderRadius:12, fontSize:13,
                      background: deLead ? C.surface2 : (m.autor === "humano" ? "#eef2ff" : "#f0fdf4"),
                      color: C.text }}>
                      {m.tipo !== "texto" && <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", marginBottom:2 }}>{m.tipo}{m.autor === "humano" ? " · humano" : m.autor === "bot" ? " · bot" : ""}</div>}
                      <div>{m.contenido || (m.media_url ? "[archivo adjunto]" : "")}</div>
                      <div style={{ fontSize:10, color:C.muted, marginTop:4, textAlign:"right" }}>{fmtHora(m.created_at)}</div>
                    </div>
                    {deLead && m.id && (
                      <button onClick={() => borrarMensaje(m)} title="Borrar mensaje"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.muted, padding:2, opacity:0.6 }}>🗑</button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding:12, borderTop:`1px solid ${C.border}`, display:"flex", gap:8 }}>
              <input value={textoHumano} onChange={e=>setTextoHumano(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") enviarComoHumano(); }}
                placeholder="Responder como humano (esto no pausa el bot — pausalo con el botón de arriba si no querés que siga respondiendo)..."
                style={{ flex:1, padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, outline:"none" }} />
              <button onClick={enviarComoHumano} disabled={enviando || !textoHumano.trim()}
                style={{ padding:"9px 18px", background:C.accent, color:"white", border:"none", borderRadius:8, fontSize:13, fontWeight:700, cursor:"pointer", opacity: enviando ? 0.6 : 1 }}>
                Enviar
              </button>
            </div>
          </>
        )}
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

  return (
    <div style={{ minHeight:"100dvh", background:C.bg, fontFamily:"'Syne',sans-serif" }}>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.accent }}>FAIM OBRAS</div>
          <span style={{ fontSize:12, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>Chat del bot</span>
        </div>
        <button onClick={logout} style={{ fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>Cerrar sesión</button>
      </div>
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>
        <PanelBotWhatsApp token={token} />
      </div>
    </div>
  );
}
