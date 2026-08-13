import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { FileText, TrendingUp, Calendar, Users, Lock, Settings, MessageCircle, ChevronRight, LogOut, Check, AlertTriangle, Sparkles, X } from "lucide-react";
import AdminSuperPanel from "./pages/AdminSuperPanel";
import ConfigCuenta from "./pages/ConfigCuenta";
import ControlFinanciero from "./pages/ControlFinanciero";
import Planner from "./pages/Planner";
import Fiscal from "./pages/Fiscal";
import Gantt from "./cotizador/pages/Gantt";
import Maquinaria from "./cotizador/pages/Maquinaria";
import Menu from "./cotizador/pages/Menu";
import Clientes from "./pages/Clientes";
import Presupuesto from "./cotizador/pages/Presupuesto";
import Materiales from "./cotizador/pages/Materiales";
import ManoObra from "./cotizador/pages/ManoObra";
import AnalisisCostos from "./cotizador/pages/AnalisisCostos";
import Certificado from "./cotizador/pages/Certificado";
import CurvaInversion from "./cotizador/pages/CurvaInversion";
import ListadoMateriales from "./cotizador/pages/ListadoMateriales";
import ClientePortal from "./pages/ClientePortal";
import PersonalPortal from "./pages/PersonalPortal";
import AccesosClientes from "./pages/AccesosClientes";
import Landing from "./pages/Landing";
import Presentacion from "./pages/Presentacion";
import DemoPortal from "./pages/DemoPortal";
import Obra from "./pages/Obra";
import Asistente from "./components/Asistente";
import ErrorBoundary from "./components/ErrorBoundary";
import api from "./cotizador/api";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", border2:"#d0d0dc",
  text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", warn:"#d97706",
  green:"#10b981", red:"#ef4444", blue:"#3b82f6",
};

// ── Subscription wall ─────────────────────────────────────────────────────────
function SuscripcionVencida({ suscripcion, onLogout }) {
  const [loading, setLoading] = useState(false);
  const handlePagar = async () => {
    setLoading(true);
    try {
      const res = await api.post('/suscripcion/crear');
      const data = res.data;
      if (data.init_point) window.location.href = data.init_point;
      // El backend ya encontró una suscripción autorizada en MercadoPago: no hay
      // nada que pagar, solo hace falta recargar para entrar con el plan activo.
      else if (data.ya_suscripto) { alert("Tu suscripción ya está activa en MercadoPago. Recargamos la página."); window.location.reload(); }
      else alert("Error al crear la suscripción. Contactá a soporte.");
    } catch (e) { alert(e.response?.data?.detail || "Error de conexión. Probá de nuevo o contactá a soporte."); }
    setLoading(false);
  };
  return (
    <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Syne', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440, background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <Lock size={36} strokeWidth={1} color={C.accent} style={{ marginBottom: 16 }} />
        <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, letterSpacing: "-1px", marginBottom: 4 }}>FAIM OBRAS</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 28, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px" }}>ACTIVÁ TU SUSCRIPCIÓN</div>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
            $ {(suscripcion?.precio_total || suscripcion?.precio_mensual || 57000).toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            por mes · plan base 2 usuarios
            {suscripcion?.usuarios_extra > 0 && ` + ${suscripcion.usuarios_extra} adicional${suscripcion.usuarios_extra > 1 ? "es" : ""}`}
          </div>
          {suscripcion?.usuarios_extra > 0 && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              $ {(suscripcion.precio_mensual || 57000).toLocaleString("es-AR")} base + $ {((suscripcion.precio_usuario_extra || 7000) * suscripcion.usuarios_extra).toLocaleString("es-AR")} usuarios adicionales
            </div>
          )}
        </div>
        <div style={{ textAlign: "left", marginBottom: 24 }}>
          {["Cotizador completo con catálogo actualizado", "Certificados y control de avance", "Panel financiero y Gantt", "Múltiples presupuestos y clientes"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, marginBottom: 8 }}>
              <Check size={13} strokeWidth={2.5} color={C.accent} /> {f}
            </div>
          ))}
        </div>
        <button onClick={handlePagar} disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: 12, justifyContent: "center", fontSize: 15, marginBottom: 10, background: loading ? C.border : C.accent2, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Procesando..." : "Suscribirme con MercadoPago"}
        </button>
        <button onClick={onLogout} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, fontFamily: "'Syne', sans-serif" }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

