import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const sb = createClient('https://bomxksdisszrhhsctowd.supabase.co','sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2');
const API = 'https://fima-backend-production.up.railway.app';

const C = {
  bg:'#f8f9fa', surface:'#ffffff', surface2:'#f1f3f5',
  border:'#e0e0e8', border2:'#d0d0dc',
  text:'#1a1a2e', muted:'#6b7280',
  accent:'#059669', accent2:'#7c3aed', warn:'#d97706', red:'#ef4444',
};

const COLORES = ['#6ee7b7','#a78bfa','#38bdf8','#fbbf24','#f87171','#fb923c','#e879f9','#a3e635','#34d399','#60a5fa'];

const inp = {
  background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8,
  color:C.text, padding:'8px 12px', fontSize:13, fontFamily:'inherit',
  width:'100%', outline:'none', boxSizing:'border-box',
};

function Btn({primary,danger,small,onClick,disabled,children,style={}}) {
  return <button onClick={onClick} disabled={disabled} style={{
    padding:small?'5px 10px':'8px 16px', borderRadius:8, fontSize:small?12:13,
    fontWeight:primary?600:500, cursor:disabled?'not-allowed':'pointer',
    border:`1px solid ${danger?'rgba(248,113,113,.3)':primary?C.accent:C.border2}`,
    background:primary?C.accent:danger?'rgba(248,113,113,.08)':'transparent',
    color:primary?'#ffffff':danger?C.red:C.text,
    fontFamily:'inherit', opacity:disabled?.5:1, ...style
  }}>{children}</button>;
}

