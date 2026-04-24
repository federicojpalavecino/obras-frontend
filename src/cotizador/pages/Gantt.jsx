import '../index.css';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileMenu from './MobileMenu';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const API = 'https://fima-backend-production.up.railway.app';

const COLORES = ['#6ee7b7','#a78bfa','#38bdf8','#fbbf24','#f87171','#fb923c','#e879f9','#a3e635','#34d399','#60a5fa'];

const addDias = (fecha, dias) => {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

const diasEntre = (a, b) => {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

const fmtFecha = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const fmtFechaLarga = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function Gantt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presupuesto, setPresupuesto] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [config, setConfig] = useState({ horas_dia: 8, dias_semana: 5, fecha_inicio_obra: new Date().toISOString().split('T')[0] });
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [toast, setToast] = useState('');
  const [generando, setGenerando] = useState(false);
  const scrollRef = useRef(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, tRes, cRes] = await Promise.all([
        fetch(`${API}/presupuestos/${id}`).then(r => r.json()),
        sb.from('gantt_tareas').select('*').eq('presupuesto_id', id).order('orden'),
        sb.from('gantt_config_proyecto').select('*').eq('presupuesto_id', id).single(),
      ]);
      setPresupuesto(pRes);
      // Extraer lineas desde rubros
      const todasLineas = (pRes.rubros || []).flatMap(r => r.lineas || []);
      setLineas(todasLineas);
      setTareas(tRes.data || []);
      if (cRes.data) setConfig(cRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const guardarConfig = async (cfg) => {
    const data = { ...cfg, presupuesto_id: parseInt(id) };
    const { data: existing } = await sb.from('gantt_config_proyecto').select('id').eq('presupuesto_id', id).single();
    if (existing) await sb.from('gantt_config_proyecto').update(data).eq('presupuesto_id', id);
    else await sb.from('gantt_config_proyecto').insert(data);
    setConfig(cfg);
    showToast('✓ Configuración guardada');
  };

  const generarDesdePresupuesto = async () => {
    setGenerando(true);
    const horasDia = parseFloat(config.horas_dia) || 8;
    const diasSemana = parseFloat(config.dias_semana) || 5;
    const fechaInicio = config.fecha_inicio_obra;
    
    // Obtener horas reales de MO desde el backend (análisis de costos real)
    let horasPorLinea = {};
    try {
      const res = await fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/horas-mo`);
      if (res.ok) {
        const data = await res.json();
        data.forEach(d => { horasPorLinea[d.linea_id] = d.horas_mo; });
      }
    } catch (e) { console.error('horas-mo:', e); }

    // Eliminar tareas existentes
    await sb.from('gantt_tareas').delete().eq('presupuesto_id', id);

    let fechaAcum = fechaInicio;
    const nuevasTareas = [];
    let orden = 0;

    lineas.forEach((linea, i) => {
      // Usar horas reales del análisis de costos si están disponibles
      const horasReales = horasPorLinea[linea.id];
      let duracion;
      if (horasReales && horasReales > 0) {
        // Horas reales del análisis → días laborales
        duracion = Math.max(1, Math.ceil(horasReales / horasDia));
      } else {
        // Sin análisis de MO → 1 día por defecto
        duracion = 1;
      }

      const fechaFin = addDias(fechaAcum, duracion - 1);
      
      nuevasTareas.push({
        presupuesto_id: parseInt(id),
        linea_presupuesto_id: linea.id,
        nombre: linea.nombre_item || linea.nombre_libre || `Ítem ${i + 1}`,
        rubro: linea.categoria_nombre || '',
        duracion_dias: duracion,
        fecha_inicio: fechaAcum,
        fecha_fin: fechaFin,
        orden: orden++,
        color: COLORES[i % COLORES.length],
        completado: 0,
      });
      fechaAcum = addDias(fechaFin, 1);
    });

    if (nuevasTareas.length > 0) {
      await sb.from('gantt_tareas').insert(nuevasTareas);
    }
    
    await cargar();
    setGenerando(false);
    showToast(`✓ ${nuevasTareas.length} tareas generadas desde análisis de costos`);
  };

  const guardarTarea = async (tarea) => {
    const data = { ...tarea };
    if (tarea.id) {
      await sb.from('gantt_tareas').update(data).eq('id', tarea.id);
    } else {
      await sb.from('gantt_tareas').insert({ ...data, presupuesto_id: parseInt(id) });
    }
    setEditando(null);
    showToast('✓ Guardado');
    cargar();
  };

  const eliminarTarea = async (tid) => {
    await sb.from('gantt_tareas').delete().eq('id', tid);
    showToast('✓ Eliminado');
    cargar();
  };

  const enviarAlPlanner = async () => {
    const { data: proyectos } = await sb.from('planner_proyectos').select('*');
    let proyectoId = proyectos?.find(p => p.presupuesto_id === parseInt(id))?.id;
    
    if (!proyectoId) {
      const { data: nuevo } = await sb.from('planner_proyectos').insert({
        nombre: presupuesto?.nombre_obra || `Obra ${id}`,
        color: COLORES[0],
        presupuesto_id: parseInt(id),
      }).select().single();
      proyectoId = nuevo?.id;
    }

    const plannerTareas = tareas.map(t => ({
      proyecto_id: proyectoId,
      titulo: t.nombre,
      descripcion: t.rubro || '',
      estado: t.completado >= 100 ? 'listo' : t.completado > 0 ? 'en_progreso' : 'pendiente',
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin,
      prioridad: 'normal',
    }));

    await sb.from('planner_tareas').insert(plannerTareas);
    showToast(`✓ ${plannerTareas.length} tareas enviadas al Planner`);
  };

  // ── CÁLCULOS DEL GANTT ──
  if (loading) return <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--sans)' }}>Cargando...</div>;

  const fechaMin = tareas.reduce((a, t) => t.fecha_inicio < a ? t.fecha_inicio : a, tareas[0]?.fecha_inicio || config.fecha_inicio_obra);
  const fechaMax = tareas.reduce((a, t) => t.fecha_fin > a ? t.fecha_fin : a, addDias(fechaMin, 30));
  const totalDias = Math.max(30, diasEntre(fechaMin, fechaMax) + 7);
  const PX_DIA = 28;
  const ROW_H = 40;
  const LABEL_W = 260;

  // Generar cabecera de fechas
  const diasHeader = [];
  for (let i = 0; i <= totalDias; i++) {
    diasHeader.push(addDias(fechaMin, i));
  }

  const hoy = new Date().toISOString().split('T')[0];

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
      {/* HEADER */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>FIMA</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>
            ← Volver
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{presupuesto?.nombre_obra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Diagrama de Gantt</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="header-actions-desktop" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={enviarAlPlanner}>📅 Planner</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditando({})}>+ Tarea</button>
            {tareas.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? 'Generando...' : '⚡ Generar'}
              </button>
            )}
            {tareas.length > 0 && (
              <button className="btn btn-warn btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? '...' : '↺ Regenerar'}
              </button>
            )}
          </div>
          <MobileMenu actions={[
            { label: 'Enviar al Planner', icon: '📅', onClick: enviarAlPlanner },
            { label: 'Nueva tarea', icon: '➕', onClick: () => setEditando({}) },
            tareas.length === 0
              ? { label: 'Generar desde presupuesto', icon: '⚡', onClick: generarDesdePresupuesto, disabled: generando }
              : { label: 'Regenerar Gantt', icon: '↺', onClick: generarDesdePresupuesto, disabled: generando, color: 'var(--warn)' },
          ]} />
        </div>
      </div>

      {/* CONFIG BAR */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Inicio obra</label>
          <input type="date" value={config.fecha_inicio_obra} onChange={e => setConfig(c => ({ ...c, fecha_inicio_obra: e.target.value }))}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Hs/día</label>
          <input type="number" value={config.horas_dia} onChange={e => setConfig(c => ({ ...c, horas_dia: e.target.value }))}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12, width: 60, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Días/semana</label>
          <input type="number" value={config.dias_semana} min={1} max={7} onChange={e => setConfig(c => ({ ...c, dias_semana: e.target.value }))}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12, width: 50, fontFamily: 'inherit' }} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => guardarConfig(config)}>Guardar config</button>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {tareas.length} tareas · {fmtFechaLarga(fechaMin)} → {fmtFechaLarga(fechaMax)}
        </div>
      </div>

      {/* GANTT */}
      {tareas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Sin tareas en el Gantt</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Generá automáticamente desde el presupuesto o agregá tareas manualmente</div>
          <button className="btn btn-primary" onClick={generarDesdePresupuesto} disabled={generando}>
            {generando ? 'Generando...' : '⚡ Generar desde presupuesto'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', overflow: 'hidden' }}>
          {/* Labels */}
          <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tarea
            </div>
            {tareas.map(t => (
              <div key={t.id} style={{ height: ROW_H, borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, cursor: 'pointer' }}
                onClick={() => setEditando(t)}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</div>
                  {t.rubro && <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.rubro}</div>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>{t.duracion_dias}d</div>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ width: totalDias * PX_DIA, position: 'relative' }}>
              {/* Header fechas */}
              <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'flex-end', position: 'sticky', top: 0, zIndex: 10 }}>
                {diasHeader.map((dia, i) => {
                  const d = new Date(dia + 'T12:00:00');
                  const esLunes = d.getDay() === 1;
                  const esDomingo = d.getDay() === 0;
                  const esHoyDia = dia === hoy;
                  return (
                    <div key={dia} style={{ width: PX_DIA, flexShrink: 0, height: '100%', borderLeft: esLunes ? '1px solid #3a3a48' : '1px solid #2e2e3822', background: esHoyDia ? 'rgba(110,231,183,.08)' : esDomingo ? 'rgba(74,74,88,.3)' : 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 2px 4px' }}>
                      {esLunes && <div style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</div>}
                      <div style={{ fontSize: 9, color: esHoyDia ? '#6ee7b7' : esDomingo ? '#4a4a58' : 'var(--muted2, #4a4a58)' }}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

              {/* Filas */}
              {tareas.map(t => {
                const offsetDias = diasEntre(fechaMin, t.fecha_inicio || fechaMin);
                const anchoDias = t.duracion_dias || 1;
                const left = offsetDias * PX_DIA;
                const width = anchoDias * PX_DIA - 2;
                const pct = Math.min(100, Math.max(0, t.completado || 0));
                return (
                  <div key={t.id} style={{ height: ROW_H, borderBottom: '1px solid var(--border2)', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {/* Columnas de fondo */}
                    {diasHeader.map(dia => {
                      const d = new Date(dia + 'T12:00:00');
                      const esDomingo = d.getDay() === 0 || d.getDay() === 6;
                      const esHoyDia = dia === hoy;
                      return <div key={dia} style={{ width: PX_DIA, height: '100%', flexShrink: 0, background: esHoyDia ? 'rgba(110,231,183,.04)' : esDomingo ? 'rgba(74,74,88,.15)' : 'transparent', borderLeft: d.getDay() === 1 ? '1px solid #3a3a4844' : '1px solid transparent' }} />;
                    })}
                    {/* Barra de tarea */}
                    <div style={{ position: 'absolute', left, top: 6, width, height: ROW_H - 12, borderRadius: 6, background: t.color + '33', border: `1px solid ${t.color}66`, cursor: 'pointer', overflow: 'hidden' }}
                      onClick={() => setEditando(t)}>
                      {/* Progreso */}
                      <div style={{ width: `${pct}%`, height: '100%', background: t.color + '55', transition: 'width .3s' }} />
                      {/* Label */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {width > 60 ? t.nombre : ''}
                          {pct > 0 && width > 80 ? ` (${pct}%)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Línea de hoy */}
              {hoy >= fechaMin && hoy <= fechaMax && (
                <div style={{ position: 'absolute', left: diasEntre(fechaMin, hoy) * PX_DIA + PX_DIA / 2, top: 0, bottom: 0, width: 2, background: '#6ee7b7', opacity: .5, pointerEvents: 'none', zIndex: 5 }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREA */}
      {editando !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', border: '1px solid #e0e0e8', color: '#1a1a2e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{editando.id ? 'Editar tarea' : 'Nueva tarea'}</div>
              <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 22 }}>×</button>
            </div>
            <EditarTarea tarea={editando} onSave={guardarTarea} onDelete={editando.id ? () => { eliminarTarea(editando.id); setEditando(null); } : null} presupuestoId={parseInt(id)} />
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#222228', border: '1px solid #3a3a48', borderRadius: 20, padding: '10px 20px', fontSize: 13, color: 'var(--text)', zIndex: 400 }}>{toast}</div>}
    </div>
  );
}

function EditarTarea({ tarea, onSave, onDelete, presupuestoId }) {
  const [form, setForm] = useState({
    nombre: '', rubro: '', duracion_dias: 1,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    color: COLORES[0], completado: 0, asignado_a: '',
    presupuesto_id: presupuestoId,
    ...tarea
  });
  const upd = (k, v) => {
    const f = { ...form, [k]: v };
    // Recalcular fecha_fin al cambiar duración o fecha_inicio
    if (k === 'duracion_dias' || k === 'fecha_inicio') {
      const dur = k === 'duracion_dias' ? parseInt(v) || 1 : parseInt(form.duracion_dias) || 1;
      const fi = k === 'fecha_inicio' ? v : form.fecha_inicio;
      f.fecha_fin = addDias(fi, dur - 1);
    }
    // Recalcular duración al cambiar fecha_fin
    if (k === 'fecha_fin' && form.fecha_inicio) {
      f.duracion_dias = Math.max(1, diasEntre(form.fecha_inicio, v) + 1);
    }
    setForm(f);
  };

  const inpStyle = { background: '#f8f9fa', border: '1px solid #e0e0e8', borderRadius: 8, color: '#1a1a2e', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' };

  const lblStyle = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lblStyle}>Nombre *</label>
          <input style={inpStyle} value={form.nombre} onChange={e => upd('nombre', e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lblStyle}>Rubro</label>
          <input style={inpStyle} value={form.rubro || ''} onChange={e => upd('rubro', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Fecha inicio</label>
          <input style={inpStyle} type="date" value={form.fecha_inicio} onChange={e => upd('fecha_inicio', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Duración (días)</label>
          <input style={inpStyle} type="number" min={1} value={form.duracion_dias} onChange={e => upd('duracion_dias', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Fecha fin</label>
          <input style={inpStyle} type="date" value={form.fecha_fin} onChange={e => upd('fecha_fin', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>% completado</label>
          <input style={inpStyle} type="number" min={0} max={100} value={form.completado} onChange={e => upd('completado', e.target.value)} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lblStyle}>Asignado a</label>
          <input style={inpStyle} value={form.asignado_a || ''} onChange={e => upd('asignado_a', e.target.value)} placeholder="Nombre..." />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORES.map(c => (
              <button key={c} onClick={() => upd('color', c)} style={{ width: 24, height: 24, borderRadius: 4, background: c, border: form.color === c ? '3px solid #e8e8f0' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {onDelete && <button onClick={onDelete} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>}
        <div style={{ flex: 1 }} />
        <button onClick={() => onSave(form)} disabled={!form.nombre} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#6ee7b7', color: '#0f0f11', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !form.nombre ? .5 : 1 }}>Guardar</button>
      </div>
    </div>
  );
}