// ── Trial banner ──────────────────────────────────────────────────────────────
function TrialBanner({ diasRestantes }) {
  if (diasRestantes > 7) return null;
  return (
    <div style={{ background: diasRestantes <= 2 ? "#fef2f2" : "#fffbeb", borderBottom: `1px solid ${diasRestantes <= 2 ? "#fecaca" : "#fde68a"}`, color: diasRestantes <= 2 ? C.red : C.warn, textAlign: "center", padding: "7px 16px", fontSize: 13, fontFamily: "'Syne', sans-serif" }}>
      <AlertTriangle size={13} strokeWidth={2} style={{ marginRight: 4, verticalAlign: "middle" }} /> Te {diasRestantes === 1 ? "queda" : "quedan"} <strong>{diasRestantes} día{diasRestantes !== 1 ? "s" : ""}</strong> de prueba gratuita.
      {diasRestantes <= 3 && " Suscribite para no perder el acceso."}
    </div>
  );
}

// ── Banner de anuncio global (lo publica el admin de plataforma) ───────────────
function AnuncioBanner({ anuncio, onClose }) {
  if (!anuncio) return null;
  return (
    <div style={{ background: "#eef2ff", borderBottom: "1px solid #c7d2fe", color: "#3730a3", padding: "8px 40px 8px 16px", fontSize: 13, fontFamily: "'Syne', sans-serif", position: "relative", textAlign: "center" }}>
      <Sparkles size={13} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }} />
      {anuncio.titulo && <strong>{anuncio.titulo} </strong>}
      <span>{anuncio.mensaje}</span>
      <button onClick={onClose} aria-label="Cerrar" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3730a3", lineHeight: 0 }}>
        <X size={16} />
      </button>
    </div>
  );
}

