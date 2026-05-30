import { useState, useEffect } from "react";
import api from "../cotizador/api";

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", border2: "#d0d0dc",
  text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", red: "#ef4444",
};
const inp = { background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 13, fontFamily: "inherit", width: "100%", outline: "none", boxSizing: "border-box" };

export default function AccesosClientes({ user }) {
  const [accesos, setAccesos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const SECCIONES = [
    { id: "avance", label: "Avance de obra" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];
  const [form, setForm] = useState({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"], presupuestos_visibles: [] });
  const [presupuestosCliente, setPresupuestosCliente] = useState([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    const [r1, r2] = await Promise.all([
      api.get('/portal/accesos').then(r => r.data).catch(() => []),
      api.get('/clientes').then(r => r.data).catch(() => []),
    ]);
    setAccesos(Array.isArray(r1) ? r1 : []);
    setClientes(Array.isArray(r2) ? r2 : (r2.clientes || []));
    setLoading(false);
  };

  const crearAcceso = async () => {
    if (!form.email || !form.cliente_id || !form.password) { setMsg("Completá todos los campos obligatorios"); return; }
    setSaving(true); setMsg("");
    try {
      await api.post('/portal/accesos', { email: form.email.toLowerCase().trim(), nombre: form.nombre, cliente_id: parseInt(form.cliente_id), password: form.password, secciones_visibles: form.secciones_visibles, presupuestos_visibles: form.presupuestos_visibles.length > 0 ? form.presupuestos_visibles : null });
      setModal(false); setForm({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"], presupuestos_visibles: [] }); setPresupuestosCliente([]); showToast("✓ Acceso creado"); cargar();
    } catch(err) { setMsg(err.response?.data?.detail || "Error de conexión"); }
    setSaving(false);
  };

  const revocarAcceso = async (id, email) => {
    if (!window.confirm(`¿Revocar acceso de ${email}?`)) return;
    await api.delete(`/portal/accesos/${id}`);
    showToast("✓ Acceso revocado");
    cargar();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", paddingBottom: 40 }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Portal de clientes</div>
          <div style={{ fontSize: 14, color: C.muted }}>Gestioná qué clientes pueden ver sus proyectos y certificados.</div>
        </div>

        {/* Info */}
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "#1d4ed8" }}>
          💡 Cada acceso le permite a un cliente ver sus presupuestos y certificados en el portal con tu marca.
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button onClick={() => { setModal(true); setMsg(""); }} style={{ padding: "9px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            + Nuevo acceso
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 40 }}>Cargando...</div>
        ) : accesos.length === 0 ? (
          <div style={{ textAlign: "center", color: C.muted, padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔑</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Sin accesos configurados</div>
            <div style={{ fontSize: 13 }}>Creá un acceso para que un cliente pueda ver sus proyectos.</div>
          </div>
        ) : (
          <div>
            {accesos.map((a) => {
              const cliente = clientes.find((c) => c.id === a.cliente_id);
              return (
                <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 8, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface2, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👤</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{a.nombre || a.email}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{a.email}</div>
                    {cliente && <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>Cliente: {cliente.nombre}</div>}
                    {a.secciones_visibles && a.secciones_visibles.length < 5 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Ve: {a.secciones_visibles.join(", ")}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, background: a.activo ? "#f0fdf4" : "#fef2f2", color: a.activo ? C.accent : C.red, border: `1px solid ${a.activo ? "#bbf7d0" : "#fecaca"}` }}>
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                    <button onClick={() => revocarAcceso(a.id, a.email)} style={{ padding: "5px 12px", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 7, fontSize: 12, color: C.red, cursor: "pointer", fontFamily: "inherit" }}>
                      Revocar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 420, width: "100%", border: `1px solid ${C.border2}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Nuevo acceso de cliente</div>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Cliente *</label>
                <select style={inp} value={form.cliente_id} onChange={(e) => {
                  const cid = e.target.value;
                  setForm((f) => ({ ...f, cliente_id: cid, presupuestos_visibles: [] }));
                  if (cid) {
                    api.get(`/clientes/${cid}/presupuestos`)
                      .then(r => setPresupuestosCliente(Array.isArray(r.data) ? r.data : [])).catch(() => setPresupuestosCliente([]));
                  } else setPresupuestosCliente([]);
                }}>
                  <option value="">— Seleccionar cliente —</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Email *</label>
                <input style={inp} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@cliente.com" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Nombre</label>
                <input style={inp} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del contacto" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Contraseña *</label>
                <input style={inp} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Contraseña para el portal" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué puede ver el cliente?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SECCIONES.map((s) => {
                    const checked = form.secciones_visibles.includes(s.id);
                    return (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${checked ? C.accent : C.border}`, background: checked ? "#f0fdf4" : C.surface, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setForm((f) => ({ ...f, secciones_visibles: checked ? f.secciones_visibles.filter((x) => x !== s.id) : [...f.secciones_visibles, s.id] }));
                        }} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                        <span style={{ fontSize: 13, color: checked ? C.accent : C.text, fontWeight: checked ? 600 : 400 }}>{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {form.cliente_id && presupuestosCliente.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué presupuestos puede ver?</label>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Si no seleccionás ninguno, verá todos sus presupuestos.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {presupuestosCliente.map((p) => {
                      const checked = form.presupuestos_visibles.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${checked ? C.accent : C.border}`, background: checked ? "#f0fdf4" : C.surface, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            setForm((f) => ({ ...f, presupuestos_visibles: checked ? f.presupuestos_visibles.filter((x) => x !== p.id) : [...f.presupuestos_visibles, p.id] }));
                          }} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                          <span style={{ fontSize: 13, color: checked ? C.accent : C.text, fontWeight: checked ? 600 : 400 }}>{p.nombre_obra}</span>
                          <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{p.estado}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {msg && <div style={{ fontSize: 13, color: C.red, marginTop: 10, textAlign: "center" }}>{msg}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: "10px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={crearAcceso} disabled={saving} style={{ flex: 2, padding: "10px", background: saving ? C.border : C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "Creando..." : "Crear acceso"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 20, padding: "10px 20px", fontSize: 13, color: C.text, zIndex: 400 }}>{toast}</div>}
    </div>
  );
}
