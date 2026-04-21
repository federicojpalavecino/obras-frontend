import '../../cotizador.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ArrowLeft, Search, ChevronDown, ChevronRight, Check, X, Plus, Copy, Trash2 } from 'lucide-react';

const fmtU = (n) => n ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';
const fmtP = (n) => n ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const FORM_VACIO = { codigo: '', nombre: '', rubro_id: '', presentacion: '', cant_presentacion: '', unidad: 'u', precio_presentacion: '', observacion: '' };
const UNIDADES_PRESENTACION = ['bolsa','caja','rollo','balde','lata','tambor','kg','litro','metro','par','pieza','pallet','fardo','atado'];
const UNIDADES_MEDIDA = ['kg','m2','m3','m','u','litro','tn','gl','bolsa','lote'];

export default function Materiales() {
  const navigate = useNavigate();
  const [materiales, setMateriales] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [historial, setHistorial] = useState({});
  const [expandidos, setExpandidos] = useState({});
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState(FORM_VACIO);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [matsRes, rubrosRes] = await Promise.all([
        api.get('/maestros/materiales'),
        api.get('/maestros/rubros-materiales'),
      ]);
      setMateriales(matsRes.data);
      setRubros(rubrosRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const verHistorial = async (matId) => {
    if (historial[matId]) { setHistorial(prev => ({ ...prev, [matId]: null })); return; }
    try {
      const res = await api.get(`/maestros/materiales/${matId}/historial`);
      setHistorial(prev => ({ ...prev, [matId]: res.data.historial }));
    } catch (e) { console.error(e); }
  };

  const iniciarEdicion = (mat) => {
    setEditando(mat.id);
    setFormEdit({
      precio_presentacion: mat.precio_presentacion || '',
      cant_presentacion: mat.cant_presentacion || '',
      observacion: '',
    });
  };

  // Precio unitario se calcula automáticamente — no se edita manualmente
  const calcPrecioUnit = (precioPres, cant) => {
    const p = parseFloat(precioPres);
    const c = parseFloat(cant);
    if (p > 0 && c > 0) return (p / c).toFixed(6);
    return null;
  };

  const guardarPrecio = async (mat) => {
    setGuardando(true);
    try {
      const body = {};
      if (formEdit.precio_presentacion) body.precio_presentacion = parseFloat(formEdit.precio_presentacion);
      if (formEdit.cant_presentacion) body.cant_presentacion = parseFloat(formEdit.cant_presentacion);
      if (formEdit.observacion) body.observacion = formEdit.observacion;
      const res = await api.patch(`/maestros/materiales/${mat.id}/precio`, body);
      setEditando(null);
      setHistorial(prev => ({ ...prev, [mat.id]: null }));
      setMateriales(prev => prev.map(m => m.id === mat.id ? {
        ...m,
        precio_presentacion: res.data.precio_presentacion,
        precio_unitario: res.data.precio_unitario,
        cant_presentacion: res.data.cant_presentacion,
      } : m));
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
    setGuardando(false);
  };

  const handleCrearMaterial = async () => {
    if (!formNuevo.codigo || !formNuevo.nombre || !formNuevo.rubro_id) return;
    try {
      await api.post('/maestros/materiales', {
        ...formNuevo,
        rubro_id: parseInt(formNuevo.rubro_id),
        cant_presentacion: parseFloat(formNuevo.cant_presentacion) || 1,
        precio_presentacion: parseFloat(formNuevo.precio_presentacion) || 0,
      });
      setModalNuevo(false);
      setFormNuevo(FORM_VACIO);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleDuplicar = async (mat) => {
    const nuevoNombre = prompt(`Nombre para la copia:`, mat.nombre + ' (copia)');
    if (!nuevoNombre) return;
    const nuevoCodigo = prompt(`Código para la copia:`, mat.codigo + '-2');
    if (!nuevoCodigo) return;
    try {
      await api.post(`/maestros/materiales/${mat.id}/duplicar?nuevo_codigo=${encodeURIComponent(nuevoCodigo)}&nuevo_nombre=${encodeURIComponent(nuevoNombre)}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminar = async (mat) => {
    if (!window.confirm(`¿Eliminar "${mat.nombre}"? No se podrá usar en nuevos análisis.`)) return;
    try {
      await api.delete(`/maestros/materiales/${mat.id}`);
      setMateriales(prev => prev.filter(m => m.id !== mat.id));
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const toggleRubro = (rubro) => setExpandidos(prev => ({ ...prev, [rubro]: !prev[rubro] }));

  const matsFiltrados = materiales.filter(m => {
    const matchBusqueda = !busqueda ||
      m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      m.codigo.toLowerCase().includes(busqueda.toLowerCase());
    const matchRubro = !rubroFiltro || m.rubro === rubroFiltro;
    return matchBusqueda && matchRubro;
  });

  const porRubro = {};
  matsFiltrados.forEach(m => {
    const rubro = m.rubro || 'Sin rubro';
    if (!porRubro[rubro]) porRubro[rubro] = [];
    porRubro[rubro].push(m);
  });

  const diasDesde = (f) => f ? Math.floor((new Date() - new Date(f)) / 86400000) : null;
  const colorAlerta = (d) => d === null ? 'var(--muted)' : d > 60 ? 'var(--danger)' : d > 30 ? 'var(--warn)' : 'var(--success)';
  const rubrosUnicos = [...new Set(materiales.map(m => m.rubro).filter(Boolean))];

  return (
    <div>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/app')}><ArrowLeft size={14} /> Volver</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Maestro de Materiales</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{materiales.length} materiales</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--success)' }}>● Actualizado</span>
            <span style={{ color: 'var(--warn)' }}>● +30 días</span>
            <span style={{ color: 'var(--danger)' }}>● +60 días</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModalNuevo(true)}>
            <Plus size={14} /> Nuevo material
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Buscar por nombre o código..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input" style={{ width: 220 }} value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}>
          <option value="">Todos los rubros</option>
          {rubrosUnicos.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(busqueda || rubroFiltro) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setBusqueda(''); setRubroFiltro(''); }}>
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        {loading ? <div className="loading">Cargando...</div> : (
          Object.entries(porRubro).map(([rubro, mats]) => (
            <div key={rubro} style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: '2px solid var(--border)' }}
                onClick={() => toggleRubro(rubro)}>
                {expandidos[rubro] ? <ChevronDown size={16} color="var(--muted)" /> : <ChevronRight size={16} color="var(--muted)" />}
                <span style={{ fontWeight: 700, fontSize: 13 }}>{rubro}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{mats.length}</span>
              </div>

              {!expandidos[rubro] && (
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      <th style={th}>Código</th>
                      <th style={th}>Material</th>
                      <th style={{ ...th, textAlign: 'center' }}>Present.</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--warn)' }}>P. Presentación</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>P. Unitario</th>
                      <th style={th}>Proveedor</th>
                      <th style={th}>Actualización</th>
                      <th style={{ ...th, width: 140 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map(mat => {
                      const dias = diasDesde(mat.fecha_actualizacion);
                      const isEdit = editando === mat.id;
                      const tieneHist = historial[mat.id];
                      const precioUnitCalc = isEdit ? calcPrecioUnit(formEdit.precio_presentacion || mat.precio_presentacion, formEdit.cant_presentacion || mat.cant_presentacion) : null;

                      return (
                        <React.Fragment key={mat.id}>
                          <tr style={{ borderBottom: '1px solid rgba(46,46,56,0.5)', background: isEdit ? 'rgba(167,139,250,0.04)' : 'transparent' }}
                            onMouseEnter={e => { if (!isEdit) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                            onMouseLeave={e => { if (!isEdit) e.currentTarget.style.background = 'transparent'; }}>
                            <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{mat.codigo}</td>
                            <td style={td}>{mat.nombre}</td>
                            <td style={{ ...td, textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                              {isEdit ? (
                                <input type="number" min="0" step="0.001" className="input input-mono"
                                  style={{ width: 70, padding: '3px 6px', fontSize: 11 }}
                                  placeholder="Cant"
                                  value={formEdit.cant_presentacion}
                                  onChange={e => setFormEdit(p => ({ ...p, cant_presentacion: e.target.value }))} />
                              ) : (
                                mat.cant_presentacion ? `${mat.cant_presentacion} ${mat.presentacion || mat.unidad}` : '—'
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              {isEdit ? (
                                <input type="number" min="0" step="0.01" className="input input-mono"
                                  style={{ width: 120, padding: '3px 6px', fontSize: 12 }}
                                  placeholder="Precio de compra"
                                  value={formEdit.precio_presentacion}
                                  onChange={e => setFormEdit(p => ({ ...p, precio_presentacion: e.target.value }))} />
                              ) : (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)' }}>{fmtP(mat.precio_presentacion)}</span>
                              )}
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              {isEdit ? (
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: precioUnitCalc ? 'var(--precio)' : 'var(--border2)' }}>
                                    {precioUnitCalc ? `$ ${Number(precioUnitCalc).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
                                  </div>
                                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>calculado / {mat.unidad}</div>
                                </div>
                              ) : (
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--precio)' }}>
                                  {fmtU(mat.precio_unitario)} / {mat.unidad}
                                </span>
                              )}
                            </td>
                            <td style={{ ...td, fontSize: 12, color: 'var(--muted)' }}>
                              {isEdit ? (
                                <input type="text" className="input" style={{ width: 130, padding: '3px 6px', fontSize: 11 }}
                                  placeholder="Observación" value={formEdit.observacion}
                                  onChange={e => setFormEdit(p => ({ ...p, observacion: e.target.value }))} />
                              ) : mat.proveedor || '—'}
                            </td>
                            <td style={td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorAlerta(dias), display: 'inline-block' }}></span>
                                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                                  {mat.fecha_actualizacion ? new Date(mat.fecha_actualizacion).toLocaleDateString('es-AR') : 'Sin fecha'}
                                  {dias !== null && <span style={{ marginLeft: 4, color: colorAlerta(dias) }}>({dias}d)</span>}
                                </span>
                              </div>
                            </td>
                            <td style={{ ...td, textAlign: 'right' }}>
                              {isEdit ? (
                                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                  <button className="btn btn-success btn-sm" onClick={() => guardarPrecio(mat)} disabled={guardando}>
                                    <Check size={13} /> Guardar
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => setEditando(null)}><X size={13} /></button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                  <button className="btn btn-secondary btn-sm" onClick={() => iniciarEdicion(mat)} title="Actualizar precio">
                                    Precio
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => verHistorial(mat.id)} title="Historial">
                                    {tieneHist ? '▲' : '▼'}
                                  </button>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleDuplicar(mat)} title="Duplicar">
                                    <Copy size={12} />
                                  </button>
                                  <button className="btn btn-danger btn-sm" onClick={() => handleEliminar(mat)} title="Eliminar">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>

                          {tieneHist && (
                            <tr>
                              <td colSpan={8} style={{ padding: '0 12px 12px 40px', background: 'rgba(110,231,183,0.04)' }}>
                                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', margin: '8px 0' }}>Historial</div>
                                <table style={{ width: '50%', borderCollapse: 'collapse' }}>
                                  <tbody>
                                    {tieneHist.length === 0 ? (
                                      <tr><td style={{ color: 'var(--muted)', fontSize: 11 }}>Sin historial</td></tr>
                                    ) : tieneHist.map((h, i) => (
                                      <tr key={i} style={{ borderBottom: '1px solid rgba(46,46,56,0.3)' }}>
                                        <td style={{ padding: '4px 8px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{new Date(h.fecha).toLocaleDateString('es-AR')}</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--precio)', fontWeight: 600 }}>{fmtU(h.precio)}</td>
                                        <td style={{ padding: '4px 8px', fontSize: 11, color: 'var(--muted)' }}>{h.observacion || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL NUEVO MATERIAL */}
      {modalNuevo && (
        <div className="modal-overlay" onClick={() => setModalNuevo(false)}>
          <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h2>Nuevo material</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Código *</label>
                <input className="input input-mono" value={formNuevo.codigo}
                  onChange={e => setFormNuevo(p => ({ ...p, codigo: e.target.value }))}
                  placeholder="Ej: AGL-025" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Rubro *</label>
                <select className="input" value={formNuevo.rubro_id}
                  onChange={e => setFormNuevo(p => ({ ...p, rubro_id: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {rubros.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="input" value={formNuevo.nombre}
                onChange={e => setFormNuevo(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre del material" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Presentación</label>
                <input className="input" value={formNuevo.presentacion}
                  onChange={e => setFormNuevo(p => ({ ...p, presentacion: e.target.value }))}
                  placeholder="bolsa, m3, u..." />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Unidad de análisis</label>
                <input className="input" value={formNuevo.unidad}
                  onChange={e => setFormNuevo(p => ({ ...p, unidad: e.target.value }))}
                  placeholder="kg, m3, u..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Cant. por presentación</label>
                <input className="input input-mono" type="number" min="0" step="0.001" value={formNuevo.cant_presentacion}
                  onChange={e => setFormNuevo(p => ({ ...p, cant_presentacion: e.target.value }))}
                  placeholder="Ej: 50" />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Precio presentación</label>
                <input className="input input-mono" type="number" min="0" step="0.01" value={formNuevo.precio_presentacion}
                  onChange={e => setFormNuevo(p => ({ ...p, precio_presentacion: e.target.value }))}
                  placeholder="Ej: 9796.80" />
              </div>
            </div>
            {formNuevo.precio_presentacion && formNuevo.cant_presentacion && (
              <div style={{ padding: '8px 12px', background: 'rgba(110,231,183,0.08)', borderRadius: 6, fontSize: 12, color: 'var(--precio)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                Precio por {formNuevo.unidad || 'unidad'}: $ {(parseFloat(formNuevo.precio_presentacion) / parseFloat(formNuevo.cant_presentacion)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalNuevo(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearMaterial}>Crear material</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', verticalAlign: 'middle' };
