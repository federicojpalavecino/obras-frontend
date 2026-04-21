import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, authHeaders } from '../../App';

const fmt = n => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';
const API_URL = (api, path) => `${api}${path}`;

export default function Presupuesto() {
  const { id } = useParams();
  const { API } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [coefAbierto, setCoefAbierto] = useState(false);
  const [modalLibre, setModalLibre] = useState(false);
  const [formLibre, setFormLibre] = useState({ nombre: '', unidad: 'gl', cantidad: 1, costo: '' });
  const [editCoef, setEditCoef] = useState({});
  const debounceRef = useRef(null);

  useEffect(() => { cargar(); }, [id]);

  useEffect(() => {
    if (busqueda.length < 2) { setItems([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`${API}/maestros/items?q=${encodeURIComponent(busqueda)}`, { headers: authHeaders() });
      const d = await res.json();
      setItems(d || []);
    }, 300);
  }, [busqueda]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/presupuestos/${id}`, { headers: authHeaders() });
      const d = await res.json();
      setData(d);
      setEditCoef({
        k_materiales: d.coeficientes?.k_materiales,
        k_mano_obra: d.coeficientes?.k_mano_obra,
        k_maquinaria: d.coeficientes?.k_maquinaria,
        gg_porcentaje: d.coeficientes?.gg_porcentaje,
        ben_porcentaje: d.coeficientes?.ben_porcentaje,
        iva_porcentaje: d.coeficientes?.iva_porcentaje,
        modo_gestion: d.coeficientes?.modo_gestion,
        pct_gestion: d.coeficientes?.pct_gestion,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const agregarItem = async (item) => {
    await fetch(`${API}/presupuestos/${id}/lineas`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 })
    });
    setBusqueda(''); setItems([]);
    cargar();
  };

  const agregarLibre = async () => {
    if (!formLibre.nombre) return;
    await fetch(`${API}/presupuestos/${id}/lineas`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        tipo: 'libre',
        nombre_override: formLibre.nombre,
        unidad: formLibre.unidad,
        cantidad: parseFloat(formLibre.cantidad) || 1,
        costo_directo_libre: parseFloat(formLibre.costo) || 0,
      })
    });
    setModalLibre(false);
    setFormLibre({ nombre: '', unidad: 'gl', cantidad: 1, costo: '' });
    cargar();
  };

  const eliminarLinea = async (lid) => {
    if (!window.confirm('¿Eliminar este ítem?')) return;
    await fetch(`${API}/presupuestos/${id}/lineas/${lid}`, { method: 'DELETE', headers: authHeaders() });
    cargar();
  };

  const guardarCoef = async () => {
    await fetch(`${API}/presupuestos/${id}`, {
      method: 'PUT', headers: authHeaders(),
      body: JSON.stringify(editCoef)
    });
    cargar();
  };

  const cerrarPresupuesto = async () => {
    if (!window.confirm('¿Cerrar el presupuesto? Los precios quedarán fijos.')) return;
    await fetch(`${API}/presupuestos/${id}/cerrar`, { method: 'POST', headers: authHeaders() });
    cargar();
  };

  const reabrirPresupuesto = async () => {
    await fetch(`${API}/presupuestos/${id}/reabrir`, { method: 'POST', headers: authHeaders() });
    cargar();
  };

  if (loading) return <div style={{ padding: 40, color: '#64748b' }}>Cargando...</div>;
  if (!data) return <div style={{ padding: 40, color: '#f87171' }}>Presupuesto no encontrado</div>;

  const cerrado = data.estado === 'cerrado';
  const color = data.tenant?.color_primario || '#7c3aed';

  const s = {
    wrap: { display: 'flex', height: '100%', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' },
    sidebar: { width: 260, background: '#1a1a2e', borderRight: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', overflow: 'auto' },
    main: { flex: 1, overflow: 'auto', background: '#0f0f1a' },
    inp: { width: '100%', padding: '9px 12px', borderRadius: 7, border: '1px solid #2a2a3a', background: '#0f0f1a', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' },
    btn: (bg = color) => ({ padding: '7px 14px', borderRadius: 7, border: 'none', background: bg, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }),
  };

  return (
    <div style={s.wrap}>
      {/* SIDEBAR */}
      <div style={s.sidebar}>
        {/* Header */}
        <div style={{ padding: '16px 14px', borderBottom: '1px solid #2a2a3a' }}>
          <button onClick={() => navigate('/app')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, marginBottom: 8, padding: 0 }}>← Volver</button>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.3 }}>{data.nombre_obra}</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{data.cliente?.nombre}</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            {!cerrado
              ? <button onClick={cerrarPresupuesto} style={{ ...s.btn('#ef4444'), fontSize: 11, padding: '4px 10px' }}>Cerrar</button>
              : <button onClick={reabrirPresupuesto} style={{ ...s.btn('#059669'), fontSize: 11, padding: '4px 10px' }}>Reabrir</button>}
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: cerrado ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: cerrado ? '#f87171' : '#4ade80' }}>
              {data.estado}
            </span>
          </div>
        </div>

        {!cerrado && <>
          {/* Búsqueda de ítems */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #2a2a3a' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, fontWeight: 600 }}>AGREGAR ÍTEM</div>
            <input
              placeholder="Buscar en catálogo..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              style={s.inp}
            />
            {items.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                {items.map(item => (
                  <div key={item.id} onClick={() => agregarItem(item)}
                    style={{ padding: '7px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, borderBottom: '1px solid #1e1e2e' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.15)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ fontWeight: 500 }}>{item.nombre}</div>
                    <div style={{ color: '#64748b', fontSize: 11 }}>{item.codigo} · {item.unidad_ejecucion}</div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setModalLibre(true)} style={{ ...s.btn('#334155'), width: '100%', marginTop: 8, fontSize: 12 }}>
              + Ítem libre / subcontrato
            </button>
          </div>

          {/* Coeficientes */}
          <div style={{ borderBottom: '1px solid #2a2a3a' }}>
            <div onClick={() => setCoefAbierto(o => !o)}
              style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              <span>COEFICIENTES</span>
              <span>{coefAbierto ? '▲' : '▼'}</span>
            </div>
            {coefAbierto && (
              <div style={{ padding: '0 14px 14px' }}>
                {[
                  { label: 'K Materiales', key: 'k_materiales' },
                  { label: 'K Mano de Obra', key: 'k_mano_obra' },
                  { label: 'K Maquinaria', key: 'k_maquinaria' },
                  { label: 'GG %', key: 'gg_porcentaje' },
                  { label: 'BEN %', key: 'ben_porcentaje' },
                  { label: 'IVA %', key: 'iva_porcentaje' },
                  { label: 'Gestión %', key: 'pct_gestion' },
                ].map(({ label, key }) => (
                  <div key={key} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 3 }}>{label}</div>
                    <input
                      type="number" step="0.01"
                      value={editCoef[key] ?? ''}
                      onChange={e => setEditCoef(c => ({ ...c, [key]: parseFloat(e.target.value) }))}
                      style={{ ...s.inp, padding: '6px 10px' }}
                    />
                  </div>
                ))}
                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={editCoef.modo_gestion || false}
                    onChange={e => setEditCoef(c => ({ ...c, modo_gestion: e.target.checked }))} />
                  <span style={{ fontSize: 12 }}>Modo gestión materiales</span>
                </div>
                <button onClick={guardarCoef} style={{ ...s.btn(), width: '100%', fontSize: 12 }}>Guardar coeficientes</button>
              </div>
            )}
          </div>
        </>}

        {/* Totales */}
        <div style={{ padding: 14, marginTop: 'auto' }}>
          {[
            { label: 'Total s/IVA', value: data.totales?.total_precio_sin_iva },
            { label: 'IVA', value: data.totales?.total_iva },
            { label: 'TOTAL', value: data.totales?.total_precio_con_iva, bold: true },
            { label: 'Margen', value: null, txt: `${data.totales?.margen_pct?.toFixed(1)}%` },
          ].map(t => (
            <div key={t.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: t.bold ? 15 : 13, fontWeight: t.bold ? 700 : 400, color: t.bold ? '#a78bfa' : '#94a3b8' }}>
              <span>{t.label}</span>
              <span>{t.txt || fmt(t.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div style={s.main}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e1e2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{data.nombre_obra}</h2>
            <div style={{ fontSize: 13, color: '#64748b' }}>{data.ubicacion} · {data.cliente?.nombre}</div>
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {(!data.lineas_por_rubro || data.lineas_por_rubro.length === 0) ? (
            <div style={{ textAlign: 'center', marginTop: 60, color: '#64748b' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
              <p>Buscá ítems en el panel izquierdo para agregar al presupuesto</p>
            </div>
          ) : data.lineas_por_rubro.map(rubro => (
            <div key={rubro.numero} style={{ marginTop: 24 }}>
              {/* Header rubro */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(124,58,237,0.1)', borderRadius: 8, marginBottom: 4, borderLeft: `3px solid ${color}` }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: '#a78bfa' }}>{rubro.numero}. {rubro.nombre}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{fmt(rubro.subtotal_precio)}</span>
              </div>

              {/* Tabla */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #2a2a3a' }}>
                    {['Ítem', 'Unid.', 'Cant.', 'MAT', 'MO', 'MAQ', 'P. Unit.', 'Total', ''].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: h === 'Ítem' ? 'left' : 'right', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rubro.lineas.map(linea => (
                    <tr key={linea.id} style={{ borderBottom: '1px solid #1a1a2e' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '8px 8px' }}>
                        <div style={{ fontWeight: 500 }}>{linea.nombre_item || linea.nombre}</div>
                        <div style={{ fontSize: 11, color: linea.tipo === 'libre' ? '#f59e0b' : '#64748b' }}>{linea.tipo}</div>
                      </td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#64748b' }}>{linea.unidad_item || linea.unidad}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{linea.cant || linea.cantidad}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#64748b', fontSize: 12 }}>{fmt(linea.costo_mat)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#64748b', fontSize: 12 }}>{fmt(linea.costo_mo)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: '#64748b', fontSize: 12 }}>{fmt(linea.costo_maq)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right' }}>{fmt(linea.precio_venta_con_iva)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', fontWeight: 600, color: '#a78bfa' }}>{fmt(linea.precio_venta_con_iva * (linea.cant || linea.cantidad))}</td>
                      <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                        {!cerrado && (
                          <button onClick={() => eliminarLinea(linea.id)}
                            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>✕</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      {/* Modal ítem libre */}
      {modalLibre && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ marginBottom: 20, fontSize: 16 }}>Ítem libre / subcontrato</h3>
            {[
              { ph: 'Nombre del ítem *', key: 'nombre' },
              { ph: 'Unidad (gl, m², m³...)', key: 'unidad' },
              { ph: 'Cantidad', key: 'cantidad', type: 'number' },
              { ph: 'Costo directo ($)', key: 'costo', type: 'number' },
            ].map(f => (
              <input key={f.key} placeholder={f.ph} type={f.type || 'text'}
                value={formLibre[f.key]} onChange={e => setFormLibre(v => ({ ...v, [f.key]: e.target.value }))}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 7, border: '1px solid #2a2a3a', background: '#0f0f1a', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box', marginBottom: 10 }} />
            ))}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => setModalLibre(false)} style={{ padding: '8px 16px', borderRadius: 7, border: '1px solid #2a2a3a', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={agregarLibre} style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Agregar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
