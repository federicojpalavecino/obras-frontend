import React, { useState, useEffect } from "react";

// Direct Supabase REST API (bypasses SDK auth issues)
const SB_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SB_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sbHeaders = { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY, "Content-Type": "application/json", "Prefer": "return=representation" };

const sbSelect = async (table, order) => {
  const url = SB_URL + "/rest/v1/" + table + "?select=*" + (order ? "&order=" + order : "");
  try {
    const res = await fetch(url, { headers: sbHeaders });
    if (!res.ok) {
      const err = await res.text();
      console.error("sbSelect error", table, res.status, err);
      return [];
    }
    return await res.json();
  } catch(e) {
    console.error("sbSelect fetch error", table, e);
    return [];
  }
};
const sbInsert = async (table, data) => {
  try {
    const res = await fetch(SB_URL + "/rest/v1/" + table, { method: "POST", headers: sbHeaders, body: JSON.stringify(data) });
    if (!res.ok) {
      const err = await res.text();
      console.error("sbInsert error", table, res.status, err);
      return null;
    }
    const result = await res.json();
    return Array.isArray(result) ? result[0] : result;
  } catch(e) {
    console.error("sbInsert fetch error", table, e);
    return null;
  }
};
const sbUpdate = async (table, id, data) => {
  const res = await fetch(SB_URL + "/rest/v1/" + table + "?id=eq." + id, { method: "PATCH", headers: sbHeaders, body: JSON.stringify(data) });
  return res.ok;
};
const sbDelete = async (table, id) => {
  const res = await fetch(SB_URL + "/rest/v1/" + table + "?id=eq." + id, { method: "DELETE", headers: { "apikey": SB_KEY, "Authorization": "Bearer " + SB_KEY } });
  return res.ok;
};
const sbSelectFilter = async (table, field, value) => {
  const url = SB_URL + "/rest/v1/" + table + "?select=*&" + field + "=eq." + value;
  const res = await fetch(url, { headers: sbHeaders });
  return res.ok ? await res.json() : [];
};

// ── GOOGLE CALENDAR ──
const GCAL_CLIENT_ID = "289602384269-rc91am6518mhnec4kr6ju0i19qq18ih4.apps.googleusercontent.com";
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GCAL_CALENDAR_ID = "primary";

const gcalToken = () => localStorage.getItem('gcal_token');
const gcalTokenExp = () => localStorage.getItem('gcal_token_exp');
const gcalIsValid = () => {
  const t = gcalToken(); const e = gcalTokenExp();
  return t && e && Date.now() < parseInt(e);
};

const gcalLogin = () => {
  // Save current path so we can return after auth
  localStorage.setItem('gcal_return_path', window.location.pathname);
  const params = new URLSearchParams({
    client_id: GCAL_CLIENT_ID,
    redirect_uri: window.location.origin,
    response_type: 'token',
    scope: GCAL_SCOPE,
    prompt: 'consent',
  });
  // Full page redirect - most reliable approach
  window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
};

// Called on mount - checks if we just came back from Google OAuth
const parseGcalToken = () => {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;
  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');
  const expiresIn = params.get('expires_in');
  if (token) {
    localStorage.setItem('gcal_token', token);
    localStorage.setItem('gcal_token_exp', String(Date.now() + parseInt(expiresIn) * 1000));
    window.history.replaceState(null, '', window.location.pathname);
    return true;
  }
  return false;
};

const gcalLogout = () => {
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_token_exp');
};

