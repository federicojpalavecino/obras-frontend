import '../index.css';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import api from '../api';
import { coincide } from '../buscar';

import { imprimirHTML } from '../../utils/imprimir';
const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const fmtCant = n => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

// Calcula presentaciones comerciales: 100kg / 50kg por bolsa = 2 bolsas
const calcPresentacion = (m) => {
  if (!m.cant_presentacion || m.cant_presentacion <= 0) return null;
  const cantPres = Math.ceil(m.cantidad_total / m.cant_presentacion);
  const label = m.presentacion || 'unid.';
  return { cantPres, label, cantPorPres: m.cant_presentacion };
};

export default function ListadoMateriales() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [expandidos, setExpandidos] = useState({});
  // Dos maneras de leer la misma lista. Por rubro se compra: todo el cemento
  // junto, aunque vaya a cinco tareas. Por ítem se planifica y se imputa:
  // cuánto lleva la mampostería, cuánto el contrapiso.
  const [vistaPorItem, setVistaPorItem] = useState(false);
  const [itemAbierto, setItemAbierto] = useState({});
  const [seleccionados, setSeleccionados] = useState({});
  const [modalAgregar, setModalAgregar] = useState(false);
  const [busquedaCatalogo, setBusquedaCatalogo] = useState('');
  const [catalogoResultados, setCatalogoResultados] = useState([]);
  const [matSeleccionado, setMatSeleccionado] = useState(null);
  const [cantidadAgregar, setCantidadAgregar] = useState('');
  const [materialesExtra, setMaterialesExtra] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [catalogoCompleto, setCatalogoCompleto] = useState([]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/presupuestos/${id}/materiales-listado`);
      const json = res.data;
      setData(json);
      // Expandir todos los rubros por defecto
      const rubros = [...new Set((json.materiales || []).map(m => m.rubro))];
      const exp = {};
      rubros.forEach(r => { exp[r] = true; });
      setExpandidos(exp);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const toggleSeleccionado = (id) => {
    setSeleccionados(s => ({ ...s, [id]: !s[id] }));
  };

  const seleccionarTodos = () => {
    const todos = {};
    materialesFiltrados.forEach(m => { todos[m.material_id] = true; });
    setSeleccionados(todos);
  };

  const deseleccionarTodos = () => setSeleccionados({});

  const todosLosMateriales = [...(data?.materiales || []), ...materialesExtra];

  const cargarCatalogo = async () => {
    if (catalogoCompleto.length > 0) return;
    setCargandoCatalogo(true);
    try {
      const res = await api.get('/maestros/materiales');
      setCatalogoCompleto(res.data || []);
    } catch(e) {}
    setCargandoCatalogo(false);
  };

  const buscarCatalogo = (q) => {
    setBusquedaCatalogo(q);
    if (q.length < 2) { setCatalogoResultados([]); return; }
    const resultados = catalogoCompleto.filter(m =>
      coincide(m.nombre, q) || coincide(m.codigo, q)
    ).slice(0, 20);
    setCatalogoResultados(resultados);
  };

  const agregarMaterial = () => {
    if (!cantidadAgregar || parseFloat(cantidadAgregar) <= 0) return;
    const cant = parseFloat(cantidadAgregar);
    if (matSeleccionado) {
      // Agregar material del catálogo
      const existente = materialesExtra.find(m => m.material_id === matSeleccionado.id);
      if (existente) {
        setMaterialesExtra(prev => prev.map(m => m.material_id === matSeleccionado.id
          ? { ...m, cantidad_total: m.cantidad_total + cant, subtotal: (m.cantidad_total + cant) * m.precio_unitario }
          : m
        ));
      } else {
        // Verificar si ya está en el listado principal
        const yaEnLista = todosLosMateriales.find(m => m.material_id === matSeleccionado.id);
        if (yaEnLista) {
          setMaterialesExtra(prev => [...prev, { ...yaEnLista, material_id: 'extra_' + matSeleccionado.id, cantidad_total: cant, subtotal: cant * yaEnLista.precio_unitario, items_que_lo_usan: ['Agregado manualmente'] }]);
        } else {
          setMaterialesExtra(prev => [...prev, {
            material_id: 'extra_' + matSeleccionado.id,
            codigo: matSeleccionado.codigo || '',
            nombre: matSeleccionado.nombre,
            unidad: matSeleccionado.unidad || '',
            presentacion: '',
            cant_presentacion: 0,
            rubro: matSeleccionado.rubro || 'Sin rubro',
            precio_unitario: parseFloat(matSeleccionado.precio_unitario) || 0,
            precio_presentacion: 0,
            cantidad_total: cant,
            subtotal: cant * (parseFloat(matSeleccionado.precio_unitario) || 0),
            items_que_lo_usan: ['Agregado manualmente'],
          }]);
        }
      }
    }
    setBusquedaCatalogo(''); setCatalogoResultados([]); setMatSeleccionado(null); setCantidadAgregar('');
    setModalAgregar(false);
  };

  const sumarCantidad = (mid, extra) => {
    setMaterialesExtra(prev => {
      const existe = prev.find(m => m.material_id === 'extra_' + mid || m.material_id === mid);
      if (existe) {
        return prev.map(m => (m.material_id === 'extra_' + mid || m.material_id === mid)
          ? { ...m, cantidad_total: m.cantidad_total + extra, subtotal: (m.cantidad_total + extra) * m.precio_unitario }
          : m
        );
      }
      const base = todosLosMateriales.find(m => m.material_id === mid);
      if (!base) return prev;
      return [...prev, { ...base, material_id: 'extra_' + mid, cantidad_total: extra, subtotal: extra * base.precio_unitario, items_que_lo_usan: ['Cantidad adicional'] }];
    });
  };

  const eliminarExtra = (mid) => setMaterialesExtra(prev => prev.filter(m => m.material_id !== mid));

  const materialesFiltrados = todosLosMateriales.filter(m => {
    const matchBusq = !busqueda || coincide(m.nombre, busqueda) || coincide(m.codigo, busqueda);
    const matchRubro = !rubroFiltro || m.rubro === rubroFiltro;
    return matchBusq && matchRubro;
  });

  const porRubro = {};
  materialesFiltrados.forEach(m => {
    if (!porRubro[m.rubro]) porRubro[m.rubro] = [];
    porRubro[m.rubro].push(m);
  });

  const rubros = [...new Set(todosLosMateriales.map(m => m.rubro))].sort();
  const selCount = Object.values(seleccionados).filter(Boolean).length;
  const matSel = materialesFiltrados.filter(m => seleccionados[m.material_id]);
  const totalSel = matSel.reduce((a, m) => a + m.subtotal, 0);

  const imprimir = (soloSeleccionados = false) => {
    const mats = soloSeleccionados ? matSel : materialesFiltrados;
    const hoy = new Date().toLocaleDateString('es-AR');
    const gruposPrint = {};
    mats.forEach(m => {
      if (!gruposPrint[m.rubro]) gruposPrint[m.rubro] = [];
      gruposPrint[m.rubro].push(m);
    });

    const filasHTML = Object.entries(gruposPrint).map(([rubro, items]) => `
      <tr><td colspan="5" style="background:#f0f0f0;font-weight:700;font-size:9pt;text-transform:uppercase;letter-spacing:.5px;color:#555;padding:6px 8px">${rubro}</td></tr>
      ${items.map((m, i) => `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
        <td style="color:#888;font-family:monospace;font-size:8pt">${m.codigo||'—'}</td>
        <td>${m.nombre}</td>
        <td class="r">${fmtCant(m.cantidad_total)} ${m.unidad||''}</td>
        <td class="r">${fmt(m.precio_unitario)}/${m.unidad||'u'}</td>
        <td class="r" style="font-weight:700;color:#065f46">${fmt(m.subtotal)}</td>
      </tr>`).join('')}
    `).join('');

    const total = mats.reduce((a, m) => a + m.subtotal, 0);
    imprimirHTML(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listado de Materiales</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:10pt}
    h1{font-size:16pt;margin:0}h2{font-size:9pt;color:#666;margin:4px 0 20px}
    table{width:100%;border-collapse:collapse}th{background:#1a1a1a;color:#fff;padding:5px 8px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.5px}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}.r{text-align:right;font-family:monospace}
    .total{background:#f0f5ff;font-weight:700;font-size:10pt}.footer{margin-top:16px;font-size:8pt;color:#aaa;border-top:1px solid #eee;padding-top:6px;display:flex;justify-content:space-between}
    @media print{@page{margin:1.5cm}}</style></head><body>
    <h1>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</h1>
    <h2>${data?.obra}${soloSeleccionados ? ' (selección)' : ''} · ${hoy}</h2>
    <table><thead><tr><th>Código</th><th>Material</th><th class="r">Cantidad</th><th class="r">P. Unitario</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${filasHTML}
    <tr class="total"><td colspan="4" style="text-align:right;padding:8px">TOTAL MATERIALES</td><td class="r" style="padding:8px;font-size:12pt;color:#065f46">${fmt(total)}</td></tr>
    </tbody></table>
    <div class="footer"><span>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}')||{};if(s?.tenant?.nombre)return s.tenant.nombre;}catch(e){}return 'FAIM OBRAS'})()}  — ${data?.obra}</span><span>${hoy}</span></div>
    </body></html>`);

  };

  const imprimirPedido = (soloSeleccionados = false) => {
    const mats = soloSeleccionados ? matSel : materialesFiltrados;
    const hoy = new Date().toLocaleDateString('es-AR');
    const gruposPrint = {};
    mats.forEach(m => {
      if (!gruposPrint[m.rubro]) gruposPrint[m.rubro] = [];
      gruposPrint[m.rubro].push(m);
    });

    const filasHTML = Object.entries(gruposPrint).map(([rubro, items]) => `
      <tr><td colspan="4" style="background:#f0f0f0;font-weight:700;font-size:9pt;text-transform:uppercase;letter-spacing:.5px;color:#555;padding:6px 8px;border-top:2px solid #ddd">${rubro}</td></tr>
      ${items.map((m, i) => {
        const pres = calcPresentacion(m);
        const cantStr = pres
          ? `${fmtCant(m.cantidad_total)} ${m.unidad} <span style="color:#666;font-size:8pt">(${pres.cantPres} ${pres.label})</span>`
          : `${fmtCant(m.cantidad_total)} ${m.unidad}`;
        return `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
          <td style="color:#888;font-family:monospace;font-size:8pt;width:80px">${m.codigo||'—'}</td>
          <td style="font-size:9pt">${m.nombre}</td>
          <td style="text-align:right;font-family:monospace;font-size:9pt">${cantStr}</td>
          <td style="width:120px;border:1px solid #ddd;padding:4px 8px;font-size:9pt;color:#aaa">Precio proveedor</td>
        </tr>`;
      }).join('')}
    `).join('');

    imprimirHTML(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido de Materiales</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:10pt}
    h1{font-size:16pt;margin:0}h2{font-size:9pt;color:#666;margin:4px 0 8px}
    .aviso{background:#fff8e1;border:1px solid #f0c040;border-radius:4px;padding:8px 12px;font-size:9pt;color:#666;margin-bottom:16px}
    table{width:100%;border-collapse:collapse}
    th{background:#1a1a1a;color:#fff;padding:5px 8px;text-align:left;font-size:8pt;text-transform:uppercase;letter-spacing:.5px}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}
    .footer{margin-top:16px;font-size:8pt;color:#aaa;border-top:1px solid #eee;padding-top:6px;display:flex;justify-content:space-between}
    @media print{@page{margin:1.5cm}.aviso{display:none}}</style></head><body>
    <h1>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</h1>
    <h2>${data?.obra}${soloSeleccionados ? ' (selección)' : ''} · ${hoy}</h2>
    <div class="aviso">Este listado es para pedido/cotización a proveedores — sin precios internos</div>
    <table><thead><tr><th>Código</th><th>Material</th><th style="text-align:right">Cantidad</th><th>Precio proveedor</th></tr></thead>
    <tbody>${filasHTML}</tbody></table>
    <div class="footer"><span>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}')||{};if(s?.tenant?.nombre)return s.tenant.nombre;}catch(e){}return 'FAIM OBRAS'})()}  — ${data?.obra}</span><span>${hoy}</span></div>
    </body></html>`);

  };

  const copiarParaProveedor = () => {
    const mats = selCount > 0 ? matSel : materialesFiltrados;
    const texto = mats.map(m => `${m.nombre} — ${fmtCant(m.cantidad_total)} ${m.unidad || ''}`).join('\n');
    navigator.clipboard.writeText(texto).then(() => {
      alert('✓ Copiado al portapapeles');
    });
  };


  if (loading) return <div className="loading">Cargando materiales...</div>;

  return (
    <div>
      <div className="header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>← Volver</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{data?.obra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Listado de materiales</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selCount > 0 && (
            <span style={{ fontSize: 12, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{selCount} seleccionados · {fmt(totalSel)}</span>
          )}
          <button className="btn btn-secondary btn-sm" onClick={copiarParaProveedor}>
            Copiar {selCount > 0 ? 'selección' : 'todo'}
          </button>
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => imprimir(selCount > 0)}>Con precios</button>
            <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => imprimirPedido(selCount > 0)}>Pedido/Cotizar</button>
            <button className="btn btn-sm" style={{ borderRadius: 0, background: 'var(--accent)', color: '#0f0f11', border: 'none', cursor: 'pointer', padding: '6px 12px', fontSize: 12, fontFamily: 'inherit', fontWeight: 700 }} onClick={() => { setModalAgregar(true); cargarCatalogo(); }}>+ Agregar</button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)' }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Buscar material..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
          {[[false, 'Por rubro'], [true, 'Por ítem']].map(([v, txt]) => (
            <button key={txt} onClick={() => setVistaPorItem(v)}
              style={{ padding: '5px 13px', borderRadius: 6, border: 'none', cursor: 'pointer',
                       fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                       background: vistaPorItem === v ? 'var(--accent)' : 'transparent',
                       color: vistaPorItem === v ? '#fff' : 'var(--muted)' }}>{txt}</button>
          ))}
        </div>
        {!vistaPorItem && (
          <select className="input" style={{ width: 200 }} value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}>
            <option value="">Todos los rubros</option>
            {rubros.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        {!vistaPorItem && <button className="btn btn-secondary btn-sm" onClick={seleccionarTodos}>Seleccionar todos</button>}
        {!vistaPorItem && selCount > 0 && <button className="btn btn-secondary btn-sm" onClick={deseleccionarTodos}>Deseleccionar</button>}
      </div>

      {/* Resumen */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>Total materiales: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--precio)' }}>{fmt(data?.total_materiales)}</span></div>
        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>Ítems: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{materialesFiltrados.length}</span></div>
        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>Rubros: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>{Object.keys(porRubro).length}</span></div>
        {data?.con_desperdicio && (
          <div style={{ fontSize: 11.5, color: 'var(--warn)', marginLeft: 'auto' }}>
            Las cantidades ya incluyen el desperdicio cargado en los análisis
          </div>
        )}
      </div>

      {/* Tabla por rubro */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        {materialesFiltrados.length === 0 && (
          <div className="empty"><h3>Sin materiales</h3><p>Los ítems del presupuesto no tienen análisis de costos con materiales cargados.</p></div>
        )}

        {vistaPorItem && (data?.por_item || []).filter(it => it.cuantos > 0).map(it => (
          <div key={it.linea_id} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                          background: 'var(--surface2)', cursor: 'pointer',
                          border: '1px solid var(--border)',
                          borderRadius: itemAbierto[it.linea_id] === false ? 8 : '8px 8px 0 0' }}
              onClick={() => setItemAbierto(e => ({ ...e, [it.linea_id]: e[it.linea_id] === false }))}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{it.item}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {it.categoria} · {fmtCant(it.cantidad_item)} {it.unidad}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                {it.cuantos} material{it.cuantos !== 1 ? 'es' : ''} · {fmt(it.total)}
              </span>
              <span style={{ color: 'var(--muted)' }}>{itemAbierto[it.linea_id] === false ? '\u25b6' : '\u25bc'}</span>
            </div>

            {itemAbierto[it.linea_id] !== false && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none',
                            borderRadius: '0 0 8px 8px', overflow: 'auto' }}>
                <table className="tabla-materiales" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={th} className="col-secundaria">Código</th>
                      <th style={th}>Material</th>
                      <th style={{ ...th, textAlign: 'right' }} className="col-secundaria">Por {it.unidad || 'unidad'}</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cantidad</th>
                      <th style={{ ...th, textAlign: 'right' }} className="col-secundaria">P. Unitario</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {it.materiales.map(m => (
                      <tr key={m.material_id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ ...td, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 10.5 }}
                            className="col-secundaria">{m.codigo || '\u2014'}</td>
                        <td style={td}>
                          {m.nombre}
                          {m.desperdicio_pct > 0 && (
                            <span style={{ marginLeft: 7, fontSize: 10.5, color: 'var(--warn)',
                                           fontFamily: 'var(--mono)' }}>
                              +{m.desperdicio_pct}% desperdicio
                            </span>
                          )}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                            className="col-secundaria">{fmtCant(m.por_unidad)} {m.unidad}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600 }}>
                          {fmtCant(m.cantidad)} {m.unidad}
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--muted)' }}
                            className="col-secundaria">{fmt(m.precio_unitario)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)',
                                     fontWeight: 700, color: 'var(--precio)' }}>{fmt(m.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {vistaPorItem && !(data?.por_item || []).some(it => it.cuantos > 0) && (
          <div className="empty"><h3>Ningún ítem tiene materiales</h3>
            <p>Los análisis de costos de este presupuesto no tienen materiales cargados.</p></div>
        )}

        {!vistaPorItem && Object.entries(porRubro).map(([rubro, mats]) => (
          <div key={rubro} style={{ marginBottom: 16 }}>
            {/* Header rubro */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: expandidos[rubro] ? '8px 8px 0 0' : 8, cursor: 'pointer', border: '1px solid var(--border)', borderBottom: expandidos[rubro] ? 'none' : '1px solid var(--border)' }}
              onClick={() => setExpandidos(e => ({ ...e, [rubro]: !e[rubro] }))}>
              <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{rubro}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{mats.length} materiales · {fmt(mats.reduce((a, m) => a + m.subtotal, 0))}</span>
              <span style={{ color: 'var(--muted)' }}>{expandidos[rubro] ? '▼' : '▶'}</span>
            </div>

            {expandidos[rubro] && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                <table className="tabla-materiales" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={th}></th>
                      <th style={th} className="col-secundaria">Código</th>
                      <th style={th}>Material</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cantidad</th>
                      <th style={{ ...th, textAlign: 'right' }} className="col-secundaria">Unidad</th>
                      <th style={{ ...th, textAlign: 'right' }}>P. Unitario</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Subtotal</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--accent2)' }} className="col-secundaria">Presentación</th>
                      <th style={th} className="col-secundaria">Usado en</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((m, i) => (
                      <tr key={m.material_id}
                        style={{ borderBottom: '1px solid var(--border2)', background: seleccionados[m.material_id] ? 'rgba(110,231,183,0.05)' : i%2===0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer' }}
                        onClick={() => toggleSeleccionado(m.material_id)}>
                        <td style={{ ...td, width: 32 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${seleccionados[m.material_id] ? 'var(--accent)' : 'var(--border)'}`,
                            background: seleccionados[m.material_id] ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0f0f11' }}>
                            {seleccionados[m.material_id] ? '✓' : ''}
                          </div>
                        </td>
                        <td className="col-secundaria" style={{ ...td, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{m.codigo || '—'}</td>
                        <td style={{ ...td, fontSize: 12, fontWeight: 500 }}>{m.nombre}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{fmtCant(m.cantidad_total)} <span className="solo-celu" style={{ fontSize: 10, color: 'var(--muted)' }}>{m.unidad || ''}</span></td>
                        <td className="col-secundaria" style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{m.unidad || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{fmt(m.precio_unitario)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--precio)', fontWeight: 600 }}>{fmt(m.subtotal)}</td>
                        <td className="col-secundaria" style={{ ...td, fontSize: 11, color: 'var(--accent2)' }}>
                          {calcPresentacion(m) ? (
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                              {calcPresentacion(m).cantPres} {calcPresentacion(m).label}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="col-secundaria" style={{ ...td, fontSize: 10, color: 'var(--muted)' }}>
                          {m.items_que_lo_usan.slice(0, 2).join(', ')}{m.items_que_lo_usan.length > 2 ? ` +${m.items_que_lo_usan.length - 2}` : ''}
                          {String(m.material_id).startsWith('extra_') && (
                            <button onClick={() => eliminarExtra(m.material_id)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(110,231,183,0.04)', borderTop: '1px solid var(--border)' }}>
                      <td colSpan={7} style={{ ...td, fontSize: 11, color: 'var(--muted)', textAlign: 'right', fontWeight: 600 }}>Subtotal {rubro}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--precio)' }}>{fmt(mats.reduce((a, m) => a + m.subtotal, 0))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {/* Total general */}
        {materialesFiltrados.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total materiales presupuesto</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--precio)' }}>{fmt(data?.total_materiales)}</div>
            </div>
          </div>
        )}
      </div>
    {modalAgregar && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => { setModalAgregar(false); setBusquedaCatalogo(''); setCatalogoResultados([]); setMatSeleccionado(null); setCantidadAgregar(''); }}>
        <div style={{ background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24, width: '100%', maxWidth: 460,
                      maxHeight: '90dvh', overflowY: 'auto', }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#f0f0f5' }}>Agregar material del catálogo</div>
            <button onClick={() => setModalAgregar(false)} style={{ background: 'none', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: 20 }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: '#8888aa', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Buscar material</label>
              <input autoFocus value={busquedaCatalogo} onChange={e => buscarCatalogo(e.target.value)} placeholder="Nombre o código del material..."
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#0f0f15', border: '1px solid #2a2a3a', borderRadius: 8, color: '#f0f0f5', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            {cargandoCatalogo && <div style={{ fontSize: 12, color: '#8888aa', textAlign: 'center' }}>Buscando...</div>}
            {catalogoResultados.length > 0 && !matSeleccionado && (
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #2a2a3a', borderRadius: 8, background: '#0f0f15' }}>
                {catalogoResultados.map(m => (
                  <div key={m.id} onClick={() => { setMatSeleccionado(m); setBusquedaCatalogo(m.nombre); setCatalogoResultados([]); }}
                    style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #1a1a24', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1a1a2e'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontSize: 13, color: '#f0f0f5' }}>{m.nombre}</div>
                      <div style={{ fontSize: 11, color: '#8888aa' }}>{m.codigo} · {m.unidad} · {m.rubro}</div>
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', color: '#6ee7b7' }}>$ {Math.round(m.precio_unitario).toLocaleString('es-AR')}</div>
                  </div>
                ))}
              </div>
            )}
            {matSeleccionado && (
              <div style={{ background: '#0f2a1a', border: '1px solid #059669', borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f5' }}>{matSeleccionado.nombre}</div>
                  <div style={{ fontSize: 11, color: '#8888aa' }}>{matSeleccionado.unidad} · $ {Math.round(matSeleccionado.precio_unitario).toLocaleString('es-AR')}</div>
                </div>
                <button onClick={() => { setMatSeleccionado(null); setBusquedaCatalogo(''); }} style={{ background: 'none', border: 'none', color: '#8888aa', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}
            <div>
              <label style={{ fontSize: 11, color: '#8888aa', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Cantidad a agregar {matSeleccionado ? `(${matSeleccionado.unidad})` : ''}</label>
              <input type="number" value={cantidadAgregar} onChange={e => setCantidadAgregar(e.target.value)} placeholder="0"
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#0f0f15', border: '1px solid #2a2a3a', borderRadius: 8, color: '#f0f0f5', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
            </div>
            {matSeleccionado && cantidadAgregar && (
              <div style={{ fontSize: 12, color: '#8888aa', textAlign: 'right' }}>
                Subtotal: <span style={{ color: '#6ee7b7', fontFamily: 'monospace' }}>$ {Math.round(parseFloat(cantidadAgregar) * matSeleccionado.precio_unitario).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={agregarMaterial} disabled={!matSeleccionado || !cantidadAgregar}
                style={{ flex: 1, padding: '10px 0', background: matSeleccionado && cantidadAgregar ? 'var(--accent)' : '#2a2a3a', color: matSeleccionado && cantidadAgregar ? '#0f0f11' : '#8888aa', border: 'none', borderRadius: 8, cursor: matSeleccionado && cantidadAgregar ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, fontFamily: 'inherit' }}>
                Agregar al listado
              </button>
              <button onClick={() => setModalAgregar(false)} style={{ padding: '10px 16px', background: 'none', border: '1px solid #2a2a3a', color: '#8888aa', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', verticalAlign: 'middle' };
