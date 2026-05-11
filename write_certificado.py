import os

path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'

content = r"""import '../index.css';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Plus, FileText, Printer, Trash2, Edit2 } from 'lucide-react';
import '../print.css';

const fmt = (n) => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';
const fmtPct = (n) => (n != null ? Number(n).toFixed(1) + '%' : '0.0%');

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

export default function Certificado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presupuesto, setPresupuesto] = useState(null);
  const [certificados, setCertificados] = useState([]);
  const [certDetalle, setCertDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoCertFecha, setNuevoCertFecha] = useState(new Date().toISOString().split('T')[0]);
  const [avances, setAvances] = useState({});
  const [avancesAnteriores, setAvancesAnteriores] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [certMayoresCostosPct, setCertMayoresCostosPct] = useState(0);
  const [certFondoReparoPct, setCertFondoReparoPct] = useState(0);
  const [certMultas, setCertMultas] = useState(0);
  const [certNota, setCertNota] = useState('');
  const [modalEditCert, setModalEditCert] = useState(null);
  const tenantNombre = getTenantName();
  const tenantColor = getTenantColor();

  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        api.get(`/presupuestos/${id}`),
        api.get(`/presupuestos/${id}/certificados`),
      ]);
      setPresupuesto(pRes.data);
      setCertificados(cRes.data || []);
      // Inicializar avances en 0 para cada ítem
      const av = {};
      (pRes.data?.rubros || []).forEach(r => {
        (r.lineas || []).forEach(l => { av[l.id] = 0; });
      });
      setAvances(av);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const cargarDetalle = async (num) => {
    try {
      const res = await api.get(`/presupuestos/${id}/certificados/${num}`);
      setCertDetalle(res.data);
    } catch(e) { console.error(e); }
  };

  useEffect(() => { cargar(); }, [id]);

  const handleCrearCert = async () => {
    setGuardando(true);
    try {
      const detalles = Object.entries(avances)
        .filter(([, v]) => v > 0)
        .map(([linea_id, avance_pct]) => ({ linea_id: parseInt(linea_id), avance_pct: parseFloat(avance_pct) }));
      await api.post(`/presupuestos/${id}/certificados`, {
        fecha: nuevoCertFecha,
        detalles,
        mayores_costos_pct: parseFloat(certMayoresCostosPct) || 0,
        fondo_reparo_pct: parseFloat(certFondoReparoPct) || 0,
        multas: parseFloat(certMultas) || 0,
        nota: certNota,
      });
      setModalNuevo(false);
      cargar();
    } catch(e) { alert('Error al crear certificado: ' + (e.response?.data?.detail || e.message)); }
    setGuardando(false);
  };

  const handleEliminarCert = async (num) => {
    if (!window.confirm(`¿Eliminar certificado #${num}?`)) return;
    try {
      await api.delete(`/presupuestos/${id}/certificados/${num}`);
      setCertDetalle(null);
      cargar();
    } catch(e) { alert('Error al eliminar: ' + (e.response?.data?.detail || e.message)); }
  };

  const imprimirCert = (cert) => {
    const hoy = new Date().toLocaleDateString('es-AR');
    const rubrosHTML = (presupuesto?.rubros || []).map(r => {
      const lineasHTML = (r.lineas || []).map(l => {
        const det = (cert.detalles || []).find(d => d.linea_id === l.id);
        const avPct = det?.avance_pct || 0;
        const avAnt = det?.avance_anterior_pct || 0;
        const avPeriodo = avPct - avAnt;
        const monto = (l.precio_venta_con_iva || 0) * avPeriodo / 100;
        if (avPct === 0) return '';
        return `<tr>
          <td>${l.nombre_item || ''}</td>
          <td class="r">${l.unidad_item || ''}</td>
          <td class="r">${fmtPct(avAnt)}</td>
          <td class="r">${fmtPct(avPct)}</td>
          <td class="r" style="font-weight:700">${fmtPct(avPeriodo)}</td>
          <td class="r" style="color:#065f46;font-weight:700">${fmt(monto)}</td>
        </tr>`;
      }).filter(Boolean).join('');
      if (!lineasHTML) return '';
      return `<tr><td colspan="6" style="background:#f0f0f0;font-weight:700;padding:6px 8px">${r.nombre}</td></tr>${lineasHTML}`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificado #${cert.numero}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111;font-size:10pt}
    h1{font-size:16pt;margin:0}h2{font-size:9pt;color:#666;margin:4px 0 20px}
    table{width:100%;border-collapse:collapse}th{background:#1a1a1a;color:#fff;padding:5px 8px;font-size:8pt;text-transform:uppercase}
    td{padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt}.r{text-align:right}
    .total{background:#f0f5ff;font-weight:700}@media print{@page{margin:1.5cm}}</style></head><body>
    <h1>${tenantNombre} — Certificado de Obra #${cert.numero}</h1>
    <h2>${presupuesto?.nombre_obra} · ${cert.fecha} · Avance al ${fmtPct(cert.avance_total_pct)}</h2>
    <table><thead><tr><th>Ítem</th><th class="r">Unid.</th><th class="r">% Ant.</th><th class="r">% Act.</th><th class="r">% Per.</th><th class="r">Monto</th></tr></thead>
    <tbody>${rubrosHTML}</tbody></table>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <div style="background:#f0f5ff;padding:12px 20px;border-radius:8px;text-align:right">
        <div style="font-size:9pt;color:#666">MONTO CERTIFICADO PERÍODO</div>
        <div style="font-size:20pt;font-weight:700;color:#065f46">${fmt(cert.monto_periodo)}</div>
      </div>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const totalCertificado = presupuesto ? (presupuesto.rubros || []).reduce((acc, r) =>
    acc + (r.lineas || []).reduce((a2, l) => {
      const av = parseFloat(avances[l.id] || 0);
      return a2 + (l.precio_venta_con_iva || 0) * av / 100;
    }, 0), 0) : 0;

  if (loading) return <div className="loading">Cargando certificados...</div>;

  const rubros = presupuesto?.rubros || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, color: tenantColor, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>{tenantNombre}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)} style={{ flexShrink: 0 }}><ArrowLeft size={14} /></button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{presupuesto?.nombre_obra}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>Certificados de avance</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setModalNuevo(true)}><Plus size={14} /> Nuevo certificado</button>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Panel izq — lista certificados */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--surface)', flexShrink: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {certificados.length} certificado{certificados.length !== 1 ? 's' : ''}
          </div>
          {certificados.length === 0 && (
            <div className="empty" style={{ padding: 24 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>Sin certificados aún. Creá el primero con el botón de arriba.</p>
            </div>
          )}
          {certificados.map(c => (
            <div key={c.numero}
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: certDetalle?.numero === c.numero ? 'var(--surface2)' : 'transparent' }}
              onClick={() => cargarDetalle(c.numero)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Certificado #{c.numero}</span>
                <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px' }} onClick={e => { e.stopPropagation(); handleEliminarCert(c.numero); }}><Trash2 size={11} /></button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.fecha}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Avance: {fmtPct(c.avance_total_pct)}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--precio)' }}>{fmt(c.monto_periodo)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Panel der — detalle */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!certDetalle && (
            <div className="empty">
              <FileText size={40} color="var(--muted)" />
              <h3>Seleccioná un certificado</h3>
              <p>O creá uno nuevo con el botón de arriba</p>
            </div>
          )}
          {certDetalle && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h2 style={{ margin: 0 }}>Certificado #{certDetalle.numero}</h2>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>Fecha: {certDetalle.fecha} · Avance total: {fmtPct(certDetalle.avance_total_pct)}</div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => imprimirCert(certDetalle)}><Printer size={14} /> Imprimir</button>
              </div>

              {/* Tabla rubros */}
              {rubros.map(r => (
                <div key={r.numero} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, padding: '6px 12px', background: 'var(--surface2)', borderRadius: '6px 6px 0 0', border: '1px solid var(--border)' }}>
                    {r.numero} — {r.nombre}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderTop: 'none' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        <th style={th}>Ítem</th>
                        <th style={{ ...th, textAlign: 'right' }}>Precio</th>
                        <th style={{ ...th, textAlign: 'right' }}>% Ant.</th>
                        <th style={{ ...th, textAlign: 'right' }}>% Act.</th>
                        <th style={{ ...th, textAlign: 'right' }}>% Per.</th>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(r.lineas || []).map(l => {
                        const det = (certDetalle.detalles || []).find(d => d.linea_id === l.id);
                        const avPct = det?.avance_pct || 0;
                        const avAnt = det?.avance_anterior_pct || 0;
                        const avPer = avPct - avAnt;
                        const monto = (l.precio_venta_con_iva || 0) * avPer / 100;
                        return (
                          <tr key={l.id} style={{ borderBottom: '1px solid var(--border2)' }}>
                            <td style={td}><span style={{ fontSize: 12 }}>{l.nombre_item}</span></td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{fmt(l.precio_venta_con_iva)}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>{fmtPct(avAnt)}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{fmtPct(avPct)}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent2)' }}>{fmtPct(avPer)}</td>
                            <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, color: 'var(--precio)' }}>{fmt(monto)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Totales */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Monto período</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 24, fontWeight: 700, color: 'var(--precio)' }}>{fmt(certDetalle.monto_periodo)}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Acumulado: {fmt(certDetalle.monto_acumulado)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal nuevo certificado */}
      {modalNuevo && (
        <div className="modal-overlay" onClick={() => setModalNuevo(false)}>
          <div className="modal" style={{ maxWidth: 800, width: '95%', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2>Nuevo certificado de avance</h2>
            <div className="form-group">
              <label>Fecha</label>
              <input className="input" type="date" value={nuevoCertFecha} onChange={e => setNuevoCertFecha(e.target.value)} />
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Avance por ítem (%)</div>
              {rubros.map(r => (
                <div key={r.numero} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '4px 0', textTransform: 'uppercase' }}>{r.nombre}</div>
                  {(r.lineas || []).map(l => (
                    <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--border2)' }}>
                      <span style={{ flex: 1, fontSize: 12 }}>{l.nombre_item}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{fmt(l.precio_venta_con_iva)}</span>
                      <input type="number" min="0" max="100" style={{ width: 70 }} className="input"
                        value={avances[l.id] || 0}
                        onChange={e => setAvances(a => ({ ...a, [l.id]: e.target.value }))} />
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>%</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Mayores costos %</label>
                <input className="input" type="number" value={certMayoresCostosPct} onChange={e => setCertMayoresCostosPct(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Fondo reparo %</label>
                <input className="input" type="number" value={certFondoReparoPct} onChange={e => setCertFondoReparoPct(e.target.value)} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Multas $</label>
                <input className="input" type="number" value={certMultas} onChange={e => setCertMultas(e.target.value)} />
              </div>
            </div>
            <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginTop: 8, textAlign: 'right' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--precio)' }}>{fmt(totalCertificado)}</span>
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>estimado período</span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={handleCrearCert} disabled={guardando}>{guardando ? 'Guardando...' : 'Crear certificado'}</button>
              <button className="btn btn-secondary" onClick={() => setModalNuevo(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '6px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)' };
const td = { padding: '6px 12px', verticalAlign: 'middle' };
"""

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to {path}")
