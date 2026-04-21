import React, { useState, useEffect } from 'react';
import api from '../../api';
import { X, Plus, Trash2, Check, RotateCcw, AlertTriangle } from 'lucide-react';

const fmt2 = (n) => n != null ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmt0 = (n) => n != null ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';

export default function PanelAnalisis({ presupuestoId, linea, onClose, onCostoChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [materiales, setMateriales] = useState([]);
  const [moList, setMoList] = useState([]);
  const [maqList, setMaqList] = useState([]);
  const [addMat, setAddMat] = useState({ material_id: '', cantidad: 1 });
  const [addMO, setAddMO] = useState({ unidad_mo_id: '', horas: 1 });
  const [addMaq, setAddMaq] = useState({ maquinaria_id: '', horas: 1 });
  const [editando, setEditando] = useState(null); // {tipo, id, campo, valor}
  const [modalImportar, setModalImportar] = useState(false);
  const [itemsCatalogo, setItemsCatalogo] = useState([]);
  const [busquedaImport, setBusquedaImport] = useState('');
  const [busquedaMat, setBusquedaMat] = useState(''); // búsqueda inline en selector de material
  const [showMatDropdown, setShowMatDropdown] = useState(false);
  const [importando, setImportando] = useState(false);

  const lineaId = linea?.id;
  useEffect(() => {
    if (lineaId) cargar();
  }, [lineaId]);

  useEffect(() => {
    Promise.all([
      api.get('/maestros/materiales'),
      api.get('/analisis/mo'),
      api.get('/analisis/maquinaria'),
    ]).then(([m, mo, maq]) => {
      setMateriales(m.data);
      setMoList(mo.data);
      setMaqList(maq.data);
    });
    // Cargar items del catálogo para importar análisis
    api.get('/analisis/items').then(r => setItemsCatalogo(r.data || [])).catch(() => {});
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis`);
      setData(res.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const recargar = async () => {
    const res = await api.get(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis`);
    setData(res.data);
    // Forzar recálculo de snaps y esperar que termine antes de recargar presupuesto
    try {
      await api.post(`/presupuestos/${presupuestoId}/recalcular-overrides`);
    } catch(e) { console.error('recalcular-overrides:', e); }
    // Pequeña pausa para que el backend commitee los cambios
    await new Promise(r => setTimeout(r, 300));
    if (onCostoChange) onCostoChange(linea.id, res.data.totales.total);
  };

  const handleResetear = async () => {
    if (!window.confirm('¿Restablecer el análisis original? Se perderán todos los cambios de este presupuesto.')) return;
    await api.delete(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis`);
    recargar();
  };

  const handleImportarDesdeCatalogo = async (itemObraId) => {
    setImportando(true);
    try {
      // Obtener el análisis del item del catálogo
      const res = await api.get(`/analisis/items/${itemObraId}`);
      const analisis = res.data;
      // Borrar override actual si existe
      await api.delete(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis`).catch(() => {});
      // Agregar materiales
      for (const m of (analisis.lineas_material || [])) {
        await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/materiales`,
          { material_id: m.material_id, cantidad: parseFloat(m.cantidad) });
      }
      // Agregar MO
      for (const mo of (analisis.lineas_mo || [])) {
        await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/mo`,
          { unidad_mo_id: mo.unidad_mo_id, horas: parseFloat(mo.horas) });
      }
      // Agregar Maquinaria
      for (const maq of (analisis.lineas_maquinaria || [])) {
        await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/maquinaria`,
          { maquinaria_id: maq.maquinaria_id, horas: parseFloat(maq.horas) });
      }
      setModalImportar(false);
      setBusquedaImport('');
      await recargar();
    } catch(e) {
      alert('Error al importar: ' + (e.message || 'desconocido'));
    }
    setImportando(false);
  };

  // Materiales
  const handleAgregarMat = async () => {
    if (!addMat.material_id) return;
    await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/materiales`,
      { material_id: parseInt(addMat.material_id), cantidad: parseFloat(addMat.cantidad) });
    setAddMat({ material_id: '', cantidad: 1 });
    recargar();
  };
  const handleEditarMat = async (id, campo, valor) => {
    const body = {};
    if (campo === 'cantidad') body.cantidad = parseFloat(valor);
    if (campo === 'precio_manual') body.precio_manual = parseFloat(valor) || null;
    await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/materiales/${id}`, body);
    setEditando(null); recargar();
  };
  const handleEliminarMat = async (id) => {
    await api.delete(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/materiales/${id}`);
    recargar();
  };

  // MO
  const handleAgregarMO = async () => {
    if (!addMO.unidad_mo_id) return;
    await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/mo`,
      { unidad_mo_id: parseInt(addMO.unidad_mo_id), horas: parseFloat(addMO.horas) });
    setAddMO({ unidad_mo_id: '', horas: 1 });
    recargar();
  };
  const handleEditarMO = async (id, campo, valor) => {
    const body = {};
    if (campo === 'horas') body.horas = parseFloat(valor);
    if (campo === 'costo_manual') body.costo_manual = parseFloat(valor) || null;
    await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/mo/${id}`, body);
    setEditando(null); recargar();
  };
  const handleEliminarMO = async (id) => {
    await api.delete(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/mo/${id}`);
    recargar();
  };

  // Maquinaria
  const handleAgregarMaq = async () => {
    if (!addMaq.maquinaria_id) return;
    await api.post(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/maquinaria`,
      { maquinaria_id: parseInt(addMaq.maquinaria_id), horas: parseFloat(addMaq.horas) });
    setAddMaq({ maquinaria_id: '', horas: 1 });
    recargar();
  };
  const handleEditarMaq = async (id, campo, valor) => {
    const body = {};
    if (campo === 'horas') body.horas = parseFloat(valor);
    if (campo === 'costo_manual') body.costo_manual = parseFloat(valor) || null;
    await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/maquinaria/${id}`, body);
    setEditando(null); recargar();
  };
  const handleEliminarMaq = async (id) => {
    await api.delete(`/presupuestos/${presupuestoId}/lineas/${linea.id}/analisis/maquinaria/${id}`);
    recargar();
  };

  if (!linea) return null;

  return (
    <div style={{
      width: 420, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
            {linea.nombre_override || linea.nombre_item || linea.nombre_libre}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', marginTop: 3 }}>
            {linea.tipo === 'libre' ? 'Análisis desglosado · ítem libre' : 'Análisis de costos'}{data?.tiene_override && <span style={{ color: 'var(--warn)' }}> · modificado</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setModalImportar(true)} title="Importar análisis desde el catálogo" style={{ fontSize: 10 }}>
            📋 Importar
          </button>
          {data?.tiene_override && (
            <button className="btn btn-secondary btn-sm" onClick={handleResetear} title="Restablecer análisis original">
              <RotateCcw size={12} />
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
      </div>

      {/* Aviso override */}
      {data?.tiene_override && (
        <div style={{ padding: '6px 14px', background: 'rgba(251,191,36,0.08)', borderBottom: '1px solid rgba(251,191,36,0.2)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--warn)' }}>
          <AlertTriangle size={12} />
          Análisis personalizado para este presupuesto
        </div>
      )}

      {/* Totales */}
      {data && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
          {[
            { label: 'Mat', val: data.totales.materiales, color: 'var(--mat)' },
            { label: 'MO', val: data.totales.mano_obra, color: 'var(--mo)' },
            { label: 'Maq', val: data.totales.maquinaria, color: 'var(--maq)' },
            { label: 'Total', val: data.totales.total, color: 'var(--ejec)' },
          ].map(t => (
            <div key={t.label}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' }}>{t.label}</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: t.color }}>{fmt0(t.val)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Contenido */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {loading ? <div className="loading">Cargando...</div> : data && (
          <>
            {/* MATERIALES */}
            <Seccion titulo="1/3) Materiales" color="var(--mat)">
              <TablaLineas
                lineas={data.lineas_mat.map(l => ({
                  id: l.id,
                  nombre: l.nombre, sub: l.codigo,
                  val1: l.cantidad, label1: 'Cant',
                  val2: l.precio_unitario, label2: 'P.Unit',
                  val2_manual: l.precio_manual,
                  subtotal: l.subtotal,
                }))}
                editando={editando} setEditando={setEditando}
                onEditar={(id, campo, val) => handleEditarMat(id, campo, val)}
                onEliminar={handleEliminarMat}
                campo1="cantidad" campo2="precio_manual"
              />
              <FilaAgregar>
                <div style={{ flex: 2, position: 'relative' }}>
                  <input
                    className="input" style={{ fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                    placeholder="Buscar material..."
                    value={busquedaMat}
                    onChange={e => { setBusquedaMat(e.target.value); setShowMatDropdown(true); setAddMat(p => ({ ...p, material_id: '' })); }}
                    onFocus={() => setShowMatDropdown(true)}
                    onBlur={() => setTimeout(() => setShowMatDropdown(false), 150)}
                  />
                  {showMatDropdown && busquedaMat.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 6, maxHeight: 200, overflowY: 'auto', boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
                      {materiales
                        .filter(m => m.nombre.toLowerCase().includes(busquedaMat.toLowerCase()) || m.codigo.toLowerCase().includes(busquedaMat.toLowerCase()))
                        .slice(0, 30)
                        .map(m => (
                          <div key={m.id}
                            onMouseDown={() => { setAddMat(p => ({ ...p, material_id: m.id })); setBusquedaMat(m.codigo + ' — ' + m.nombre); setShowMatDropdown(false); }}
                            style={{ padding: '6px 10px', cursor: 'pointer', fontSize: 11, borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                            <span style={{ fontFamily: 'var(--mono)', color: 'var(--muted)', marginRight: 6 }}>{m.codigo}</span>
                            {m.nombre}
                            <span style={{ float: 'right', color: 'var(--muted)', fontSize: 10 }}>{m.unidad}</span>
                          </div>
                        ))}
                      {materiales.filter(m => m.nombre.toLowerCase().includes(busquedaMat.toLowerCase()) || m.codigo.toLowerCase().includes(busquedaMat.toLowerCase())).length === 0 && (
                        <div style={{ padding: '8px 10px', fontSize: 11, color: 'var(--muted)' }}>Sin resultados</div>
                      )}
                    </div>
                  )}
                </div>
                <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 70, fontSize: 11 }}
                  placeholder="Cant" value={addMat.cantidad} onChange={e => setAddMat(p => ({ ...p, cantidad: e.target.value }))} />
                <button className="btn btn-primary btn-sm" onClick={() => { handleAgregarMat(); setBusquedaMat(''); }}><Plus size={11} /></button>
              </FilaAgregar>
            </Seccion>

            {/* MANO DE OBRA */}
            <Seccion titulo="2/3) Mano de obra" color="var(--mo)">
              <TablaLineas
                lineas={data.lineas_mo.map(l => ({
                  id: l.id, nombre: l.funcion,
                  val1: l.horas, label1: 'Hs',
                  val2: l.costo_hora, label2: '$/hs',
                  val2_manual: l.costo_manual,
                  subtotal: l.subtotal,
                }))}
                editando={editando} setEditando={setEditando}
                onEditar={(id, campo, val) => handleEditarMO(id, campo, val)}
                onEliminar={handleEliminarMO}
                campo1="horas" campo2="costo_manual"
              />
              <FilaAgregar>
                <select className="input" style={{ flex: 2, fontSize: 11 }}
                  value={addMO.unidad_mo_id} onChange={e => setAddMO(p => ({ ...p, unidad_mo_id: e.target.value }))}>
                  <option value="">Función...</option>
                  {moList.map(m => <option key={m.id} value={m.id}>{m.funcion}</option>)}
                </select>
                <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 70, fontSize: 11 }}
                  placeholder="Hs" value={addMO.horas} onChange={e => setAddMO(p => ({ ...p, horas: e.target.value }))} />
                <button className="btn btn-primary btn-sm" onClick={handleAgregarMO}><Plus size={11} /></button>
              </FilaAgregar>
            </Seccion>

            {/* MAQUINARIA */}
            <Seccion titulo="3/3) Maq / Eq / Herr" color="var(--maq)">
              <TablaLineas
                lineas={data.lineas_maq.map(l => ({
                  id: l.id, nombre: l.nombre,
                  val1: l.horas, label1: 'Hs',
                  val2: l.costo_hora, label2: '$/hs',
                  val2_manual: l.costo_manual,
                  subtotal: l.subtotal,
                }))}
                editando={editando} setEditando={setEditando}
                onEditar={(id, campo, val) => handleEditarMaq(id, campo, val)}
                onEliminar={handleEliminarMaq}
                campo1="horas" campo2="costo_manual"
              />
              <FilaAgregar>
                <select className="input" style={{ flex: 2, fontSize: 11 }}
                  value={addMaq.maquinaria_id} onChange={e => setAddMaq(p => ({ ...p, maquinaria_id: e.target.value }))}>
                  <option value="">Equipo...</option>
                  {maqList.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
                <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 70, fontSize: 11 }}
                  placeholder="Hs" value={addMaq.horas} onChange={e => setAddMaq(p => ({ ...p, horas: e.target.value }))} />
                <button className="btn btn-primary btn-sm" onClick={handleAgregarMaq}><Plus size={11} /></button>
              </FilaAgregar>
            </Seccion>
          </>
        )}
      </div>

      {/* MODAL IMPORTAR DESDE CATÁLOGO */}
      {modalImportar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setModalImportar(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 20, width: 'min(480px, 95vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>📋 Importar análisis del catálogo</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }} onClick={() => setModalImportar(false)}><X size={16} /></button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Elegí un ítem del catálogo para copiar su análisis de materiales, MO y maquinaria a este ítem.
            </div>
            <input className="input" placeholder="Buscar por código o nombre..."
              value={busquedaImport} onChange={e => setBusquedaImport(e.target.value)}
              autoFocus style={{ fontSize: 12 }} />
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {itemsCatalogo
                .filter(it => !busquedaImport || it.nombre.toLowerCase().includes(busquedaImport.toLowerCase()) || it.codigo.toLowerCase().includes(busquedaImport.toLowerCase()))
                .slice(0, 50)
                .map(it => (
                  <button key={it.id}
                    disabled={importando}
                    onClick={() => handleImportarDesdeCatalogo(it.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left', opacity: importando ? 0.5 : 1 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)', minWidth: 60 }}>{it.codigo}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{it.nombre}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                        MAT {fmt0(it.costo_materiales)} · MO {fmt0(it.costo_mano_obra)} · MAQ {fmt0(it.costo_maquinaria)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600 }}>{importando ? '...' : '→'}</div>
                  </button>
                ))}
              {itemsCatalogo.filter(it => !busquedaImport || it.nombre.toLowerCase().includes(busquedaImport.toLowerCase()) || it.codigo.toLowerCase().includes(busquedaImport.toLowerCase())).length === 0 && (
                <div style={{ color: 'var(--muted)', fontSize: 12, padding: 12, textAlign: 'center' }}>Sin resultados</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Seccion({ titulo, color, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color, marginBottom: 8, paddingBottom: 4, borderBottom: `1px solid ${color}40` }}>
        {titulo}
      </div>
      {children}
    </div>
  );
}

function TablaLineas({ lineas, editando, setEditando, onEditar, onEliminar, campo1, campo2 }) {
  const [editVal, setEditVal] = useState('');

  if (lineas.length === 0)
    return <div style={{ fontSize: 11, color: 'var(--muted)', padding: '4px 0 8px' }}>Sin líneas</div>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 6 }}>
      <tbody>
        {lineas.map(l => {
          const isEdit1 = editando?.id === l.id && editando?.campo === campo1;
          const isEdit2 = editando?.id === l.id && editando?.campo === campo2;
          return (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.4)' }}>
              <td style={{ padding: '5px 0', fontSize: 11, lineHeight: 1.3 }}>
                <div>{l.nombre}</div>
                {l.sub && <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{l.sub}</div>}
              </td>
              {/* Campo 1 (cantidad/horas) */}
              <td style={{ padding: '5px 4px', textAlign: 'right', width: 70 }}>
                {isEdit1 ? (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <input type="number" min="0" step="0.001" autoFocus value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      style={{ width: 55, background: 'var(--bg)', border: '1px solid var(--accent2)', borderRadius: 3, padding: '2px 4px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right' }} />
                    <button style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }} onClick={() => onEditar(l.id, campo1, editVal)}><Check size={11} /></button>
                    <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setEditando(null)}><X size={10} /></button>
                  </div>
                ) : (
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
                    onClick={() => { setEditando({ id: l.id, campo: campo1 }); setEditVal(l.val1); }}
                    title={`Editar ${l.label1}`}>
                    {l.val1}
                  </span>
                )}
              </td>
              {/* Campo 2 (precio/costo) */}
              <td style={{ padding: '5px 4px', textAlign: 'right', width: 90 }}>
                {isEdit2 ? (
                  <div style={{ display: 'flex', gap: 2 }}>
                    <input type="number" min="0" step="0.01" autoFocus value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--warn)', borderRadius: 3, padding: '2px 4px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right' }} />
                    <button style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer' }} onClick={() => onEditar(l.id, campo2, editVal)}><Check size={11} /></button>
                    <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setEditando(null)}><X size={10} /></button>
                  </div>
                ) : (
                  <span
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, cursor: 'pointer', padding: '2px 4px', borderRadius: 3, color: l.val2_manual ? 'var(--warn)' : 'var(--muted)' }}
                    onClick={() => { setEditando({ id: l.id, campo: campo2 }); setEditVal(l.val2_manual || l.val2); }}
                    title={l.val2_manual ? 'Precio manual — click para editar' : 'Precio de maestro — click para personalizar'}>
                    {fmt2(l.val2)}
                    {l.val2_manual && <span style={{ fontSize: 9, marginLeft: 2 }}>✎</span>}
                  </span>
                )}
              </td>
              <td style={{ padding: '5px 4px', textAlign: 'right', width: 80, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--ejec)' }}>
                {fmt2(l.subtotal)}
              </td>
              <td style={{ padding: '5px 0', width: 20 }}>
                <button style={{ background: 'none', border: 'none', color: 'var(--border2)', cursor: 'pointer', fontSize: 14 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}
                  onClick={() => onEliminar(l.id)}>×</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FilaAgregar({ children }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
      {children}
    </div>
  );
}
