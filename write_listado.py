import os

path = r'C:\obras-frontend\src\cotizador\pages\ListadoMateriales.jsx'

content = r"""import '../index.css';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const fmtCant = n => Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const getTenantName = () => {
  try {
    const s = JSON.parse(localStorage.getItem('obras_session') || '{}');
    if (s?.tenant?.nombre) return s.tenant.nombre;
    const t = JSON.parse(localStorage.getItem('obras_tenant') || 'null');
    if (t?.nombre) return t.nombre;
  } catch(e) {}
  return 'FAIM OBRAS';
};
const getTenantColor = () => {
  try {
    const s = JSON.parse(localStorage.getItem('obras_session') || '{}');
    if (s?.tenant?.color_primario) return s.tenant.color_primario;
    const t = JSON.parse(localStorage.getItem('obras_tenant') || 'null');
    if (t?.color_primario) return t.color_primario;
  } catch(e) {}
  return 'var(--accent)';
};

const calcPresentacion = (m) => {
  if (!m.cant_presentacion || m.cant_presentacion <= 0) return null;
  const cantPres = Math.ceil(m.cantidad_total / m.cant_presentacion);
  return { cantPres, label: m.presentacion || 'unid.', cantPorPres: m.cant_presentacion };
};

export default function ListadoMateriales() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [rubroFiltro, setRubroFiltro] = useState('');
  const [expandidos, setExpandidos] = useState({});
  const [seleccionados, setSeleccionados] = useState({});

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/presupuestos/${id}/materiales-listado`);
      const json = res.data;
      setData(json);
      const rubros = [...new Set((json.materiales || []).map(m => m.rubro))];
      const exp = {};
      rubros.forEach(r => { exp[r] = true; });
      setExpandidos(exp);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const toggleSeleccionado = (mid) => setSeleccionados(s => ({ ...s, [mid]: !s[mid] }));
  const seleccionarTodos = () => {
    const todos = {};
    materialesFiltrados.forEach(m => { todos[m.material_id] = true; });
    setSeleccionados(todos);
  };
  const deseleccionarTodos = () => setSeleccionados({});

  const materialesFiltrados = (data?.materiales || []).filter(m => {
    const matchBusq = !busqueda || m.nombre.toLowerCase().includes(busqueda.toLowerCase()) || m.codigo?.toLowerCase().includes(busqueda.toLowerCase());
    const matchRubro = !rubroFiltro || m.rubro === rubroFiltro;
    return matchBusq && matchRubro;
  });

  const porRubro = {};
  materialesFiltrados.forEach(m => {
    if (!porRubro[m.rubro]) porRubro[m.rubro] = [];
    porRubro[m.rubro].push(m);
  });

  const rubros = [...new Set((data?.materiales || []).map(m => m.rubro))].sort();
  const selCount = Object.values(seleccionados).filter(Boolean).length;
  const matSel = materialesFiltrados.filter(m => seleccionados[m.material_id]);
  const totalSel = matSel.reduce((a, m) => a + (m.subtotal || 0), 0);
  const tenantNombre = getTenantName();
  const tenantColor = getTenantColor();

  const imprimir = (soloSel = false) => {
    const mats = soloSel ? matSel : materialesFiltrados;
    const hoy = new Date().toLocaleDateString('es-AR');
    const gruposPrint = {};
    mats.forEach(m => {
      if (!gruposPrint[m.rubro]) gruposPrint[m.rubro] = [];
      gruposPrint[m.rubro].push(m);
    });
    const filasHTML = Object.entries(gruposPrint).map(([rubro, items]) => `
      <tr><td colspan="5" style="background:#f0f0f0;font-weight:700;font-size:9pt;padding:6px 8px">${rubro}</td></tr>
      ${items.map((m, i) => `<tr style="background:${i%2===0?'#fff':'#fafafa'}">
        <td style="color:#888;font-family:monospace;font-size:8pt">${m.codigo||'—'}</td>
        <td>${m.nombre}</td>
        <td class="r">${fmtCant(m.cantidad_total)} ${m.unidad||''}</td>
        <td class="r">${fmt(m.precio_unitario)}/${m.unidad||'u'}</td>
        <td class="r" style="font-weight:700;color:#065f46">${fmt(m.subtotal)}</td>
      </tr>`).join('')}
    `).join('');
    const total = mats.reduce((a, m) => a + (m.subtotal || 0), 0);
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listado de Materiales</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:10pt}
    h1{font-size:16pt;margin:0}h2{font-size:9pt;color:#666;margin:4px 0 20px}
    table{width:100%;border-collapse:collapse}th{background:#1a1a1a;color:#fff;padding:5px 8px;font-size:8pt;text-transform:uppercase}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}.r{text-align:right}
    @media print{@page{margin:1.5cm}}</style></head><body>
    <h1>${tenantNombre} — Listado de Materiales</h1>
    <h2>${data?.obra} · ${hoy}</h2>
    <table><thead><tr><th>Código</th><th>Material</th><th class="r">Cantidad</th><th class="r">P. Unitario</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${filasHTML}
    <tr style="background:#f0f5ff;font-weight:700"><td colspan="4" style="text-align:right;padding:8px">TOTAL</td>
    <td class="r" style="padding:8px;font-size:12pt;color:#065f46">${fmt(total)}</td></tr>
    </tbody></table></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const copiarParaProveedor = () => {
    const mats = selCount > 0 ? matSel : materialesFiltrados;
    const texto = mats.map(m => `${m.nombre} — ${fmtCant(m.cantidad_total)} ${m.unidad || ''}`).join('\n');
    navigator.clipboard.writeText(texto).then(() => alert('✓ Copiado al portapapeles'));
  };

  if (loading) return <div className="loading">Cargando materiales...</div>;

  return (
    <div>
      <div className="header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, color: tenantColor, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>{tenantNombre}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>← Volver</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{data?.obra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Listado de materiales</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {selCount > 0 && <span style={{ fontSize: 12, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>{selCount} sel · {fmt(totalSel)}</span>}
          <button className="btn btn-secondary btn-sm" onClick={copiarParaProveedor}>📋 Copiar</button>
          <button className="btn btn-secondary btn-sm" onClick={() => imprimir(selCount > 0)}>🖨 Imprimir</button>
        </div>
      </div>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface)' }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Buscar material..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        <select className="input" style={{ width: 200 }} value={rubroFiltro} onChange={e => setRubroFiltro(e.target.value)}>
          <option value="">Todos los rubros</option>
          {rubros.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={seleccionarTodos}>Sel. todos</button>
        {selCount > 0 && <button className="btn btn-secondary btn-sm" onClick={deseleccionarTodos}>Deseleccionar</button>}
      </div>

      <div style={{ padding: '10px 16px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>Total: </span><span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--precio)' }}>{fmt(data?.total_materiales)}</span></div>
        <div style={{ fontSize: 12 }}><span style={{ color: 'var(--muted)' }}>Ítems: </span><span style={{ fontFamily: 'var(--mono)' }}>{materialesFiltrados.length}</span></div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>
        {materialesFiltrados.length === 0 && (
          <div className="empty"><h3>Sin materiales</h3><p>Los ítems del presupuesto no tienen análisis de costos con materiales cargados.</p></div>
        )}
        {Object.entries(porRubro).map(([rubro, mats]) => (
          <div key={rubro} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface2)', borderRadius: expandidos[rubro] ? '8px 8px 0 0' : 8, cursor: 'pointer', border: '1px solid var(--border)', borderBottom: expandidos[rubro] ? 'none' : '1px solid var(--border)' }}
              onClick={() => setExpandidos(e => ({ ...e, [rubro]: !e[rubro] }))}>
              <span style={{ fontSize: 12, fontWeight: 700, flex: 1 }}>{rubro}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{mats.length} · {fmt(mats.reduce((a, m) => a + (m.subtotal||0), 0))}</span>
              <span style={{ color: 'var(--muted)' }}>{expandidos[rubro] ? '▼' : '▶'}</span>
            </div>
            {expandidos[rubro] && (
              <div style={{ border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)' }}>
                      <th style={th}></th>
                      <th style={th}>Código</th>
                      <th style={th}>Material</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cantidad</th>
                      <th style={{ ...th, textAlign: 'right' }}>Unidad</th>
                      <th style={{ ...th, textAlign: 'right' }}>P. Unit.</th>
                      <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((m, i) => (
                      <tr key={m.material_id} style={{ borderBottom: '1px solid var(--border2)', background: seleccionados[m.material_id] ? 'rgba(110,231,183,0.05)' : i%2===0 ? 'transparent' : 'rgba(0,0,0,0.01)', cursor: 'pointer' }}
                        onClick={() => toggleSeleccionado(m.material_id)}>
                        <td style={{ ...td, width: 32 }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${seleccionados[m.material_id] ? 'var(--accent)' : 'var(--border)'}`, background: seleccionados[m.material_id] ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0f0f11' }}>
                            {seleccionados[m.material_id] ? '✓' : ''}
                          </div>
                        </td>
                        <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{m.codigo || '—'}</td>
                        <td style={{ ...td, fontSize: 12, fontWeight: 500 }}>{m.nombre}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{fmtCant(m.cantidad_total)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{m.unidad || '—'}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{fmt(m.precio_unitario)}</td>
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--precio)' }}>{fmt(m.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
        {materialesFiltrados.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '16px 12px', background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Total materiales</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--precio)' }}>{fmt(data?.total_materiales)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', verticalAlign: 'middle' };
"""

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to {path}")
