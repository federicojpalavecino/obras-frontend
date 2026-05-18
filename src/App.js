import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
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

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

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
      const token = localStorage.getItem("obras_token");
      const res = await fetch(`${API}/suscripcion/crear-preferencia`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert("Error al crear el pago. Contactá a soporte.");
    } catch (e) { alert("Error de conexión."); }
    setLoading(false);
  };
  return (
    <div style={{ background: C.bg, height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Syne', sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 440, background: C.surface, border: "1px solid " + C.border, borderRadius: 16, padding: 40, boxShadow: "0 4px 24px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, letterSpacing: "-1px", marginBottom: 4 }}>FAIM OBRAS</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 28, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "2px" }}>PERÍODO DE PRUEBA VENCIDO</div>
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
            ${(suscripcion?.precio_mensual || 40000).toLocaleString("es-AR")}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>por mes · 2 usuarios incluidos</div>
        </div>
        <div style={{ textAlign: "left", marginBottom: 24 }}>
          {["Cotizador completo con catálogo actualizado", "Certificados y control de avance", "Panel financiero y Gantt", "Múltiples presupuestos y clientes"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text, marginBottom: 8 }}>
              <span style={{ color: C.accent, fontWeight: 700 }}>✓</span> {f}
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
      ⚠️ Te {diasRestantes === 1 ? "queda" : "quedan"} <strong>{diasRestantes} día{diasRestantes !== 1 ? "s" : ""}</strong> de prueba gratuita.
      {diasRestantes <= 3 && " Suscribite para no perder el acceso."}
    </div>
  );
}

// ── Soporte técnico ──────────────────────────────────────────────────────────
function PaginaSoporte() {
  const MAIL = "faimobras@gmail.com";
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

// ── Main app (identical to FIMA) ──────────────────────────────────────────────
function AppInner({user, tenant, onLogout, onTenantUpdate}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCotizador = location.pathname.startsWith("/cotizador");
  const nombreMarca = tenant?.nombre || "FAIM OBRAS";
  const logoUrl = tenant?.logo_url || null;
  const colorAccent = tenant?.color_primario || C.accent;

  const modules = [
    { id:"cotizador", path:"/cotizador", icon:"📋", label:"Cotizador", desc:"Presupuestos, analisis de costos y certificados", color:C.accent2 },
    { id:"finanzas", path:"/finanzas", icon:"💰", label:"Control Financiero", desc:"Ingresos, egresos y distribucion semanal", color:C.accent },
    { id:"planner", path:"/planner", icon:"📅", label:"Planner", desc:"Tablero de tareas y calendario", color:C.warn },
    { id:"clientes", path:"/clientes", icon:"👥", label:"Clientes y Proyectos", desc:"Gestion de clientes, obras y contactos", color:C.green },
    { id:"accesos", path:"/accesos-clientes", icon:"🔑", label:"Accesos de clientes", desc:"Gestionar portal de clientes", color:C.accent2 },
    { id:"config", path:"/config", icon:"⚙️", label:"Configuración", desc:"Logo, nombre y datos del estudio", color:C.muted },
    { id:"soporte", path:"/soporte", icon:"💬", label:"Soporte técnico", desc:"Contacto, ayuda y sugerencias", color:C.blue },
  ];

  const currentModule = modules.find(m => location.pathname.startsWith(m.path));

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Syne', sans-serif"}}>
      {!isCotizador && (
        <div className="header">
          <div style={{display:"flex", alignItems:"center", gap:16}}>
            <div onClick={()=>navigate("/")} className="header-logo" style={{cursor:"pointer", display:"flex", alignItems:"center", gap:10}}>
              {logoUrl
                ? <img src={logoUrl} alt="logo" style={{height:28, objectFit:"contain"}} />
                : <span style={{color:colorAccent, fontWeight:900, fontSize:16, letterSpacing:-0.5}}>{nombreMarca}</span>
              }
              <span style={{fontSize:14, fontWeight:400, color:C.muted}}>
                {currentModule ? "/ " + currentModule.label : ""}
              </span>
            </div>
          </div>
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <div style={{width:32, height:32, borderRadius:"50%", background:C.surface2, border:"1px solid " + C.border2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:C.accent, fontFamily:"'IBM Plex Mono', monospace"}}>
              {user.email.slice(0,2).toUpperCase()}
            </div>
            <button onClick={onLogout} style={{fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer", fontFamily:"'Syne', sans-serif"}}>Salir</button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={
          <div style={{maxWidth:640, margin:"0 auto", padding:"clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)"}}>
            <div style={{marginBottom:"clamp(24px, 5vw, 40px)"}}>
              <div style={{fontSize:"clamp(20px, 5vw, 28px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:6}}>Bienvenido, {user.nombre || user.email.split("@")[0]}</div>
              <div style={{fontSize:14, color:C.muted}}>¿Con qué querés trabajar hoy?</div>
            </div>
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {modules.map(m=>(
                <button key={m.id} onClick={()=>navigate(m.path)}
                  style={{background:C.surface, border:"1px solid " + C.border, boxShadow:"0 1px 3px rgba(0,0,0,0.06)", borderRadius:10, padding:"clamp(14px, 3vw, 18px) clamp(14px, 3vw, 20px)", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:16, width:"100%"}}>
                  <div style={{width:44, height:44, borderRadius:8, background:C.surface2, border:"1px solid " + C.border2, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0}}>{m.icon}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:"clamp(14px, 3.5vw, 16px)", fontWeight:700, color:C.text, marginBottom:3}}>{m.label}</div>
                    <div style={{fontSize:"clamp(11px, 2.8vw, 13px)", color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>{m.desc}</div>
                  </div>
                  <div style={{color:m.color, fontSize:18, fontWeight:700, flexShrink:0}}>→</div>
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{marginTop:"clamp(32px, 6vw, 48px)", paddingTop:20, borderTop:"1px solid " + C.border, textAlign:"center"}}>
              <div style={{fontSize:11, color:C.muted, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.5px"}}>
                © 2026 FAIM OBRAS · by FIMA Arquitectura · Todos los derechos reservados
              </div>
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
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [suscripcion, setSuscripcion] = useState(null);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [estudioInfo, setEstudioInfo] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [modo, setModo] = useState("login"); // "login" | "registro"
  const [regNombre, setRegNombre] = useState("");
  const [regEstudio, setRegEstudio] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const checkSuscripcion = async (token) => {
    try {
      const res = await fetch(`${API}/suscripcion/estado`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) { const data = await res.json(); setSuscripcion(data); }
    } catch (e) {}
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
          if (ci?.email && ci?.cliente_id) { setClienteInfo(ci); setUser({ email: ci.email, nombre: ci.nombre }); setLoading(false); return; }
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
              await checkSuscripcion(token);
              try {
                const tr = await fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${token}` } });
                if (tr.ok) { const td = await tr.json(); setTenant(td); localStorage.setItem("obras_tenant", JSON.stringify(td)); }
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
            await checkSuscripcion(token);
            // Refresh tenant data from server to get latest nombre/logo
            try {
              const tr = await fetch((process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app') + '/tenant', {
                headers: { Authorization: 'Bearer ' + token }
              });
              if (tr.ok) {
                const td = await tr.json();
                setTenant(td); localStorage.setItem("obras_tenant", JSON.stringify(td));
                const ns = JSON.parse(localStorage.getItem('obras_session') || '{}');
                ns.tenant = td;
                localStorage.setItem('obras_session', JSON.stringify(ns));
              }
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

    try {
      const res = await fetch(`${API}/auth/login-cliente`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:emailLower, password:pass}) });
      if (res.ok) {
        const data = await res.json();
        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;
      }
    } catch {}

    try {
      const res = await fetch(`${API}/estudio/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:emailLower, password:pass}) });
      if (res.ok) {
        const data = await res.json();
        const ei = { nombre: data.nombre, rol: data.rol, presupuestos_asignados: data.presupuestos_asignados, email: data.email };
        localStorage.setItem("obras_estudio", JSON.stringify(ei));
        // Check subscription using the token from estudio login
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          await checkSuscripcion(data.token);
          try {
            const tr = await fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${data.token}` } });
            if (tr.ok) { const td = await tr.json(); setTenant(td); }
          } catch(e) {}
        }
        setEstudioInfo(ei); setUser({ email: data.email, nombre: data.nombre, rol: data.rol }); return;
      }
    } catch {}

    try {
      const res = await fetch(`${API}/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:emailLower, password:pass}) });
      if (res.ok) {
        const data = await res.json();
        const token = data.token;
        localStorage.setItem("obras_token", token);
        localStorage.setItem("obras_session", JSON.stringify({ user: data.usuario, tenant: data.tenant, token }));
        setUser(data.usuario);
        if (data.tenant) setTenant(data.tenant);
        await checkSuscripcion(token);
        return;
      }
    } catch {}

    try {
      const res = await fetch(`${API}/admin/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:emailLower, password:pass}) });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("obras_admin_token", data.token);
        window.location.href = "/admin-panel";
        return;
      }
    } catch {}

    setError("Email o contraseña incorrectos");
  };

  const registrar = async () => {
    setError("");
    if (!regEstudio.trim() || !regNombre.trim() || !email.trim() || !pass.trim()) {
      setError("Completá todos los campos"); return;
    }
    setRegLoading(true);
    try {
      const res = await fetch(`${API}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_estudio: regEstudio.trim(), nombre_usuario: regNombre.trim(), email: email.toLowerCase().trim(), password: pass })
      });
      const data = await res.json();
      if (res.ok) {
        const token = data.token;
        const userData = data.usuario || { email: email.toLowerCase().trim(), nombre: regNombre.trim(), rol: "admin" };
        localStorage.setItem("obras_token", token);
        localStorage.setItem("obras_session", JSON.stringify({ user: userData, tenant: data.tenant, token }));
        if (data.tenant) setTenant(data.tenant);
        await checkSuscripcion(token);
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
    setUser(null); setClienteInfo(null); setEstudioInfo(null); setSuscripcion(null); setTenant(null);
  };

  // Super admin panel — ruta directa
  if (window.location.pathname === "/admin-panel") {
    return <AdminSuperPanel />;
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
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,color:"#6b7280",marginBottom:6,fontWeight:600,letterSpacing:"1px",textTransform:"uppercase"}}>Email</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="input" style={{width:"100%",boxSizing:"border-box"}}/>
            </div>
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
              <input value={regEstudio} onChange={e=>setRegEstudio(e.target.value)} type="text" className="input" style={{width:"100%",boxSizing:"border-box"}} placeholder="Ej: FIMA Arquitectura"/>
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
              {regLoading ? "Creando cuenta..." : "Comenzar prueba gratuita 30 días"}
            </button>
            <div style={{fontSize:12,color:"#6b7280",textAlign:"center",marginTop:12}}>Sin tarjeta requerida</div>
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
    return <ClientePortal user={user} clienteId={clienteInfo.cliente_id} clienteNombre={clienteInfo.nombre} onLogout={handleLogout} />;
  }

  if (estudioInfo) {
    if (estudioInfo.rol === "personal") {
      return <PersonalPortal user={user} userInfo={estudioInfo} onLogout={handleLogout} />;
    }
    return (
      <BrowserRouter>
        {banner}
        <AppInner user={{ ...user, rol: estudioInfo.rol, nombre: estudioInfo.nombre }} tenant={tenant} onLogout={handleLogout} onTenantUpdate={(data) => setTenant(t => ({...t, ...data}))} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      {banner}
      <AppInner user={user} tenant={tenant} onLogout={handleLogout} onTenantUpdate={(data) => setTenant(t => ({...t, ...data}))} />
    </BrowserRouter>
  );
}