export default function Clientes({user}) {
  const [tab, setTab] = useState('clientes');
  const [clientes, setClientes] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [modalCliente, setModalCliente] = useState(null);
  const [modalProyecto, setModalProyecto] = useState(null);
  const [formC, setFormC] = useState({nombre:'', email:'', telefono:'', direccion:'', cuit:'', notas:''});
  const [formP, setFormP] = useState({nombre:'', cliente:'', color:COLORES[0], activo:true, notas:''});
  const [toast, setToast] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500); };

  useEffect(()=>{ cargarTodo(); },[]);

  const cargarTodo = async () => {
    const [cRes, pRes] = await Promise.all([
      fetch(`${API}/clientes`).then(r=>r.json()).catch(()=>({clientes:[]})),
      sb.from('proyectos').select('*').order('nombre'),
    ]);
    setClientes(cRes.clientes || cRes || []);
    if(pRes.data) setProyectos(pRes.data);
  };

  // CLIENTES (Railway)
  const guardarCliente = async (form) => {
    try {
      if(form.id) {
        await fetch(`${API}/clientes/${form.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
      } else {
        await fetch(`${API}/clientes`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
      }
      setModalCliente(null);
      showToast('✓ Cliente guardado');
      cargarTodo();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const eliminarCliente = async (id) => {
    if(!window.confirm('¿Eliminar cliente?')) return;
    await fetch(`${API}/clientes/${id}`, {method:'DELETE'});
    showToast('✓ Eliminado');
    cargarTodo();
  };

  // PROYECTOS (Supabase)
  const guardarProyecto = async (form) => {
    if(form.id) await sb.from('proyectos').update(form).eq('id',form.id);
    else await sb.from('proyectos').insert(form);
    setModalProyecto(null);
    showToast('✓ Proyecto guardado');
    cargarTodo();
  };

  const eliminarProyecto = async (id) => {
    if(!window.confirm('¿Eliminar proyecto?')) return;
    await sb.from('proyectos').delete().eq('id',id);
    showToast('✓ Eliminado');
    cargarTodo();
  };

  const toggleActivo = async (p) => {
    await sb.from('proyectos').update({activo:!p.activo}).eq('id',p.id);
    cargarTodo();
  };

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const proyectosFiltrados = proyectos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.cliente||'').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div style={{minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Syne',sans-serif", paddingBottom:40}}>
      {/* TABS */}
      <div style={{position:'sticky',top:64,background:C.surface,borderBottom:`1px solid ${C.border}`,display:'flex',zIndex:40}}>
        {[['clientes','👤','Clientes'],['proyectos','🏗️','Proyectos / Obras']].map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'12px 8px',background:'none',border:'none',cursor:'pointer',color:tab===id?C.accent:C.muted,borderBottom:`2px solid ${tab===id?C.accent:'transparent'}`,fontSize:13,fontFamily:'inherit'}}>
            <span style={{marginRight:6}}>{icon}</span>{label}
          </button>
        ))}
      </div>

      <div style={{padding:16, maxWidth:800, margin:'0 auto'}}>
        {/* Búsqueda + agregar */}
        <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
          <input style={{...inp,flex:1}} placeholder={`Buscar ${tab}...`} value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          <Btn primary small onClick={()=>tab==='clientes'?setModalCliente({}):setModalProyecto({})}>
            + {tab==='clientes'?'Cliente':'Proyecto'}
          </Btn>
        </div>

        {/* ── CLIENTES ── */}
        {tab==='clientes' && (
          <div>
            {clientesFiltrados.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>Sin clientes</div>}
            {clientesFiltrados.map(c=>(
              <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{c.nombre}</div>
                    <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:12,color:C.muted}}>
                      {c.email && <span>✉ {c.email}</span>}
                      {c.telefono && <span>📞 {c.telefono}</span>}
                      {c.cuit && <span>CUIT: {c.cuit}</span>}
                    </div>
                    {c.direccion && <div style={{fontSize:12,color:C.muted,marginTop:4}}>📍 {c.direccion}</div>}
                    {c.notas && <div style={{fontSize:12,color:C.muted,marginTop:4,fontStyle:'italic'}}>{c.notas}</div>}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <Btn small onClick={()=>{setFormC({...c});setModalCliente(c);}}>Editar</Btn>
                    <Btn small danger onClick={()=>eliminarCliente(c.id)}>×</Btn>
                  </div>
                </div>
                {/* Proyectos vinculados */}
                {proyectos.filter(p=>p.cliente===c.nombre).length>0 && (
                  <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>
                    {proyectos.filter(p=>p.cliente===c.nombre).map(p=>(
                      <span key={p.id} style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:p.color+'22',color:p.color,border:`1px solid ${p.color}44`}}>
                        {p.nombre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PROYECTOS ── */}
        {tab==='proyectos' && (
          <div>
            {proyectosFiltrados.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>Sin proyectos</div>}
            {proyectosFiltrados.map(p=>(
              <div key={p.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:14,height:14,borderRadius:3,background:p.color,flexShrink:0}} />
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:600,color:p.activo?C.text:C.muted}}>{p.nombre}</div>
                  {p.cliente && <div style={{fontSize:12,color:C.muted}}>Cliente: {p.cliente}</div>}
                  {p.notas && <div style={{fontSize:11,color:C.muted,fontStyle:'italic',marginTop:2}}>{p.notas}</div>}
                </div>
                <div style={{display:'flex',gap:6,alignItems:'center',flexShrink:0}}>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:p.activo?'rgba(52,211,153,.12)':'rgba(74,74,88,.3)',color:p.activo?C.accent:C.muted}}>
                    {p.activo?'Activo':'Inactivo'}
                  </span>
                  <Btn small onClick={()=>{setFormP({...p});setModalProyecto(p);}}>Editar</Btn>
                  <Btn small onClick={()=>toggleActivo(p)} style={{color:C.warn}}>{p.activo?'Desactivar':'Activar'}</Btn>
                  <Btn small danger onClick={()=>eliminarProyecto(p.id)}>×</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL CLIENTE */}
      {modalCliente!==null && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:480,width:'100%',maxHeight:'90vh',overflow:'auto',border:`1px solid ${C.border2}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700}}>{formC.id?'Editar cliente':'Nuevo cliente'}</div>
              <button onClick={()=>setModalCliente(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div style={{gridColumn:'span 2'}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Nombre *</label>
                <input style={inp} value={formC.nombre||''} onChange={e=>setFormC(f=>({...f,nombre:e.target.value}))} placeholder="Nombre completo" />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Email</label>
                <input style={inp} value={formC.email||''} onChange={e=>setFormC(f=>({...f,email:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Teléfono</label>
                <input style={inp} value={formC.telefono||''} onChange={e=>setFormC(f=>({...f,telefono:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>CUIT</label>
                <input style={inp} value={formC.cuit||''} onChange={e=>setFormC(f=>({...f,cuit:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Dirección</label>
                <input style={inp} value={formC.direccion||''} onChange={e=>setFormC(f=>({...f,direccion:e.target.value}))} />
              </div>
              <div style={{gridColumn:'span 2'}}>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Notas</label>
                <textarea style={{...inp,minHeight:70,resize:'vertical'}} value={formC.notas||''} onChange={e=>setFormC(f=>({...f,notas:e.target.value}))} />
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:20}}>
              <Btn onClick={()=>setModalCliente(null)} style={{flex:1}}>Cancelar</Btn>
              <Btn primary onClick={()=>guardarCliente(formC)} disabled={!formC.nombre} style={{flex:2}}>Guardar</Btn>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PROYECTO */}
      {modalProyecto!==null && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:440,width:'100%',border:`1px solid ${C.border2}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontSize:18,fontWeight:700}}>{formP.id?'Editar proyecto':'Nuevo proyecto'}</div>
              <button onClick={()=>setModalProyecto(null)} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Nombre *</label>
                <input style={inp} value={formP.nombre||''} onChange={e=>setFormP(f=>({...f,nombre:e.target.value}))} />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Cliente</label>
                <select style={inp} value={formP.cliente||''} onChange={e=>setFormP(f=>({...f,cliente:e.target.value}))}>
                  <option value="">Sin cliente</option>
                  {clientes.map(c=><option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Notas</label>
                <input style={inp} value={formP.notas||''} onChange={e=>setFormP(f=>({...f,notas:e.target.value}))} placeholder="Descripción opcional" />
              </div>
              <div>
                <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Color</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {COLORES.map(c=>(
                    <button key={c} onClick={()=>setFormP(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:4,background:c,border:formP.color===c?`3px solid ${C.text}`:'2px solid transparent',cursor:'pointer'}} />
                  ))}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="activo" checked={formP.activo!==false} onChange={e=>setFormP(f=>({...f,activo:e.target.checked}))} style={{width:16,height:16}} />
                <label htmlFor="activo" style={{fontSize:13,cursor:'pointer'}}>Proyecto activo</label>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:20}}>
              <Btn onClick={()=>setModalProyecto(null)} style={{flex:1}}>Cancelar</Btn>
              <Btn primary onClick={()=>guardarProyecto(formP)} disabled={!formP.nombre} style={{flex:2}}>Guardar</Btn>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:20,padding:'10px 20px',fontSize:13,color:C.text,zIndex:400}}>{toast}</div>}
    </div>
  );
}
