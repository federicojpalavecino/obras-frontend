import { useState, useEffect, useRef } from "react";
import api from "../cotizador/api";

const C = {
  bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5",
  border:"#e0e0e8", text:"#1a1a2e", muted:"#6b7280",
  accent:"#059669", accent2:"#7c3aed", red:"#ef4444",
};


function UsuariosSection() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nombre:'', email:'', password:'', rol:'admin' });
  const [msg, setMsg] = useState('');

  const cargar = () => {
    api.get('/estudio/usuarios')
      .then(r => { setUsuarios(Array.isArray(r.data) ? r.data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { cargar(); }, []);

  const agregar = async () => {
    if (!form.nombre || !form.email || !form.password) { setMsg('Completá todos los campos'); return; }
    try {
      await api.post('/estudio/usuarios', form);
      setMsg('Usuario creado'); setForm({ nombre:'', email:'', password:'', rol:'admin' }); cargar();
    } catch(err) { setMsg(err.response?.data?.detail || 'Error'); }
    setTimeout(() => setMsg(''), 3000);
  };

  const eliminar = async (email) => {
    if (!window.confirm(`¿Eliminar usuario ${email}?`)) return;
    await api.delete(`/estudio/usuarios/${encodeURIComponent(email)}`);
    cargar();
  };

  const inp = { width:'100%', padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, background:C.surface2, outline:'none', boxSizing:'border-box', fontFamily:"'Syne',sans-serif" };

  if (loading) return <div style={{color:C.muted, fontSize:13}}>Cargando...</div>;

  return (
    <div>
      {usuarios.length === 0 && <div style={{color:C.muted, fontSize:13, marginBottom:16}}>No hay usuarios adicionales configurados.</div>}
      {usuarios.map(u => (
        <div key={u.email} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600 }}>{u.nombre}</div>
            <div style={{ fontSize:12, color:C.muted }}>{u.email} · {u.rol}</div>
          </div>
          <button onClick={() => eliminar(u.email)} style={{ padding:'4px 10px', background:'none', border:`1px solid ${C.border}`, borderRadius:6, color:'#ef4444', cursor:'pointer', fontSize:12, fontFamily:"'Syne',sans-serif" }}>Eliminar</button>
        </div>
      ))}
      <div style={{ marginTop:16, display:'grid', gap:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Agregar usuario</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre" style={inp} />
          <input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="Email" type="email" style={inp} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <input value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="Contraseña" type="password" style={inp} />
          <select value={form.rol} onChange={e=>setForm(f=>({...f,rol:e.target.value}))} style={inp}>
            <option value="admin">Admin</option>
            <option value="personal">Personal</option>
          </select>
        </div>
        {msg && <div style={{ fontSize:13, color: msg.includes('Error') || msg.includes('Completá') ? '#ef4444' : C.accent }}>{msg}</div>}
        <button onClick={agregar} style={{ padding:'9px 16px', background:C.accent, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', fontFamily:"'Syne',sans-serif", textAlign:'left' }}>
          + Agregar usuario
        </button>
      </div>
    </div>
  );
}

export default function ConfigCuenta({ user, onUpdate }) {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ nombre:"", cuit:"", telefono:"", direccion:"", ciudad:"", provincia:"", color_primario:"#059669" });
  const fileRef = useRef();

  useEffect(() => {
    api.get('/tenant')
      .then(r => r.data)
      .then(d => {
        setTenant(d);
        setForm({ nombre: d.nombre||"", cuit: d.cuit||"", telefono: d.telefono||"", direccion: d.direccion||"", ciudad: d.ciudad||"", provincia: d.provincia||"", color_primario: d.color_primario||"#059669" });
        setLoading(false);
      });
  }, []);

  const guardar = async () => {
    setSaving(true); setMsg("");
    const res = await api.put('/tenant', form);
    if (res.status === 200) {
      setMsg("Guardado correctamente");
      try {
        const s = JSON.parse(localStorage.getItem("obras_session") || "{}");
        s.tenant = { ...s.tenant, ...form };
        localStorage.setItem("obras_session", JSON.stringify(s));
        const t = JSON.parse(localStorage.getItem("obras_tenant") || "{}");
        localStorage.setItem("obras_tenant", JSON.stringify({ ...t, ...form }));
      } catch {}
      if (onUpdate) onUpdate(form);
    }
    else setMsg("Error al guardar");
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  };

  const subirLogo = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMsg("El archivo es muy grande (máx 2MB)"); return; }
    setSaving(true); setMsg("");
    // Convert to base64 and send as JSON to /tenant endpoint
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result; // data:image/png;base64,...
      const res = await api.put('/tenant', { logo_url: base64 });
      if (res.status === 200) {
        setTenant(prev => ({ ...prev, logo_url: base64 }));
        // Actualizar obras_tenant y obras_session para que el header lo lea
        try {
          const t = JSON.parse(localStorage.getItem("obras_tenant") || "{}");
          t.logo_url = base64;
          localStorage.setItem("obras_tenant", JSON.stringify(t));
          const s = JSON.parse(localStorage.getItem("obras_session") || "{}");
          if (s.tenant) { s.tenant.logo_url = base64; localStorage.setItem("obras_session", JSON.stringify(s)); }
        } catch {}
        if (onUpdate) onUpdate({ logo_url: base64 });
        setMsg("Logo actualizado");
      } else setMsg("Error al subir logo");
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    };
    reader.readAsDataURL(file);
  };

  const eliminarLogo = async () => {
    setSaving(true);
    await api.put('/tenant', { logo_url: null });
    setTenant(prev => ({ ...prev, logo_url: null }));
    setSaving(false);
  };

  if (loading) return <div style={{padding:40, color:C.muted}}>Cargando...</div>;

  const inp = { width:"100%", padding:"9px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:14, background:C.surface2, outline:"none", boxSizing:"border-box", fontFamily:"'Syne',sans-serif" };

  return (
    <div style={{ maxWidth:640, margin:"0 auto", padding:"clamp(24px,5vw,40px) clamp(16px,4vw,24px)", fontFamily:"'Syne',sans-serif" }}>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:4 }}>Configuración de cuenta</div>
        <div style={{ fontSize:14, color:C.muted }}>Personalizá el nombre, logo y datos de tu estudio</div>
      </div>

      {/* Logo */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Logo</div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ width:80, height:80, borderRadius:10, border:`2px dashed ${C.border}`, display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", background:C.surface2, flexShrink:0 }}>
            {tenant?.logo_url
              ? <img src={tenant.logo_url} alt="logo" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
              : <span style={{ fontSize:28 }}>🏢</span>
            }
          </div>
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={subirLogo} />
            <button onClick={()=>fileRef.current.click()} style={{ padding:"8px 16px", background:C.accent, color:"white", border:"none", borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", marginRight:8, fontFamily:"'Syne',sans-serif" }}>
              {tenant?.logo_url ? "Cambiar logo" : "Subir logo"}
            </button>
            {tenant?.logo_url && (
              <button onClick={eliminarLogo} style={{ padding:"8px 16px", background:"none", border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, color:C.red, cursor:"pointer", fontFamily:"'Syne',sans-serif" }}>
                Eliminar
              </button>
            )}
            <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>PNG o JPG, máximo 2MB. Aparece en el header y en los documentos.</div>
          </div>
        </div>
      </div>

      {/* Datos */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Datos del estudio</div>
        <div style={{ display:"grid", gap:14 }}>
          <div>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Nombre</label>
            <input value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} style={inp} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>CUIT</label>
              <input value={form.cuit} onChange={e=>setForm(f=>({...f,cuit:e.target.value}))} style={inp} placeholder="20-12345678-9" />
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Teléfono</label>
              <input value={form.telefono} onChange={e=>setForm(f=>({...f,telefono:e.target.value}))} style={inp} placeholder="+54 9 11 1234-5678" />
            </div>
          </div>
          <div>
            <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Dirección</label>
            <input value={form.direccion} onChange={e=>setForm(f=>({...f,direccion:e.target.value}))} style={inp} />
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Ciudad</label>
              <input value={form.ciudad} onChange={e=>setForm(f=>({...f,ciudad:e.target.value}))} style={inp} />
            </div>
            <div>
              <label style={{ display:"block", fontSize:11, color:C.muted, marginBottom:5, fontWeight:600, letterSpacing:"1px", textTransform:"uppercase" }}>Provincia</label>
              <input value={form.provincia} onChange={e=>setForm(f=>({...f,provincia:e.target.value}))} style={inp} />
            </div>
          </div>
        </div>
      </div>

      {/* Color */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:24 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Color de marca</div>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <input type="color" value={form.color_primario} onChange={e=>setForm(f=>({...f,color_primario:e.target.value}))}
            style={{ width:48, height:48, border:"none", borderRadius:8, cursor:"pointer", padding:2 }} />
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{form.color_primario}</div>
            <div style={{ fontSize:12, color:C.muted }}>Afecta botones y acentos del sistema</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
            {["#059669","#7c3aed","#2563eb","#dc2626","#d97706","#1a1a2e"].map(c => (
              <button key={c} onClick={()=>setForm(f=>({...f,color_primario:c}))}
                style={{ width:28, height:28, borderRadius:"50%", background:c, border: form.color_primario===c ? "3px solid #1a1a2e" : "2px solid transparent", cursor:"pointer" }} />
            ))}
          </div>
        </div>
      </div>

      {/* USUARIOS */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:24 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.text, marginBottom:16, textTransform:"uppercase", letterSpacing:"0.5px" }}>Usuarios del estudio</div>
        <UsuariosSection />
      </div>

      {msg && <div style={{ fontSize:13, color: msg.includes("Error") ? C.red : C.accent, marginBottom:12, textAlign:"center" }}>{msg}</div>}

      <button onClick={guardar} disabled={saving} style={{ width:"100%", padding:13, background:saving?C.border:C.accent, color:"white", border:"none", borderRadius:8, fontSize:15, fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"'Syne',sans-serif" }}>
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </div>
  );
}