// ── Soporte técnico ──────────────────────────────────────────────────────────
function PaginaSoporte() {
  const MAIL = "contacto.faimobras@gmail.com";
  const WHATSAPP = "5493625305155";
  const WHATSAPP_MSG = encodeURIComponent("Hola, tengo una consulta sobre FAIM OBRAS.");

  return (
    <div style={{maxWidth:600, margin:"0 auto", padding:"clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)", fontFamily:"'Syne', sans-serif"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:"clamp(20px, 5vw, 26px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:6}}>Soporte técnico</div>
        <div style={{fontSize:14, color:"#6b7280"}}>Contactanos por cualquier problema, pregunta o sugerencia.</div>
      </div>

      {/* Tarjetas de contacto */}
      <div style={{display:"flex", flexDirection:"column", gap:12, marginBottom:32}}>

        {/* WhatsApp */}
        <a href={"https://wa.me/" + WHATSAPP + "?text=" + WHATSAPP_MSG} target="_blank" rel="noreferrer"
          style={{background:"#ffffff", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(16px, 4vw, 20px)", display:"flex", alignItems:"center", gap:16, textDecoration:"none", color:"#1a1a2e", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", cursor:"pointer"}}>
          <div style={{width:48, height:48, borderRadius:10, background:"#f0fdf4", border:"1px solid #bbf7d0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0}}>💬</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:3}}>WhatsApp</div>
            <div style={{fontSize:13, color:"#6b7280"}}>Respuesta rápida en horario de oficina</div>
          </div>
          <div style={{color:"#25D366", fontSize:14, fontWeight:700}}>Escribir →</div>
        </a>

        {/* Email */}
        <a href={"mailto:" + MAIL + "?subject=Soporte FAIM OBRAS"}
          style={{background:"#ffffff", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(16px, 4vw, 20px)", display:"flex", alignItems:"center", gap:16, textDecoration:"none", color:"#1a1a2e", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", cursor:"pointer"}}>
          <div style={{width:48, height:48, borderRadius:10, background:"#eff6ff", border:"1px solid #bfdbfe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0}}>✉️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:3}}>Email</div>
            <div style={{fontSize:13, color:"#6b7280"}}>{MAIL}</div>
          </div>
          <div style={{color:"#3b82f6", fontSize:14, fontWeight:700}}>Enviar →</div>
        </a>
      </div>

      {/* Info */}
      <div style={{background:"#f8f9fa", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(14px, 3vw, 20px)"}}>
        <div style={{fontSize:13, fontWeight:700, marginBottom:12, color:"#1a1a2e"}}>Preguntas frecuentes</div>
        {[
          ["¿Cómo agrego un presupuesto?", "Desde el Cotizador → botón '+ Nuevo presupuesto'."],
          ["¿Cómo actualizo precios del catálogo?", "Desde Cotizador → Materiales, Mano de obra o Maquinaria."],
          ["¿Cómo agrego usuarios al estudio?", "Desde Configuración → Usuarios del estudio."],
          ["¿Cómo accede mi cliente al portal?", "Desde Accesos de clientes → Nuevo acceso."],
        ].map(([q, a]) => (
          <div key={q} style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid #e0e0e8"}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:3}}>{q}</div>
            <div style={{fontSize:12, color:"#6b7280"}}>{a}</div>
          </div>
        ))}
        <div style={{fontSize:11, color:"#9ca3af", marginTop:4}}>¿No encontrás lo que buscás? Escribinos.</div>
      </div>

      {/* Footer */}
      <div style={{marginTop:32, textAlign:"center", fontSize:11, color:"#9ca3af", fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.5px"}}>
        © 2026 FAIM OBRAS · by FIMA Arquitectura · Todos los derechos reservados
      </div>
    </div>
  );
}

// ── Espacio publicitario ──────────────────────────────────────────────────────
// Reemplaza al viejo feed de actividad. Dejá acá tu banner / imagen / promo.
// Para publicar un aviso: poné la URL de la imagen en AD y (opcional) el link.
function EspacioPublicidad() {
  const AD = null;        // ej: { img: "https://...", href: "https://...", alt: "Promo" }

  if (AD && AD.img) {
    const img = <img src={AD.img} alt={AD.alt || "Publicidad"} style={{ width: "100%", borderRadius: 12, display: "block" }} />;
    return (
      <div style={{ marginTop: 40 }}>
        {AD.href ? <a href={AD.href} target="_blank" rel="noreferrer">{img}</a> : img}
      </div>
    );
  }

  // Placeholder mientras no haya aviso cargado.
  return (
    <div style={{ marginTop: 40, border: `1px dashed ${C.border}`, borderRadius: 12, padding: "28px 20px", textAlign: "center", background: C.surface }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#c4c4d0" }}>Espacio publicitario</div>
    </div>
  );
}

// ── Main app (identical to FIMA) ──────────────────────────────────────────────
function AppInner({user, tenant, onLogout, onTenantUpdate}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCotizador = location.pathname.startsWith("/cotizador");
  const nombreMarca = tenant?.nombre || "FAIM OBRAS";
  const logoUrl = tenant?.logo_url || null;
  const colorAccent = tenant?.color_primario || C.accent;

  const modules = [
    { id:"cotizador", path:"/cotizador", Icon:FileText,      label:"Presupuestos y obras",  desc:"Presupuestos, obras, certificados y análisis de costos", color:C.accent2 },
    { id:"finanzas",  path:"/finanzas",  Icon:TrendingUp,    label:"Control Financiero",    desc:"Ingresos, egresos y distribución semanal",               color:C.accent },
    { id:"planner",   path:"/planner",   Icon:Calendar,      label:"Planner",               desc:"Tablero de tareas y calendario",                         color:C.warn },
    { id:"clientes",  path:"/clientes",  Icon:Users,         label:"Clientes y Proyectos",  desc:"Gestión de clientes, obras y contactos",                 color:C.green },
    { id:"accesos",   path:"/accesos-clientes", Icon:Lock,   label:"Accesos de clientes",   desc:"Gestionar portal de clientes",                           color:C.accent2 },
    { id:"config",    path:"/config",    Icon:Settings,      label:"Configuración",         desc:"Logo, nombre y datos del estudio",                       color:C.muted },
    { id:"soporte",   path:"/soporte",   Icon:MessageCircle, label:"Soporte técnico",       desc:"Contacto, ayuda y sugerencias",                          color:C.blue },
  ];

  const currentModule = modules.find(m => location.pathname.startsWith(m.path));

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Syne', sans-serif"}}>
      {!isCotizador && (
        <div className="header" style={{borderBottom:"1px solid " + C.border, background:C.surface, padding:"0 clamp(16px,4vw,32px)", height:52, display:"flex", alignItems:"center", justifyContent:"space-between"}}>
          <div onClick={()=>navigate("/")} style={{cursor:"pointer", display:"flex", alignItems:"center", gap:8}}>
            {logoUrl
              ? <img src={logoUrl} alt="logo" style={{height:24, objectFit:"contain"}} />
              : <span style={{color:colorAccent, fontWeight:800, fontSize:15, letterSpacing:-0.3}}>{nombreMarca}</span>
            }
            {currentModule && (
              <span style={{fontSize:13, color:C.muted, fontWeight:400}}>/ {currentModule.label}</span>
            )}
          </div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:30, height:30, borderRadius:"50%", background:C.surface2, border:"1px solid " + C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:C.muted, fontFamily:"'IBM Plex Mono', monospace"}}>
              {user.email.slice(0,2).toUpperCase()}
            </div>
            <button onClick={onLogout} style={{fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"'Syne', sans-serif", display:"flex", alignItems:"center", gap:4, padding:"4px 6px"}}>
              <LogOut size={13} /> Salir
            </button>
          </div>
        </div>
      )}
      {/* La `key` remonta el boundary al cambiar de ruta: sin eso, una pantalla
          que revienta deja el cartel de error puesto para siempre y no se
          puede navegar a ningun otro modulo. */}
      <ErrorBoundary key={location.pathname}>
      <Routes>
        <Route path="/" element={
          <div style={{maxWidth:560, margin:"0 auto", padding:"clamp(40px, 6vw, 64px) clamp(16px, 4vw, 24px)"}}>
            <div style={{marginBottom:"clamp(32px, 5vw, 48px)"}}>
              <div style={{fontSize:"clamp(22px, 5vw, 30px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:4}}>{user.nombre || user.email.split("@")[0]}</div>
              <div style={{fontSize:13, color:C.muted, letterSpacing:"0.2px"}}>¿Con qué vas a trabajar hoy?</div>
            </div>
            <div style={{display:"flex", flexDirection:"column"}}>
              {modules.map((m, i) => (
                <button key={m.id} onClick={()=>navigate(m.path)}
                  style={{background:"none", border:"none", borderTop: i === 0 ? "1px solid " + C.border : "none", borderBottom:"1px solid " + C.border, padding:"clamp(14px,3vw,18px) 0", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:14, width:"100%"}}>
                  <m.Icon size={18} strokeWidth={1.5} color={C.text} style={{flexShrink:0}} />
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:14, fontWeight:600, color:C.text, marginBottom:2}}>{m.label}</div>
                    <div style={{fontSize:12, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{m.desc}</div>
                  </div>
                  <ChevronRight size={15} strokeWidth={1.5} color={C.muted} style={{flexShrink:0}} />
                </button>
              ))}
            </div>
            <EspacioPublicidad />
            <div style={{marginTop:"clamp(40px, 6vw, 56px)", fontSize:11, color:"#c4c4d0", fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.5px", textAlign:"center"}}>
              © 2026 FAIM OBRAS · by FIMA Arquitectura
            </div>
          </div>
        }/>
        <Route path="/soporte" element={<PaginaSoporte />}/>
        <Route path="/finanzas/*" element={<ControlFinanciero user={user} />}/>
        <Route path="/cotizador" element={<Menu />}/>
        <Route path="/cotizador/presupuesto/:id" element={<Presupuesto />}/>
        <Route path="/cotizador/materiales" element={<Materiales />}/>
        <Route path="/cotizador/mano-obra" element={<ManoObra />}/>
        <Route path="/cotizador/analisis-costos" element={<AnalisisCostos />}/>
        <Route path="/cotizador/presupuesto/:id/certificado" element={<Certificado />}/>
        <Route path="/cotizador/presupuesto/:id/obra" element={<Obra />}/>
        <Route path="/cotizador/gantt/:id" element={<Gantt />}/>
        <Route path="/cotizador/presupuesto/:id/curva" element={<CurvaInversion />}/>
        <Route path="/cotizador/presupuesto/:id/materiales" element={<ListadoMateriales />}/>
        <Route path="/cotizador/maquinaria" element={<Maquinaria />}/>
        <Route path="/planner/*" element={<Planner user={user} />}/>
        <Route path="/fiscal/*" element={<Fiscal user={user} />}/>
        <Route path="/clientes/*" element={<Clientes user={user} />}/>
        <Route path="/accesos-clientes" element={<AccesosClientes user={user} />}/>
        <Route path="/config" element={<ConfigCuenta user={user} onUpdate={onTenantUpdate} />}/>
      </Routes>
      </ErrorBoundary>
      <Asistente />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suscripcion, setSuscripcion] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [clienteToken, setClienteToken] = useState(null);
  const [estudioInfo, setEstudioInfo] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  // El campo del estudio no se muestra de entrada: aparece solo si el backend
  // avisa que ese nombre de usuario esta repetido entre estudios.
  const [estudioLogin, setEstudioLogin] = useState("");
  const [pideEstudio, setPideEstudio] = useState(false);
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [regNombre, setRegNombre] = useState("");
  const [regEstudio, setRegEstudio] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [anuncio, setAnuncio] = useState(null);

  const checkSuscripcion = async () => {
    try {
      const res = await api.get('/suscripcion/estado');
      setSuscripcion(res.data);
    } catch (e) {}
    try {
      const a = await api.get('/anuncio');
      if (a.data && String(localStorage.getItem('anuncio_visto')) !== String(a.data.id)) {
        setAnuncio(a.data);
      }
    } catch (e) {}
  };

  const cerrarAnuncio = () => {
    if (anuncio) localStorage.setItem('anuncio_visto', String(anuncio.id));
    setAnuncio(null);
  };

  useEffect(()=>{
    const restore = async () => {
      const savedSession = localStorage.getItem("obras_session");
      const savedCliente = localStorage.getItem("obras_cliente");
      const savedEstudio = localStorage.getItem("obras_estudio");
      const token = localStorage.getItem("obras_token");

      if (savedCliente) {
        try {
          const ci = JSON.parse(savedCliente);
          if (ci?.email && ci?.cliente_id) {
            const savedToken = localStorage.getItem("obras_token");
            if (savedToken) setClienteToken(savedToken);
            setClienteInfo(ci); setUser({ email: ci.email, nombre: ci.nombre }); setLoading(false); return;
          }
        } catch { localStorage.removeItem("obras_cliente"); }
      }
      if (savedEstudio) {
        try {
          const ei = JSON.parse(savedEstudio);
          if (ei?.email && ei?.rol) {
            setEstudioInfo(ei);
            setUser({ email: ei.email, nombre: ei.nombre, rol: ei.rol });
            const token = localStorage.getItem("obras_token");
            if (token) {
              await checkSuscripcion();
              try {
                const td = (await api.get('/tenant')).data;
                setTenant(td); localStorage.setItem("obras_tenant", JSON.stringify(td));
              } catch(e) {}
            }
            setLoading(false); return;
          }
        } catch { localStorage.removeItem("obras_estudio"); }
      }
      if (savedSession && token) {
        try {
          const s = JSON.parse(savedSession);
          if (s?.user && s?.token) {
            setUser(s.user);
            if (s.tenant) setTenant(s.tenant);
            await checkSuscripcion();
            // Refresh tenant data from server to get latest nombre/logo
            try {
              const td = (await api.get('/tenant')).data;
              setTenant(td); localStorage.setItem("obras_tenant", JSON.stringify(td));
              const ns = JSON.parse(localStorage.getItem('obras_session') || '{}');
              ns.tenant = td;
              localStorage.setItem('obras_session', JSON.stringify(ns));
            } catch(e) {}
            setLoading(false);
            return;
          }
        } catch { localStorage.removeItem("obras_session"); }
      }
      setLoading(false);
    };
    restore();
  },[]);

  const login = async () => {
    setError("");
    const emailLower = email.toLowerCase().trim();
    const estudioTxt = estudioLogin.trim();

    // El login prueba varios endpoints hasta que uno contesta, asi que los
    // errores se descartan. Pero el 409 no es un "no sos vos": es el backend
    // diciendo que ese nombre de usuario existe en mas de un estudio y necesita
    // saber cual. Hay que pescarlo antes de que lo tape el intento siguiente.
    let ambiguo = false;
    const intentar = (url, body) => api.post(url, body).catch(e => {
      if (e?.response?.status === 409) ambiguo = true;
      return null;
    });

    try {
      const loginRes = await intentar('/auth/login-cliente', { email: emailLower, password: pass });
      if (loginRes) {
        const data = loginRes.data;
        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          setClienteToken(data.token);
        }
        if (data.tenant) {
          setTenant(data.tenant);
          localStorage.setItem("obras_tenant", JSON.stringify(data.tenant));
        }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;
      }
    } catch {}

    try {
      const estudioRes = await intentar('/estudio/login', { email: emailLower, password: pass, estudio: estudioTxt });
      if (estudioRes) {
        const data = estudioRes.data;
        const ei = { nombre: data.nombre, rol: data.rol, presupuestos_asignados: data.presupuestos_asignados, email: data.email };
        localStorage.setItem("obras_estudio", JSON.stringify(ei));
        // Check subscription using the token from estudio login
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          await checkSuscripcion();
          // Fetch tenant data (also returned by estudio/login now)
          let tenantData = data.tenant || null;
          if (!tenantData) {
            try {
              tenantData = (await api.get('/tenant')).data;
            } catch(e) {}
          }
          if (tenantData) {
            setTenant(tenantData);
            localStorage.setItem("obras_tenant", JSON.stringify(tenantData));
            // Also save in obras_session for compatibility
            localStorage.setItem("obras_session", JSON.stringify({ user: { email: data.email, nombre: data.nombre, rol: data.rol }, tenant: tenantData, token: data.token }));
          }
        }
        setEstudioInfo(ei); setUser({ email: data.email, nombre: data.nombre, rol: data.rol }); return;
      }
    } catch {}

    try {
      const authRes = await intentar('/auth/login', { email: emailLower, password: pass, estudio: estudioTxt });
      if (authRes) {
        const data = authRes.data;
        const token = data.token;
        localStorage.setItem("obras_token", token);
        localStorage.setItem("obras_session", JSON.stringify({ user: data.usuario, tenant: data.tenant, token }));
        setUser(data.usuario);
        if (data.tenant) setTenant(data.tenant);
        await checkSuscripcion();
        return;
      }
    } catch {}

    try {
      const adminRes = await intentar('/admin/login', { email: emailLower, password: pass });
      if (adminRes) {
        localStorage.setItem("obras_admin_token", adminRes.data.token);
        window.location.href = "/admin-panel";
        return;
      }
    } catch {}

    if (ambiguo) {
      setPideEstudio(true);
      setError("Ese usuario existe en más de un estudio. Indicá cuál.");
      return;
    }
    setError("Usuario o contraseña incorrectos");
  };

  const registrar = async () => {
    setError("");
    if (!regEstudio.trim() || !regNombre.trim() || !email.trim() || !pass.trim()) {
      setError("Completá todos los campos"); return;
    }
    setRegLoading(true);
    try {
      const res = await api.post('/auth/register', { nombre_estudio: regEstudio.trim(), nombre_usuario: regNombre.trim(), email: email.toLowerCase().trim(), password: pass });
      const data = res.data;
      if (data) {
        const token = data.token;
        const userData = data.usuario || { email: email.toLowerCase().trim(), nombre: regNombre.trim(), rol: "admin" };
        localStorage.setItem("obras_token", token);
        localStorage.setItem("obras_session", JSON.stringify({ user: userData, tenant: data.tenant, token }));
        if (data.tenant) setTenant(data.tenant);
        await checkSuscripcion();
        setUser(userData);
      } else {
        setError(data.detail || "Error al registrarse");
      }
    } catch { setError("Error de conexión"); }
    setRegLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("obras_token");
    localStorage.removeItem("obras_session");
    localStorage.removeItem("obras_cliente");
    localStorage.removeItem("obras_estudio");
    sessionStorage.removeItem("susc_reload");
    setUser(null); setClienteInfo(null); setEstudioInfo(null); setSuscripcion(null); setTenant(null);
  };

  // Super admin panel — rutas directas
  if (window.location.pathname === "/admin-panel" || window.location.pathname === "/admin") {
    return <AdminSuperPanel />;
  }

  // Presentación comercial — pública, sin login. Es el link que se le manda a
  // un prospecto. Va antes del chequeo de sesión para que abra directo.
  if (window.location.pathname === "/presentacion" || window.location.pathname === "/presentacion/") {
    return <Presentacion />;
  }

  // Demo del portal de clientes — también pública. Muestra con datos ficticios
  // lo que ve el cliente del estudio, sin pedir usuario.
  if (["/demo-portal", "/demo-portal/", "/portal-demo", "/portal-demo/"].includes(window.location.pathname)) {
    return <DemoPortal />;
  }

  if (loading) return (
    <div style={{background:"#f8f9fa",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#059669",fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800}}>
      FAIM OBRAS
    </div>
  );

  // Login / Registro screen
  // Show landing if accessing root without being logged in
  if (!user && window.location.pathname === '/landing') return <BrowserRouter><Landing /></BrowserRouter>;
  if (!user) return (
    <div style={{background:"#f8f9fa",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Syne',sans-serif"}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{fontSize:42,fontWeight:800,color:"#059669",letterSpacing:"-1px",marginBottom:4}}>FAIM OBRAS</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:32,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"2px"}}>GESTIÓN PARA ESTUDIOS Y EMPRESAS</div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:24,background:"#f1f3f5",borderRadius:8,padding:4}}>
          <button onClick={()=>{setModo("login");setError("");}} style={{flex:1,padding:"8px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13,background:modo==="login"?"#fff":"transparent",color:modo==="login"?"#1a1a2e":"#6b7280",boxShadow:modo==="login"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>Ingresar</button>
          <button onClick={()=>{setModo("registro");setError("");}} style={{flex:1,padding:"8px",borderRadius:6,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13,background:modo==="registro"?"#fff":"transparent",color:modo==="registro"?"#1a1a2e":"#6b7280",boxShadow:modo==="registro"?"0 1px 3px rgba(0,0,0,0.1)":"none"}}>Registrarme</button>
        </div>

        {modo === "login" ? (
          <>
            {/* Un solo campo para las dos cosas: el dueño del estudio entra con
                su mail y la gente que él da de alta con el usuario que le puso.
                No hace falta que elijan de antemano cuál es cuál. */}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Usuario o email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="text" autoCapitalize="none" autoCorrect="off" className="input" style={{width:"100%",boxSizing:"border-box"}}/>
            </div>
            {/* Solo cuando el mismo usuario existe en más de un estudio. */}
            {pideEstudio && (
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Estudio</label>
                <input value={estudioLogin} onChange={e=>setEstudioLogin(e.target.value)} type="text" autoCapitalize="none" autoCorrect="off" className="input" style={{width:"100%",boxSizing:"border-box"}} placeholder="Nombre del estudio"/>
              </div>
            )}
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Contraseña</label>
              <input value={pass} onChange={e=>setPass(e.target.value)} type="password" className="input" style={{width:"100%",boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&login()}/>
            </div>
            {error&&<div style={{fontSize:13,color:"#f87171",marginBottom:12,textAlign:"center"}}>{error}</div>}
            <button onClick={login} className="btn btn-primary" style={{width:"100%",padding:"12px",marginTop:8,fontSize:15,justifyContent:"center"}}>Ingresar</button>
          </>
        ) : (
          <>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Nombre del estudio o empresa</label>
              <input value={regEstudio} onChange={e=>setRegEstudio(e.target.value)} type="text" className="input" style={{width:"100%",boxSizing:"border-box"}} placeholder="Ej: MRA+Asociados"/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Tu nombre</label>
              <input value={regNombre} onChange={e=>setRegNombre(e.target.value)} type="text" className="input" style={{width:"100%",boxSizing:"border-box"}} placeholder="Ej: Matias"/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="input" style={{width:"100%",boxSizing:"border-box"}}/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Contraseña</label>
              <input value={pass} onChange={e=>setPass(e.target.value)} type="password" className="input" style={{width:"100%",boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&registrar()}/>
            </div>
            {error&&<div style={{fontSize:13,color:"#f87171",marginBottom:12,textAlign:"center"}}>{error}</div>}
            <button onClick={registrar} disabled={regLoading} className="btn btn-primary" style={{width:"100%",padding:"12px",marginTop:8,fontSize:15,justifyContent:"center",opacity:regLoading?0.7:1}}>
              {regLoading ? "Creando cuenta..." : "Crear cuenta y suscribirme"}
            </button>
            
          </>
        )}
      </div>
    </div>
  );

  // Subscription wall — only for JWT users
  if (user && suscripcion && suscripcion.trial_vencido) {
    return <SuscripcionVencida suscripcion={suscripcion} onLogout={handleLogout} />;
  }

  // Trial banner wrapper
  const banner = suscripcion && suscripcion.en_trial ? <TrialBanner diasRestantes={suscripcion.dias_restantes} /> : null;

  if (clienteInfo) {
    return <ClientePortal user={user} clienteId={clienteInfo.cliente_id} clienteNombre={clienteInfo.nombre} onLogout={handleLogout} token={clienteToken || localStorage.getItem("obras_token")} />;
  }

  if (estudioInfo) {
    if (estudioInfo.rol === "personal") {
      return <PersonalPortal user={user} userInfo={estudioInfo} onLogout={handleLogout} />;
    }
    return (
      <BrowserRouter>
        <AnuncioBanner anuncio={anuncio} onClose={cerrarAnuncio} />
        {banner}
        <AppInner user={{ ...user, rol: estudioInfo.rol, nombre: estudioInfo.nombre }} tenant={tenant} onLogout={handleLogout} onTenantUpdate={(data) => setTenant(t => ({...t, ...data}))} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AnuncioBanner anuncio={anuncio} onClose={cerrarAnuncio} />
      {banner}
      <AppInner user={user} tenant={tenant} onLogout={handleLogout} onTenantUpdate={(data) => setTenant(t => ({...t, ...data}))} />
    </BrowserRouter>
  );
}
