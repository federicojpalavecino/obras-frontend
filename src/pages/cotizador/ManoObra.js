import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ArrowLeft, Plus, Check, X, Trash2, Edit2 } from 'lucide-react';

const fmt = (n) => n ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtPct = (n) => n != null ? Number(n).toFixed(2) + '%' : '—';

export default function ManoObra() {
  const navigate = useNavigate();
  const [mos, setMos] = useState([]);
  const [cargas, setCargas] = useState([]);
  const [totalCargas, setTotalCargas] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editandoMO, setEditandoMO] = useState(null);
  const [baseEdit, setBaseEdit] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [modalNuevoMO, setModalNuevoMO] = useState(false);
  const [formNuevoMO, setFormNuevoMO] = useState({ funcion: '', categoria: '', costo_hora_base: '' });
  const [editandoCarga, setEditandoCarga] = useState(null);
  const [formCarga, setFormCarga] = useState({ concepto: '', porcentaje: '' });
  const [modalNuevaCarga, setModalNuevaCarga] = useState(false);
  const [formNuevaCarga, setFormNuevaCarga] = useState({ concepto: '', porcentaje: '' });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [moRes, cargasRes] = await Promise.all([
        api.get('/maestros/mo'),
        api.get('/maestros/cargas-sociales'),
      ]);
      setMos(moRes.data);
      setCargas(cargasRes.data.cargas || []);
      setTotalCargas(cargasRes.data.total_porcentaje || 0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleGuardarMO = async (id) => {
    setGuardando(true);
    try {
      await api.patch(`/maestros/mo/${id}`, { costo_hora_base: parseFloat(baseEdit) });
      setEditandoMO(null);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setGuardando(false);
  };

  const handleCrearMO = async () => {
    if (!formNuevoMO.funcion || !formNuevoMO.costo_hora_base) return;
    try {
      await api.post('/maestros/mo', {
        funcion: formNuevoMO.funcion,
        categoria: formNuevoMO.categoria || null,
        costo_hora: parseFloat(formNuevoMO.costo_hora_base),
      });
      setModalNuevoMO(false);
      setFormNuevoMO({ funcion: '', categoria: '', costo_hora_base: '' });
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarMO = async (mo) => {
    if (!window.confirm(`¿Eliminar "${mo.funcion}"?`)) return;
    try {
      await api.delete(`/maestros/mo/${mo.id}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleGuardarCarga = async (id) => {
    try {
      await api.patch(`/maestros/cargas-sociales/${id}`, {
        concepto: formCarga.concepto,
        porcentaje: parseFloat(formCarga.porcentaje),
      });
      setEditandoCarga(null);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleCrearCarga = async () => {
    if (!formNuevaCarga.concepto || !formNuevaCarga.porcentaje) return;
    try {
      await api.post('/maestros/cargas-sociales', {
        concepto: formNuevaCarga.concepto,
        porcentaje: parseFloat(formNuevaCarga.porcentaje),
      });
      setModalNuevaCarga(false);
      setFormNuevaCarga({ concepto: '', porcentaje: '' });
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarCarga = async (id) => {
    if (!window.confirm('¿Eliminar esta carga social?')) return;
    try {
      await api.delete(`/maestros/cargas-sociales/${id}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const porCategoria = {};
  mos.forEach(m => {
    const cat = m.categoria || 'Sin categoría';
    if (!porCategoria[cat]) porCategoria[cat] = [];
    porCategoria[cat].push(m);
  });

  const diasDesde = (f) => f ? Math.floor((new Date() - new Date(f)) / 86400000) : null;
  const colorAlerta = (d) => d === null ? 'var(--muted)' : d > 60 ? 'var(--danger)' : d > 30 ? 'var(--warn)' : 'var(--success)';

  // Preview costo con cargas para nuevo MO
  const previewCosto = formNuevoMO.costo_hora_base
    ? parseFloat(formNuevoMO.costo_hora_base) * (1 + totalCargas / 100)
    : null;

  return (
    <div>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/app')}><ArrowLeft size={14} /> Volver</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Mano de Obra</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{mos.length} categorías · cargas sociales: {fmtPct(totalCargas)}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setModalNuevaCarga(true)}>
            <Plus size={14} /> Carga social
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setModalNuevoMO(true)}>
            <Plus size={14} /> Nueva función
          </button>
        </div>
      </div>

      {loading ? <div className="loading">Cargando...</div> : (
        <div style={{ display: 'flex', gap: 24, padding: 24 }}>

          {/* PANEL CARGAS SOCIALES */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>
              1) Cargas sociales
            </div>
            <div className="card" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th style={th}>Concepto</th>
                    <th style={{ ...th, textAlign: 'right' }}>%</th>
                    <th style={{ ...th, width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cargas.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.4)' }}>
                      <td style={td}>
                        {editandoCarga === c.id ? (
                          <input className="input" style={{ fontSize: 11, padding: '2px 6px' }}
                            value={formCarga.concepto}
                            onChange={e => setFormCarga(p => ({ ...p, concepto: e.target.value }))} />
                        ) : c.concepto}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mo)' }}>
                        {editandoCarga === c.id ? (
                          <input type="number" min="0" step="0.01" className="input input-mono"
                            style={{ width: 70, fontSize: 11, padding: '2px 6px', textAlign: 'right' }}
                            value={formCarga.porcentaje}
                            onChange={e => setFormCarga(p => ({ ...p, porcentaje: e.target.value }))} />
                        ) : fmtPct(c.porcentaje)}
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        {editandoCarga === c.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-success btn-sm" style={{ padding: '2px 6px' }}
                              onClick={() => handleGuardarCarga(c.id)}><Check size={11} /></button>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px' }}
                              onClick={() => setEditandoCarga(null)}><X size={11} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px' }}
                              onClick={() => { setEditandoCarga(c.id); setFormCarga({ concepto: c.concepto, porcentaje: c.porcentaje }); }}>
                              <Edit2 size={11} />
                            </button>
                            <button style={{ background: 'none', border: 'none', color: 'var(--border2)', cursor: 'pointer', padding: '2px 4px', fontSize: 14 }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}
                              onClick={() => handleEliminarCarga(c.id)}>×</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(110,231,183,0.06)', borderTop: '2px solid var(--border)' }}>
                    <td style={{ ...td, fontWeight: 700, fontSize: 12 }}>Total cargas</td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--success)' }}>
                      {fmtPct(totalCargas)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--surface2)', borderRadius: 8, fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Fórmula:</div>
              <div>Costo/hs = Salario base + (Salario base × {fmtPct(totalCargas)})</div>
              <div style={{ marginTop: 4, color: 'var(--accent2)' }}>= Salario base × {(1 + totalCargas / 100).toFixed(4)}</div>
            </div>
          </div>

          {/* PANEL CATEGORÍAS MO */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 12 }}>
              2) Categorías de mano de obra
            </div>
            {Object.entries(porCategoria).map(([cat, items]) => (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 8, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>
                  {cat}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={th}>Función</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--muted)' }}>Salario base / hs</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--mo)' }}>Cargas ({fmtPct(totalCargas)})</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Costo total / hs</th>
                      <th style={th}>Actualización</th>
                      <th style={{ ...th, width: 130 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(mo => {
                      const isEdit = editandoMO === mo.id;
                      const dias = diasDesde(mo.fecha_actualizacion);
                      const base = parseFloat(mo.costo_hora_base || mo.costo_hora || 0);
                      const costoCargas = base * totalCargas / 100;
                      const costoTotal = parseFloat(mo.costo_hora || 0);
                      const baseEditPreview = isEdit && baseEdit ? parseFloat(baseEdit) : null;
                      return (
                        <tr key={mo.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.5)', background: isEdit ? 'rgba(167,139,250,0.04)' : 'transparent' }}
                          onMouseEnter={e => { if (!isEdit) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                          onMouseLeave={e => { if (!isEdit) e.currentTarget.style.background = 'transparent'; }}>
                          <td style={td}>{mo.funcion}</td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {isEdit ? (
                              <input type="number" min="0" step="0.01" autoFocus
                                className="input input-mono"
                                style={{ width: 120, padding: '3px 8px', fontSize: 13, textAlign: 'right' }}
                                value={baseEdit}
                                onChange={e => setBaseEdit(e.target.value)} />
                            ) : (
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                                {fmt(base)}
                              </span>
                            )}
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--mo)' }}>
                            {isEdit && baseEditPreview
                              ? fmt(baseEditPreview * totalCargas / 100)
                              : fmt(costoCargas)}
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--precio)' }}>
                              {isEdit && baseEditPreview
                                ? fmt(baseEditPreview * (1 + totalCargas / 100))
                                : fmt(costoTotal)}
                            </span>
                          </td>
                          <td style={td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorAlerta(dias), display: 'inline-block' }}></span>
                              <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                                {mo.fecha_actualizacion ? new Date(mo.fecha_actualizacion).toLocaleDateString('es-AR') : 'Sin fecha'}
                                {dias !== null && <span style={{ marginLeft: 4, color: colorAlerta(dias) }}>({dias}d)</span>}
                              </span>
                            </div>
                          </td>
                          <td style={{ ...td, textAlign: 'right' }}>
                            {isEdit ? (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button className="btn btn-success btn-sm" onClick={() => handleGuardarMO(mo.id)} disabled={guardando}>
                                  <Check size={13} /> Guardar
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => setEditandoMO(null)}><X size={13} /></button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary btn-sm"
                                  onClick={() => { setEditandoMO(mo.id); setBaseEdit(mo.costo_hora_base || mo.costo_hora || ''); }}>
                                  Actualizar
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleEliminarMO(mo)}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL NUEVA FUNCIÓN MO */}
      {modalNuevoMO && (
        <div className="modal-overlay" onClick={() => setModalNuevoMO(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nueva función MO</h2>
            <div className="form-group">
              <label>Función *</label>
              <input className="input" value={formNuevoMO.funcion} autoFocus
                onChange={e => setFormNuevoMO(p => ({ ...p, funcion: e.target.value }))}
                placeholder="Ej: Oficial Especializado" />
            </div>
            <div className="form-group">
              <label>Categoría</label>
              <input className="input" value={formNuevoMO.categoria}
                onChange={e => setFormNuevoMO(p => ({ ...p, categoria: e.target.value }))}
                placeholder="Ej: Albañilería" />
            </div>
            <div className="form-group">
              <label>Salario base por hora *</label>
              <input className="input input-mono" type="number" min="0" step="0.01" value={formNuevoMO.costo_hora_base}
                onChange={e => setFormNuevoMO(p => ({ ...p, costo_hora_base: e.target.value }))}
                placeholder="0.00" />
            </div>
            {previewCosto && (
              <div style={{ padding: '10px 14px', background: 'rgba(110,231,183,0.08)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>Desglose del costo/hora:</div>
                <div style={{ display: 'flex', gap: 24, marginTop: 6 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Salario base</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text)' }}>{fmt(parseFloat(formNuevoMO.costo_hora_base))}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Cargas ({fmtPct(totalCargas)})</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--mo)' }}>{fmt(parseFloat(formNuevoMO.costo_hora_base) * totalCargas / 100)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>Total / hora</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--precio)' }}>{fmt(previewCosto)}</div>
                  </div>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalNuevoMO(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearMO}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVA CARGA SOCIAL */}
      {modalNuevaCarga && (
        <div className="modal-overlay" onClick={() => setModalNuevaCarga(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nueva carga social</h2>
            <div className="form-group">
              <label>Concepto *</label>
              <input className="input" value={formNuevaCarga.concepto} autoFocus
                onChange={e => setFormNuevaCarga(p => ({ ...p, concepto: e.target.value }))}
                placeholder="Ej: Jubilación" />
            </div>
            <div className="form-group">
              <label>Porcentaje *</label>
              <input className="input input-mono" type="number" min="0" step="0.01" value={formNuevaCarga.porcentaje}
                onChange={e => setFormNuevaCarga(p => ({ ...p, porcentaje: e.target.value }))}
                placeholder="Ej: 11.00" />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>
              Al guardar, el costo/hora de todas las categorías MO se recalculará automáticamente.
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalNuevaCarga(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearCarga}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', verticalAlign: 'middle' };
