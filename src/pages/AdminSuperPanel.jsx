import { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", warn:"#d97706",
  red:"#ef4444", green:"#10b981",
};

function Badge({ plan }) {
  const colors = {
    trial: { bg:"#fffbeb", color:"#d97706", border:"#fde68a", label:"Trial" },
    activo: { bg:"#f0fdf4", color:"#059669", border:"#bbf7d0", label:"Activo" },
    vencido: { bg:"#fef2f2", color:"#ef4444", border:"#fecaca", label:"Vencido" },
    cancelado: { bg:"#f1f5f9", color:"#64748b", border:"#e2e8f0", label:"Cancelado" },
  };
  const s = colors[plan] || colors.cancelado;
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState("cuentas");
  const [tenants, setTenants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("todos");

  useEffect(() => {
    const t = localStorage.getItem("obras_admin_token");
    if (t) { setToken(t); cargar(t); }
    else setLoading(false);
  }, []);

  const cargar = async (t) => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/admin/tenants`, { headers: { Authorization: `Bearer ${t}` } }),
        fetch(`${API}/admin/stats`, { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (r1.ok) setTenants(await r1.json());
      if (r2.ok) setStats(await r2.json());
    } catch {}
    setLoading(false);
  };

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
        cargar(data.token);
      } else setLoginError("Credenciales incorrectas");
    } catch { setLoginError("Error de conexión"); }
  };

  const cambiarPlan = async (tid, plan) => {
    await fetch(`${API}/admin/tenants/${tid}/plan?plan=${plan}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` }
    });
    cargar(token);
  };

  const toggleActivo = async (tid) => {
    await fetch(`${API}/admin/tenants/${tid}/toggle`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}` }
    });
    cargar(token);
  };

  const logout = () => {
    localStorage.removeItem("obras_admin_token");
    setToken(null); setTenants([]); setStats(null);
  };

  // Login screen
  if (!token) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif" }}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:48, width:320, boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.accent, marginBottom:4 }}>FAIM OBRAS</div>
        <div style={{ fontSize:11, color:C.muted, marginBottom:32, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"2px" }}>PANEL DE ADMINISTRACIÓN</div>
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

  const tenantsFiltrados = tenants.filter(t => {
    const matchSearch = search === "" || t.nombre?.toLowerCase().includes(search.toLowerCase()) || t.email_admin?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === "todos" || t.plan_estado === filterPlan;
    return matchSearch && matchPlan;
  });

  const tabStyle = (id) => ({
    padding:"8px 16px", borderRadius:7, border:"none", cursor:"pointer",
    fontFamily:"'Syne',sans-serif", fontWeight:600, fontSize:13,
    background: tab===id ? C.surface : "transparent",
    color: tab===id ? C.text : C.muted,
    boxShadow: tab===id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  });

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'Syne',sans-serif" }}>
      {/* Header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"12px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ fontSize:18, fontWeight:800, color:C.accent }}>FAIM OBRAS</div>
          <span style={{ fontSize:12, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>Admin Panel</span>
        </div>
        <button onClick={logout} style={{ fontSize:12, color:C.muted, background:"none", border:"none", cursor:"pointer" }}>Cerrar sesión</button>
      </div>

      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 16px" }}>

        {/* Stats */}
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
            {[
              { label:"Total cuentas", value:stats.total_tenants ?? tenants.length, color:C.accent2 },
              { label:"En trial", value:stats.en_trial ?? tenants.filter(t=>t.plan_estado==="trial").length, color:C.warn },
              { label:"Activos", value:stats.activos ?? tenants.filter(t=>t.plan_estado==="activo").length, color:C.green },
              { label:"Vencidos", value:stats.vencidos ?? tenants.filter(t=>t.plan_estado==="vencido").length, color:C.red },
              { label:"MRR estimado", value:`$${((stats.activos ?? tenants.filter(t=>t.plan_estado==="activo").length)*40000).toLocaleString("es-AR")}`, color:C.accent },
            ].map(s => (
              <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"16px 20px" }}>
                <div style={{ fontSize:11, color:C.muted, marginBottom:6, fontWeight:600, letterSpacing:"0.5px", textTransform:"uppercase" }}>{s.label}</div>
                <div style={{ fontSize:24, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono',monospace" }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, background:C.surface2, borderRadius:8, padding:4, marginBottom:20, width:"fit-content" }}>
          <button style={tabStyle("cuentas")} onClick={()=>setTab("cuentas")}>👥 Cuentas</button>
          <button style={tabStyle("catalogo")} onClick={()=>setTab("catalogo")}>📦 Catálogo</button>
        </div>

        {tab === "cuentas" && (
          <>
            {/* Filtros */}
            <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nombre o email..."
                style={{ padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.surface, outline:"none", flex:1, minWidth:200 }} />
              <select value={filterPlan} onChange={e=>setFilterPlan(e.target.value)}
                style={{ padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.surface, outline:"none", cursor:"pointer" }}>
                <option value="todos">Todos los planes</option>
                <option value="trial">Trial</option>
                <option value="activo">Activo</option>
                <option value="vencido">Vencido</option>
              </select>
              <button onClick={()=>cargar(token)} style={{ padding:"8px 16px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, cursor:"pointer", color:C.muted }}>
                🔄 Actualizar
              </button>
            </div>

            {/* Tabla */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr auto", gap:0, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", background:C.surface2 }}>
                {["Estudio", "Email", "Plan", "Trial hasta", "Usuarios", "Acciones"].map(h => (
                  <div key={h} style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</div>
                ))}
              </div>
              {loading ? (
                <div style={{ padding:32, textAlign:"center", color:C.muted }}>Cargando...</div>
              ) : tenantsFiltrados.length === 0 ? (
                <div style={{ padding:32, textAlign:"center", color:C.muted }}>No hay cuentas</div>
              ) : tenantsFiltrados.map((t, i) => (
                <div key={t.id} style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr auto", gap:0, padding:"12px 16px", borderBottom: i < tenantsFiltrados.length-1 ? `1px solid ${C.border}` : "none", alignItems:"center", background: t.activo===false ? "#fef2f2" : "white" }}>
                  <div style={{ fontWeight:600, fontSize:14, color:C.text }}>{t.nombre}</div>
                  <div style={{ fontSize:13, color:C.muted }}>{t.email_admin}</div>
                  <div><Badge plan={t.plan_estado} /></div>
                  <div style={{ fontSize:12, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>
                    {t.trial_hasta ? new Date(t.trial_hasta).toLocaleDateString("es-AR") : "—"}
                  </div>
                  <div style={{ fontSize:13, color:C.muted }}>{t.usuarios ?? "—"}</div>
                  <div style={{ display:"flex", gap:6 }}>
                    {t.plan_estado !== "activo" && (
                      <button onClick={()=>cambiarPlan(t.id,"activo")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#f0fdf4", border:"1px solid #bbf7d0", color:C.green, borderRadius:6, cursor:"pointer" }}>
                        Activar
                      </button>
                    )}
                    {t.plan_estado !== "vencido" && (
                      <button onClick={()=>cambiarPlan(t.id,"vencido")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fef2f2", border:"1px solid #fecaca", color:C.red, borderRadius:6, cursor:"pointer" }}>
                        Vencer
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:8 }}>{tenantsFiltrados.length} cuenta{tenantsFiltrados.length!==1?"s":""}</div>
          </>
        )}

        {tab === "catalogo" && (
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:32, textAlign:"center" }}>
            <div style={{ fontSize:40, marginBottom:16 }}>📦</div>
            <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:8 }}>Catálogo Global</div>
            <div style={{ fontSize:14, color:C.muted, marginBottom:24 }}>Materiales, mano de obra, maquinaria e ítems compartidos con todos los estudios</div>
            <button onClick={async()=>{
              const r = await fetch(`${API}/admin/catalogo/stats`,{headers:{Authorization:`Bearer ${token}`}});
              if(r.ok){const d=await r.json();alert(`Categorías: ${d.categorias}\nMateriales: ${d.materiales}\nMO: ${d.mo}\nMaquinaria: ${d.maquinaria}\nÍtems: ${d.items}`);}
            }} style={{ padding:"10px 20px", background:C.accent, color:"white", border:"none", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>
              Ver estadísticas del catálogo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
