import '../../cotizador.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ArrowLeft, Edit2, Trash2, Plus, AlertCircle } from 'lucide-react';

const fmt = n => n != null ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const FORM_VACIO = { nombre: '', unidad: 'hs', costo_hora: '', tipo: '' };

export default function Maquinaria() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [editId, setEditId] = useState(null);
  const [formEdit, setFormEdit] = useState(null);
  const [formNuevo, setFormNuevo] = useState(FORM_VACIO);
  const [impacto, setImpacto] = useState({}); // { maqId: [{ item_nombre, presupuesto_nombre }] }
  const [showImpacto, setShowImpacto] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maestros/maquinaria');
      setItems(res.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleActualizar = async (item) => {
    if (!formEdit?.costo_hora) return;
    setGuardando(true);
    try {
      await api.patch(`/maestros/maquinaria/${item.id}/costo`, {
        costo_hora: parseFloat(formEdit.costo_hora),
      });
      setEditId(null);
      setFormEdit(null);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setGuardando(false);
  };

  const handleCrear = async () => {
    if (!formNuevo.codigo || !formNuevo.nombre || !formNuevo.costo_hora) return;
    setGuardando(true);
    try {
      await api.post('/maestros/maquinaria', {
        nombre: formNuevo.nombre,
        unidad: formNuevo.unidad || 'hs',
        costo_hora: parseFloat(formNuevo.costo_hora),
        tipo: formNuevo.tipo || null,
      });
      setFormNuevo(FORM_VACIO);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setGuardando(false);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Eliminar este equipo? Se desactivará del catálogo.')) return;
    try {
      await api.delete(`/maestros/maquinaria/${id}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const verImpacto = async (maqId) => {
    if (showImpacto === maqId) { setShowImpacto(null); return; }
    try {
      // Fetch items de obra que usan esta maquinaria
      const res = await api.get(`/analisis/maquinaria`);
      // Filter items that use this maq (we get the full list, client-side filter)
      // Actually get from items analisis
      const resItems = await api.get('/maestros/items');
      const usados = [];
      for (const item of (resItems.data || [])) {
        try {
          const detalle = await api.get(`/analisis/items/${item.id}`);
          const maqLineas = detalle.data?.lineas_maquinaria || [];
          if (maqLineas.some(l => l.maquinaria_id === maqId)) {
            usados.push({ id: item.id, nombre: item.nombre, categoria: item.categoria });
          }
        } catch(e) {}
      }
      setImpacto(prev => ({ ...prev, [maqId]: usados }));
      setShowImpacto(maqId);
    } catch(e) { console.error(e); }
  };

  const filtrados = items.filter(m =>
    m.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.codigo?.toLowerCase().includes(busqueda.toLowerCase())
  );

  if (loading) return <div className="loading">Cargando...</div>;

  return (
    <div>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => navigate('/app')}>FIMA</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/app')}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Máquinas, Equipos y Herramientas</div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{items.length} equipos</div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>

        {/* Aviso impacto */}
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={14} />
          Actualizar el costo de un equipo afecta automáticamente todos los análisis de costos que lo usan en ítems abiertos.
        </div>

        {/* Búsqueda */}
        <div style={{ marginBottom: 16 }}>
          <input className="input" placeholder="Buscar por nombre o código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ maxWidth: 340 }} />
        </div>

        {/* Tabla */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                {['Tipo', 'Nombre', 'Unidad', 'Costo/unidad', 'Análisis', 'Acciones'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700,
                    letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)',
                    borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
                  {items.length === 0 ? 'No hay equipos cargados. Agregá uno abajo.' : 'Sin resultados'}
                </td></tr>
              )}
              {filtrados.map(item => (
                <React.Fragment key={item.id}>
                  <tr style={{ borderBottom: showImpacto === item.id ? 'none' : '1px solid var(--border2)',
                    background: showImpacto === item.id ? 'rgba(110,231,183,0.03)' : 'transparent' }}>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: 'var(--muted)' }}>
                      {item.tipo || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{item.nombre}</div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                      {item.unidad || 'hs'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {editId === item.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input className="input input-mono" type="number" value={formEdit?.costo_hora || ''}
                            onChange={e => setFormEdit(p => ({ ...p, costo_hora: e.target.value }))}
                            style={{ width: 120 }} autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleActualizar(item)} />
                          <button className="btn btn-success btn-sm" onClick={() => handleActualizar(item)} disabled={guardando}>✓</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditId(null); setFormEdit(null); }}>×</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>
                            {fmt(item.costo_hora)}/{item.unidad || 'hs'}
                          </span>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => { setEditId(item.id); setFormEdit({ costo_hora: item.costo_hora }); }}
                            title="Editar costo">
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button
                        onClick={() => verImpacto(item.id)}
                        style={{ fontSize: 11, padding: '3px 10px', background: 'none',
                          border: `1px solid ${showImpacto === item.id ? 'var(--accent)' : 'var(--border)'}`,
                          borderRadius: 5, color: showImpacto === item.id ? 'var(--accent)' : 'var(--muted)',
                          cursor: 'pointer', fontFamily: 'inherit' }}>
                        {showImpacto === item.id ? '▲ Ocultar' : '▼ Ver usos'}
                      </button>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(item.id)} title="Eliminar">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>

                  {/* Fila de impacto expandida */}
                  {showImpacto === item.id && (
                    <tr style={{ borderBottom: '1px solid var(--border2)' }}>
                      <td colSpan={6} style={{ padding: '8px 14px 14px 40px', background: 'rgba(110,231,183,0.03)' }}>
                        {!impacto[item.id] ? (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cargando usos...</span>
                        ) : impacto[item.id].length === 0 ? (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>No se usa en ningún análisis de ítems actualmente.</span>
                        ) : (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', marginBottom: 8 }}>
                              Ítems de obra que usan este equipo ({impacto[item.id].length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {impacto[item.id].map(uso => (
                                <span key={uso.id} style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(110,231,183,0.08)',
                                  border: '1px solid rgba(110,231,183,0.2)', borderRadius: 4, color: 'var(--text)' }}>
                                  {uso.categoria && <span style={{ color: 'var(--muted)', marginRight: 4 }}>{uso.categoria} ·</span>}
                                  {uso.nombre}
                                </span>
                              ))}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
                              ↑ Al actualizar el costo, estos ítems recalculan automáticamente en todos los presupuestos abiertos.
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Formulario nuevo equipo */}
        <div className="card">
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--muted)', marginBottom: 16 }}>
            <Plus size={12} style={{ marginRight: 4 }} />
            Agregar equipo / herramienta
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 1 }}>Nombre *</label>
              <input className="input" value={formNuevo.nombre}
                onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Andamio tubular" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 1 }}>Tipo</label>
              <select className="input" value={formNuevo.tipo}
                onChange={e => setFormNuevo(p => ({ ...p, tipo: e.target.value }))}>
                <option value="">— Sin tipo —</option>
                {['Máquina', 'Equipo', 'Herramienta', 'Vehículo', 'Kit'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 1 }}>Unidad</label>
              <select className="input" value={formNuevo.unidad}
                onChange={e => setFormNuevo(p => ({ ...p, unidad: e.target.value }))}>
                {['hs', 'día', 'semana', 'mes', 'viaje', 'uso', 'km'].map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4,
                textTransform: 'uppercase', letterSpacing: 1 }}>Costo/unidad *</label>
              <input className="input input-mono" type="number" value={formNuevo.costo_hora}
                onChange={e => setFormNuevo(p => ({ ...p, costo_hora: e.target.value }))} placeholder="0" />
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleCrear} disabled={guardando || !formNuevo.nombre || !formNuevo.costo_hora}>
            <Plus size={14} /> {guardando ? 'Guardando...' : 'Agregar equipo'}
          </button>
        </div>
      </div>
    </div>
  );
}
