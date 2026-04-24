import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
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

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", border2:"#d0d0dc",
  text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", warn:"#d97706",
  green:"#10b981", red:"#ef4444", blue:"#3b82f6",
};

function AppInner({user, onLogout}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isCotizador = location.pathname.startsWith("/cotizador");

  const modules = [
    { id:"finanzas", path:"/finanzas", icon:"💰", label:"Control Financiero", desc:"Ingresos, egresos y distribucion semanal", color:C.accent },
    { id:"cotizador", path:"/cotizador", icon:"📋", label:"Cotizador", desc:"Presupuestos, analisis de costos y certificados", color:C.accent2 },
    { id:"planner", path:"/planner", icon:"📅", label:"Planner", desc:"Tablero de tareas y calendario", color:C.warn },
    { id:"fiscal", path:"/fiscal", icon:"🧾", label:"Gestion Fiscal", desc:"ARCA, facturacion y analisis fiscal", color:C.blue },
    { id:"clientes", path:"/clientes", icon:"👥", label:"Clientes y Proyectos", desc:"Gestion de clientes, obras y contactos", color:C.green },
    { id:"accesos", path:"/accesos-clientes", icon:"🔑", label:"Accesos de clientes", desc:"Gestionar portal de clientes", color:C.accent2 },
  ];

  const currentModule = modules.find(m => location.pathname.startsWith(m.path));

  return (
    <div style={{minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Syne', sans-serif"}}>
      {!isCotizador && (
        <div className="header">
          <div style={{display:"flex", alignItems:"center", gap:16}}>
            <div onClick={()=>navigate("/")} className="header-logo" style={{cursor:"pointer"}}>
              FAIM OBRAS
              <span style={{marginLeft:8, fontSize:14, fontWeight:400, color:C.muted}}>
                {currentModule ? "/ " + currentModule.label : "— Gestión para Estudios y Empresas"}
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
              <div style={{fontSize:14, color:C.muted}}>Con que queres trabajar hoy?</div>
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
          </div>
        }/>
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
      </Routes>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clienteInfo, setClienteInfo] = useState(null);
  const [estudioInfo, setEstudioInfo] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  useEffect(()=>{
    // Restaurar sesión desde localStorage
    const savedSession = localStorage.getItem("obras_session");
    const savedCliente = localStorage.getItem("obras_cliente");
    const savedEstudio = localStorage.getItem("obras_estudio");

    if (savedCliente) {
      try {
        const ci = JSON.parse(savedCliente);
        if (ci?.email && ci?.cliente_id) {
          setClienteInfo(ci);
          setUser({ email: ci.email, nombre: ci.nombre });
          setLoading(false);
          return;
        }
      } catch { localStorage.removeItem("obras_cliente"); }
    }
    if (savedEstudio) {
      try {
        const ei = JSON.parse(savedEstudio);
        if (ei?.email && ei?.rol) {
          setEstudioInfo(ei);
          setUser({ email: ei.email, nombre: ei.nombre, rol: ei.rol });
          setLoading(false);
          return;
        }
      } catch { localStorage.removeItem("obras_estudio"); }
    }
    if (savedSession) {
      try {
        const s = JSON.parse(savedSession);
        if (s?.user && s?.token) {
          setUser(s.user);
          setLoading(false);
          return;
        }
      } catch { localStorage.removeItem("obras_session"); }
    }
    setLoading(false);
  },[]);

  const login = async () => {
    setError("");
    const emailLower = email.toLowerCase().trim();

    // 1. Intentar login de cliente
    try {
      const res = await fetch(`${API}/cliente/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower, password: pass }),
      });
      if (res.ok) {
        const data = await res.json();
        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        setClienteInfo(ci);
        setUser({ email: data.email, nombre: data.nombre });
        return;
      }
    } catch {}

    // 2. Intentar login de usuario estudio
    try {
      const res = await fetch(`${API}/estudio/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower, password: pass }),
      });
      if (res.ok) {
        const data = await res.json();
        const ei = { nombre: data.nombre, rol: data.rol, presupuestos_asignados: data.presupuestos_asignados, email: data.email };
        localStorage.setItem("obras_estudio", JSON.stringify(ei));
        setEstudioInfo(ei);
        setUser({ email: data.email, nombre: data.nombre, rol: data.rol });
        return;
      }
    } catch {}

    // 3. Login admin via JWT
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailLower, password: pass }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("obras_token", data.token);
        localStorage.setItem("obras_session", JSON.stringify({ user: data.usuario, tenant: data.tenant, token: data.token }));
        setUser(data.usuario);
        return;
      }
    } catch {}

    setError("Email o contraseña incorrectos");
  };

  const handleLogout = () => {
    localStorage.removeItem("obras_token");
    localStorage.removeItem("obras_session");
    localStorage.removeItem("obras_cliente");
    localStorage.removeItem("obras_estudio");
    setUser(null);
    setClienteInfo(null);
    setEstudioInfo(null);
  };

  if(loading) return <div style={{background:"#f8f9fa",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#059669",fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800}}>FAIM OBRAS</div>;

  if(!user) return (
    <div style={{background:"#f8f9fa",height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"'Syne',sans-serif"}}>
      <div style={{width:"100%",maxWidth:360}}>
        <div style={{fontSize:42,fontWeight:800,color:"#059669",letterSpacing:"-1px",marginBottom:4}}>FAIM OBRAS</div>
        <div style={{fontSize:12,color:"#6b7280",marginBottom:40,fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"2px"}}>GESTIÓN PARA ESTUDIOS Y EMPRESAS</div>
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
      </div>
    </div>
  );

  if (clienteInfo) {
    return <ClientePortal user={user} clienteId={clienteInfo.cliente_id} clienteNombre={clienteInfo.nombre} onLogout={handleLogout} />;
  }

  if (estudioInfo) {
    if (estudioInfo.rol === "personal") {
      return <PersonalPortal user={user} userInfo={estudioInfo} onLogout={handleLogout} />;
    }
    return (
      <BrowserRouter>
        <AppInner user={{ ...user, rol: estudioInfo.rol, nombre: estudioInfo.nombre }} onLogout={handleLogout} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppInner user={user} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
