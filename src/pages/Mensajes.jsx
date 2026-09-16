import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Bell, BellOff } from "lucide-react";
import api from "../cotizador/api";
import { pushSoportado, pushEstado, activarPush } from "../push";

// Mensajes 1 a 1 entre gente del mismo estudio. Sin grupos, sin adjuntos: es
// para dejar un aviso rápido sin salir del sistema ni mandarlo por WhatsApp.
// Si tiene el push activado, le suena aunque tenga la app cerrada.

const C = { bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5", border:"#e0e0e8",
            text:"#1a1a2e", muted:"#6b7280", accent:"#059669", accent2:"#7c3aed",
            warn:"#d97706", red:"#ef4444" };

const fmtHora = (iso) => {
  try { return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
};
const fmtFechaCorta = (iso) => {
  try {
    const d = new Date(iso), hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) return fmtHora(iso);
    return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
};

export default function Mensajes() {
  const navigate = useNavigate();
  const [contactos, setContactos] = useState(null);
  const [activo, setActivo] = useState(null); // contacto abierto
  const [hilo, setHilo] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [permiso, setPermiso] = useState(pushEstado());
  const scrollRef = useRef(null);

  const cargarContactos = useCallback(() => {
    api.get("/mensajes/contactos").then(r => setContactos(r.data || [])).catch(() => setContactos([]));
  }, []);
  useEffect(() => { cargarContactos(); }, [cargarContactos]);

  const cargarHilo = useCallback((contactoId, silencioso = false) => {
    if (!silencioso) setHilo([]);
    api.get(`/mensajes/${contactoId}`).then(r => setHilo(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activo) return;
    cargarHilo(activo.id);
    const t = setInterval(() => cargarHilo(activo.id, true), 4000);
    return () => clearInterval(t);
  }, [activo, cargarHilo]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [hilo]);

  const abrir = (c) => { setActivo(c); setTexto(""); };

  const volverALista = () => {
    setActivo(null);
    cargarContactos(); // refresca no_leidos y último mensaje de la lista
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !activo || enviando) return;
    setEnviando(true);
    setTexto("");
    try {
      await api.post("/mensajes", { destinatario_id: activo.id, texto: t });
      cargarHilo(activo.id, true);
    } catch (e) {
      setTexto(t); // se lo devolvemos si falló, para no perder lo escrito
    }
    setEnviando(false);
  };

  const pedirPush = async () => {
    const r = await activarPush();
    setPermiso(pushEstado());
    if (!r.ok && r.motivo === "sin_permiso") {
      alert("El navegador no te dejó activar notificaciones. Podés habilitarlas desde los permisos del sitio.");
    }
  };

  if (contactos === null) {
    return <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", alignItems: "center",
                         justifyContent: "center", color: C.accent, fontFamily: "'Syne',sans-serif" }}>Cargando…</div>;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", color: C.text, fontFamily: "'Syne',sans-serif" }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={activo ? volverALista : () => navigate("/")}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px",
                   cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.muted }}>
          ← {activo ? "Mensajes" : "Volver"}
        </button>
        <div style={{ fontSize: 17, fontWeight: 800 }}>{activo ? activo.nombre : "Mensajes"}</div>
        {!activo && pushSoportado() && permiso !== "granted" && (
          <button onClick={pedirPush}
            style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "6px 12px",
                     borderRadius: 18, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600,
                     border: `1px solid ${C.accent}`, background: "rgba(5,150,105,.08)", color: C.accent }}>
            <Bell size={13} /> Activar notificaciones
          </button>
        )}
      </div>

      {!pushSoportado() && !activo && (
        <div style={{ padding: "9px 16px", background: "rgba(107,114,128,.10)", color: C.muted, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
          <BellOff size={13} /> Este navegador no permite notificaciones push acá. En el celular, agregá la app a la pantalla de inicio para poder activarlas.
        </div>
      )}

      {!activo ? (
        <div>
          {contactos.length === 0 && (
            <div style={{ padding: 30, textAlign: "center", color: C.muted, fontSize: 13.5 }}>
              No hay nadie más cargado en el estudio todavía.
            </div>
          )}
          {contactos.map(c => (
            <button key={c.id} onClick={() => abrir(c)}
              style={{ width: "100%", background: "none", border: "none", borderBottom: `1px solid ${C.border}`,
                       padding: "13px 16px", cursor: "pointer", textAlign: "left", display: "flex",
                       alignItems: "center", gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.surface2, border: `1px solid ${C.border}`,
                            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                            color: C.muted, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
                {(c.nombre || "??").trim().slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: c.no_leidos ? 800 : 600, marginBottom: 2 }}>{c.nombre}</div>
                <div style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.ultimo_texto ? (c.ultimo_es_mio ? "Vos: " : "") + c.ultimo_texto : "Sin mensajes todavía"}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                {c.ultimo_fecha && <div style={{ fontSize: 10.5, color: C.muted }}>{fmtFechaCorta(c.ultimo_fecha)}</div>}
                {c.no_leidos > 0 && (
                  <div style={{ background: C.red, color: "#fff", borderRadius: 10, minWidth: 18, height: 18, fontSize: 10.5,
                                fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                    {c.no_leidos}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100dvh - 53px)" }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            {hilo.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.es_mio ? "flex-end" : "flex-start" }}>
                <div style={{ maxWidth: "78%", background: m.es_mio ? C.accent : C.surface,
                              color: m.es_mio ? "#fff" : C.text,
                              border: m.es_mio ? "none" : `1px solid ${C.border}`,
                              borderRadius: 14, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.4 }}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.texto}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3, textAlign: "right" }}>{fmtHora(m.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: 10, display: "flex", gap: 8 }}>
            <input value={texto} onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
              placeholder="Escribí un mensaje..."
              style={{ flex: 1, padding: "10px 14px", borderRadius: 20, border: `1px solid ${C.border}`,
                       background: C.surface2, color: C.text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
            <button onClick={enviar} disabled={!texto.trim() || enviando}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", cursor: texto.trim() ? "pointer" : "default",
                       background: texto.trim() ? C.accent : C.surface2, color: texto.trim() ? "#fff" : C.muted,
                       display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
