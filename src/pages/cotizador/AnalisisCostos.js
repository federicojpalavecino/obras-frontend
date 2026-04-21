import '../../cotizador.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { ArrowLeft, Search, Plus, Trash2, Edit2, Check, X, Copy, ChevronDown, ChevronRight } from 'lucide-react';

const fmt = (n) => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';
const fmtD = (n) => n ? '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

export default function AnalisisCostos() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [items, setItems] = useState([]);
  const [itemDetalle, setItemDetalle] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [moList, setMoList] = useState([]);
  const [maqList, setMaqList] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [expandidos, setExpandidos] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [modalNuevoItem, setModalNuevoItem] = useState(false);
  const [nuevoItem, setNuevoItem] = useState({ codigo: '', nombre: '', categoria_id: '', unidad_ejecucion: '' });
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  // Agregar líneas
  const [addMat, setAddMat] = useState({ material_id: '', cantidad: 1 });
  const [addMO, setAddMO] = useState({ unidad_mo_id: '', horas: 1 });
  const [addMaq, setAddMaq] = useState({ maquinaria_id: '', horas: 1 });
  const [editLinea, setEditLinea] = useState(null); // {tipo, id, valor}

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [catRes, itemsRes, matsRes, moRes, maqRes] = await Promise.all([
        api.get('/maestros/categorias'),
        api.get('/analisis/items'),
        api.get('/maestros/materiales'),
        api.get('/analisis/mo'),
        api.get('/analisis/maquinaria'),
      ]);
      setCategorias(catRes.data);
      setItems(itemsRes.data);
      setMateriales(matsRes.data);
      setMoList(moRes.data);
      setMaqList(maqRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const verDetalle = async (item) => {
    if (itemDetalle?.id === item.id) { setItemDetalle(null); return; }
    setLoadingDetalle(true);
    try {
      const res = await api.get(`/analisis/items/${item.id}`);
      setItemDetalle(res.data);
      setNombreEdit(res.data.nombre);
    } catch (e) { console.error(e); }
    setLoadingDetalle(false);
  };

  const recargarDetalle = async () => {
    if (!itemDetalle) return;
    const res = await api.get(`/analisis/items/${itemDetalle.id}`);
    setItemDetalle(res.data);
    // Actualizar también en la lista
    setItems(prev => prev.map(i => i.id === res.data.id ? { ...i,
      costo_materiales: res.data.costo_materiales,
      costo_mano_obra: res.data.costo_mano_obra,
      costo_maquinaria: res.data.costo_maquinaria,
      costo_total: res.data.costo_total,
    } : i));
  };

  const handleCrearItem = async () => {
    if (!nuevoItem.codigo || !nuevoItem.nombre || !nuevoItem.categoria_id) return;
    try {
      await api.post('/analisis/items', { ...nuevoItem, categoria_id: parseInt(nuevoItem.categoria_id) });
      setModalNuevoItem(false);
      setNuevoItem({ codigo: '', nombre: '', categoria_id: '', unidad_ejecucion: '' });
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleDuplicar = async (item) => {
    const nuevoCodigo = prompt(`Código para la copia de "${item.nombre}":`, item.codigo + '-COPIA');
    if (!nuevoCodigo) return;
    try {
      await api.post(`/analisis/items/${item.id}/duplicar?nuevo_codigo=${encodeURIComponent(nuevoCodigo)}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleGuardarNombre = async () => {
    if (!nombreEdit || !itemDetalle) return;
    await api.patch(`/analisis/items/${itemDetalle.id}`, { nombre: nombreEdit });
    setEditandoNombre(false);
    recargarDetalle();
    setItems(prev => prev.map(i => i.id === itemDetalle.id ? { ...i, nombre: nombreEdit } : i));
  };

  const handleAgregarMat = async () => {
    if (!addMat.material_id || !addMat.cantidad) return;
    try {
      const payload = { 
        material_id: parseInt(addMat.material_id), 
        cantidad: parseFloat(addMat.cantidad) 
      };
      await api.post(`/analisis/${itemDetalle.id}/materiales`, payload);
      setAddMat({ material_id: '', cantidad: 1 });
      recargarDetalle();
    } catch (e1) {
      try {
        // Try alternate endpoint
        const payload = { 
          material_id: parseInt(addMat.material_id), 
          cantidad: parseFloat(addMat.cantidad) 
        };
        await api.post(`/analisis/items/${itemDetalle.id}/materiales`, payload);
        setAddMat({ material_id: '', cantidad: 1 });
        recargarDetalle();
      } catch (e2) {
        alert('Error al agregar material: ' + (e2.response?.data?.detail || e2.message));
      }
    }
  };

  const handleEliminarMat = async (lid) => {
    await api.delete(`/analisis/items/${itemDetalle.id}/materiales/${lid}`);
    recargarDetalle();
  };

  const handleEditarCantMat = async (lid, cant) => {
    await api.patch(`/analisis/items/${itemDetalle.id}/materiales/${lid}`, { cantidad: parseFloat(cant) });
    setEditLinea(null);
    recargarDetalle();
  };

  const handleAgregarMO = async () => {
    if (!addMO.unidad_mo_id || !addMO.horas) return;
    try {
      await api.post(`/analisis/items/${itemDetalle.id}/mo`, { unidad_mo_id: parseInt(addMO.unidad_mo_id), horas: parseFloat(addMO.horas) });
      setAddMO({ unidad_mo_id: '', horas: 1 });
      recargarDetalle();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarMO = async (lid) => {
    await api.delete(`/analisis/items/${itemDetalle.id}/mo/${lid}`);
    recargarDetalle();
  };

  const handleEditarHorasMO = async (lid, horas) => {
    await api.patch(`/analisis/items/${itemDetalle.id}/mo/${lid}`, { horas: parseFloat(horas) });
    setEditLinea(null);
    recargarDetalle();
  };

  const handleAgregarMaq = async () => {
    if (!addMaq.maquinaria_id || !addMaq.horas) return;
    try {
      await api.post(`/analisis/items/${itemDetalle.id}/maquinaria`, { maquinaria_id: parseInt(addMaq.maquinaria_id), horas: parseFloat(addMaq.horas) });
      setAddMaq({ maquinaria_id: '', horas: 1 });
      recargarDetalle();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarMaq = async (lid) => {
    await api.delete(`/analisis/items/${itemDetalle.id}/maquinaria/${lid}`);
    recargarDetalle();
  };

  const handleEditarHorasMaq = async (lid, horas) => {
    await api.patch(`/analisis/items/${itemDetalle.id}/maquinaria/${lid}`, { horas: parseFloat(horas) });
    setEditLinea(null);
    recargarDetalle();
  };

  const itemsFiltrados = items.filter(i => {
    const matchBusq = !busqueda || i.nombre.toLowerCase().includes(busqueda.toLowerCase()) || i.codigo.includes(busqueda);
    const matchCat = !catFiltro || String(i.categoria_id) === catFiltro;
    return matchBusq && matchCat;
  });

  const porCategoria = {};
  itemsFiltrados.forEach(i => {
    const key = i.categoria_nombre || 'Sin categoría';
    if (!porCategoria[key]) porCategoria[key] = [];
    porCategoria[key].push(i);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/app')}>
            <ArrowLeft size={14} /> Volver
          </button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Análisis de Costos</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{items.length} ítems · {categorias.length} rubros</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalNuevoItem(true)}>
          <Plus size={14} /> Nuevo ítem
        </button>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input className="input" style={{ paddingLeft: 30 }} placeholder="Buscar ítem..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        </div>
        <select className="input" style={{ width: 260 }} value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
          <option value="">Todos los rubros</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* LISTA IZQUIERDA */}
        <div style={{ width: itemDetalle ? 380 : '100%', borderRight: itemDetalle ? '1px solid var(--border)' : 'none', overflowY: 'auto', transition: 'width 0.2s' }}>
          {loading ? <div className="loading">Cargando...</div> : (
            Object.entries(porCategoria).map(([cat, catItems]) => (
              <div key={cat}>
                <div style={{ padding: '8px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', position: 'sticky', top: 0, zIndex: 5 }}
                  onClick={() => setExpandidos(p => ({ ...p, [cat]: !p[cat] }))}>
                  {expandidos[cat] ? <ChevronDown size={14} color="var(--muted)" /> : <ChevronRight size={14} color="var(--muted)" />}
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)' }}>{cat}</span>
                  <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--border2)' }}>{catItems.length}</span>
                </div>
                {expandidos[cat] !== true && catItems.map(item => (
                  <div key={item.id}
                    style={{ padding: '10px 16px', borderBottom: '1px solid rgba(46,46,56,0.4)', cursor: 'pointer', background: itemDetalle?.id === item.id ? 'rgba(167,139,250,0.08)' : 'transparent', borderLeft: itemDetalle?.id === item.id ? '3px solid var(--accent2)' : '3px solid transparent' }}
                    onMouseEnter={e => { if (itemDetalle?.id !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    onMouseLeave={e => { if (itemDetalle?.id !== item.id) e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <div style={{ flex: 1 }} onClick={() => verDetalle(item)}>
                        <div style={{ fontSize: 12, lineHeight: 1.4 }}>{item.nombre}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{item.codigo}</span>
                          <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{item.unidad_ejecucion}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--ejec)' }}>{fmt(item.costo_total)}</div>
                        <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '2px 4px', fontSize: 11 }}
                          onClick={e => { e.stopPropagation(); handleDuplicar(item); }} title="Duplicar">
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* DETALLE DERECHA */}
        {itemDetalle && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {loadingDetalle ? <div className="loading">Cargando...</div> : (
              <>
                {/* Header ítem */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    {editandoNombre ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input className="input" value={nombreEdit} onChange={e => setNombreEdit(e.target.value)} style={{ fontSize: 16, fontWeight: 700 }} />
                        <button className="btn btn-success btn-sm" onClick={handleGuardarNombre}><Check size={13} /></button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditandoNombre(false)}><X size={13} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{itemDetalle.nombre}</h2>
                        <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setEditandoNombre(true)}><Edit2 size={13} /></button>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>
                      <span>{itemDetalle.codigo}</span>
                      <span>{itemDetalle.categoria_nombre}</span>
                      <span>{itemDetalle.unidad_ejecucion}</span>
                      <span>{itemDetalle.horas_unidad} hs/unidad</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Costo total</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--ejec)' }}>{fmt(itemDetalle.costo_total)}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, fontFamily: 'var(--mono)' }}>
                      <span style={{ color: 'var(--mat)' }}>Mat: {fmt(itemDetalle.costo_materiales)}</span>
                      <span style={{ color: 'var(--mo)' }}>MO: {fmt(itemDetalle.costo_mano_obra)}</span>
                      <span style={{ color: 'var(--maq)' }}>Maq: {fmt(itemDetalle.costo_maquinaria)}</span>
                    </div>
                  </div>
                </div>

                {/* MATERIALES */}
                <SeccionLineas
                  titulo="1/3) Materiales" color="var(--mat)"
                  columnas={['Material', 'Unidad', 'Cantidad', 'P. Unitario', 'Subtotal', '']}
                  lineas={itemDetalle.lineas_material.map(l => ({
                    id: l.id,
                    col1: l.material_nombre, col1b: l.material_codigo,
                    col2: l.unidad, col3: l.cantidad, col4: l.precio_unitario, col5: l.subtotal,
                  }))}
                  editLinea={editLinea}
                  setEditLinea={setEditLinea}
                  onEditarValor={(lid, val) => handleEditarCantMat(lid, val)}
                  onEliminar={(lid) => handleEliminarMat(lid)}
                  campoEditable="col3"
                  labelEditable="Cant."
                >
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select className="input" style={{ flex: 2 }} value={addMat.material_id}
                      onChange={e => setAddMat(p => ({ ...p, material_id: e.target.value }))}>
                      <option value="">Seleccionar material...</option>
                      {materiales.map(m => <option key={m.id} value={m.id}>{m.codigo} — {m.nombre} ({m.unidad})</option>)}
                    </select>
                    <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 90 }}
                      placeholder="Cant." value={addMat.cantidad}
                      onChange={e => setAddMat(p => ({ ...p, cantidad: e.target.value }))} />
                    <button className="btn btn-primary btn-sm" onClick={handleAgregarMat}><Plus size={13} /> Agregar</button>
                  </div>
                </SeccionLineas>

                {/* MANO DE OBRA */}
                <SeccionLineas
                  titulo="2/3) Mano de obra" color="var(--mo)"
                  columnas={['Función', 'Horas', 'Costo/hora', 'Subtotal', '']}
                  lineas={itemDetalle.lineas_mo.map(l => ({
                    id: l.id, col1: l.funcion, col2: null,
                    col3: l.horas, col4: l.costo_hora, col5: l.subtotal,
                  }))}
                  editLinea={editLinea} setEditLinea={setEditLinea}
                  onEditarValor={(lid, val) => handleEditarHorasMO(lid, val)}
                  onEliminar={(lid) => handleEliminarMO(lid)}
                  campoEditable="col3" labelEditable="Hs."
                >
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select className="input" style={{ flex: 2 }} value={addMO.unidad_mo_id}
                      onChange={e => setAddMO(p => ({ ...p, unidad_mo_id: e.target.value }))}>
                      <option value="">Seleccionar función...</option>
                      {moList.map(m => <option key={m.id} value={m.id}>{m.funcion} — {fmtD(m.costo_hora)}/hs</option>)}
                    </select>
                    <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 90 }}
                      placeholder="Horas" value={addMO.horas}
                      onChange={e => setAddMO(p => ({ ...p, horas: e.target.value }))} />
                    <button className="btn btn-primary btn-sm" onClick={handleAgregarMO}><Plus size={13} /> Agregar</button>
                  </div>
                </SeccionLineas>

                {/* MAQUINARIA */}
                <SeccionLineas
                  titulo="3/3) Maq / Eq / Herr" color="var(--maq)"
                  columnas={['Equipo', 'Horas', 'Costo/hora', 'Subtotal', '']}
                  lineas={itemDetalle.lineas_maquinaria.map(l => ({
                    id: l.id, col1: l.nombre, col2: null,
                    col3: l.horas, col4: l.costo_hora, col5: l.subtotal,
                  }))}
                  editLinea={editLinea} setEditLinea={setEditLinea}
                  onEditarValor={(lid, val) => handleEditarHorasMaq(lid, val)}
                  onEliminar={(lid) => handleEliminarMaq(lid)}
                  campoEditable="col3" labelEditable="Hs."
                >
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <select className="input" style={{ flex: 2 }} value={addMaq.maquinaria_id}
                      onChange={e => setAddMaq(p => ({ ...p, maquinaria_id: e.target.value }))}>
                      <option value="">Seleccionar equipo...</option>
                      {maqList.map(m => <option key={m.id} value={m.id}>{m.nombre} — {fmtD(m.costo_hora)}/hs</option>)}
                    </select>
                    <input type="number" min="0" step="0.001" className="input input-mono" style={{ width: 90 }}
                      placeholder="Horas" value={addMaq.horas}
                      onChange={e => setAddMaq(p => ({ ...p, horas: e.target.value }))} />
                    <button className="btn btn-primary btn-sm" onClick={handleAgregarMaq}><Plus size={13} /> Agregar</button>
                  </div>
                </SeccionLineas>
              </>
            )}
          </div>
        )}
      </div>

      {/* MODAL NUEVO ÍTEM */}
      {modalNuevoItem && (
        <div className="modal-overlay" onClick={() => setModalNuevoItem(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo ítem de obra</h2>
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Código *</label>
                <input className="input input-mono" value={nuevoItem.codigo}
                  onChange={e => setNuevoItem(p => ({ ...p, codigo: e.target.value }))}
                  placeholder="Ej: 1.24." />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Unidad ejecución</label>
                <input className="input" value={nuevoItem.unidad_ejecucion}
                  onChange={e => setNuevoItem(p => ({ ...p, unidad_ejecucion: e.target.value }))}
                  placeholder="m2, m3, Gl..." />
              </div>
            </div>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="input" value={nuevoItem.nombre}
                onChange={e => setNuevoItem(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre del ítem de obra" />
            </div>
            <div className="form-group">
              <label>Rubro *</label>
              <select className="input" value={nuevoItem.categoria_id}
                onChange={e => setNuevoItem(p => ({ ...p, categoria_id: e.target.value }))}>
                <option value="">Seleccionar rubro...</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalNuevoItem(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearItem}>Crear ítem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionLineas({ titulo, color, columnas, lineas, editLinea, setEditLinea, onEditarValor, onEliminar, campoEditable, labelEditable, children }) {
  const [editVal, setEditVal] = useState('');
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color, marginBottom: 10, paddingBottom: 6, borderBottom: `1px solid ${color}40` }}>
        {titulo}
      </div>
      {lineas.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>Sin líneas — agregá usando el formulario abajo</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              {columnas.map((c, i) => (
                <th key={i} style={{ padding: '6px 10px', textAlign: i >= 2 ? 'right' : 'left', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineas.map(l => {
              const isEdit = editLinea?.id === l.id;
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.4)' }}>
                  <td style={{ padding: '7px 10px', fontSize: 12 }}>
                    {l.col1}
                    {l.col1b && <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', marginLeft: 6 }}>{l.col1b}</span>}
                  </td>
                  {l.col2 !== undefined && <td style={{ padding: '7px 10px', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>{l.col2}</td>}
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    {isEdit ? (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <input type="number" min="0" step="0.001" autoFocus
                          value={editVal} onChange={e => setEditVal(e.target.value)}
                          style={{ width: 80, background: 'var(--bg)', border: '1px solid var(--accent2)', borderRadius: 4, padding: '3px 6px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }} />
                        <button className="btn btn-success btn-sm" style={{ padding: '3px 6px' }} onClick={() => onEditarValor(l.id, editVal)}><Check size={11} /></button>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '3px 6px' }} onClick={() => setEditLinea(null)}><X size={11} /></button>
                      </div>
                    ) : (
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}
                        onClick={() => { setEditLinea({ id: l.id }); setEditVal(l.col3); }}
                        title={`Editar ${labelEditable}`}>
                        {l.col3}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtD(l.col4)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color, fontWeight: 600 }}>{fmtD(l.col5)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--border2)', cursor: 'pointer', padding: '2px 4px' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}
                      onClick={() => onEliminar(l.id)}>×</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {children}
    </div>
  );
}

