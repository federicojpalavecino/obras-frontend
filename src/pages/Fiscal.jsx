import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const API = "https://fima-backend-production.up.railway.app";

const C = {
  bg:'#f8f9fa', surface:'#ffffff', surface2:'#f1f3f5', surface3:'#e9ecef',
  border:'#e0e0e8', border2:'#d0d0dc',
  text:'#1a1a2e', muted:'#6b7280', muted2:'#9ca3af',
  accent:'#059669', accent2:'#7c3aed', warn:'#d97706',
  green:'#10b981', red:'#ef4444', blue:'#3b82f6',
};

// ── CONSTANTES FISCALES ──────────────────────────────────────────────────────
const CATEGORIAS_MONO = {
  A: { limite: 2109574,  cuota: 5280,   nombre: 'A' },
  B: { limite: 3132626,  cuota: 6160,   nombre: 'B' },
  C: { limite: 4387264,  cuota: 7260,   nombre: 'C' },
  D: { limite: 5442418,  cuota: 8800,   nombre: 'D' },
  E: { limite: 6440381,  cuota: 11000,  nombre: 'E' },
  F: { limite: 8053988,  cuota: 13420,  nombre: 'F' },
  G: { limite: 10067485, cuota: 17600,  nombre: 'G' },
  H: { limite: 13397490, cuota: 26070,  nombre: 'H' },
  I: { limite: 16079988, cuota: 34980,  nombre: 'I' },
  J: { limite: 19294985, cuota: 47080,  nombre: 'J' },
  K: { limite: 22641940, cuota: 61820,  nombre: 'K' },
};

// Vencimientos ARCA (día del mes)
const VENCIMIENTOS_MENSUAL = {
  monotributo: { dia: 20, descripcion: 'Pago cuota monotributo' },
  iva_ri: { dia: 20, descripcion: 'Declaración IVA (RI)' },
  ganancias_anticipo: { dia: 15, descripcion: 'Anticipo ganancias' },
};

// Vencimientos anuales
const VENCIMIENTOS_ANUALES = [
  { mes: 1, dia: 1, descripcion: 'Recategorización monotributo (enero)' },
  { mes: 7, dia: 1, descripcion: 'Recategorización monotributo (julio)' },
  { mes: 6, dia: 30, descripcion: 'Vencimiento declaración anual ganancias' },
];

const CONDICIONES = ['monotributo', 'responsable_inscripto', 'exento'];
const CONDICION_LABEL = { monotributo:'Monotributista', responsable_inscripto:'Responsable Inscripto', exento:'Exento' };
const TIPOS_FACTURA = ['A','B','C','M','E'];
const IVA_ALICUOTAS = [0, 10.5, 21, 27];

const fmt = n => '$' + Math.round(n||0).toLocaleString('es-AR');
const fmtM = n => { const v=Math.abs(Math.round(n||0)); if(v>=1000000) return (n<0?'-':'')+'$'+(v/1000000).toFixed(2)+'M'; if(v>=1000) return (n<0?'-':'')+'$'+(v/1000).toFixed(0)+'k'; return fmt(n); };
const today = () => new Date().toISOString().split('T')[0];
const fmtFecha = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
const fmtMes = d => d ? new Date(d+'T12:00:00').toLocaleDateString('es-AR',{month:'long',year:'numeric'}) : '—';

const inp = {
  background:C.surface2, border:`1px solid ${C.border2}`, borderRadius:8,
  color:C.text, padding:'8px 12px', fontSize:13, fontFamily:'inherit',
  width:'100%', outline:'none', boxSizing:'border-box'
};
const lbl = { fontSize:11, color:C.muted, display:'block', marginBottom:4, textTransform:'uppercase', letterSpacing:1 };

// ── COMPONENTES BASE ─────────────────────────────────────────────────────────
function Card({title,children,style={},accent}) {
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:12,borderTop:accent?`3px solid ${accent}`:'none',...style}}>
      {title && <div style={{fontSize:10,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:C.muted2,marginBottom:14,fontFamily:"'IBM Plex Mono',monospace"}}>{title}</div>}
      {children}
    </div>
  );
}

function Metric({label,val,color,sub,onClick}) {
  return (
    <div onClick={onClick} style={{background:C.surface2,borderRadius:10,padding:14,cursor:onClick?'pointer':'default'}}>
      <div style={{fontSize:10,color:C.muted,marginBottom:6,textTransform:'uppercase',letterSpacing:.5,fontFamily:"'IBM Plex Mono',monospace"}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:color||C.text}}>{val}</div>
      {sub && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  );
}

function Btn({primary,danger,small,onClick,disabled,children,style={}}) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{padding:small?'6px 14px':'9px 18px',background:primary?C.accent:danger?C.red:'transparent',color:primary||danger?'#fff':C.text,
        border:`1px solid ${primary?C.accent:danger?C.red:C.border2}`,borderRadius:8,cursor:disabled?'not-allowed':'pointer',
        fontSize:small?12:13,fontFamily:'inherit',fontWeight:600,opacity:disabled?.5:1,...style}}>
      {children}
    </button>
  );
}

function Semaforo({pct}) {
  const color = pct >= 90 ? C.red : pct >= 75 ? C.warn : C.green;
  const label = pct >= 90 ? '🔴 CRÍTICO' : pct >= 75 ? '🟡 ATENCIÓN' : '🟢 OK';
  return (
    <div style={{marginTop:12}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
        <span style={{fontSize:12,color:C.muted}}>Facturado vs límite de categoría</span>
        <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
      </div>
      <div style={{background:C.surface2,borderRadius:20,height:8,overflow:'hidden'}}>
        <div style={{width:`${Math.min(100,pct)}%`,height:'100%',background:color,borderRadius:20,transition:'width .5s'}} />
      </div>
      <div style={{fontSize:11,color:C.muted,marginTop:4,textAlign:'right'}}>{pct.toFixed(1)}% del límite anual</div>
    </div>
  );
}

function Badge({color, children}) {
  const bg = color === 'green' ? 'rgba(52,211,153,.12)' : color === 'red' ? 'rgba(248,113,113,.12)' : color === 'warn' ? 'rgba(217,119,6,.12)' : 'rgba(74,74,88,.2)';
  const tc = color === 'green' ? C.green : color === 'red' ? C.red : color === 'warn' ? C.warn : C.muted;
  return <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:bg,color:tc,fontWeight:600}}>{children}</span>;
}

