// FAIM OBRAS — Chat del bot de WhatsApp, como página propia.
// Mismo backend y mismo login (/admin/login, get_admin_user) que el panel de
// admin — solo que acá vive sola, sin el resto de la gestión de cuentas, para
// poder tenerla en un dominio/página aparte (ej: faimobras.online).
// Dinámica de uso calcada de WhatsApp/Mensajes.jsx: una sola pantalla a la
// vez (lista de conversaciones O la conversación abierta, con "volver"), para
// que funcione igual de bien instalada en el celular que en escritorio.
import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Bell, BellOff, ChevronLeft, Send, Star } from "lucide-react";
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
// Clientes son otra categoría, no un paso más del embudo de venta: tienen su propio botón,
// separado del desplegable de estados de prospecto.
const ESTADOS_FILTRO = ESTADOS_LEAD_BOT.filter(e => e !== "cliente");

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

function PanelBotWhatsApp({ token, onLogout, onSesionExpirada }) {
  const [leads, setLeads]           = useState([]);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [busqueda, setBusqueda]     = useState("");
  const [seleccionado, setSeleccionado] = useState(null); // detalle del lead abierto
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [textoHumano, setTextoHumano] = useState("");
  const [enviando, setEnviando]     = useState(false);
  const [permisoPush, setPermisoPush] = useState(pushEstado());
  const [marcados, setMarcados] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bot_leads_marcados") || "{}"); }
    catch { return {}; }
  });
  // Última vez que un humano (no el bot) miró la conversación de cada lead, por su
  // propio ultimo_mensaje_at (que solo avanza con mensajes entrantes). Si el lead
  // escribió después de esa marca, está "no visto" aunque el bot ya le haya contestado.
  const [vistos, setVistos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("bot_leads_vistos") || "{}"); }
    catch { return {}; }
  });
  const chatRef = useRef(null);          // contenedor con scroll de la conversación
  const listaRef = useRef(null);         // contenedor con scroll de la lista de chats
  const scrollListaGuardado = useRef(0);
  const abrioNuevaConversacion = useRef(false); // fuerza ir al final al entrar, incluso reabriendo el mismo chat
  const cantMensajesPrevia = useRef(0);

  const toggleMarcado = (id) => {
    setMarcados(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      localStorage.setItem("bot_leads_marcados", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => { cargarLista(); }, [filtroEstado]);

  // Como en WhatsApp: al abrir una conversación (incluso una ya vista antes) se ve el
  // último mensaje, nunca el principio. Cuando entra uno nuevo por polling baja solo,
  // salvo que el usuario esté leyendo más arriba. useLayoutEffect para que el salto pase
  // antes de pintar, sin que se llegue a ver un instante el tope de la conversación.
  useLayoutEffect(() => {
    const el = chatRef.current;
    if (!el || !seleccionado) return;
    const cant = seleccionado.mensajes?.length || 0;
    const cercaDelFinal = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (abrioNuevaConversacion.current || (cant > cantMensajesPrevia.current && cercaDelFinal)) {
      el.scrollTop = el.scrollHeight;
      abrioNuevaConversacion.current = false;
    }
    cantMensajesPrevia.current = cant;
  }, [seleccionado]);

  // La lista pierde el scroll al entrar a una conversación porque es una pantalla
  // distinta (se desmonta del todo). Al volver, se restaura la posición en la que se
  // había quedado, para no tener que volver a buscar el chat.
  useEffect(() => {
    if (!seleccionado && !loadingLista && listaRef.current) {
      listaRef.current.scrollTop = scrollListaGuardado.current;
    }
  }, [seleccionado, loadingLista]);

  // Mientras la conversación está abierta, cada mensaje entrante que llega (por polling
  // de la lista) queda marcado como visto. Si se cierra sin leer, la marca se queda en el
  // último mensaje visto y la lista la muestra como pendiente, aunque el bot ya respondió.
  useEffect(() => {
    if (!seleccionado) return;
    const lead = leads.find(l => l.id === seleccionado.id);
    if (!lead?.ultimo_mensaje_at || vistos[seleccionado.id] === lead.ultimo_mensaje_at) return;
    setVistos(prev => {
      const next = { ...prev, [seleccionado.id]: lead.ultimo_mensaje_at };
      localStorage.setItem("bot_leads_vistos", JSON.stringify(next));
      return next;
    });
  }, [leads, seleccionado]);

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
      else if (r.status === 401) return onSesionExpirada();
    } catch {}
    if (!silencioso) setLoadingLista(false);
  };

  const abrirLead = async (id, silencioso) => {
    if (!silencioso) setLoadingDetalle(true);
    try {
      const r = await fetch(`${API}/whatsapp/admin/leads/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setSeleccionado(await r.json());
      else if (r.status === 401) return onSesionExpirada();
    } catch {}
    if (!silencioso) setLoadingDetalle(false);
  };

  // Las imágenes se ven en la burbuja del mensaje, no solo como adjunto para abrir aparte.
  // El endpoint pide el token de admin, así que no alcanza con un <img src>: se bajan como
  // blob (como abrirArchivo) y se cachean por id de archivo.
  const [imagenes, setImagenes] = useState({});

  useEffect(() => {
    setImagenes(prev => { Object.values(prev).forEach(u => URL.revokeObjectURL(u)); return {}; });
  }, [seleccionado?.id]);

  useEffect(() => {
    (seleccionado?.archivos || []).filter(a => a.mime_type?.startsWith("image/")).forEach(a => {
      if (imagenes[a.id]) return;
      fetch(`${API}/whatsapp/admin/archivos/${a.id}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => (r.ok ? r.blob() : null))
        .then(blob => { if (blob) setImagenes(prev => ({ ...prev, [a.id]: URL.createObjectURL(blob) })); })
        .catch(() => {});
    });
  }, [seleccionado?.archivos]);

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

  const abrir = (l) => { abrioNuevaConversacion.current = true; setSeleccionado(null); abrirLead(l.id); };
  const volverALista = () => { setSeleccionado(null); cargarLista(true); };

  // Volver deslizando desde el borde izquierdo, como el gesto nativo de iOS. Solo se mide
  // el gesto (sin mover nada con el dedo mientras se desliza, eso tocaba el DOM a mitad del
  // toque y quedaba la pantalla rota en iOS) y recién al soltar, si corresponde, se navega.
  const swipeRef = useRef({ activo: false, startX: 0, startY: 0 });

  const onTouchStartConv = (e) => {
    const t = e.touches[0];
    if (t.clientX > 24) return;
    swipeRef.current = { activo: true, startX: t.clientX, startY: t.clientY };
  };
  const onTouchEndConv = (e) => {
    const s = swipeRef.current;
    if (!s.activo) return;
    s.activo = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.startX;
    const dy = t.clientY - s.startY;
    if (dx > 60 && Math.abs(dy) < 50) volverALista();
  };

  const pedirPush = async () => {
    const r = await activarPushAdmin(token);
    setPermisoPush(pushEstado());
    if (r.ok) alert("Listo, quedaste suscripto de nuevo. Probá mandarte un push de prueba.");
    else if (r.motivo === "sin_permiso") {
      alert("El navegador no te dejó activar notificaciones. Podés habilitarlas desde los permisos del sitio.");
    } else alert("No se pudo renovar la suscripción. Probá de nuevo en un rato.");
  };

  // ── Pantalla de conversación (una por vez, como WhatsApp) ──────────────────
  if (seleccionado || loadingDetalle) {
    return (
      <div onTouchStart={onTouchStartConv} onTouchEnd={onTouchEndConv}
        style={{ display:"flex", flexDirection:"column", height:"100dvh", background:C.bg, fontFamily:"'Syne',sans-serif" }}>
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
              <button onClick={() => toggleMarcado(seleccionado.id)}
                title={marcados[seleccionado.id] ? "Quitar marca" : "Marcar para escribir mañana"}
                style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", flexShrink:0 }}>
                <Star size={19} fill={marcados[seleccionado.id] ? C.warn : "none"} color={marcados[seleccionado.id] ? C.warn : C.muted} />
              </button>
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
                const archivoImg = seleccionado.archivos?.find(a => a.mensaje_id === m.id && a.mime_type?.startsWith("image/"));
                // El corchete es la etiqueta interna para el agente ("[El lead envió una
                // imagen] <caption>"); acá ya se ve la imagen, así que solo interesa el resto.
                const textoLimpio = archivoImg ? (m.contenido || "").replace(/^\[[^\]]+\]\s*/, "") : m.contenido;
                return (
                  <div key={m.id || i} style={{ display:"flex", alignItems:"center", gap:4, justifyContent: deLead ? "flex-start" : "flex-end" }}>
                    {!deLead && m.id && (
                      <button onClick={() => borrarMensaje(m)} title="Borrar mensaje"
                        style={{ background:"none", border:"none", cursor:"pointer", fontSize:13, color:C.muted, padding:2, opacity:0.5 }}>🗑</button>
                    )}
                    <div style={{ maxWidth:"78%", padding: m.tipo === "reaction" ? "4px 10px" : "8px 12px", borderRadius:14, fontSize:13.5, lineHeight:1.4,
                      background: deLead ? C.surface : (m.autor === "humano" ? C.accent : "#f0fdf4"),
                      color: deLead ? C.text : (m.autor === "humano" ? "#fff" : C.text),
                      border: deLead ? `1px solid ${C.border}` : "none" }}>
                      {m.tipo === "reaction" ? (
                        <div style={{ fontSize:24, lineHeight:1.2 }}>{m.contenido || "🙂"}</div>
                      ) : (
                        <>
                          {m.tipo !== "texto" && !archivoImg && <div style={{ fontSize:10, opacity:0.75, textTransform:"uppercase", marginBottom:2 }}>{m.tipo}{m.autor === "humano" ? " · humano" : m.autor === "bot" ? " · bot" : ""}</div>}
                          {archivoImg && (
                            imagenes[archivoImg.id] ? (
                              <img src={imagenes[archivoImg.id]} alt="Imagen enviada" onClick={() => abrirArchivo(archivoImg.id)}
                                style={{ maxWidth:220, maxHeight:280, borderRadius:10, display:"block", cursor:"pointer", marginBottom: textoLimpio ? 4 : 0 }} />
                            ) : (
                              <div style={{ width:180, height:120, borderRadius:10, background:C.surface2, display:"flex",
                                alignItems:"center", justifyContent:"center", color:C.muted, fontSize:11, marginBottom: textoLimpio ? 4 : 0 }}>Cargando imagen...</div>
                            )
                          )}
                          {(textoLimpio || (!archivoImg && m.media_url)) && (
                            <div style={{ whiteSpace:"pre-wrap" }}>{textoLimpio || "[archivo adjunto]"}</div>
                          )}
                        </>
                      )}
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
        {pushSoportado() && (
          <button onClick={pedirPush}
            title={permisoPush === "granted" ? "Volver a activar: por si la suscripción quedó vieja y no te llegan" : "Activar notificaciones"}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 10px", borderRadius:18, cursor:"pointer",
              fontFamily:"inherit", fontSize:12, fontWeight:600, border:`1px solid ${C.accent}`, background:"rgba(5,150,105,.08)", color:C.accent }}>
            <Bell size={13} /> {permisoPush === "granted" ? "Renovar notif." : "Notificaciones"}
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
        <div style={{ display:"flex", gap:8 }}>
          <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}
            style={{ flex:1, padding:"8px 10px", border:`1px solid ${C.border}`, borderRadius:10, fontSize:13, outline:"none", cursor:"pointer", background:C.surface2 }}>
            <option value="todos">Todos los estados</option>
            {ESTADOS_FILTRO.map(e => <option key={e} value={e}>{e.replace("_"," ")}</option>)}
          </select>
          <button onClick={() => setFiltroEstado(filtroEstado === "cliente" ? "todos" : "cliente")}
            style={{ padding:"8px 14px", borderRadius:10, fontSize:13, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap",
              border:`1px solid ${filtroEstado === "cliente" ? C.accent : C.border}`,
              background: filtroEstado === "cliente" ? C.accent : C.surface2,
              color: filtroEstado === "cliente" ? "#fff" : C.text }}>
            Clientes
          </button>
        </div>
      </div>

      <div ref={listaRef} onScroll={e => { scrollListaGuardado.current = e.currentTarget.scrollTop; }}
        style={{ flex:1, overflowY:"auto" }}>
        {loadingLista ? (
          <div style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13.5 }}>Cargando...</div>
        ) : leadsFiltrados.length === 0 ? (
          <div style={{ padding:30, textAlign:"center", color:C.muted, fontSize:13.5 }}>Sin leads</div>
        ) : leadsFiltrados.map(l => {
          const noVisto = !!l.ultimo_mensaje_at && (!vistos[l.id] || new Date(l.ultimo_mensaje_at) > new Date(vistos[l.id]));
          return (
          <div key={l.id} onClick={()=>abrir(l)} role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === "Enter") abrir(l); }}
            style={{ width:"100%", background: marcados[l.id] ? "#fffbeb" : "none", border:"none", borderBottom:`1px solid ${C.border}`,
              padding:"13px 16px", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:38, height:38, borderRadius:"50%", background:C.surface2, border:`1px solid ${C.border}`,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:C.muted, flexShrink:0,
              fontFamily:"'IBM Plex Mono', monospace" }}>
              {(l.nombre || l.telefono || "??").trim().slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {noVisto && <span title="Sin leer" style={{ width:9, height:9, borderRadius:"50%", background:C.accent2, flexShrink:0 }} />}
                <span style={{ fontSize:14, fontWeight: noVisto ? 800 : 700, color:C.text }}>{l.nombre || l.telefono}</span>
                {!l.bot_activo && <span title="Bot pausado" style={{ fontSize:11 }}>⏸</span>}
              </div>
              <div style={{ fontSize:12, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.telefono}</div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
              <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                <span style={{ fontSize:10.5, color:C.muted }}>{fmtHora(l.ultimo_mensaje_at)}</span>
                <button onClick={e => { e.stopPropagation(); toggleMarcado(l.id); }}
                  title={marcados[l.id] ? "Quitar marca" : "Marcar para escribir mañana"}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:2, display:"flex" }}>
                  <Star size={14} fill={marcados[l.id] ? C.warn : "none"} color={marcados[l.id] ? C.warn : C.muted} />
                </button>
              </div>
              <BadgeEstadoLead estado={l.estado} />
            </div>
          </div>
          );
        })}
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
  const [sesionExpirada, setSesionExpirada] = useState(false);

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
        setSesionExpirada(false);
      } else setLoginError("Credenciales incorrectas");
    } catch { setLoginError("Error de conexión"); }
  };

  const logout = () => {
    localStorage.removeItem("obras_admin_token");
    setToken(null);
  };

  // El backend devuelve 401 cuando el token guardado ya no es válido (venció
  // a los 7 días, o quedó firmado con un JWT_SECRET viejo tras un redeploy).
  // Antes esto fallaba en silencio: la lista/conversación quedaba vacía sin
  // avisar nada, como si "no cargaran los mensajes".
  const sesionExpiradaHandler = () => {
    localStorage.removeItem("obras_admin_token");
    setToken(null);
    setSesionExpirada(true);
  };

  if (loading) return null;

  if (!token) return (
    <div style={{ minHeight:"100dvh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:48, width:320, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.accent, marginBottom:4 }}>FAIM OBRAS</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:32, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"2px" }}>CHAT DEL BOT</div>
        {sesionExpirada && <div style={{ color:C.warn, fontSize:13, marginBottom:16, textAlign:"center" }}>Tu sesión expiró. Volvé a ingresar.</div>}
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

  return <PanelBotWhatsApp token={token} onLogout={logout} onSesionExpirada={sesionExpiradaHandler} />;
}