// Leer token del hash tras el redirect de OAuth
const parseGcalHash = () => {
  const hash = window.location.hash.substring(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const token = params.get('access_token');
  const expiresIn = params.get('expires_in');
  if (token) {
    localStorage.setItem('gcal_token', token);
    localStorage.setItem('gcal_token_exp', String(Date.now() + parseInt(expiresIn) * 1000));
    window.history.replaceState(null, '', window.location.pathname);
  }
};

const gcalUpsertEvent = async (tarea, proyectoNombre) => {
  const token = gcalToken();
  if (!token || !gcalIsValid()) return null;
  const start = tarea.fecha_inicio || new Date().toISOString().split('T')[0];
  const end = tarea.fecha_fin || start;
  const body = {
    summary: (proyectoNombre ? '[' + proyectoNombre + '] ' : '') + tarea.titulo,
    description: tarea.descripcion || '',
    start: (tarea.hora_inicio && tarea.hora_inicio !== '')
      ? { dateTime: start + 'T' + tarea.hora_inicio.slice(0,5) + ':00', timeZone: 'America/Argentina/Buenos_Aires' }
      : { date: start },
    end: (tarea.hora_inicio && tarea.hora_inicio !== '')
      ? { dateTime: end + 'T' + (tarea.hora_fin && tarea.hora_fin !== '' ? tarea.hora_fin.slice(0,5) : addOneHour(tarea.hora_inicio.slice(0,5))) + ':00', timeZone: 'America/Argentina/Buenos_Aires' }
      : { date: addDays(end, 1) },
    colorId: (() => {
      // Map project color to nearest Google Calendar color
      if (proyectoNombre) {
        // Use a hash of the project name to pick a consistent colorId
        let hash = 0;
        for (let i = 0; i < proyectoNombre.length; i++) hash = proyectoNombre.charCodeAt(i) + ((hash << 5) - hash);
        return String((Math.abs(hash) % 11) + 1);
      }
      return tarea.prioridad === 'alta' ? '11' : tarea.prioridad === 'baja' ? '2' : '7';
    })(),
  };
  const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
  if (tarea.google_event_id) {
    // Update existing event
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${tarea.google_event_id}`, {
      method: 'PUT', headers, body: JSON.stringify(body)
    });
    const data = await res.json();
    return data.id || tarea.google_event_id;
  } else {
    // Create new event
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events`, {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    const data = await res.json();
    return data.id || null;
  }
};

const gcalDeleteEvent = async (eventId) => {
  const token = gcalToken();
  if (!token || !gcalIsValid() || !eventId) return;
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/${GCAL_CALENDAR_ID}/events/${eventId}`, {
    method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token }
  });
};

const C = {
  bg:'#f8f9fa', surface:'#ffffff', surface2:'#f1f3f5', surface3:'#e9ecef',
  border:'#e0e0e8', border2:'#d0d0dc',
  text:'#1a1a2e', muted:'#6b7280', muted2:'#9ca3af',
  accent:'#059669', accent2:'#7c3aed', warn:'#d97706',
  green:'#10b981', red:'#ef4444', blue:'#3b82f6',
};

const COLORES_PROYECTO = ['#6ee7b7','#a78bfa','#fbbf24','#f87171','#38bdf8','#fb923c','#e879f9','#a3e635'];
const ESTADOS = ['pendiente','en_progreso','listo'];
const ESTADO_LABEL = { pendiente:'Por hacer', en_progreso:'En progreso', listo:'Listo' };
const ESTADO_COLOR = { pendiente: C.muted, en_progreso: C.warn, listo: C.green };
const PRIORIDADES = ['baja','normal','alta'];
const PRIORIDAD_COLOR = { baja: C.muted, normal: C.accent, alta: C.red };
const VISTAS = ['kanban','lista','dia','semana','quincena','mes','anual'];
const VISTA_LABEL = { kanban:'Kanban', lista:'Lista', dia:'Día', semana:'Semana', quincena:'2 semanas', mes:'Mes', anual:'Año' };

const hoy = () => new Date().toISOString().split('T')[0];
const fmtFecha = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'short'}) : '—';
const fmtFechaLarga = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'long'}) : '—';
const addDays = (d, n) => { const r=new Date(d+'T12:00:00'); r.setDate(r.getDate()+n); return r.toISOString().split('T')[0]; };
const addOneHour = (t) => { if(!t) return '09:00'; const [h,m]=t.split(':').map(Number); const nh=(h+1)%24; return String(nh).padStart(2,'0')+':'+String(m).padStart(2,'0'); };
const startOfWeek = d => { const r=new Date(d+'T12:00:00'); r.setDate(r.getDate()-r.getDay()+1); return r.toISOString().split('T')[0]; };
const startOfMonth = d => d.slice(0,7)+'-01';
const isSameDay = (a,b) => a && b && a===b;
const isInRange = (d,a,b) => d && a && (b ? (d>=a && d<=b) : d===a);

const inp = {
  background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8,
  color:C.text, padding:'8px 12px', fontSize:13, fontFamily:'inherit',
  width:'100%', outline:'none', boxSizing:'border-box'
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

function Badge({color,children}) {
  return <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:color+'22',color,border:`1px solid ${color}44`,fontWeight:600,letterSpacing:.5}}>{children}</span>;
}

function TareaCard({tarea, proyecto, onEdit, onDelete, onEstado}) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8,cursor:'pointer'}} onClick={()=>onEdit(tarea)}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
        <div style={{fontSize:14,fontWeight:600,color:C.text,flex:1,marginRight:8}}>{tarea.titulo}</div>
        <button onClick={e=>{e.stopPropagation();onDelete(tarea.id);}} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:16,lineHeight:1}}>×</button>
      </div>
      {tarea.descripcion && <div style={{fontSize:12,color:C.muted,marginBottom:8,lineHeight:1.5}}>{tarea.descripcion}</div>}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,alignItems:'center'}}>
        {proyecto && <span style={{fontSize:11,color:proyecto.color,fontWeight:600}}>● {proyecto.nombre}</span>}
        <Badge color={PRIORIDAD_COLOR[tarea.prioridad]}>{tarea.prioridad}</Badge>
        {tarea.fecha_fin && <span style={{fontSize:11,color:tarea.fecha_fin<hoy()?C.red:C.muted}}>📅 {fmtFecha(tarea.fecha_fin)}</span>}
        {tarea.asignado_a && <span style={{fontSize:11,color:C.muted}}>👤 {tarea.asignado_a}</span>}
        {tarea.hora_inicio && <span style={{fontSize:11,color:C.blue}}>🕐 {tarea.hora_inicio}{tarea.hora_fin?` – ${tarea.hora_fin}`:''}</span>}
      </div>
      <div style={{display:'flex',gap:4,marginTop:10}}>
        {ESTADOS.map(e=>(
          <button key={e} onClick={ev=>{ev.stopPropagation();onEstado(tarea.id,e);}}
            style={{flex:1,padding:'4px 0',fontSize:10,borderRadius:6,border:`1px solid ${tarea.estado===e?ESTADO_COLOR[e]:C.border}`,background:tarea.estado===e?ESTADO_COLOR[e]+'22':'transparent',color:tarea.estado===e?ESTADO_COLOR[e]:C.muted,cursor:'pointer',fontFamily:'inherit',fontWeight:tarea.estado===e?700:400}}>
            {ESTADO_LABEL[e]}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModalTarea({tarea, proyectos, usuarios, onSave, onClose}) {
  const [form, setForm] = useState(tarea || { titulo:'', descripcion:'', estado:'pendiente', prioridad:'normal', fecha_inicio:hoy(), fecha_fin:'', hora_inicio:'', hora_fin:'', asignado_a:'', proyecto_id:'' });
  const horaInicioRef = React.useRef(null);
  const horaFinRef = React.useRef(null);
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = () => {
    const finalForm = {
      ...form,
      hora_inicio: horaInicioRef.current?.value || '',
      hora_fin: horaFinRef.current?.value || '',
    };
    onSave(finalForm);
  };
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:500,width:'100%',maxHeight:'90vh',overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700}}>{tarea?.id?'Editar tarea':'Nueva tarea'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Título *</label>
            <input style={inp} value={form.titulo} onChange={e=>upd('titulo',e.target.value)} placeholder="Nombre de la tarea" /></div>
          <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Descripción</label>
            <textarea style={{...inp,minHeight:80,resize:'vertical'}} value={form.descripcion} onChange={e=>upd('descripcion',e.target.value)} placeholder="Detalles..." /></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Proyecto</label>
              <select style={inp} value={form.proyecto_id} onChange={e=>upd('proyecto_id',e.target.value)}>
                <option value="">Sin proyecto</option>
                {proyectos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Asignado a</label>
              <input style={inp} value={form.asignado_a} onChange={e=>upd('asignado_a',e.target.value)} placeholder="Nombre..." /></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Estado</label>
              <select style={inp} value={form.estado} onChange={e=>upd('estado',e.target.value)}>
                {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
              </select></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Prioridad</label>
              <select style={inp} value={form.prioridad} onChange={e=>upd('prioridad',e.target.value)}>
                {PRIORIDADES.map(p=><option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Fecha inicio</label>
              <input style={inp} type="date" value={form.fecha_inicio} onChange={e=>upd('fecha_inicio',e.target.value)} /></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Fecha fin</label>
              <input style={inp} type="date" value={form.fecha_fin} onChange={e=>upd('fecha_fin',e.target.value)} /></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Hora inicio</label>
              <input ref={horaInicioRef} style={inp} type="time" defaultValue={form.hora_inicio||''} /></div>
            <div><label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Hora fin</label>
              <input ref={horaFinRef} style={inp} type="time" defaultValue={form.hora_fin||''} /></div>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20}}>
          <Btn onClick={onClose} style={{flex:1}}>Cancelar</Btn>
          <Btn primary onClick={handleSave} disabled={!form.titulo} style={{flex:2}}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

function ModalProyecto({onSave, onClose}) {
  const [form, setForm] = useState({nombre:'', color:COLORES_PROYECTO[0]});
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:380,width:'100%'}}>
        <div style={{fontSize:18,fontWeight:700,marginBottom:20}}>Nuevo proyecto</div>
        <div style={{marginBottom:14}}>
          <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Nombre *</label>
          <input style={inp} value={form.nombre} onChange={e=>setForm(f=>({...f,nombre:e.target.value}))} placeholder="Nombre del proyecto" />
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,color:C.muted,display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>Color</label>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {COLORES_PROYECTO.map(c=>(
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))} style={{width:28,height:28,borderRadius:'50%',background:c,border:form.color===c?`3px solid ${C.text}`:`2px solid transparent`,cursor:'pointer'}} />
            ))}
          </div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <Btn onClick={onClose} style={{flex:1}}>Cancelar</Btn>
          <Btn primary onClick={()=>onSave(form)} disabled={!form.nombre} style={{flex:2}}>Crear</Btn>
        </div>
      </div>
    </div>
  );
}

// ── VISTA KANBAN ──
function ViewKanban({tareas, proyectos, onEdit, onDelete, onEstado}) {
  const getProyecto = id => proyectos.find(p=>p.id===parseInt(id));
  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,alignItems:'start'}}>
      {ESTADOS.map(estado=>(
        <div key={estado} style={{background:C.surface,borderRadius:12,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:700,color:ESTADO_COLOR[estado],textTransform:'uppercase',letterSpacing:1}}>{ESTADO_LABEL[estado]}</div>
            <span style={{fontSize:11,color:C.muted,background:C.surface2,borderRadius:20,padding:'2px 8px'}}>{tareas.filter(t=>t.estado===estado).length}</span>
          </div>
          {tareas.filter(t=>t.estado===estado).map(t=>(
            <TareaCard key={t.id} tarea={t} proyecto={getProyecto(t.proyecto_id)} onEdit={onEdit} onDelete={onDelete} onEstado={onEstado} />
          ))}
          {tareas.filter(t=>t.estado===estado).length===0 && (
            <div style={{textAlign:'center',color:C.muted2,fontSize:12,padding:'20px 0'}}>Sin tareas</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── VISTA LISTA ──
function ViewLista({tareas, proyectos, onEdit, onDelete, onEstado}) {
  const getProyecto = id => proyectos.find(p=>p.id===parseInt(id));
  return (
    <div>
      {tareas.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>Sin tareas</div>}
      {tareas.map(t=>(
        <TareaCard key={t.id} tarea={t} proyecto={getProyecto(t.proyecto_id)} onEdit={onEdit} onDelete={onDelete} onEstado={onEstado} />
      ))}
    </div>
  );
}

// ── VISTA CALENDARIO ──
function ViewCalendario({tareas, proyectos, vista, fechaBase, onEdit}) {
  const getProyecto = id => proyectos.find(p=>p.id===parseInt(id));

  const getDias = () => {
    if(vista==='dia') return [fechaBase];
    if(vista==='semana') return Array.from({length:7},(_,i)=>addDays(startOfWeek(fechaBase),i));
    if(vista==='quincena') return Array.from({length:14},(_,i)=>addDays(startOfWeek(fechaBase),i));
    if(vista==='mes') {
      const start = startOfMonth(fechaBase);
      const d = new Date(start+'T12:00:00');
      const days = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
      return Array.from({length:days},(_,i)=>addDays(start,i));
    }
    if(vista==='anual') {
      return Array.from({length:12},(_,i)=>{
        const d = new Date(fechaBase.slice(0,4)+'-01-01T12:00:00');
        d.setMonth(i);
        return d.toISOString().split('T')[0];
      });
    }
    return [];
  };

  const dias = getDias();
  const cols = vista==='dia'?1:vista==='semana'?7:vista==='quincena'?7:vista==='mes'?7:4;

  if(vista==='anual') {
    return (
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {dias.map((mes,mi)=>{
          const d = new Date(mes+'T12:00:00');
          const mesNum = d.getMonth();
          const anio = d.getFullYear();
          const diasMes = new Date(anio,mesNum+1,0).getDate();
          const tareasDelMes = tareas.filter(t=>t.fecha_inicio&&t.fecha_inicio.slice(0,7)===mes.slice(0,7));
          return (
            <div key={mes} style={{background:C.surface,borderRadius:10,padding:14}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:C.accent}}>
                {d.toLocaleDateString('es-AR',{month:'long',year:'numeric'})}
              </div>
              {tareasDelMes.length===0 ? <div style={{fontSize:11,color:C.muted2}}>Sin tareas</div> :
                tareasDelMes.slice(0,5).map(t=>(
                  <div key={t.id} onClick={()=>onEdit(t)} style={{fontSize:11,padding:'3px 6px',borderRadius:4,background:getProyecto(t.proyecto_id)?.color+'22'||C.surface2,color:getProyecto(t.proyecto_id)?.color||C.text,marginBottom:3,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {t.titulo}
                  </div>
                ))
              }
              {tareasDelMes.length>5 && <div style={{fontSize:10,color:C.muted}}>+{tareasDelMes.length-5} más</div>}
            </div>
          );
        })}
      </div>
    );
  }

  // Vista día, semana, quincena, mes
  const semanas = [];
  if(vista==='mes') {
    // Agrupar en semanas para el mes
    const primerDia = new Date(dias[0]+'T12:00:00').getDay();
    const offset = primerDia===0?6:primerDia-1;
    const totalCeldas = Math.ceil((dias.length+offset)/7)*7;
    const celdas = Array.from({length:totalCeldas},(_, i)=>{
      const idx = i-offset;
      return idx>=0&&idx<dias.length ? dias[idx] : null;
    });
    for(let i=0;i<celdas.length;i+=7) semanas.push(celdas.slice(i,i+7));
  }

  const diasHeader = vista==='semana'||vista==='quincena'||vista==='mes'?
    ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'] : null;

  const HORAS = Array.from({length:24},(_,i)=>i);

  const renderDiaHorario = (dia) => {
    if(!dia) return <div key="empty" style={{background:C.surface,borderRadius:8,flex:1,opacity:.3}} />;
    const tareasDelDia = tareas.filter(t=>isInRange(dia,t.fecha_inicio,t.fecha_fin)||isSameDay(dia,t.fecha_inicio)||isSameDay(dia,t.fecha_fin));
    const esHoy = dia===hoy();
    return (
      <div key={dia} style={{flex:1,borderRight:`1px solid ${C.border}`,minWidth:0}}>
        <div style={{padding:'6px 8px',fontSize:11,fontWeight:esHoy?700:400,color:esHoy?C.accent:C.muted,borderBottom:`1px solid ${C.border}`,textAlign:'center',background:esHoy?'rgba(110,231,183,.06)':C.surface}}>
          {new Date(dia+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'numeric',month:'short'})}
        </div>
        {/* Tareas sin hora — franja superior */}
        {tareasDelDia.filter(t=>!t.hora_inicio).length > 0 && (
          <div style={{borderBottom:`1px solid ${C.border}`,minHeight:24,padding:'2px 2px'}}>
            {tareasDelDia.filter(t=>!t.hora_inicio).map(t=>{
              const p = getProyecto(t.proyecto_id);
              return (
                <div key={t.id} onClick={()=>onEdit(t)}
                  style={{fontSize:10,padding:'1px 4px',borderRadius:3,background:p?.color+'22'||C.surface2,color:p?.color||C.text,marginBottom:2,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',borderLeft:`3px solid ${p?.color||ESTADO_COLOR[t.estado]}`}}>
                  {t.titulo}
                </div>
              );
            })}
          </div>
        )}
        <div style={{position:'relative'}}>
          {HORAS.map(h=>(
            <div key={h} style={{height:48,borderBottom:`1px solid ${C.border}22`,position:'relative'}}>
              {tareasDelDia.filter(t=>t.hora_inicio&&parseInt(t.hora_inicio.split(':')[0])===h).map(t=>{
                const p = getProyecto(t.proyecto_id);
                const hStart = parseInt((t.hora_inicio||'0:0').split(':')[0]);
                const mStart = parseInt((t.hora_inicio||'0:0').split(':')[1]);
                const hEnd = t.hora_fin?parseInt(t.hora_fin.split(':')[0]):hStart+1;
                const mEnd = t.hora_fin?parseInt(t.hora_fin.split(':')[1]):0;
                const durMin = (hEnd*60+mEnd)-(hStart*60+mStart);
                const altura = Math.max(24, durMin*48/60);
                return (
                  <div key={t.id} onClick={()=>onEdit(t)} style={{position:'absolute',top:mStart*48/60,left:2,right:2,height:altura,background:p?.color+'33'||C.surface2,borderLeft:`3px solid ${p?.color||ESTADO_COLOR[t.estado]}`,borderRadius:4,padding:'2px 4px',fontSize:10,color:p?.color||C.text,cursor:'pointer',overflow:'hidden',zIndex:1}}>
                    <div style={{fontWeight:600}}>{t.titulo}</div>
                    {t.hora_inicio&&<div style={{opacity:.8}}>{t.hora_inicio}{t.hora_fin?`–${t.hora_fin}`:''}</div>}
                  </div>
                );
              })}

            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDia = (dia) => {
    if(!dia) return <div key="empty" style={{background:C.surface,borderRadius:8,padding:8,minHeight:80,opacity:.3}} />;
    const tareasDelDia = tareas.filter(t=>isInRange(dia,t.fecha_inicio,t.fecha_fin)||isSameDay(dia,t.fecha_inicio)||isSameDay(dia,t.fecha_fin));
    const esHoy = dia===hoy();
    return (
      <div key={dia} style={{background:esHoy?'rgba(110,231,183,.06)':C.surface,borderRadius:8,padding:8,minHeight:80,border:esHoy?`1px solid ${C.accent}44`:`1px solid ${C.border}`}}>
        <div style={{fontSize:11,fontWeight:esHoy?700:400,color:esHoy?C.accent:C.muted,marginBottom:6}}>
          {new Date(dia+'T12:00:00').toLocaleDateString('es-AR',{day:'numeric',month:vista==='mes'?'numeric':'short'})}
        </div>
        {tareasDelDia.map(t=>{
          const p = getProyecto(t.proyecto_id);
          return (
            <div key={t.id} onClick={()=>onEdit(t)} style={{fontSize:11,padding:'3px 6px',borderRadius:4,background:p?.color+'22'||C.surface2,color:p?.color||C.text,marginBottom:3,cursor:'pointer',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',borderLeft:`3px solid ${p?.color||ESTADO_COLOR[t.estado]}`}}>
              {t.hora_inicio&&<span style={{opacity:.7}}>{t.hora_inicio} </span>}{t.titulo}
            </div>
          );
        })}
      </div>
    );
  };

  if(vista==='mes') {
    return (
      <div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
          {diasHeader.map(d=><div key={d} style={{fontSize:11,color:C.muted,textAlign:'center',padding:'4px 0'}}>{d}</div>)}
        </div>
        {semanas.map((semana,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:4}}>
            {semana.map((dia,j)=>renderDia(dia))}
          </div>
        ))}
      </div>
    );
  }

  // Vista con horario (dia, semana, quincena)
  if(vista==='dia'||vista==='semana'||vista==='quincena') {
    const diasSem = vista==='dia'?[fechaBase]:vista==='semana'?Array.from({length:7},(_,i)=>addDays(startOfWeek(fechaBase),i)):Array.from({length:14},(_,i)=>addDays(startOfWeek(fechaBase),i));
    const diasVis = vista==='quincena'?diasSem.slice(0,7):diasSem;
    const diasVis2 = vista==='quincena'?diasSem.slice(7):null;
    return (
      <div style={{overflowX:'auto'}}>
        {diasVis2 && <div style={{marginBottom:8,fontSize:11,color:C.muted}}>Semana 1</div>}
        <div style={{display:'flex',minWidth:vista==='dia'?300:600}}>
          {/* Columna de horas */}
          <div style={{width:44,flexShrink:0,paddingTop:36}}>
            {HORAS.map(h=>(
              <div key={h} style={{height:48,fontSize:10,color:C.muted2,textAlign:'right',paddingRight:6,paddingTop:2,borderBottom:`1px solid ${C.border}22`}}>{h}:00</div>
            ))}
          </div>
          {diasVis.map(d=>renderDiaHorario(d))}
        </div>
        {diasVis2 && (
          <>
            <div style={{marginTop:12,marginBottom:8,fontSize:11,color:C.muted}}>Semana 2</div>
            <div style={{display:'flex',minWidth:600}}>
              <div style={{width:44,flexShrink:0,paddingTop:36}}>
                {HORAS.map(h=>(
                  <div key={h} style={{height:48,fontSize:10,color:C.muted2,textAlign:'right',paddingRight:6,paddingTop:2,borderBottom:`1px solid ${C.border}22`}}>{h}:00</div>
                ))}
              </div>
              {diasVis2.map(d=>renderDiaHorario(d))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${cols},1fr)`,gap:4}}>
        {dias.map(d=>renderDia(d))}
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ──
export default function Planner({user}) {
  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [vista, setVista] = useState('kanban');
  const [fechaBase, setFechaBase] = useState(hoy());
  const [modalTarea, setModalTarea] = useState(null); // null | {} | tarea
  const [modalProyecto, setModalProyecto] = useState(false);
  const [filtroProyecto, setFiltroProyecto] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [toast, setToast] = useState('');

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500); };

  const handleGcalConnect = () => {
    if (gcalConnected) {
      gcalLogout();
      setGcalConnected(false);
      showToast('Desconectado de Google Calendar');
    } else {
      gcalLogin();
    }
  };

  const [gcalConnected, setGcalConnected] = useState(gcalIsValid());

  useEffect(()=>{
    const justConnected = parseGcalToken();
    setGcalConnected(gcalIsValid());
    if (justConnected) showToast('✓ Conectado a Google Calendar');
    cargar();
  },[]);

  const cargar = async () => {
    const [tr, pr] = await Promise.all([
      sbSelect('planner_tareas', 'fecha_inicio.asc'),
      sbSelect('planner_proyectos', 'created_at.asc'),
    ]);
    const normH = h => h ? h.slice(0,5) : null;
    setTareas((tr||[]).map(t=>({...t, hora_inicio:normH(t.hora_inicio), hora_fin:normH(t.hora_fin)})));
    setProyectos(pr || []);
  };

  const guardarTarea = async form => {
    // Build clean data object
    const toNull = (v) => (!v || v === '') ? null : v;
    const toTime = (v) => (!v || v === '') ? null : (v.length === 5 ? v + ':00' : v); // Ensure HH:MM:SS for Postgres TIME
    const data = {
      titulo: form.titulo,
      descripcion: toNull(form.descripcion),
      estado: form.estado || 'pendiente',
      prioridad: form.prioridad || 'normal',
      proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id) : null,
      fecha_inicio: (form.fecha_inicio && form.fecha_inicio !== '') ? form.fecha_inicio : new Date().toISOString().split('T')[0],
      fecha_fin: toNull(form.fecha_fin),
      hora_inicio: toTime(form.hora_inicio),
      hora_fin: toTime(form.hora_fin),
      asignado_a: toNull(form.asignado_a),
      google_event_id: toNull(form.google_event_id),
      updated_at: new Date().toISOString(),
    };
    // Save to Supabase FIRST
    let savedId = form.id;
    if(form.id) {
      await sbUpdate('planner_tareas', form.id, data);
    } else {
      const inserted = await sbInsert('planner_tareas', {...data, created_by:user?.email||''});
      if (inserted && inserted[0]) savedId = inserted[0].id;
    }
    setModalTarea(null);
    cargar();
    // Sync with Google Calendar AFTER saving
    if (gcalConnected) {
      try {
        const proyecto = proyectos.find(p => p.id === parseInt(form.proyecto_id));
        const eventId = await gcalUpsertEvent(data, proyecto?.nombre);
        if (eventId && savedId) {
          await sbUpdate('planner_tareas', savedId, { google_event_id: eventId });
        }
      } catch(e) { console.error('GCal sync error:', e); }
    }
    showToast(gcalConnected ? '✓ Guardado y sincronizado con Google Calendar' : '✓ Guardado');
  };

  const eliminarTarea = async id => {
    if(!window.confirm('¿Eliminar tarea?')) return;
    // Delete from Google Calendar if connected
    if (gcalConnected) {
      const tarea = tareas.find(t => t.id === id);
      if (tarea?.google_event_id) {
        try { await gcalDeleteEvent(tarea.google_event_id); } catch(e) {}
      }
    }
    await sbDelete('planner_tareas', id);
    showToast('✓ Eliminado');
    cargar();
  };

  const cambiarEstado = async (id, estado) => {
    await sbUpdate('planner_tareas', id, {estado, updated_at:new Date().toISOString()});
    setTareas(t=>t.map(x=>x.id===id?{...x,estado}:x));
  };

  const guardarProyecto = async form => {
    await sbInsert('planner_proyectos', {...form, created_by:user?.email||''});
    setModalProyecto(false);
    showToast('✓ Proyecto creado');
    cargar();
  };

  const eliminarProyecto = async (id) => {
    if (!window.confirm('¿Eliminar este proyecto? Las tareas asociadas quedarán sin proyecto.')) return;
    await sbDelete('planner_proyectos', id);
    if (filtroProyecto === id.toString()) setFiltroProyecto('');
    showToast('✓ Proyecto eliminado');
    cargar();
  };

  const navegar = dir => {
    const steps = { dia:1, semana:7, quincena:14, mes:30, anual:365 };
    const step = steps[vista] || 7;
    setFechaBase(addDays(fechaBase, dir*step));
  };

  // Reset to today when switching to calendar view
  const cambiarVista = (v) => {
    setVista(v);
    if (['dia','semana','quincena','mes','anual'].includes(v)) {
      setFechaBase(hoy());
    }
  };

  const tareasFiltradas = tareas.filter(t => {
    if(filtroProyecto && t.proyecto_id !== parseInt(filtroProyecto)) return false;
    if(filtroEstado && t.estado !== filtroEstado) return false;
    if(busqueda && !t.titulo.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  const imprimirPlanificacion = () => {
    const hoyStr = new Date().toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    const getDiasPrint = () => {
      if(vista==='dia') return [fechaBase];
      if(vista==='semana') return Array.from({length:7},(_,i)=>addDays(startOfWeek(fechaBase),i));
      if(vista==='quincena') return Array.from({length:14},(_,i)=>addDays(startOfWeek(fechaBase),i));
      if(vista==='mes') {
        const start = startOfMonth(fechaBase);
        const d = new Date(start+'T12:00:00');
        const days = new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
        return Array.from({length:days},(_,i)=>addDays(start,i));
      }
      return Array.from({length:7},(_,i)=>addDays(startOfWeek(fechaBase),i));
    };
    const dias = getDiasPrint();
    const getProyecto = id => proyectos.find(p=>p.id===parseInt(id));
    const diasHTML = dias.map(dia => {
      const d = new Date(dia+'T12:00:00');
      const finSemana = d.getDay()===0||d.getDay()===6;
      const tareasDelDia = tareasFiltradas.filter(t=>
        isInRange(dia,t.fecha_inicio,t.fecha_fin)||isSameDay(dia,t.fecha_inicio)||isSameDay(dia,t.fecha_fin)
      ).sort((a,b)=>(a.hora_inicio||'')>(b.hora_inicio||'')?1:-1);
      const diaLabel = d.toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'short'});
      const tareasHTML = tareasDelDia.length===0
        ? '<div style="color:#aaa;font-size:9pt;padding:4px 0;font-style:italic">Sin actividades</div>'
        : tareasDelDia.map(t=>{
            const p = getProyecto(t.proyecto_id);
            const color = p?.color||'#7c3aed';
            const hora = t.hora_inicio ? t.hora_inicio.slice(0,5)+(t.hora_fin?' – '+t.hora_fin.slice(0,5):'') : '';
            return `<div style="margin-bottom:5px;padding:5px 8px;border-left:3px solid ${color};background:${color}15;border-radius:0 5px 5px 0">
              <div style="font-size:9pt;font-weight:700;color:#1a1a2e">${t.titulo}</div>
              ${hora?`<div style="font-size:8pt;color:#666;margin-top:1px">⏰ ${hora}</div>`:''}
              ${p?`<div style="font-size:8pt;color:${color};margin-top:1px">● ${p.nombre}</div>`:''}
              ${t.descripcion?`<div style="font-size:8pt;color:#888;margin-top:2px">${t.descripcion}</div>`:''}
            </div>`;
          }).join('');
      return `<div style="border:1px solid #e0e0e8;border-radius:8px;overflow:hidden;${finSemana?'opacity:.65':''}">
        <div style="padding:7px 10px;background:${finSemana?'#f5f5f5':'#1a1a2e'};color:${finSemana?'#888':'#fff'}">
          <div style="font-size:9pt;font-weight:700;text-transform:capitalize">${diaLabel}</div>
          ${tareasDelDia.length>0?`<div style="font-size:8pt;opacity:.7">${tareasDelDia.length} tarea${tareasDelDia.length>1?'s':''}</div>`:''}
        </div>
        <div style="padding:8px">${tareasHTML}</div>
      </div>`;
    }).join('');
    const cols = vista==='dia'?1:7;
    const vistaLabel = {dia:'Día',semana:'Semana',quincena:'Dos semanas',mes:'Mes'}[vista]||vista;
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Planificación — ${vistaLabel}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:20px;color:#1a1a2e;background:white}
    h1{font-size:15pt;margin:0;color:#059669}h2{font-size:9pt;color:#666;margin:3px 0 14px;font-weight:400}
    .grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:8px}
    .footer{margin-top:14px;font-size:8pt;color:#aaa;border-top:1px solid #eee;padding-top:6px;display:flex;justify-content:space-between}
    @media print{@page{margin:.8cm;size:landscape}body{padding:0}}</style></head><body>
    <h1>Fima Arquitectura — Planificación</h1>
    <h2>${vistaLabel} · ${labelFecha()} · ${hoyStr}</h2>
    <div class="grid">${diasHTML}</div>
    <div class="footer"><span>Fima Arquitectura</span><span>${labelFecha()}</span></div>
    </body></html>`);
    win.document.close();
    setTimeout(()=>win.print(),600);
  };

    const esCalendario = ['dia','semana','quincena','mes','anual'].includes(vista);

  // Navegación de fecha legible
  const labelFecha = () => {
    const d = new Date(fechaBase+'T12:00:00');
    if(vista==='dia') return fmtFechaLarga(fechaBase);
    if(vista==='semana') { const fin=addDays(startOfWeek(fechaBase),6); return fmtFecha(startOfWeek(fechaBase))+' – '+fmtFecha(fin); }
    if(vista==='quincena') { const fin=addDays(startOfWeek(fechaBase),13); return fmtFecha(startOfWeek(fechaBase))+' – '+fmtFecha(fin); }
    if(vista==='mes') return d.toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    if(vista==='anual') return d.getFullYear().toString();
    return '';
  };

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Syne',sans-serif",paddingBottom:40}}>
      {/* TOOLBAR */}
      <div style={{padding:'12px 20px',borderBottom:`1px solid ${C.border}`,background:C.surface,position:'sticky',top:64,zIndex:40}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:10}}>
          {/* Vistas */}
          <div style={{display:'flex',background:C.surface2,borderRadius:8,padding:3,gap:2}}>
            {VISTAS.map(v=>(
              <button key={v} onClick={()=>setVista(v)} style={{padding:'5px 10px',borderRadius:6,border:'none',background:vista===v?C.accent2:'transparent',color:vista===v?'#fff':C.muted,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:vista===v?600:400}}>
                {VISTA_LABEL[v]}
              </button>
            ))}
          </div>

          {/* Navegación calendario */}
          {esCalendario && (
            <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:8}}>
              <button onClick={()=>navegar(-1)} style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:6,padding:'4px 10px',color:C.text,cursor:'pointer'}}>‹</button>
              <span style={{fontSize:13,color:C.text,minWidth:160,textAlign:'center'}}>{labelFecha()}</span>
              <button onClick={()=>navegar(1)} style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:6,padding:'4px 10px',color:C.text,cursor:'pointer'}}>›</button>
              <button onClick={()=>setFechaBase(hoy())} style={{background:'transparent',border:`1px solid ${C.border2}`,borderRadius:6,padding:'4px 10px',color:C.muted,cursor:'pointer',fontSize:12}}>Hoy</button>
            </div>
          )}

          <div style={{flex:1}}/>

          {/* Acciones */}
          <button onClick={handleGcalConnect} style={{
            padding:'5px 10px', borderRadius:8, fontSize:11, fontWeight:600,
            border: gcalConnected ? '1px solid rgba(52,211,153,.4)' : '1px solid rgba(255,255,255,.15)',
            background: gcalConnected ? 'rgba(52,211,153,.1)' : 'rgba(255,255,255,.05)',
            color: gcalConnected ? '#34d399' : '#7a7a90',
            cursor:'pointer', fontFamily:'inherit',
          }}>
            📅 {gcalConnected ? 'Google Calendar ✓' : 'Conectar Calendar'}
          </button>
          <Btn small onClick={()=>setModalProyecto(true)}>+ Proyecto</Btn>
          <Btn small primary onClick={()=>setModalTarea({})}>+ Tarea</Btn>
          {esCalendario && (
            <button onClick={imprimirPlanificacion} style={{padding:'5px 10px',borderRadius:8,fontSize:11,fontWeight:600,border:'1px solid rgba(5,150,105,.4)',background:'rgba(5,150,105,.08)',color:'#059669',cursor:'pointer',fontFamily:'inherit'}}>
              🖨 Imprimir
            </button>
          )}
        </div>

        {/* Filtros */}
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          <input style={{...inp,width:200,padding:'6px 10px'}} placeholder="Buscar tarea..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
          <select style={{...inp,width:'auto',padding:'6px 10px'}} value={filtroProyecto} onChange={e=>setFiltroProyecto(e.target.value)}>
            <option value="">Todos los proyectos</option>
            {proyectos.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select style={{...inp,width:'auto',padding:'6px 10px'}} value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e=><option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
          </select>
          {/* Proyectos pills */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
            {proyectos.map(p=>(
              <span key={p.id} style={{fontSize:11,padding:'3px 10px',borderRadius:20,background:p.color+'22',color:p.color,border:`1px solid ${p.color+(filtroProyecto==p.id.toString()?'cc':'44')}`,cursor:'pointer',fontWeight:600,display:'inline-flex',alignItems:'center',gap:5}}
                onClick={()=>setFiltroProyecto(filtroProyecto==p.id.toString()?'':p.id.toString())}>
                ● {p.nombre} ({tareas.filter(t=>t.proyecto_id===p.id).length})
                <button onClick={e=>{e.stopPropagation();eliminarProyecto(p.id);}}
                  style={{background:'none',border:'none',cursor:'pointer',color:p.color,fontSize:13,lineHeight:1,padding:'0 1px',opacity:.7,fontFamily:'inherit'}}>×</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{padding:20}}>
        {vista==='kanban' && <ViewKanban tareas={tareasFiltradas} proyectos={proyectos} onEdit={setModalTarea} onDelete={eliminarTarea} onEstado={cambiarEstado} />}
        {vista==='lista' && <ViewLista tareas={tareasFiltradas} proyectos={proyectos} onEdit={setModalTarea} onDelete={eliminarTarea} onEstado={cambiarEstado} />}
        {esCalendario && <ViewCalendario tareas={tareasFiltradas} proyectos={proyectos} vista={vista} fechaBase={fechaBase} onEdit={setModalTarea} />}
      </div>

      {/* MODALES */}
      {modalTarea !== null && <ModalTarea tarea={modalTarea?.id?modalTarea:null} proyectos={proyectos} onSave={guardarTarea} onClose={()=>setModalTarea(null)} />}
      {modalProyecto && <ModalProyecto onSave={guardarProyecto} onClose={()=>setModalProyecto(false)} />}

      {/* TOAST */}
      {toast && <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:20,padding:'10px 20px',fontSize:13,color:C.text,zIndex:400}}>{toast}</div>}
    </div>
  );
}
