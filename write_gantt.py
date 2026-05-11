import os

path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'

content = r"""import '../index.css';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MobileMenu from './MobileMenu';
import api from '../api';

const COLORES = ['#6ee7b7','#a78bfa','#38bdf8','#fbbf24','#f87171','#fb923c','#e879f9','#a3e635','#34d399','#60a5fa'];
const addDias = (fecha, dias) => { const d = new Date(fecha + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.toISOString().split('T')[0]; };
const diasEntre = (a, b) => { const da = new Date(a + 'T12:00:00'); const db = new Date(b + 'T12:00:00'); return Math.round((db - da) / 86400000); };
const fmtFecha = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const fmtFechaLarga = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const getTenantName = () => { try { const s = JSON.parse(localStorage.getItem('obras_session') || '{}'); if (s?.tenant?.nombre) return s.tenant.nombre; const t = JSON.parse(localStorage.getItem('obras_tenant') || 'null'); if (t?.nombre) return t.nombre; } catch(e) {} return 'FAIM OBRAS'; };
const getTenantColor = () => { try { const s = JSON.parse(localStorage.getItem('obras_session') || '{}'); if (s?.tenant?.color_primario) return s.tenant.color_primario; const t = JSON.parse(localStorage.getItem('obras_tenant') || 'null'); if (t?.color_primario) return t.color_primario; } catch(e) {} return 'var(--accent)'; };

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
  const tenantNombre = getTenantName();
  const tenantColor = getTenantColor();

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, tRes, cRes] = await Promise.all([
        api.get(`/presupuestos/${id}`),
        api.get(`/presupuestos/${id}/gantt/tareas`),
        api.get(`/presupuestos/${id}/gantt/config`).catch(() => ({ data: {} })),
      ]);
      setPresupuesto(pRes.data);
      const todasLineas = (pRes.data?.rubros || []).flatMap(r => r.lineas || []);
      setLineas(todasLineas);
      setTareas(tRes.data || []);
      if (cRes.data && Object.keys(cRes.data).length) setConfig(c => ({ ...c, ...cRes.data }));
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const guardarConfig = async (newConfig) => {
    try {
      await api.put(`/presupuestos/${id}/gantt/config`, newConfig);
      setConfig(newConfig);
      showToast('Configuración guardada');
    } catch(e) { console.error(e); }
  };

  const generarDesdeLineas = async () => {
    setGenerando(true);
    try {
      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('Tareas generadas automáticamente');
    } catch(e) { alert('Error al generar: ' + e.message); }
    setGenerando(false);
  };

  const guardarTarea = async (tarea) => {
    try {
      if (tarea.id && tarea.id > 0) {
        await api.put(`/presupuestos/${id}/gantt/tareas/${tarea.id}`, tarea);
      } else {
        const res = await api.post(`/presupuestos/${id}/gantt/tareas`, tarea);
        tarea.id = res.data.id;
      }
      setTareas(prev => {
        const idx = prev.findIndex(t => t.id === tarea.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = tarea; return n; }
        return [...prev, tarea];
      });
      setEditando(null);
      showToast('Guardado');
    } catch(e) { alert('Error al guardar: ' + e.message); }
  };

  const eliminarTarea = async (tid) => {
    if (!window.confirm('¿Eliminar esta tarea?')) return;
    try {
      await api.delete(`/presupuestos/${id}/gantt/tareas/${tid}`);
      setTareas(prev => prev.filter(t => t.id !== tid));
      showToast('Eliminada');
    } catch(e) { alert('Error: ' + e.message); }
  };

  const nuevaTarea = () => {
    const t = { id: Date.now() * -1, nombre: 'Nueva tarea', fecha_inicio: config.fecha_inicio_obra || new Date().toISOString().split('T')[0], duracion_dias: 5, color: COLORES[tareas.length % COLORES.length], orden: tareas.length, progreso: 0 };
    setEditando(t);
  };

  // Calcular rango del diagrama
  const fechaMin = tareas.length ? tareas.reduce((m, t) => t.fecha_inicio < m ? t.fecha_inicio : m, tareas[0].fecha_inicio) : (config.fecha_inicio_obra || new Date().toISOString().split('T')[0]);
  const fechaMax = tareas.length ? tareas.reduce((m, t) => { const fin = addDias(t.fecha_inicio, t.duracion_dias); return fin > m ? fin : m; }, addDias(tareas[0].fecha_inicio, tareas[0].duracion_dias)) : addDias(fechaMin, 30);
  const totalDias = Math.max(30, diasEntre(fechaMin, fechaMax) + 5);
  const PX_DIA = 28;

  // Generar columnas de días
  const dias = Array.from({ length: totalDias }, (_, i) => addDias(fechaMin, i));

  if (loading) return <div className="loading">Cargando Gantt...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, color: tenantColor, cursor: 'pointer' }} onClick={() => navigate('/')}>{tenantNombre}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>← Volver</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{presupuesto?.nombre_obra}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Diagrama Gantt</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={generarDesdeLineas} disabled={generando}>
            {generando ? '...' : '⚡ Generar auto'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={nuevaTarea}>+ Tarea</button>
        </div>
      </div>

      {/* Config bar */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center', background: 'var(--surface)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Inicio:</span>
          <input type="date" className="input" style={{ padding: '2px 8px', fontSize: 11 }} value={config.fecha_inicio_obra || ''} onChange={e => setConfig(c => ({ ...c, fecha_inicio_obra: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Hs/día:</span>
          <input type="number" className="input" style={{ width: 56, padding: '2px 6px', fontSize: 11 }} value={config.horas_dia} onChange={e => setConfig(c => ({ ...c, horas_dia: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span style={{ color: 'var(--muted)' }}>Días/sem:</span>
          <input type="number" className="input" style={{ width: 56, padding: '2px 6px', fontSize: 11 }} value={config.dias_semana} onChange={e => setConfig(c => ({ ...c, dias_semana: e.target.value }))} />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => guardarConfig(config)}>Guardar config</button>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{tareas.length} tareas · {Math.round(totalDias / 7)} semanas</span>
      </div>

      {/* Gantt body */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex' }} ref={scrollRef}>
        {/* Lista tareas */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto' }}>
          <div style={{ height: 32, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Tarea</div>
          {tareas.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
              <p>Sin tareas. Hacé click en "⚡ Generar auto" para crear tareas desde los ítems del presupuesto, o "+ Tarea" para agregar manualmente.</p>
            </div>
          )}
          {tareas.map((t, i) => (
            <div key={t.id} style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--border2)', gap: 6, cursor: 'pointer' }}
              onClick={() => setEditando({ ...t })}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: t.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span>
              <span style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{t.duracion_dias}d</span>
            </div>
          ))}
        </div>

        {/* Diagrama */}
        <div style={{ flex: 1, overflowX: 'auto', position: 'relative' }}>
          {/* Header días */}
          <div style={{ display: 'flex', height: 32, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 10 }}>
            {dias.map((d, i) => {
              const fecha = new Date(d + 'T12:00:00');
              const esLunes = fecha.getDay() === 1;
              const esDomingo = fecha.getDay() === 0;
              return (
                <div key={d} style={{ width: PX_DIA, flexShrink: 0, borderRight: esLunes ? '1px solid var(--border)' : '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: esDomingo ? 'var(--danger)' : esLunes ? 'var(--text)' : 'var(--muted)', fontWeight: esLunes ? 700 : 400, background: esDomingo ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                  {esLunes || i === 0 ? fmtFecha(d) : fecha.getDate()}
                </div>
              );
            })}
          </div>

          {/* Filas tareas */}
          {tareas.map((t, i) => {
            const offset = Math.max(0, diasEntre(fechaMin, t.fecha_inicio));
            const width = t.duracion_dias * PX_DIA;
            return (
              <div key={t.id} style={{ height: 36, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border2)', position: 'relative' }}>
                {/* Grid fondo */}
                {dias.map((d, j) => {
                  const fecha = new Date(d + 'T12:00:00');
                  const esDomingo = fecha.getDay() === 0 || fecha.getDay() === 6;
                  return <div key={j} style={{ width: PX_DIA, flexShrink: 0, height: '100%', background: esDomingo ? 'rgba(0,0,0,0.03)' : 'transparent', borderRight: '1px solid var(--border2)' }} />;
                })}
                {/* Barra */}
                <div style={{ position: 'absolute', left: offset * PX_DIA, width: Math.max(20, width), height: 22, background: t.color, borderRadius: 4, opacity: 0.85, display: 'flex', alignItems: 'center', padding: '0 6px', overflow: 'hidden', cursor: 'pointer', zIndex: 2 }}
                  onClick={() => setEditando({ ...t })}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#0f0f11', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.nombre}</span>
                  {/* Progreso */}
                  {t.progreso > 0 && (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${t.progreso}%`, background: 'rgba(0,0,0,0.2)', borderRadius: 4, zIndex: 1 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Panel edición tarea */}
      {editando && (
        <div className="modal-overlay" onClick={() => setEditando(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h2>{editando.id > 0 ? 'Editar tarea' : 'Nueva tarea'}</h2>
            <div className="form-group">
              <label>Nombre</label>
              <input className="input" value={editando.nombre} onChange={e => setEditando(p => ({ ...p, nombre: e.target.value }))} autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Fecha inicio</label>
                <input type="date" className="input" value={editando.fecha_inicio} onChange={e => setEditando(p => ({ ...p, fecha_inicio: e.target.value }))} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Duración (días)</label>
                <input type="number" className="input" value={editando.duracion_dias} onChange={e => setEditando(p => ({ ...p, duracion_dias: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Progreso %</label>
              <input type="range" min="0" max="100" value={editando.progreso} onChange={e => setEditando(p => ({ ...p, progreso: parseFloat(e.target.value) }))} style={{ width: '100%' }} />
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{editando.progreso}%</span>
            </div>
            <div className="form-group">
              <label>Color</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COLORES.map(c => (
                  <div key={c} style={{ width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer', border: editando.color === c ? '2px solid var(--text)' : '2px solid transparent' }} onClick={() => setEditando(p => ({ ...p, color: c }))} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={() => guardarTarea(editando)}>Guardar</button>
              {editando.id > 0 && <button className="btn btn-danger" onClick={() => { eliminarTarea(editando.id); setEditando(null); }}>Eliminar</button>}
              <button className="btn btn-secondary" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--accent)', color: '#0f0f11', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 13, zIndex: 999 }}>{toast}</div>
      )}
    </div>
  );
}
"""

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to Gantt.jsx")