// ── MODAL FACTURA ────────────────────────────────────────────────────────────
function ModalFactura({configs, onSave, onClose, prefill}) {
  const [form, setForm] = useState({
    tipo:'B', numero:'', fecha:today(), emisor_email:'',
    cliente_nombre:'', cliente_cuit:'', concepto:'', monto:'',
    iva_pct:0, estado:'emitida', origen:'manual', presupuesto_id:null,
    certificado_id:null,
    ...prefill
  });
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const montoNeto = parseFloat(form.monto)||0;
  const montoIva = montoNeto * (parseFloat(form.iva_pct)||0) / 100;
  const montoTotal = montoNeto + montoIva;
  const emisorConfig = configs.find(c=>c.usuario_email===form.emisor_email);

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:540,width:'100%',maxHeight:'92vh',overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700}}>Registrar factura</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div>
            <label style={lbl}>Tipo</label>
            <select style={inp} value={form.tipo} onChange={e=>upd('tipo',e.target.value)}>
              {TIPOS_FACTURA.map(t=><option key={t} value={t}>Factura {t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Número</label>
            <input style={inp} value={form.numero} onChange={e=>upd('numero',e.target.value)} placeholder="0001-00000001" />
          </div>
          <div>
            <label style={lbl}>Fecha</label>
            <input style={inp} type="date" value={form.fecha} onChange={e=>upd('fecha',e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Emitida por</label>
            <select style={inp} value={form.emisor_email} onChange={e=>upd('emisor_email',e.target.value)}>
              <option value="">— Seleccionar</option>
              {configs.filter(c=>c.activo).map(c=><option key={c.id} value={c.usuario_email}>{c.nombre}</option>)}
            </select>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <label style={lbl}>Cliente / Comitente</label>
            <input style={inp} value={form.cliente_nombre} onChange={e=>upd('cliente_nombre',e.target.value)} placeholder="Nombre del cliente" />
          </div>
          <div>
            <label style={lbl}>CUIT cliente</label>
            <input style={inp} value={form.cliente_cuit} onChange={e=>upd('cliente_cuit',e.target.value)} placeholder="20-12345678-9" />
          </div>
          <div>
            <label style={lbl}>Estado</label>
            <select style={inp} value={form.estado} onChange={e=>upd('estado',e.target.value)}>
              {['emitida','cobrada','parcial','anulada'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{gridColumn:'span 2'}}>
            <label style={lbl}>Concepto</label>
            <input style={inp} value={form.concepto} onChange={e=>upd('concepto',e.target.value)} placeholder="Honorarios por servicios profesionales..." />
          </div>
          <div>
            <label style={lbl}>Monto neto</label>
            <input style={inp} type="number" value={form.monto} onChange={e=>upd('monto',e.target.value)} placeholder="0" />
          </div>
          <div>
            <label style={lbl}>IVA</label>
            <select style={inp} value={form.iva_pct} onChange={e=>upd('iva_pct',e.target.value)}>
              {IVA_ALICUOTAS.map(a=><option key={a} value={a}>{a}%</option>)}
            </select>
          </div>
          {(montoIva > 0 || form.iva_pct > 0) && (
            <div style={{gridColumn:'span 2',background:C.surface2,borderRadius:8,padding:10,fontSize:12,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <div><span style={{color:C.muted}}>Neto: </span><b>{fmt(montoNeto)}</b></div>
              <div><span style={{color:C.muted}}>IVA {form.iva_pct}%: </span><b>{fmt(montoIva)}</b></div>
              <div><span style={{color:C.muted}}>Total: </span><b style={{color:C.accent}}>{fmt(montoTotal)}</b></div>
            </div>
          )}
          {emisorConfig?.condicion === 'monotributo' && parseFloat(form.iva_pct) > 0 && (
            <div style={{gridColumn:'span 2',background:'rgba(217,119,6,.08)',border:`1px solid rgba(217,119,6,.3)`,borderRadius:8,padding:10,fontSize:12,color:C.warn}}>
              ⚠️ Los monotributistas no deben cobrar IVA. Verificá antes de emitir.
            </div>
          )}
        </div>
        <div style={{display:'flex',gap:8,marginTop:20}}>
          <Btn onClick={onClose} style={{flex:1}}>Cancelar</Btn>
          <Btn primary onClick={()=>onSave({...form,monto:montoNeto,iva_monto:montoIva,monto_total:montoTotal})} disabled={!form.monto||!form.cliente_nombre||!form.emisor_email} style={{flex:2}}>
            Registrar factura
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── MODAL CONFIG PERFIL ──────────────────────────────────────────────────────
function ModalConfig({config, onSave, onDelete, onClose}) {
  const [form, setForm] = useState(config || {
    usuario_email:'', cuit:'', nombre:'', condicion:'monotributo',
    categoria_actual:'H', fecha_inicio_categoria:'', proxima_recategorizacion:'',
    activo:true, iibb_inscripto:false, iibb_numero:'', iibb_alicuota:3,
    banco:'', cbu:'', alias:'', notas:''
  });
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));
  const calcProxRec = fecha => {
    if(!fecha) return '';
    const d = new Date(fecha+'T12:00:00');
    const mes = d.getMonth();
    const anio = d.getFullYear();
    let proxMes, proxAnio;
    if(mes < 6) { proxMes = 6; proxAnio = anio; } else { proxMes = 0; proxAnio = anio+1; }
    return `${proxAnio}-${String(proxMes+1).padStart(2,'0')}-01`;
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:560,width:'100%',maxHeight:'92vh',overflow:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700}}>{config?'Editar perfil fiscal':'Nuevo perfil fiscal'}</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div style={{gridColumn:'span 2'}}>
            <label style={lbl}>Nombre completo</label>
            <input style={inp} value={form.nombre} onChange={e=>upd('nombre',e.target.value)} placeholder="Federico Palavecino" />
          </div>
          <div>
            <label style={lbl}>CUIT</label>
            <input style={inp} value={form.cuit} onChange={e=>upd('cuit',e.target.value)} placeholder="20-12345678-9" />
          </div>
          <div>
            <label style={lbl}>Email</label>
            <input style={inp} value={form.usuario_email} onChange={e=>upd('usuario_email',e.target.value)} placeholder="email@..." />
          </div>
          <div style={{gridColumn:'span 2'}}>
            <label style={lbl}>Condición fiscal</label>
            <select style={inp} value={form.condicion} onChange={e=>upd('condicion',e.target.value)}>
              {CONDICIONES.map(c=><option key={c} value={c}>{CONDICION_LABEL[c]}</option>)}
            </select>
          </div>
          {form.condicion==='monotributo' && <>
            <div>
              <label style={lbl}>Categoría actual</label>
              <select style={inp} value={form.categoria_actual} onChange={e=>upd('categoria_actual',e.target.value)}>
                {Object.keys(CATEGORIAS_MONO).map(k=><option key={k} value={k}>Cat. {k} — {fmtM(CATEGORIAS_MONO[k].limite)}/año</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Inicio categoría</label>
              <input style={inp} type="date" value={form.fecha_inicio_categoria} onChange={e=>{
                upd('fecha_inicio_categoria',e.target.value);
                upd('proxima_recategorizacion',calcProxRec(e.target.value));
              }} />
            </div>
            <div style={{gridColumn:'span 2'}}>
              <label style={lbl}>Próxima recategorización</label>
              <input style={inp} type="date" value={form.proxima_recategorizacion} onChange={e=>upd('proxima_recategorizacion',e.target.value)} />
            </div>
          </>}
          {form.condicion==='responsable_inscripto' && <>
            <div style={{gridColumn:'span 2',background:'rgba(59,130,246,.06)',borderRadius:8,padding:12,fontSize:12,color:C.blue}}>
              Como RI debés presentar DDJJ IVA mensual, retener IVA 21% en facturas A, y presentar ganancias anual.
            </div>
          </>}
          <div>
            <label style={lbl}>Banco</label>
            <input style={inp} value={form.banco||''} onChange={e=>upd('banco',e.target.value)} placeholder="Banco Nación..." />
          </div>
          <div>
            <label style={lbl}>CBU / Alias</label>
            <input style={inp} value={form.cbu||''} onChange={e=>upd('cbu',e.target.value)} placeholder="CBU o alias" />
          </div>
          <div style={{gridColumn:'span 2'}}>
            <label style={lbl}>Notas internas</label>
            <input style={inp} value={form.notas||''} onChange={e=>upd('notas',e.target.value)} placeholder="Observaciones..." />
          </div>
          <div style={{gridColumn:'span 2',display:'flex',alignItems:'center',gap:10}}>
            <input type="checkbox" id="activo" checked={form.activo} onChange={e=>upd('activo',e.target.checked)} style={{width:16,height:16}} />
            <label htmlFor="activo" style={{fontSize:13,color:C.text,cursor:'pointer'}}>Perfil activo</label>
          </div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:20}}>
          {config?.id && <Btn danger onClick={()=>onDelete(config.id)} style={{flex:1}}>Eliminar</Btn>}
          <Btn onClick={onClose} style={{flex:1}}>Cancelar</Btn>
          <Btn primary onClick={()=>onSave(form)} disabled={!form.nombre||!form.cuit} style={{flex:2}}>Guardar</Btn>
        </div>
      </div>
    </div>
  );
}

// ── TABLA CATEGORÍAS ─────────────────────────────────────────────────────────
function TablaCategorias({facturadoPorUsuario}) {
  const totalFact = Object.values(facturadoPorUsuario).reduce((a,b)=>a+b,0);
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr>{['Cat.','Límite anual','Cuota mensual','Tu facturación','Estado'].map(h=>(
            <th key={h} style={{textAlign:'left',padding:'8px 10px',color:C.muted2,fontWeight:600,borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:'uppercase',letterSpacing:.5}}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {Object.entries(CATEGORIAS_MONO).map(([key,cat])=>{
            const esCat = key===Object.keys(CATEGORIAS_MONO).find(k=>CATEGORIAS_MONO[k].limite>=totalFact);
            const pct = totalFact > 0 ? (totalFact/cat.limite*100) : 0;
            return (
              <tr key={key} style={{background:esCat?'rgba(110,231,183,.06)':'transparent'}}>
                <td style={{padding:'8px 10px',fontWeight:esCat?700:400,color:esCat?C.accent:C.text,borderBottom:`1px solid ${C.border}22`}}>{esCat?'→ ':''}{key}</td>
                <td style={{padding:'8px 10px',fontFamily:"'IBM Plex Mono',monospace",borderBottom:`1px solid ${C.border}22`}}>{fmtM(cat.limite)}</td>
                <td style={{padding:'8px 10px',fontFamily:"'IBM Plex Mono',monospace",borderBottom:`1px solid ${C.border}22`,color:C.muted}}>{fmt(cat.cuota)}</td>
                <td style={{padding:'8px 10px',fontFamily:"'IBM Plex Mono',monospace",borderBottom:`1px solid ${C.border}22`,color:totalFact>cat.limite?C.red:C.muted}}>
                  {fmtM(totalFact)} ({pct.toFixed(0)}%)
                </td>
                <td style={{padding:'8px 10px',borderBottom:`1px solid ${C.border}22`}}>
                  {esCat ? <span style={{color:C.accent,fontWeight:600}}>✓ Correcta</span> :
                   totalFact>cat.limite ? <span style={{color:C.red}}>Excede</span> :
                   <span style={{color:C.muted2}}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── PANEL VENCIMIENTOS ───────────────────────────────────────────────────────
function PanelVencimientos({configs}) {
  const hoy = new Date();
  const vencimientos = [];

  // Mensuales para cada perfil activo
  configs.filter(c=>c.activo).forEach(c => {
    const diasMono = 20 - hoy.getDate();
    if (c.condicion === 'monotributo') {
      vencimientos.push({
        titulo: `Cuota monotributo — ${c.nombre}`,
        fecha: `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-20`,
        tipo: 'mensual', dias: diasMono, perfil: c.nombre,
        descripcion: `${fmt(CATEGORIAS_MONO[c.categoria_actual]?.cuota||0)} — Pagar en ARCA`
      });
    }
    if (c.condicion === 'responsable_inscripto') {
      vencimientos.push({
        titulo: `DDJJ IVA — ${c.nombre}`,
        fecha: `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-20`,
        tipo: 'mensual', dias: diasMono, perfil: c.nombre,
        descripcion: 'Presentar DDJJ IVA en ARCA'
      });
    }
    if (c.proxima_recategorizacion) {
      const dRec = new Date(c.proxima_recategorizacion+'T12:00:00');
      const diasRec = Math.ceil((dRec - hoy) / (1000*60*60*24));
      vencimientos.push({
        titulo: `Recategorización — ${c.nombre}`,
        fecha: c.proxima_recategorizacion,
        tipo: 'recategorizacion', dias: diasRec, perfil: c.nombre,
        descripcion: 'Evaluar categoría en base a últimos 12 meses'
      });
    }
  });

  // Ordenar por días
  vencimientos.sort((a,b) => a.dias - b.dias);

  const colorDias = d => d < 0 ? C.red : d <= 7 ? C.red : d <= 30 ? C.warn : C.green;
  const labelDias = d => d < 0 ? `Vencido hace ${Math.abs(d)}d` : d === 0 ? '¡Hoy!' : `${d} días`;

  return (
    <div>
      {vencimientos.length === 0 && (
        <div style={{textAlign:'center',color:C.muted,padding:40}}>Configurá perfiles fiscales para ver vencimientos</div>
      )}
      {vencimientos.map((v,i) => (
        <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:700}}>{v.titulo}</span>
              <Badge color={v.dias <= 7 ? 'red' : v.dias <= 30 ? 'warn' : 'green'}>{v.tipo}</Badge>
            </div>
            <div style={{fontSize:12,color:C.muted}}>{v.descripcion}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtFecha(v.fecha)}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}>
            <div style={{fontSize:16,fontWeight:700,color:colorDias(v.dias)}}>{labelDias(v.dias)}</div>
          </div>
        </div>
      ))}
      <div style={{fontSize:11,color:C.muted,marginTop:8,padding:'8px 12px',background:C.surface2,borderRadius:8}}>
        📌 Para pagar el monotributo: <a href="https://auth.afip.gob.ar" target="_blank" rel="noreferrer" style={{color:C.accent}}>ARCA (afip.gob.ar)</a> → Servicios → Monotributo
      </div>
    </div>
  );
}

// ── PANEL RECOMENDACIONES IA ─────────────────────────────────────────────────
function PanelRecomendaciones({configs, facturas, anio, totalFacturado, facturadoPorUsuario}) {
  const recomendaciones = [];
  const mesActual = new Date().getMonth() + 1;
  const proyeccion = mesActual > 0 ? (totalFacturado / mesActual) * 12 : 0;

  configs.filter(c=>c.activo && c.condicion==='monotributo').forEach(c => {
    const facturado = facturadoPorUsuario[c.usuario_email] || 0;
    const limite = CATEGORIAS_MONO[c.categoria_actual]?.limite || 0;
    const pct = limite > 0 ? facturado / limite * 100 : 0;
    const proyPersanal = mesActual > 0 ? (facturado / mesActual) * 12 : 0;

    if (pct >= 90) {
      recomendaciones.push({
        tipo: 'danger', icono: '🔴',
        titulo: `${c.nombre}: Límite crítico (${pct.toFixed(0)}%)`,
        texto: `Facturaste ${fmt(facturado)} de ${fmt(limite)} permitidos. Si superás el límite en el año, ARCA puede darte de baja del monotributo. Redistribuí facturación o consultá pasarte a RI.`,
        accion: 'Redistribuir urgente'
      });
    } else if (pct >= 75) {
      recomendaciones.push({
        tipo: 'warn', icono: '🟡',
        titulo: `${c.nombre}: Acercándose al límite (${pct.toFixed(0)}%)`,
        texto: `Proyección anual: ${fmtM(proyPersanal)}. Tenés margen pero prestá atención. Considerá redistribuir entre socios si hay otros perfiles activos.`,
        accion: 'Revisar distribución'
      });
    }

    if (proyPersanal > limite * 1.1) {
      recomendaciones.push({
        tipo: 'warn', icono: '📈',
        titulo: `${c.nombre}: Proyección supera el límite`,
        texto: `A este ritmo, en diciembre habrás facturado ${fmtM(proyPersanal)}, superando el límite de cat. ${c.categoria_actual} (${fmtM(limite)}). Evaluá recategorizarte o pasarte a RI.`,
        accion: 'Evaluar RI'
      });
    }
  });

  // Distribución entre socios
  const activos = configs.filter(c=>c.activo&&c.condicion==='monotributo');
  if (activos.length >= 2) {
    const porPersona = totalFacturado / activos.length;
    const desbalance = activos.some(c => Math.abs((facturadoPorUsuario[c.usuario_email]||0) - porPersona) / porPersona > 0.3);
    if (desbalance) {
      recomendaciones.push({
        tipo: 'info', icono: '⚖️',
        titulo: 'Distribución desequilibrada entre socios',
        texto: `La distribución ideal sería ${fmtM(porPersona)} por socio. Distribuir uniformemente optimiza la carga fiscal total del estudio.`,
        accion: 'Ver distribución'
      });
    }
  }

  // Recategorización próxima
  const proxRec = configs.filter(c=>c.proxima_recategorizacion).map(c=>({...c,dias:Math.ceil((new Date(c.proxima_recategorizacion+'T12:00:00')-new Date())/(1000*60*60*24))})).filter(c=>c.dias<=30&&c.dias>=0);
  proxRec.forEach(c => {
    const facturado12m = facturadoPorUsuario[c.usuario_email] || 0;
    const catSugerida = Object.entries(CATEGORIAS_MONO).find(([k,v])=>v.limite>=facturado12m)?.[0];
    const cambio = catSugerida !== c.categoria_actual;
    recomendaciones.push({
      tipo: cambio ? 'warn' : 'info', icono: '📅',
      titulo: `${c.nombre}: Recategorización en ${c.dias} días`,
      texto: cambio
        ? `Basado en tu facturación, deberías cambiar de cat. ${c.categoria_actual} a cat. ${catSugerida||'K+'}. Hacelo antes del vencimiento.`
        : `Tu categoría ${c.categoria_actual} es correcta. Solo confirmala en ARCA.`,
      accion: 'Ir a ARCA'
    });
  });

  if (recomendaciones.length === 0) {
    recomendaciones.push({
      tipo: 'ok', icono: '✅',
      titulo: 'Situación fiscal en orden',
      texto: `Todo parece estar bien para ${anio}. Seguí monitoreando tu facturación mensualmente.`,
    });
  }

  const bgMap = {danger:'rgba(248,113,113,.06)',warn:'rgba(217,119,6,.06)',info:'rgba(59,130,246,.06)',ok:'rgba(52,211,153,.06)'};
  const borderMap = {danger:`rgba(248,113,113,.3)`,warn:`rgba(217,119,6,.3)`,info:`rgba(59,130,246,.3)`,ok:`rgba(52,211,153,.3)`};

  return (
    <div>
      {recomendaciones.map((r,i) => (
        <div key={i} style={{background:bgMap[r.tipo],border:`1px solid ${borderMap[r.tipo]}`,borderRadius:10,padding:16,marginBottom:10}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
            <span style={{fontSize:20}}>{r.icono}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:6}}>{r.titulo}</div>
              <div style={{fontSize:13,color:C.muted,lineHeight:1.5}}>{r.texto}</div>
              {r.accion && (
                <button style={{marginTop:8,fontSize:12,color:C.accent,background:'none',border:`1px solid ${C.accent}30`,borderRadius:6,padding:'4px 10px',cursor:'pointer'}}>
                  {r.accion} →
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MODAL NEGRO ─────────────────────────────────────────────────────────────
function ModalNegro({onSave, onClose}) {
  const [f, setF] = useState({tipo:'ingreso',concepto:'',monto:'',fecha:today()});
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
      <div style={{background:C.surface,borderRadius:16,padding:24,maxWidth:400,width:'100%'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
          <div style={{fontSize:18,fontWeight:700}}>Movimiento en negro</div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:C.muted,fontSize:22}}>×</button>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div>
            <label style={lbl}>Tipo</label>
            <select style={inp} value={f.tipo} onChange={e=>setF(x=>({...x,tipo:e.target.value}))}>
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
          <div><label style={lbl}>Concepto</label><input style={inp} value={f.concepto} onChange={e=>setF(x=>({...x,concepto:e.target.value}))} /></div>
          <div><label style={lbl}>Monto</label><input style={inp} type="number" value={f.monto} onChange={e=>setF(x=>({...x,monto:e.target.value}))} /></div>
          <div><label style={lbl}>Fecha</label><input style={inp} type="date" value={f.fecha} onChange={e=>setF(x=>({...x,fecha:e.target.value}))} /></div>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <Btn onClick={onClose} style={{flex:1}}>Cancelar</Btn>
            <Btn primary disabled={!f.monto||!f.concepto} style={{flex:2}} onClick={()=>onSave(f)}>Guardar</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Fiscal({user}) {
  const [tab, setTab] = useState('dashboard');
  const [configs, setConfigs] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [negro, setNegro] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [cfSemanas, setCfSemanas] = useState([]);
  const [arcaData, setArcaData] = useState({}); // {cuit: {status, comprobantes, total}}
  const [arcaLoading, setArcaLoading] = useState({});
  const [modalFactura, setModalFactura] = useState(false);
  const [modalFacturaPrefill, setModalFacturaPrefill] = useState(null);
  const [modalConfig, setModalConfig] = useState(null);
  const [toast, setToast] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const showToast = msg => { setToast(msg); setTimeout(()=>setToast(''),2500); };

  const cargar = useCallback(async () => {
    const [cf, fa, ne, certs] = await Promise.all([
      sb.from('fiscal_config').select('*').order('created_at'),
      sb.from('fiscal_facturas').select('*').order('fecha',{ascending:false}),
      sb.from('fiscal_negro').select('*').order('fecha',{ascending:false}),
      fetch(`${API}/certificados/todos`).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]);
    if(cf.data) setConfigs(cf.data);
    if(fa.data) setFacturas(fa.data);
    if(ne.data) setNegro(ne.data);
    setCertificados(Array.isArray(certs)?certs:[]);
    // CF semanas para cruzar datos
    const {data:semanas} = await sb.from('semanas').select('*').order('fecha',{ascending:false}).limit(52);
    if(semanas) setCfSemanas(semanas);
  }, []);

  useEffect(()=>{ cargar(); },[cargar]);

  const cargarArcaDatos = async (cuit) => {
    setArcaLoading(l=>({...l,[cuit]:true}));
    try {
      const [statusRes, compRes] = await Promise.all([
        fetch(`${API}/arca/status/${cuit}`),
        fetch(`${API}/arca/comprobantes/${cuit}?anio=${anio}`),
      ]);
      const status = statusRes.ok ? await statusRes.json() : null;
      const comps = compRes.ok ? await compRes.json() : null;
      setArcaData(d=>({...d,[cuit]:{status, ...comps}}));
    } catch(e) { console.error('ARCA error:', e); }
    setArcaLoading(l=>({...l,[cuit]:false}));
  };

  useEffect(()=>{
    configs.filter(c=>c.activo&&c.cuit).forEach(c=>cargarArcaDatos(c.cuit));
  },[configs, anio]);

  const guardarConfig = async form => {
    if(form.id) await sb.from('fiscal_config').update(form).eq('id',form.id);
    else await sb.from('fiscal_config').insert(form);
    setModalConfig(null); showToast('✓ Perfil guardado'); cargar();
  };
  const eliminarConfig = async id => {
    if(!window.confirm('¿Eliminar perfil?')) return;
    await sb.from('fiscal_config').delete().eq('id',id);
    setModalConfig(null); showToast('✓ Eliminado'); cargar();
  };
  const guardarFactura = async form => {
    await sb.from('fiscal_facturas').insert({
      ...form, monto:parseFloat(form.monto||0),
      iva_monto:parseFloat(form.iva_monto||0),
      monto_total:parseFloat(form.monto_total||form.monto||0),
      created_by:user?.email
    });
    setModalFactura(false); setModalFacturaPrefill(null);
    showToast('✓ Factura registrada'); cargar();
  };
  const eliminarFactura = async id => {
    if(!window.confirm('¿Eliminar factura?')) return;
    await sb.from('fiscal_facturas').delete().eq('id',id);
    showToast('✓ Eliminada'); cargar();
  };
  const actualizarEstadoFactura = async (id, estado) => {
    await sb.from('fiscal_facturas').update({estado}).eq('id',id);
    showToast('✓ Estado actualizado'); cargar();
  };

  // ── CÁLCULOS ──────────────────────────────────────────────────────────────
  const facturasAnio = facturas.filter(f=>f.fecha&&f.fecha.startsWith(anio.toString())&&f.estado!=='anulada');
  const negroAnio = negro.filter(n=>n.fecha&&n.fecha.startsWith(anio.toString()));

  const facturadoPorUsuario = {};
  configs.forEach(c=>{ facturadoPorUsuario[c.usuario_email]=0; });
  facturasAnio.forEach(f=>{ if(facturadoPorUsuario[f.emisor_email]!==undefined) facturadoPorUsuario[f.emisor_email]+=(f.monto||0); });

  const totalFacturado = Object.values(facturadoPorUsuario).reduce((a,b)=>a+b,0);
  const totalIvaCobrado = facturasAnio.reduce((a,f)=>a+(f.iva_monto||0),0);
  const totalCobrado = facturas.filter(f=>f.fecha&&f.fecha.startsWith(anio.toString())&&f.estado==='cobrada').reduce((a,f)=>a+(f.monto_total||f.monto||0),0);
  const totalPendiente = facturas.filter(f=>f.fecha&&f.fecha.startsWith(anio.toString())&&f.estado==='emitida').reduce((a,f)=>a+(f.monto_total||f.monto||0),0);
  const totalNegroIng = negroAnio.filter(n=>n.tipo==='ingreso').reduce((a,b)=>a+(b.monto||0),0);
  const totalNegroEg = negroAnio.filter(n=>n.tipo==='egreso').reduce((a,b)=>a+(b.monto||0),0);
  const totalIngresos = totalFacturado + totalNegroIng;

  const configActiva = configs.find(c=>c.activo&&c.condicion==='monotributo');
  const limiteActual = configActiva ? (CATEGORIAS_MONO[configActiva.categoria_actual]?.limite || 0) : 0;
  const pctLimite = limiteActual > 0 ? (totalFacturado/limiteActual*100) : 0;

  const mesActual = new Date().getMonth()+1;
  const proyeccionAnual = mesActual > 0 ? (totalFacturado / mesActual) * 12 : 0;

  const distribucion = (() => {
    const activos = configs.filter(c=>c.activo&&c.condicion==='monotributo');
    if(activos.length < 2) return null;
    const porPersona = totalFacturado / activos.length;
    return activos.map(c=>({ nombre:c.nombre, sugerido:porPersona, actual:facturadoPorUsuario[c.usuario_email]||0 }));
  })();

  // Ingresos CF del año para cruzar
  const ingresosRealCF = cfSemanas
    .filter(s=>s.fecha&&s.fecha.startsWith(anio.toString()))
    .reduce((a,s)=>a+(s.totalIng||0),0);

  // Certificados no facturados
  const idsFacturados = new Set(facturas.map(f=>f.certificado_id).filter(Boolean));
  const certsNoFacturados = certificados.filter(c=>!idsFacturados.has(c.id));

  // Filtros facturas
  const facturasFiltradas = facturas.filter(f => {
    const matchBusq = !busqueda || f.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) || f.concepto?.toLowerCase().includes(busqueda.toLowerCase()) || f.numero?.includes(busqueda);
    const matchEstado = filtroEstado === 'todos' || f.estado === filtroEstado;
    return matchBusq && matchEstado;
  });

  const TABS = [
    ['dashboard','📊','Dashboard'],
    ['facturas','🧾','Facturas'],
    ['certificados','📋','Certificados'],
    ['vencimientos','📅','Vencimientos'],
    ['recomendaciones','💡','Recomendaciones'],
    ['arca','🔗','ARCA'],
    ['negro','🌑','En negro'],
    ['config','⚙️','Perfiles'],
  ];

  return (
    <div style={{minHeight:'100vh',background:C.bg,color:C.text,fontFamily:"'Syne',sans-serif",paddingBottom:40}}>
      {/* TABS */}
      <div style={{position:'sticky',top:64,background:C.surface,borderBottom:`1px solid ${C.border}`,display:'flex',zIndex:40,overflowX:'auto'}}>
        {TABS.map(([id,icon,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{flex:'0 0 auto',padding:'10px 14px',background:'none',border:'none',cursor:'pointer',color:tab===id?C.accent:C.muted,borderBottom:`2px solid ${tab===id?C.accent:'transparent'}`,fontSize:11,fontFamily:'inherit',whiteSpace:'nowrap'}}>
            <div style={{fontSize:16}}>{icon}</div>{label}
          </button>
        ))}
      </div>

      <div style={{padding:16,maxWidth:900,margin:'0 auto'}}>
        {/* Selector año */}
        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:8,marginBottom:16}}>
          <button onClick={()=>setAnio(a=>a-1)} style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:6,padding:'4px 10px',color:C.text,cursor:'pointer'}}>‹</button>
          <span style={{fontSize:14,fontWeight:600,minWidth:60,textAlign:'center'}}>{anio}</span>
          <button onClick={()=>setAnio(a=>a+1)} style={{background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:6,padding:'4px 10px',color:C.text,cursor:'pointer'}}>›</button>
        </div>

        {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
        {tab==='dashboard' && (
          <div>
            {configs.length === 0 && (
              <div style={{background:'rgba(124,58,237,.06)',border:`1px solid rgba(124,58,237,.2)`,borderRadius:10,padding:16,marginBottom:16,fontSize:13}}>
                👋 Empezá configurando tus perfiles fiscales en <b>⚙️ Perfiles</b>
              </div>
            )}
            {/* Métricas principales */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:10,marginBottom:16}}>
              <Metric label="Total facturado" val={fmtM(totalFacturado)} color={C.accent} sub={`${facturasAnio.length} facturas · ${anio}`} />
              <Metric label="Cobrado" val={fmtM(totalCobrado)} color={C.green} sub="Facturas cobradas" />
              <Metric label="Pendiente" val={fmtM(totalPendiente)} color={C.warn} sub="Sin cobrar aún" />
              {totalIvaCobrado > 0 && <Metric label="IVA cobrado" val={fmtM(totalIvaCobrado)} color={C.blue} sub="Posición IVA" />}
            </div>

            {/* Semáforo y proyección */}
            {configActiva && (
              <Card title="Control de categoría" accent={pctLimite>=90?C.red:pctLimite>=75?C.warn:C.accent}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <Metric label="Proyección anual" val={fmtM(proyeccionAnual)} color={proyeccionAnual>limiteActual?C.red:C.text} sub={`Cat. ${configActiva.categoria_actual}`} />
                  <Metric label="Margen disponible" val={fmtM(Math.max(0,limiteActual-totalFacturado))} color={C.green} sub={`Límite: ${fmtM(limiteActual)}`} />
                </div>
                <Semaforo pct={pctLimite} />
              </Card>
            )}

            {/* Cruce con CF */}
            {ingresosRealCF > 0 && (
              <Card title="Ingresos reales vs facturado (CF)">
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                  <Metric label="Ingresos CF" val={fmtM(ingresosRealCF)} color={C.blue} sub="Control financiero" />
                  <Metric label="Facturado" val={fmtM(totalFacturado)} color={C.accent} sub="En blanco" />
                  <Metric label="Brecha" val={fmtM(Math.abs(ingresosRealCF-totalFacturado))} color={ingresosRealCF>totalFacturado?C.warn:C.green}
                    sub={ingresosRealCF>totalFacturado?'Sin facturar':'OK'} />
                </div>
                {ingresosRealCF > totalFacturado * 1.1 && (
                  <div style={{marginTop:12,fontSize:12,color:C.warn,background:'rgba(217,119,6,.08)',borderRadius:8,padding:10}}>
                    ⚠️ Hay {fmtM(ingresosRealCF-totalFacturado)} de ingresos en el CF que no tienen factura asociada.
                  </div>
                )}
              </Card>
            )}

            {/* Distribución entre socios */}
            {distribucion && (
              <Card title="Distribución de facturación entre socios">
                {distribucion.map((d,i) => (
                  <div key={i} style={{marginBottom:10}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                      <span>{d.nombre}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace"}}>{fmtM(d.actual)} <span style={{color:C.muted,fontSize:11}}>/ sugerido {fmtM(d.sugerido)}</span></span>
                    </div>
                    <div style={{background:C.surface2,borderRadius:20,height:6,overflow:'hidden'}}>
                      <div style={{width:`${Math.min(100,d.sugerido>0?d.actual/d.sugerido*100:0)}%`,height:'100%',background:Math.abs(d.actual-d.sugerido)/d.sugerido>0.3?C.warn:C.accent,borderRadius:20}} />
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Certificados pendientes de facturar */}
            {certsNoFacturados.length > 0 && (
              <Card title={`Certificados sin facturar (${certsNoFacturados.length})`} accent={C.warn}>
                {certsNoFacturados.slice(0,3).map((c,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.border}`}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600}}>Cert. #{c.numero} — {c.obra||c.nombre_obra}</div>
                      <div style={{fontSize:11,color:C.muted}}>{fmtFecha(c.fecha)}</div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:700,color:C.accent}}>{fmt(c.total_periodo||c.monto||0)}</span>
                      <Btn small primary onClick={()=>{
                        setModalFacturaPrefill({
                          concepto:`Cert. #${c.numero} — ${c.obra||c.nombre_obra}`,
                          monto:String(c.total_periodo||c.monto||''),
                          certificado_id:c.id,
                          origen:'certificado'
                        });
                        setModalFactura(true);
                      }}>Facturar</Btn>
                    </div>
                  </div>
                ))}
                {certsNoFacturados.length > 3 && <div style={{fontSize:12,color:C.muted,marginTop:8}}>+ {certsNoFacturados.length-3} más en la tab Certificados</div>}
              </Card>
            )}

            <TablaCategorias facturadoPorUsuario={facturadoPorUsuario} />
            <div style={{fontSize:11,color:C.muted,marginTop:6}}>* Montos orientativos. Actualizá los límites según ARCA en cada recategorización.</div>

            {/* Blanco vs negro */}
            <Card title="Ingresos: blanco vs negro" style={{marginTop:12}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
                <Metric label="Facturado (blanco)" val={fmtM(totalFacturado)} color={C.accent} sub={`${totalIngresos>0?(totalFacturado/totalIngresos*100).toFixed(0):0}% del total`} />
                <Metric label="En negro" val={fmtM(totalNegroIng)} color={C.warn} sub={`${totalIngresos>0?(totalNegroIng/totalIngresos*100).toFixed(0):0}% del total`} />
                <Metric label="Total real" val={fmtM(totalIngresos)} color={C.green} sub={`Neto negro: ${fmtM(totalNegroIng-totalNegroEg)}`} />
              </div>
            </Card>
          </div>
        )}

        {/* ── FACTURAS ──────────────────────────────────────────────────────── */}
        {tab==='facturas' && (
          <div>
            <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
              <input style={{...inp,flex:1,minWidth:180}} placeholder="Buscar por cliente, concepto, número..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} />
              <select style={{...inp,width:'auto'}} value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
                {['todos','emitida','cobrada','parcial','anulada'].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <Btn primary small onClick={()=>{setModalFacturaPrefill(null);setModalFactura(true);}}>+ Registrar factura</Btn>
            </div>
            <div style={{fontSize:12,color:C.muted,marginBottom:12}}>
              {facturasFiltradas.length} facturas · Cobrado: {fmtM(totalCobrado)} · Pendiente: {fmtM(totalPendiente)}
            </div>
            {facturasFiltradas.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>Sin facturas</div>}
            {facturasFiltradas.map(f=>(
              <div key={f.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:11,fontWeight:700,background:C.surface2,border:`1px solid ${C.border2}`,borderRadius:6,padding:'2px 8px',color:C.accent2}}>F. {f.tipo}</span>
                      {f.numero && <span style={{fontSize:12,color:C.muted,fontFamily:"'IBM Plex Mono',monospace"}}>{f.numero}</span>}
                      <Badge color={f.estado==='cobrada'?'green':f.estado==='anulada'?'red':f.estado==='parcial'?'warn':''}>{f.estado}</Badge>
                      {f.origen==='certificado' && <Badge color="info">de certificado</Badge>}
                    </div>
                    <div style={{fontSize:14,fontWeight:600}}>{f.cliente_nombre}</div>
                    {f.cliente_cuit && <div style={{fontSize:11,color:C.muted}}>CUIT: {f.cliente_cuit}</div>}
                    {f.concepto && <div style={{fontSize:12,color:C.muted,marginTop:2}}>{f.concepto}</div>}
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>{fmtFecha(f.fecha)} · {f.emisor_email?.split('@')[0]}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:18,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:f.estado==='anulada'?C.muted:C.green}}>{fmt(f.monto_total||f.monto)}</div>
                    {(f.iva_monto>0) && <div style={{fontSize:11,color:C.muted}}>+ IVA {fmt(f.iva_monto)}</div>}
                    <div style={{display:'flex',gap:4,marginTop:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
                      {f.estado==='emitida' && <Btn small onClick={()=>actualizarEstadoFactura(f.id,'cobrada')} style={{fontSize:10}}>✓ Cobrar</Btn>}
                      {f.estado==='emitida' && <Btn small onClick={()=>actualizarEstadoFactura(f.id,'anulada')} style={{fontSize:10}}>Anular</Btn>}
                      <Btn small danger onClick={()=>eliminarFactura(f.id)} style={{fontSize:10}}>Eliminar</Btn>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CERTIFICADOS ──────────────────────────────────────────────────── */}
        {tab==='certificados' && (
          <div>
            <div style={{fontSize:14,color:C.muted,marginBottom:16}}>
              Certificados de obra disponibles para facturar — {certsNoFacturados.length} sin facturar
            </div>
            {certificados.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>No hay certificados emitidos</div>}
            {certificados.map(c=>{
              const facturado = idsFacturados.has(c.id);
              return (
                <div key={c.id} style={{background:C.surface,border:`1px solid ${facturado?C.border:C.warn+'44'}`,borderRadius:10,padding:14,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:700}}>Cert. #{c.numero}</span>
                      <Badge color={facturado?'green':'warn'}>{facturado?'Facturado':'Sin facturar'}</Badge>
                    </div>
                    <div style={{fontSize:13,color:C.text}}>{c.obra||c.nombre_obra}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:2}}>{fmtFecha(c.fecha)}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:16,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:C.green}}>{fmt(c.total_periodo||c.monto||0)}</div>
                    {!facturado && (
                      <Btn small primary style={{marginTop:6}} onClick={()=>{
                        setModalFacturaPrefill({
                          concepto:`Honorarios Cert. #${c.numero} — ${c.obra||c.nombre_obra}`,
                          monto:String(c.total_periodo||c.monto||''),
                          certificado_id:c.id,
                          origen:'certificado',
                        });
                        setModalFactura(true);
                      }}>Facturar →</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── VENCIMIENTOS ──────────────────────────────────────────────────── */}
        {tab==='vencimientos' && (
          <div>
            <div style={{fontSize:14,color:C.muted,marginBottom:16}}>Obligaciones fiscales próximas</div>
            <PanelVencimientos configs={configs} />
          </div>
        )}

        {/* ── RECOMENDACIONES ───────────────────────────────────────────────── */}
        {tab==='recomendaciones' && (
          <div>
            <div style={{fontSize:14,color:C.muted,marginBottom:16}}>Análisis de tu situación fiscal — {anio}</div>
            <PanelRecomendaciones
              configs={configs} facturas={facturas} anio={anio}
              totalFacturado={totalFacturado} facturadoPorUsuario={facturadoPorUsuario} />
          </div>
        )}

        {/* ── ARCA ─────────────────────────────────────────────────────────── */}
        {tab==='arca' && (
          <div>
            <div style={{fontSize:14,color:C.muted,marginBottom:16}}>Comprobantes emitidos en ARCA — {anio}</div>
            {configs.filter(c=>c.activo&&c.cuit).length === 0 && (
              <div style={{textAlign:'center',color:C.muted,padding:40}}>Configurá perfiles fiscales con CUIT primero</div>
            )}
            {configs.filter(c=>c.activo&&c.cuit).map(c => {
              const data = arcaData[c.cuit];
              const loading = arcaLoading[c.cuit];
              const status = data?.status;
              const comprobantes = data?.comprobantes || [];
              const total = data?.total || 0;
              return (
                <Card key={c.cuit} title={c.nombre + " — CUIT " + c.cuit} accent={status?.autenticado ? C.accent : C.border}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {loading && <span style={{fontSize:12,color:C.muted}}>Consultando ARCA...</span>}
                      {!loading && status && (
                        <Badge color={status.autenticado?'green':'red'}>
                          {status.autenticado ? '🟢 Conectado' : '🔴 ' + (status.mensaje||'Sin conexión')}
                        </Badge>
                      )}
                      {!loading && !status && <Badge color="red">🔴 Sin certificado configurado</Badge>}
                    </div>
                    <Btn small onClick={()=>cargarArcaDatos(c.cuit)}>↺ Actualizar</Btn>
                  </div>
                  {status?.autenticado && (
                    <>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:14}}>
                        <Metric label="Total facturado ARCA" val={fmtM(total)} color={C.accent} sub={`${comprobantes.length} comprobantes`} />
                        <Metric label="Diferencia con FIMA" val={fmtM(Math.abs(total-(facturadoPorUsuario[c.usuario_email]||0)))}
                          color={Math.abs(total-(facturadoPorUsuario[c.usuario_email]||0)) < 1000 ? C.green : C.warn}
                          sub={total > (facturadoPorUsuario[c.usuario_email]||0) ? 'Hay facturas en ARCA no registradas' : 'OK'} />
                      </div>
                      {comprobantes.length > 0 && (
                        <div style={{overflowX:'auto'}}>
                          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                            <thead>
                              <tr>{['Número','Fecha','Total','CAE','Estado'].map(h=>(
                                <th key={h} style={{textAlign:'left',padding:'6px 10px',color:C.muted2,fontWeight:600,borderBottom:`1px solid ${C.border}`,fontSize:10,textTransform:'uppercase'}}>{h}</th>
                              ))}</tr>
                            </thead>
                            <tbody>
                              {comprobantes.slice(0,20).map((comp,i)=>(
                                <tr key={i} style={{background:i%2===0?'transparent':C.surface2}}>
                                  <td style={{padding:'7px 10px',fontFamily:"'IBM Plex Mono',monospace"}}>
                                    {String(comp.punto_venta||1).padStart(4,'0')}-{String(comp.numero||0).padStart(8,'0')}
                                  </td>
                                  <td style={{padding:'7px 10px',color:C.muted}}>{fmtFecha(comp.fecha)}</td>
                                  <td style={{padding:'7px 10px',fontFamily:"'IBM Plex Mono',monospace",color:C.green,fontWeight:600}}>{fmt(comp.importe_total)}</td>
                                  <td style={{padding:'7px 10px',fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:C.muted}}>{comp.cae||'—'}</td>
                                  <td style={{padding:'7px 10px'}}>
                                    <Badge color={comp.estado==='A'?'green':'red'}>{comp.estado==='A'?'Autorizado':'Rechazado'}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {comprobantes.length > 20 && <div style={{fontSize:11,color:C.muted,marginTop:8}}>Mostrando 20 de {comprobantes.length}</div>}
                        </div>
                      )}
                      {comprobantes.length === 0 && <div style={{textAlign:'center',color:C.muted,padding:20,fontSize:13}}>Sin comprobantes en ARCA para {anio}</div>}
                    </>
                  )}
                  {!status?.autenticado && !loading && (
                    <div style={{background:'rgba(248,113,113,.06)',border:`1px solid rgba(248,113,113,.2)`,borderRadius:8,padding:12,fontSize:12}}>
                      <div style={{fontWeight:700,marginBottom:6}}>Cómo conectar este CUIT</div>
                      <ol style={{margin:0,paddingLeft:20,lineHeight:2,color:C.muted}}>
                        <li>Generá el certificado digital en ARCA → Administración de Certificados Digitales</li>
                        <li>Habilitá el servicio wsfe en el Administrador de Relaciones</li>
                        <li>Subí el .crt y .key en las variables de entorno de Railway:
                          <code style={{display:'block',background:C.surface2,padding:'4px 8px',borderRadius:4,marginTop:4,fontSize:11}}>
                            ARCA_CERT_{c.cuit.replace(/-/g,'')}<br/>
                            ARCA_KEY_{c.cuit.replace(/-/g,'')}
                          </code>
                        </li>
                      </ol>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── EN NEGRO ──────────────────────────────────────────────────────── */}
        {tab==='negro' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:14,color:C.muted}}>Ingresos: {fmtM(totalNegroIng)} · Egresos: {fmtM(totalNegroEg)} · Neto: {fmtM(totalNegroIng-totalNegroEg)}</div>
              <Btn primary small onClick={()=>setModalFactura('negro')}>+ Agregar</Btn>
            </div>
            {negro.length===0 && <div style={{textAlign:'center',color:C.muted,padding:40}}>Sin movimientos registrados</div>}
            {negro.map(n=>(
              <div key={n.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:11,fontWeight:700,color:n.tipo==='ingreso'?C.green:C.red}}>{n.tipo==='ingreso'?'↑ Ingreso':'↓ Egreso'}</span>
                    <span style={{fontSize:11,color:C.muted}}>{fmtFecha(n.fecha)}</span>
                  </div>
                  <div style={{fontSize:14}}>{n.concepto}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:18,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",color:n.tipo==='ingreso'?C.green:C.red}}>{fmt(n.monto)}</div>
                  <button onClick={async()=>{
                    if(!window.confirm('¿Eliminar?')) return;
                    await sb.from('fiscal_negro').delete().eq('id',n.id);
                    showToast('✓ Eliminado'); cargar();
                  }} style={{fontSize:11,color:C.red,background:'none',border:`1px solid rgba(248,113,113,.3)`,borderRadius:6,padding:'3px 8px',cursor:'pointer',marginTop:6}}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PERFILES ──────────────────────────────────────────────────────── */}
        {tab==='config' && (
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div style={{fontSize:14,color:C.muted}}>Perfiles fiscales del estudio</div>
              <Btn primary small onClick={()=>setModalConfig({})}>+ Agregar perfil</Btn>
            </div>
            {configs.length===0 && (
              <div style={{textAlign:'center',color:C.muted,padding:40,background:C.surface,borderRadius:12,border:`1px solid ${C.border}`}}>
                <div style={{fontSize:24,marginBottom:8}}>📋</div>
                <div style={{fontWeight:600,marginBottom:4}}>Sin perfiles configurados</div>
                <div style={{fontSize:13}}>Agregá los perfiles fiscales de los socios del estudio</div>
              </div>
            )}
            {configs.map(c=>(
              <div key={c.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:10}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <div style={{fontSize:16,fontWeight:700}}>{c.nombre}</div>
                      <Badge color={c.activo?'green':''}>{c.activo?'Activo':'Inactivo'}</Badge>
                      <Badge color="">{CONDICION_LABEL[c.condicion]}</Badge>
                    </div>
                    <div style={{fontSize:13,color:C.muted}}>CUIT: {c.cuit}</div>
                    {c.categoria_actual && <div style={{fontSize:13,color:C.muted}}>Cat. {c.categoria_actual} — {fmtM(CATEGORIAS_MONO[c.categoria_actual]?.limite||0)}/año · Cuota: {fmt(CATEGORIAS_MONO[c.categoria_actual]?.cuota||0)}/mes</div>}
                    {c.proxima_recategorizacion && <div style={{fontSize:12,color:C.warn,marginTop:4}}>📅 Próx. recategorización: {fmtFecha(c.proxima_recategorizacion)}</div>}
                    {c.cbu && <div style={{fontSize:12,color:C.muted,marginTop:4}}>CBU/Alias: {c.cbu}</div>}
                  </div>
                  <Btn small onClick={()=>setModalConfig(c)}>Editar</Btn>
                </div>
                {c.condicion==='monotributo' && c.categoria_actual && (
                  <div style={{marginTop:12,padding:10,background:C.surface2,borderRadius:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:4}}>
                      <span style={{color:C.muted}}>Facturado en {anio}</span>
                      <span style={{fontFamily:"'IBM Plex Mono',monospace",color:C.accent,fontWeight:700}}>{fmtM(facturadoPorUsuario[c.usuario_email]||0)}</span>
                    </div>
                    <Semaforo pct={limiteActual>0?(facturadoPorUsuario[c.usuario_email]||0)/(CATEGORIAS_MONO[c.categoria_actual]?.limite||1)*100:0} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODALES */}
      {modalFactura === true && (
        <ModalFactura configs={configs} onSave={guardarFactura} onClose={()=>{setModalFactura(false);setModalFacturaPrefill(null);}} prefill={modalFacturaPrefill||{}} />
      )}
      {modalFactura === 'negro' && (
        <ModalNegro onSave={async(f)=>{
          await sb.from('fiscal_negro').insert({...f,monto:parseFloat(f.monto),created_by:user?.email});
          setModalFactura(false); showToast('✓ Guardado'); cargar();
        }} onClose={()=>setModalFactura(false)} />
      )}
      {modalConfig !== null && (
        <ModalConfig config={modalConfig?.id?modalConfig:null} onSave={guardarConfig} onDelete={eliminarConfig} onClose={()=>setModalConfig(null)} />
      )}
      {toast && <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:C.text,color:'#fff',borderRadius:20,padding:'10px 20px',fontSize:13,zIndex:400}}>{toast}</div>}
    </div>
  );
}
