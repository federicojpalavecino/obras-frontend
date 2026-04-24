import { useState, useEffect } from "react";

const API = "https://fima-backend-production.up.railway.app";

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706", red: "#ef4444",
};

const ROLES = [
  { value: "arquitecto", label: "Arquitecto", desc: "Presupuestos, certificados, control financiero (sin ingresos ni sueldo personal)" },
  { value: "personal", label: "Personal de obra", desc: "Solo egresos, herramientas y Gantt/Planner de obras asignadas" },
];

const rolBadge = (rol) => {
  const colors = { arquitecto: C.accent2, personal: C.warn, admin: C.accent };
  return <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: (colors[rol]||C.muted)+"18", color: colors[rol]||C.muted, fontWeight: 700, textTransform: "uppercase" }}>{rol}</span>;
};

export default function AccesosClientes({ user }) {
  const [tab, setTab] = useState("clientes");
  // Clientes
  const [accesos, setAccesos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [formCliente, setFormCliente] = useState({ email: "", cliente_id: "", nombre: "", password: "" });
  const [showPassC, setShowPassC] = useState(false);
  const [pendientes, setPendientes] = useState([]);
  const [respuesta, setRespuesta] = useState({});
  // Usuarios estudio
  const [usuarios, setUsuarios] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);
  const [formUser, setFormUser] = useState({ email: "", nombre: "", rol: "arquitecto", password: "", presupuestos_asignados: "" });
  const [showPassU, setShowPassU] = useState(false);
  // Common
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [accRes, clientRes, pendRes, usersRes, presRes] = await Promise.all([
      fetch(`${API}/cliente/accesos`),
      fetch(`${API}/clientes`),
      fetch(`${API}/cliente/comentarios_pendientes`),
      fetch(`${API}/estudio/usuarios`),
      fetch(`${API}/presupuestos`),
    ]);
    if (accRes.ok) setAccesos(await accRes.json());
    if (clientRes.ok) setClientes(await clientRes.json());
    if (pendRes.ok) setPendientes(await pendRes.json());
    if (usersRes.ok) setUsuarios(await usersRes.json());
    if (presRes.ok) {
      const data = await presRes.json();
      const todos = (data.por_cliente || []).flatMap(c => c.presupuestos.map(p => ({ id: p.id, nombre: p.nombre_obra, cliente: c.cliente_nombre })));
      setPresupuestos(todos);
    }
    setLoading(false);
  };

  const crearAccesoCliente = async () => {
    if (!formCliente.email || !formCliente.cliente_id || !formCliente.password) return;
    setGuardando(true);
    const cliente = clientes.find(c => c.id === parseInt(formCliente.cliente_id));
    const res = await fetch(`${API}/cliente/accesos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formCliente.email.toLowerCase().trim(), cliente_id: parseInt(formCliente.cliente_id), nombre: formCliente.nombre || cliente?.nombre || formCliente.email, password: formCliente.password }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); alert("Error: " + (e.detail||"desconocido")); }
    else { setFormCliente({ email: "", cliente_id: "", nombre: "", password: "" }); await cargar(); }
    setGuardando(false);
  };

  const revocarCliente = async (email) => {
    if (!window.confirm("Eliminar acceso de " + email + "?")) return;
    await fetch(`${API}/cliente/accesos/${encodeURIComponent(email)}`, { method: "DELETE" });
    await cargar();
  };

  const crearUsuarioEstudio = async () => {
    if (!formUser.email || !formUser.nombre || !formUser.password) return;
    setGuardando(true);
    const res = await fetch(`${API}/estudio/usuarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formUser, email: formUser.email.toLowerCase().trim() }),
    });
    if (!res.ok) { const e = await res.json().catch(()=>({})); alert("Error: " + (e.detail||"desconocido")); }
    else { setFormUser({ email: "", nombre: "", rol: "arquitecto", password: "", presupuestos_asignados: "" }); await cargar(); }
    setGuardando(false);
  };

  const eliminarUsuario = async (email) => {
    if (!window.confirm("Eliminar usuario " + email + "?")) return;
    await fetch(`${API}/estudio/usuarios/${encodeURIComponent(email)}`, { method: "DELETE" });
    await cargar();
  };

  const responderComentario = async (presupuestoId) => {
    const texto = respuesta[presupuestoId];
    if (!texto?.trim()) return;
    await fetch(`${API}/cliente/comentarios`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presupuesto_id: presupuestoId, email: user.email, nombre: "Fima Arquitectura", texto: texto.trim(), es_admin: true }),
    });
    setRespuesta(r => ({ ...r, [presupuestoId]: "" }));
    await cargar();
  };

  const eliminarComentario = async (id) => {
    if (!window.confirm("¿Eliminar esta consulta?")) return;
    await fetch(`${API}/cliente/comentarios/${id}`, { method: "DELETE" });
    await cargar();
  };

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit" };
  const lbl = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Syne', sans-serif", marginBottom: 20 }}>Gestión de accesos</div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
        {[
          ["clientes", "Clientes"],
          ["consultas", `Consultas${pendientes.length > 0 ? " (" + pendientes.length + ")" : ""}`],
          ["estudio", "Usuarios del estudio"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ flex: 1, padding: "10px 0", fontSize: 12, border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: tab === id ? 700 : 400, background: tab === id ? C.accent + "18" : C.surface2, color: tab === id ? C.accent : C.muted }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CLIENTES ── */}
      {tab === "clientes" && (
        <>
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Nuevo acceso de cliente</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div><label style={lbl}>Email *</label><input style={inp} type="email" placeholder="cliente@email.com" value={formCliente.email} onChange={e => setFormCliente(f => ({ ...f, email: e.target.value }))} /></div>
              <div>
                <label style={lbl}>Cliente *</label>
                <select style={inp} value={formCliente.cliente_id} onChange={e => { const c = clientes.find(cl => cl.id === parseInt(e.target.value)); setFormCliente(f => ({ ...f, cliente_id: e.target.value, nombre: c?.nombre || "" })); }}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Nombre para mostrar</label><input style={inp} placeholder="Nombre del contacto" value={formCliente.nombre} onChange={e => setFormCliente(f => ({ ...f, nombre: e.target.value }))} /></div>
              <div>
                <label style={lbl}>Contraseña *</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...inp, paddingRight: 70 }} type={showPassC ? "text" : "password"} placeholder="Contraseña para el cliente" value={formCliente.password} onChange={e => setFormCliente(f => ({ ...f, password: e.target.value }))} />
                  <button onClick={() => setShowPassC(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted }}>{showPassC ? "Ocultar" : "Ver"}</button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={crearAccesoCliente} disabled={guardando || !formCliente.email || !formCliente.cliente_id || !formCliente.password}
                  style={{ padding: "8px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: (!formCliente.email || !formCliente.cliente_id || !formCliente.password) ? 0.5 : 1 }}>
                  {guardando ? "Guardando..." : "Crear acceso"}
                </button>
              </div>
            </div>
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Accesos activos</div>
          {loading && <div style={{ color: C.muted, fontSize: 13 }}>Cargando...</div>}
          {!loading && accesos.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, padding: 30, fontSize: 13 }}>No hay accesos configurados</div>}
          {accesos.map(a => (
            <div key={a.email} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nombre || a.email}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{a.email}</div>
                <div style={{ fontSize: 11, color: C.accent2, marginTop: 2 }}>{a.cliente_nombre || "Cliente ID " + a.cliente_id}</div>
              </div>
              <button onClick={() => revocarCliente(a.email)} style={{ padding: "6px 14px", background: "none", border: `1px solid ${C.red}50`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Revocar</button>
            </div>
          ))}
        </>
      )}

      {/* ── CONSULTAS ── */}
      {tab === "consultas" && (
        <>
          {pendientes.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, padding: 40, fontSize: 13 }}>No hay consultas pendientes</div>}
          {pendientes.map(c => (
            <div key={c.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div><span style={{ fontWeight: 700, fontSize: 13 }}>{c.nombre || c.email}</span><span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>Pres. #{c.presupuesto_id}</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{new Date(c.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}</span>
                  <button onClick={() => eliminarComentario(c.id)} style={{ background: "none", border: `1px solid ${C.red}50`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 11, padding: "2px 8px" }}>Borrar</button>
                </div>
              </div>
              <div style={{ fontSize: 13, padding: "10px 14px", background: "rgba(124,58,237,0.06)", borderRadius: 8, border: "1px solid rgba(124,58,237,0.2)", marginBottom: 10 }}>{c.texto}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <textarea value={respuesta[c.presupuesto_id] || ""} onChange={e => setRespuesta(r => ({ ...r, [c.presupuesto_id]: e.target.value }))} placeholder="Escribi tu respuesta..." rows={2}
                  style={{ flex: 1, padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical" }} />
                <button onClick={() => responderComentario(c.presupuesto_id)} disabled={!respuesta[c.presupuesto_id]?.trim()}
                  style={{ padding: "8px 16px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", alignSelf: "flex-start", opacity: !respuesta[c.presupuesto_id]?.trim() ? 0.5 : 1 }}>
                  Responder
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ── USUARIOS ESTUDIO ── */}
      {tab === "estudio" && (
        <>
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Nuevo usuario del estudio</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={lbl}>Nombre *</label><input style={inp} placeholder="Nombre completo" value={formUser.nombre} onChange={e => setFormUser(f => ({ ...f, nombre: e.target.value }))} /></div>
                <div><label style={lbl}>Email *</label><input style={inp} type="email" placeholder="usuario@email.com" value={formUser.email} onChange={e => setFormUser(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div>
                <label style={lbl}>Rol *</label>
                <select style={inp} value={formUser.rol} onChange={e => setFormUser(f => ({ ...f, rol: e.target.value }))}>
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{ROLES.find(r => r.value === formUser.rol)?.desc}</div>
              </div>
              {formUser.rol === "personal" && (
                <div>
                  <label style={lbl}>Presupuestos asignados</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                    {presupuestos.map(p => {
                      const asignados = formUser.presupuestos_asignados ? formUser.presupuestos_asignados.split(",").map(x => x.trim()).filter(Boolean) : [];
                      const checked = asignados.includes(String(p.id));
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, cursor: "pointer", padding: "4px 8px", borderRadius: 6, background: checked ? C.accent2 + "18" : "transparent", border: `1px solid ${checked ? C.accent2 : C.border}` }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            const arr = asignados.includes(String(p.id)) ? asignados.filter(x => x !== String(p.id)) : [...asignados, String(p.id)];
                            setFormUser(f => ({ ...f, presupuestos_asignados: arr.join(",") }));
                          }} style={{ margin: 0 }} />
                          <span style={{ color: checked ? C.accent2 : C.text }}>{p.nombre} <span style={{ color: C.muted }}>({p.cliente})</span></span>
                        </label>
                      );
                    })}
                    {presupuestos.length === 0 && <span style={{ fontSize: 12, color: C.muted }}>No hay presupuestos disponibles</span>}
                  </div>
                </div>
              )}
              <div>
                <label style={lbl}>Contraseña *</label>
                <div style={{ position: "relative" }}>
                  <input style={{ ...inp, paddingRight: 70 }} type={showPassU ? "text" : "password"} placeholder="Contraseña" value={formUser.password} onChange={e => setFormUser(f => ({ ...f, password: e.target.value }))} />
                  <button onClick={() => setShowPassU(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 11, color: C.muted }}>{showPassU ? "Ocultar" : "Ver"}</button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button onClick={crearUsuarioEstudio} disabled={guardando || !formUser.email || !formUser.nombre || !formUser.password}
                  style={{ padding: "8px 20px", background: C.accent2, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: (!formUser.email || !formUser.nombre || !formUser.password) ? 0.5 : 1 }}>
                  {guardando ? "Guardando..." : "Crear usuario"}
                </button>
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Usuarios del estudio</div>
          {loading && <div style={{ color: C.muted, fontSize: 13 }}>Cargando...</div>}
          {!loading && usuarios.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, padding: 30, fontSize: 13 }}>No hay usuarios del estudio configurados</div>}
          {usuarios.map(u => (
            <div key={u.email} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{u.nombre}</span>
                  {rolBadge(u.rol)}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{u.email}</div>
                {u.presupuestos_asignados && <div style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>Obras: {u.presupuestos_asignados.split(",").filter(Boolean).length} asignadas</div>}
              </div>
              <button onClick={() => eliminarUsuario(u.email)} style={{ padding: "6px 14px", background: "none", border: `1px solid ${C.red}50`, borderRadius: 6, color: C.red, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>Eliminar</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
