import { useState, useEffect, useRef } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", warn:"#d97706",
  red:"#ef4444", green:"#10b981",
};

const fmt = n => "$ " + Math.round(n).toLocaleString("es-AR");

function Badge({ plan }) {
  const colors = {
    trial:     { bg:"#fffbeb", color:"#d97706", border:"#fde68a", label:"Trial" },
    activo:    { bg:"#f0fdf4", color:"#059669", border:"#bbf7d0", label:"Activo" },
    vencido:   { bg:"#fef2f2", color:"#ef4444", border:"#fecaca", label:"Vencido" },
    cancelado: { bg:"#f1f5f9", color:"#64748b", border:"#e2e8f0", label:"Cancelado" },
  };
  const s = colors[plan] || colors.cancelado;
  return <span style={{ fontSize:11, fontWeight:700, padding:"3px 8px", borderRadius:20, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{s.label}</span>;
}

// ── Panel de Mano de Obra ──────────────────────────────────────────────────────
const CS_REF = 65; // % cargas sociales referencia UOCRA construcción Argentina

function fmtFechaCorta(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day:"2-digit", month:"2-digit", year:"numeric" });
}

function PanelMO({ token }) {
  const [list, setList]     = useState([]);
  const [edit, setEdit]     = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved]   = useState({});
  const [csRef, setCsRef]   = useState(CS_REF);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const r = await fetch(`${API}/admin/mo`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setList(await r.json());
  };

  // Usa el endpoint bulk que está confirmado funcionando
  const guardar = async (id, costo) => {
    setSaving(s => ({ ...s, [id]: true }));
    const r = await fetch(`${API}/admin/bulk-precios/mo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ id, costo_hora: parseFloat(costo) }])
    });
    const ok2 = r.ok;
    setSaving(s => ({ ...s, [id]: false }));
    if (ok2) { setSaved(s => ({ ...s, [id]: true })); setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 1500); }
    else { alert("Error al guardar"); }
    cargar();
  };

  // Fecha de última actualización (la más reciente del conjunto)
  const lastUpdate = list.reduce((mx, m) => {
    if (!m.updated_at) return mx;
    return !mx || m.updated_at > mx ? m.updated_at : mx;
  }, null);

  return (
    <div>
      {/* Info cargas sociales */}
      <div style={{ background:"#fffbeb", border:"1px solid #fde68a", borderRadius:8, padding:"10px 14px", marginBottom:16, fontSize:12, color:"#92400e" }}>
        <strong>Tasas base UOCRA Zona A.</strong> Las cargas sociales (jubilación, obra social, ART, SAC, vacaciones, etc.)
        se aplican <em>por presupuesto</em> en el cotizador — por defecto el 65% sobre el salario base.
        Costo empleador estimado = tasa base × (1 + CS%/100).
        <div style={{ marginTop:6, display:"flex", alignItems:"center", gap:8 }}>
          <span>CS% de referencia:</span>
          <input type="number" value={csRef} onChange={e => setCsRef(parseFloat(e.target.value)||0)} min={0} max={200}
            style={{ width:60, padding:"2px 6px", borderRadius:5, border:"1px solid #fde68a", fontSize:12, fontFamily:"'IBM Plex Mono',monospace" }} />
          <span style={{ color:"#78350f" }}>→ factor {(1 + csRef/100).toFixed(2)}x</span>
        </div>
      </div>

      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 140px 140px 70px 110px", padding:"10px 16px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
          {["Categoría","Grupo","Tasa base/hora","Con CS " + csRef + "%","","Actualizado"].map(h => (
            <div key={h} style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</div>
          ))}
        </div>
        {list.map((m, i) => {
          const val = edit[m.id] !== undefined ? edit[m.id] : String(m.costo_hora);
          const base = parseFloat(val) || 0;
          const conCs = Math.round(base * (1 + csRef / 100));
          const changed = base !== m.costo_hora;
          return (
            <div key={m.id} style={{ display:"grid", gridTemplateColumns:"2fr 1fr 140px 140px 70px 110px", padding:"10px 16px", borderBottom: i < list.length-1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{m.nombre}</div>
              <div style={{ fontSize:12, color:C.muted }}>{m.categoria || "—"}</div>
              <input
                type="number" value={val}
                onChange={e => setEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                style={{ padding:"5px 8px", border:`1px solid ${changed ? C.accent : C.border}`, borderRadius:6, fontSize:13, fontFamily:"'IBM Plex Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" }}
              />
              <div style={{ fontSize:13, fontFamily:"'IBM Plex Mono',monospace", color:C.accent, fontWeight:600 }}>
                $ {conCs.toLocaleString("es-AR")}
              </div>
              <button
                onClick={() => guardar(m.id, parseFloat(val))}
                disabled={saving[m.id] || !changed}
                style={{ padding:"5px 10px", borderRadius:6, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background: saved[m.id] ? C.green : changed ? C.accent : C.surface2, color: saved[m.id] || changed ? "white" : C.muted, opacity:saving[m.id]?0.6:1 }}>
                {saved[m.id] ? "✓" : saving[m.id] ? "..." : "OK"}
              </button>
              <div style={{ fontSize:11, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>
                {fmtFechaCorta(m.updated_at) || "—"}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize:12, color:C.muted, marginTop:8, fontFamily:"'IBM Plex Mono',monospace", display:"flex", justifyContent:"space-between" }}>
        <span>Fuente: UOCRA — Zona A. Actualizar mensualmente con el convenio vigente.</span>
        {lastUpdate && <span>Ultima actualización: {fmtFechaCorta(lastUpdate)}</span>}
      </div>
    </div>
  );
}

// ── Panel de Maquinaria ────────────────────────────────────────────────────────
function PanelMaquinaria({ token }) {
  const [list, setList] = useState([]);
  const [edit, setEdit] = useState({});
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const r = await fetch(`${API}/admin/maquinaria`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setList(await r.json());
  };

  const guardar = async (id, costo) => {
    setSaving(s => ({ ...s, [id]: true }));
    await fetch(`${API}/admin/bulk-precios/maquinaria`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ id, costo_hora: parseFloat(costo) }])
    });
    setSaving(s => ({ ...s, [id]: false }));
    setSaved(s => ({ ...s, [id]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 1500);
    cargar();
  };

  return (
    <div>
      <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
        Costo horario de equipos y herramientas. Representa la amortización por hora de uso. Aplica a todos los estudios.
      </div>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 160px 80px", padding:"10px 16px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
          {["Equipo / Herramienta","Costo/hora (ARS)",""].map(h => (
            <div key={h} style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</div>
          ))}
        </div>
        {list.map((m, i) => {
          const val = edit[m.id] !== undefined ? edit[m.id] : String(m.costo_hora);
          const changed = parseFloat(val) !== m.costo_hora;
          return (
            <div key={m.id} style={{ display:"grid", gridTemplateColumns:"2fr 160px 80px", padding:"10px 16px", borderBottom: i < list.length-1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{m.nombre}</div>
              <input
                type="number" value={val}
                onChange={e => setEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                style={{ padding:"6px 10px", border:`1px solid ${changed ? C.accent : C.border}`, borderRadius:6, fontSize:13, fontFamily:"'IBM Plex Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" }}
              />
              <button
                onClick={() => guardar(m.id, val)}
                disabled={saving[m.id] || !changed}
                style={{ padding:"5px 12px", borderRadius:6, border:"none", fontSize:12, fontWeight:700, cursor:"pointer", background: saved[m.id] ? C.green : changed ? C.accent : C.surface2, color: saved[m.id] || changed ? "white" : C.muted, opacity:saving[m.id]?0.6:1 }}>
                {saved[m.id] ? "✓" : saving[m.id] ? "..." : "OK"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Panel de Materiales ────────────────────────────────────────────────────────
function PanelMateriales({ token }) {
  const [list, setList]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [search, setSearch]       = useState("");
  const [edit, setEdit]           = useState({});
  const [saving, setSaving]       = useState({});
  const [saved, setSaved]         = useState({});
  const [csvText, setCsvText]     = useState("");
  const [csvResult, setCsvResult] = useState(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [showCsv, setShowCsv]     = useState(false);
  const [page, setPage]           = useState(0);
  const fileRef = useRef();
  const PER_PAGE = 50;

  useEffect(() => { cargar(); }, [search, page]);

  const cargar = async () => {
    const q = search ? `&q=${encodeURIComponent(search)}` : "";
    const r = await fetch(`${API}/admin/materiales?limit=${PER_PAGE}&offset=${page * PER_PAGE}${q}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (r.ok) { const d = await r.json(); setList(d.items); setTotal(d.total); }
  };

  const guardarPrecio = async (id, precio) => {
    setSaving(s => ({ ...s, [id]: true }));
    const r = await fetch(`${API}/admin/materiales/${id}/precio`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ precio_unitario: parseFloat(precio) })
    });
    setSaving(s => ({ ...s, [id]: false }));
    if (r.ok) {
      setSaved(s => ({ ...s, [id]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [id]: false })), 1500);
    } else {
      const err = await r.json().catch(() => ({}));
      alert(`Error ${r.status}: ${err.detail || r.statusText || "Intentá volver a ingresar al panel"}`);
    }
    cargar();
  };

  const parseCsv = (text) => {
    const lines = text.trim().split("\n").filter(Boolean);
    if (!lines.length) return [];
    const sep = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].toLowerCase().split(sep).map(h => h.trim());
    const hasHeader = isNaN(parseFloat(lines[0].split(sep)[0]));
    const dataLines = hasHeader ? lines.slice(1) : lines;
    return dataLines.map(line => {
      const parts = line.split(sep).map(p => p.trim().replace(/^["']|["']$/g, ""));
      if (hasHeader) {
        const obj = {};
        header.forEach((h, i) => obj[h] = parts[i]);
        return {
          codigo: obj.codigo || obj.code || obj["cód"] || null,
          nombre: obj.nombre || obj.name || obj.material || null,
          precio_unitario: parseFloat(obj.precio_unitario || obj.precio || obj.price || 0),
        };
      } else {
        return { codigo: parts[0] || null, precio_unitario: parseFloat(parts[1] || 0) };
      }
    }).filter(r => r.precio_unitario > 0);
  };

  const importarCsv = async () => {
    const items = parseCsv(csvText);
    if (!items.length) { alert("No se encontraron datos válidos en el CSV"); return; }
    setCsvLoading(true);
    const r = await fetch(`${API}/admin/bulk-precios/materiales`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(items)
    });
    const d = await r.json();
    setCsvResult(d);
    setCsvLoading(false);
    cargar();
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target.result);
    reader.readAsText(file, "UTF-8");
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:13, color:C.muted }}>
          {total.toLocaleString("es-AR")} materiales en el catálogo global. Los precios aplican a todos los estudios (salvo override por tenant).
        </div>
        <button onClick={() => setShowCsv(!showCsv)}
          style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:showCsv ? C.accent2 : C.surface, color:showCsv ? "white" : C.text, fontSize:13, fontWeight:600, cursor:"pointer" }}>
          {showCsv ? "× Cerrar import" : "⬆ Importar CSV / DataObra"}
        </button>
      </div>

      {showCsv && (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:C.text, marginBottom:8 }}>Importar precios desde CSV</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
            Formato: <code style={{ background:C.surface2, padding:"2px 6px", borderRadius:4 }}>codigo;precio_unitario</code> ó <code style={{ background:C.surface2, padding:"2px 6px", borderRadius:4 }}>nombre;precio_unitario</code><br/>
            También acepta Excel exportado como CSV. Separador: <code style={{ background:C.surface2, padding:"2px 6px", borderRadius:4 }}>,</code> ó <code style={{ background:C.surface2, padding:"2px 6px", borderRadius:4 }}>;</code>
          </div>
          <div style={{ display:"flex", gap:10, marginBottom:10 }}>
            <button onClick={() => fileRef.current?.click()}
              style={{ padding:"7px 14px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface2, fontSize:13, cursor:"pointer", color:C.text }}>
              Seleccionar archivo CSV
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display:"none" }} />
            <span style={{ fontSize:12, color:C.muted, alignSelf:"center" }}>o pegá el contenido abajo</span>
          </div>
          <textarea
            value={csvText} onChange={e => { setCsvText(e.target.value); setCsvResult(null); }}
            placeholder={"codigo;precio_unitario\nAGL-004;1200\nAGL-025;450\nCEM-001;9500"}
            style={{ width:"100%", height:160, padding:10, border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", boxSizing:"border-box", resize:"vertical", outline:"none" }}
          />
          {csvText.trim() && (
            <div style={{ fontSize:12, color:C.muted, margin:"6px 0" }}>
              {parseCsv(csvText).length} registros detectados
            </div>
          )}
          <div style={{ display:"flex", gap:10, marginTop:10, alignItems:"center" }}>
            <button onClick={importarCsv} disabled={csvLoading || !csvText.trim()}
              style={{ padding:"8px 20px", background:C.accent, color:"white", border:"none", borderRadius:8, fontSize:14, fontWeight:700, cursor:"pointer", opacity:csvLoading?0.6:1 }}>
              {csvLoading ? "Importando..." : "Importar precios"}
            </button>
            {csvResult && (
              <div style={{ fontSize:13 }}>
                <span style={{ color:C.green, fontWeight:700 }}>✓ {csvResult.updated} actualizados</span>
                {csvResult.not_found?.length > 0 && (
                  <span style={{ color:C.warn, marginLeft:12 }}>⚠ {csvResult.not_found.length} no encontrados: {csvResult.not_found.slice(0,3).join(", ")}{csvResult.not_found.length>3?"...":""}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Búsqueda */}
      <div style={{ display:"flex", gap:10, marginBottom:12 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Buscar por código o nombre..."
          style={{ flex:1, padding:"8px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, background:C.surface, outline:"none" }} />
        {total > PER_PAGE && (
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
              style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:13, opacity:page===0?0.4:1 }}>←</button>
            <span style={{ fontSize:12, color:C.muted }}>{page+1} / {Math.ceil(total/PER_PAGE)}</span>
            <button onClick={() => setPage(p => p+1)} disabled={(page+1)*PER_PAGE >= total}
              style={{ padding:"6px 12px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:13, opacity:(page+1)*PER_PAGE>=total?0.4:1 }}>→</button>
          </div>
        )}
      </div>

      {/* Tabla materiales */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"90px 1fr 60px 180px 80px", padding:"10px 16px", background:C.surface2, borderBottom:`1px solid ${C.border}` }}>
          {["Código","Nombre","Unidad","Precio unitario (ARS)",""].map(h => (
            <div key={h} style={{ fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"0.5px" }}>{h}</div>
          ))}
        </div>
        {list.map((m, i) => {
          const val = edit[m.id] !== undefined ? edit[m.id] : String(Math.round(m.precio_unitario));
          const changed = parseFloat(val) !== Math.round(m.precio_unitario);
          return (
            <div key={m.id} style={{ display:"grid", gridTemplateColumns:"90px 1fr 60px 180px 80px", padding:"8px 16px", borderBottom: i < list.length-1 ? `1px solid ${C.border}` : "none", alignItems:"center" }}>
              <div style={{ fontSize:11, color:C.muted, fontFamily:"'IBM Plex Mono',monospace" }}>{m.codigo}</div>
              <div style={{ fontSize:13, color:C.text }}>{m.nombre}</div>
              <div style={{ fontSize:12, color:C.muted }}>{m.unidad}</div>
              <input
                type="number" value={val}
                onChange={e => setEdit(prev => ({ ...prev, [m.id]: e.target.value }))}
                style={{ padding:"5px 8px", border:`1px solid ${changed ? C.accent : C.border}`, borderRadius:6, fontSize:12, fontFamily:"'IBM Plex Mono',monospace", width:"100%", outline:"none", boxSizing:"border-box" }}
              />
              <button
                onClick={() => guardarPrecio(m.id, val)}
                disabled={saving[m.id] || !changed}
                style={{ padding:"4px 10px", borderRadius:6, border:"none", fontSize:11, fontWeight:700, cursor:"pointer", background: saved[m.id] ? C.green : changed ? C.accent : C.surface2, color: saved[m.id] || changed ? "white" : C.muted, opacity:saving[m.id]?0.6:1 }}>
                {saved[m.id] ? "✓" : saving[m.id] ? "..." : "OK"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [tab, setTab]               = useState("cuentas");
  const [preciosTab, setPreciosTab] = useState("mo");
  const [tenants, setTenants]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [token, setToken]           = useState(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass]   = useState("");
  const [loginError, setLoginError] = useState("");
  const [search, setSearch]         = useState("");
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
        fetch(`${API}/admin/stats`,   { headers: { Authorization: `Bearer ${t}` } }),
      ]);
      if (r1.status === 401 || r2.status === 401) {
        // Sesión expirada — limpiar y pedir relogin
        localStorage.removeItem("obras_admin_token");
        setToken(null); setTenants([]); setStats(null);
        setLoading(false);
        return;
      }
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

  const eliminarTenant = async (tid, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"?\n\nEsto borrará TODOS los datos del estudio permanentemente.`)) return;
    if (!window.confirm(`⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Estás seguro de eliminar "${nombre}" y todos sus datos?\nEsta acción NO se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API}/admin/tenants/${tid}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) cargar(token);
      else { const d = await res.json(); alert("Error: " + (d.detail || "No se pudo eliminar")); }
    } catch { alert("Error de conexión"); }
  };

  const logout = () => {
    localStorage.removeItem("obras_admin_token");
    setToken(null); setTenants([]); setStats(null);
  };

  const tabStyle = (id) => ({
    padding:"8px 16px", borderRadius:7, border:"none", cursor:"pointer",
    fontFamily:"'Syne',sans-serif", fontWeight:600, fontSize:13,
    background: tab===id ? C.surface : "transparent",
    color: tab===id ? C.text : C.muted,
    boxShadow: tab===id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
  });

  const tenantsFiltrados = tenants.filter(t => {
    const matchSearch = search === "" || t.nombre?.toLowerCase().includes(search.toLowerCase()) || t.email_admin?.toLowerCase().includes(search.toLowerCase());
    const matchPlan = filterPlan === "todos" || t.plan_estado === filterPlan;
    return matchSearch && matchPlan;
  });

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

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>

        {/* Stats */}
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:12, marginBottom:24 }}>
            {[
              { label:"Total cuentas", value:stats.total_tenants ?? tenants.length, color:C.accent2 },
              { label:"En trial",      value:stats.en_trial ?? tenants.filter(t=>t.plan_estado==="trial").length, color:C.warn },
              { label:"Activos",       value:stats.activos  ?? tenants.filter(t=>t.plan_estado==="activo").length, color:C.green },
              { label:"Vencidos",      value:stats.vencidos ?? tenants.filter(t=>t.plan_estado==="vencido").length, color:C.red },
            ].map(s => (
              <div key={s.label} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.5px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, background:C.surface2, borderRadius:8, padding:4, marginBottom:20, width:"fit-content" }}>
          <button style={tabStyle("cuentas")} onClick={()=>setTab("cuentas")}>Cuentas</button>
          <button style={tabStyle("precios")} onClick={()=>setTab("precios")}>Precios</button>
        </div>

        {/* ── CUENTAS ──────────────────────────────────────────────────────────── */}
        {tab === "cuentas" && (
          <>
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
                Actualizar
              </button>
            </div>

            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden" }}>
              <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 1fr 1fr auto", gap:0, borderBottom:`1px solid ${C.border}`, padding:"10px 16px", background:C.surface2 }}>
                {["Estudio","Email","Plan","Trial hasta","Usuarios","Acciones"].map(h => (
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
                    {t.plan_estado !== "trial" && (
                      <button onClick={()=>cambiarPlan(t.id,"trial")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fffbeb", border:"1px solid #fde68a", color:C.warn, borderRadius:6, cursor:"pointer" }}>
                        Trial
                      </button>
                    )}
                    <button onClick={()=>toggleActivo(t.id)}
                      style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#f1f5f9", border:"1px solid #e2e8f0", color:"#64748b", borderRadius:6, cursor:"pointer" }}>
                      {t.activo===false ? "Habilitar" : "Suspender"}
                    </button>
                    <button onClick={()=>eliminarTenant(t.id, t.nombre)}
                      style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fef2f2", border:"1px solid #fecaca", color:C.red, borderRadius:6, cursor:"pointer" }}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:C.muted, marginTop:8 }}>{tenantsFiltrados.length} cuenta{tenantsFiltrados.length!==1?"s":""}</div>
          </>
        )}

        {/* ── PRECIOS ──────────────────────────────────────────────────────────── */}
        {tab === "precios" && (
          <div>
            <div style={{ display:"flex", gap:4, background:C.surface2, borderRadius:8, padding:4, marginBottom:20, width:"fit-content" }}>
              {[["mo","Mano de Obra UOCRA"],["materiales","Materiales"],["maquinaria","Maquinaria"]].map(([id, label]) => (
                <button key={id} onClick={() => setPreciosTab(id)}
                  style={{ padding:"7px 14px", borderRadius:6, border:"none", cursor:"pointer", fontFamily:"'Syne',sans-serif", fontWeight:600, fontSize:13, background:preciosTab===id ? C.surface : "transparent", color:preciosTab===id ? C.text : C.muted, boxShadow:preciosTab===id?"0 1px 3px rgba(0,0,0,0.08)":"none" }}>
                  {label}
                </button>
              ))}
            </div>

            {preciosTab === "mo" && <PanelMO token={token} />}
            {preciosTab === "materiales" && <PanelMateriales token={token} />}
            {preciosTab === "maquinaria" && <PanelMaquinaria token={token} />}
          </div>
        )}

      </div>
    </div>
  );
}
