import '../index.css';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const API = 'https://fima-backend-production.up.railway.app';

const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const fmtK = n => {
  const v = Math.abs(Math.round(n || 0));
  if (v >= 1000000) return (n < 0 ? '-' : '') + '$ ' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (n < 0 ? '-' : '') + '$ ' + (v / 1000).toFixed(0) + 'k';
  return fmt(n);
};

const addDias = (fecha, dias) => {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};

const inicioSemana = (fecha) => {
  const d = new Date(fecha + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const inicioQuincena = (fecha) => {
  const d = new Date(fecha + 'T12:00:00');
  const dia = d.getDate();
  if (dia <= 15) { d.setDate(1); }
  else { d.setDate(16); }
  return d.toISOString().split('T')[0];
};

const inicioMes = (fecha) => {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

const labelPeriodo = (fecha, modo) => {
  const d = new Date(fecha + 'T12:00:00');
  if (modo === 'semanal') return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  if (modo === 'quincenal') return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  return d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
};

export default function CurvaInversion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presupuesto, setPresupuesto] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [modo, setModo] = useState('semanal');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`${API}/presupuestos/${id}`).then(r => r.json()),
        sb.from('gantt_tareas').select('*').eq('presupuesto_id', id).order('fecha_inicio'),
      ]);
      setPresupuesto(pRes);
      setTareas(tRes.data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const calcularCurva = () => {
    if (!tareas.length) return [];
    // Obtener precio de cada tarea desde el presupuesto
    const lineasMap = {};
    (presupuesto?.rubros || []).forEach(r => {
      (r.lineas || []).forEach(l => { lineasMap[l.id] = l; });
    });

    const periodos = {};
    const fn = modo === 'semanal' ? inicioSemana : modo === 'quincenal' ? inicioQuincena : inicioMes;

    tareas.forEach(t => {
      if (!t.fecha_inicio || !t.fecha_fin) return;
      const linea = lineasMap[t.linea_presupuesto_id];
      const monto = linea ? parseFloat(linea.precio_venta_con_iva || 0) : 0;
      if (!monto) return;

      // Distribuir el monto proporcionalmente entre los períodos que abarca la tarea
      const d1 = new Date(t.fecha_inicio + 'T12:00:00');
      const d2 = new Date(t.fecha_fin + 'T12:00:00');
      const durTotal = Math.max(1, Math.round((d2 - d1) / 86400000) + 1);

      // Iterar día a día y agrupar
      for (let i = 0; i < durTotal; i++) {
        const d = addDias(t.fecha_inicio, i);
        const p = fn(d);
        if (!periodos[p]) periodos[p] = 0;
        periodos[p] += monto / durTotal;
      }
    });

    const sorted = Object.keys(periodos).sort();
    let acum = 0;
    return sorted.map(p => {
      acum += periodos[p];
      return { fecha: p, monto: Math.round(periodos[p]), acumulado: Math.round(acum) };
    });
  };

  const curva = calcularCurva();
  const totalObra = curva.length ? curva[curva.length - 1].acumulado : 0;
  const maxMonto = Math.max(...curva.map(c => c.monto), 1);
  const maxAcum = Math.max(...curva.map(c => c.acumulado), 1);

  const imprimir = () => {
    const hoy = new Date().toLocaleDateString('es-AR');
    const filas = curva.map((c, i) => `
      <tr style="background:${i%2===0?'#fff':'#fafafa'}">
        <td>${labelPeriodo(c.fecha, modo)}</td>
        <td class="r">${fmt(c.monto)}</td>
        <td class="r">${fmt(c.acumulado)}</td>
        <td class="r">${totalObra > 0 ? (c.acumulado / totalObra * 100).toFixed(1) : 0}%</td>
      </tr>`).join('');

    // Build SVG chart
    const W = 680, H = 200, PAD = 40, BAR_W = Math.max(4, Math.floor((W - PAD * 2) / Math.max(curva.length, 1)) - 2);
    const maxM = Math.max(...curva.map(c => c.monto), 1);
    const maxA = Math.max(...curva.map(c => c.acumulado), 1);
    const xStep = (W - PAD * 2) / Math.max(curva.length, 1);

    const bars = curva.map((c, i) => {
      const x = PAD + i * xStep;
      const hBar = Math.round((c.monto / maxM) * (H - 20));
      const hAcum = Math.round((c.acumulado / maxA) * (H - 20));
      return `<rect x="${x}" y="${H - hBar}" width="${BAR_W}" height="${hBar}" fill="#7c3aed" opacity="0.6" rx="2"/>
              <line x1="${x + BAR_W/2}" y1="${H - hAcum}" x2="${x + BAR_W/2 + xStep}" y2="${H - Math.round((((curva[i+1]||curva[i]).acumulado)/maxA)*(H-20))}" stroke="#059669" stroke-width="1.5" opacity="0.7"/>
              <circle cx="${x + BAR_W/2}" cy="${H - hAcum}" r="3" fill="#059669"/>`;
    }).join('');

    const labels = curva.filter((_, i) => i % Math.ceil(curva.length / 8) === 0).map((c, i) => {
      const origIdx = i * Math.ceil(curva.length / 8);
      const x = PAD + origIdx * xStep + BAR_W / 2;
      return `<text x="${x}" y="${H + 14}" font-size="8" fill="#666" text-anchor="middle">${labelPeriodo(c.fecha, modo)}</text>`;
    }).join('');

    const svgChart = `<svg width="${W}" height="${H + 20}" xmlns="http://www.w3.org/2000/svg">
      <line x1="${PAD}" y1="0" x2="${PAD}" y2="${H}" stroke="#ccc" stroke-width="1"/>
      <line x1="${PAD}" y1="${H}" x2="${W - PAD}" y2="${H}" stroke="#ccc" stroke-width="1"/>
      ${bars}${labels}
      <rect x="${W-140}" y="4" width="12" height="10" fill="#7c3aed" opacity="0.6" rx="2"/>
      <text x="${W-125}" y="13" font-size="9" fill="#444">Desembolso período</text>
      <circle cx="${W-134}" cy="26" r="4" fill="#059669"/>
      <text x="${W-125}" y="30" font-size="9" fill="#444">Acumulado</text>
    </svg>`;

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Curva de Inversión</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:18pt;margin:0}h2{font-size:10pt;color:#666;margin:4px 0 16px}
    .chart{margin:16px 0;border:1px solid #eee;padding:12px;border-radius:4px}
    table{width:100%;border-collapse:collapse;font-size:10pt}th{background:#1a1a1a;color:#fff;padding:6px 10px;text-align:left}
    td{padding:6px 10px;border-bottom:1px solid #eee}.r{text-align:right;font-family:monospace}
    .total{background:#f0f5ff;font-weight:700}.footer{margin-top:20px;font-size:9pt;color:#aaa;border-top:1px solid #eee;padding-top:8px;display:flex;justify-content:space-between}
    @media print{@page{margin:1.5cm}}
    </style></head><body>
    <h1>Fima Arquitectura — Curva de Inversión</h1>
    <h2>${presupuesto?.nombre_obra} · Plan de desembolso ${modo} · ${hoy}</h2>
    <div class="chart">${svgChart}</div>
    <table><thead><tr><th>Período</th><th class="r">Desembolso</th><th class="r">Acumulado</th><th class="r">% Avance</th></tr></thead>
    <tbody>${filas}<tr class="total"><td>TOTAL</td><td class="r">${fmt(totalObra)}</td><td class="r">${fmt(totalObra)}</td><td class="r">100%</td></tr></tbody></table>
    <div class="footer"><span>Fima Arquitectura</span><span>${hoy}</span></div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const BAR_H = 200;
  const BAR_W = Math.max(40, Math.floor(700 / Math.max(curva.length, 1)));

  return (
    <div>
      <div className="header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>FIMA</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>← Volver</button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{presupuesto?.nombre_obra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Curva de inversión</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            {['semanal', 'quincenal', 'mensual'].map(m => (
              <button key={m} onClick={() => setModo(m)}
                style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: modo === m ? 'var(--accent2)' : 'transparent', color: modo === m ? 'white' : 'var(--muted)' }}>
                {m.charAt(0).toUpperCase()+m.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={imprimir}>🖨 Imprimir</button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24 }}>

        {tareas.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Sin datos de Gantt</div>
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>Necesitás generar el diagrama de Gantt primero para calcular la curva de inversión.</p>
            <button className="btn btn-primary" onClick={() => navigate(`/cotizador/gantt/${id}`)}>Ir al Gantt</button>
          </div>
        )}

        {curva.length > 0 && (
          <>
            {/* Resumen */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total obra', val: fmtK(totalObra), color: 'var(--precio)' },
                { label: 'Períodos', val: curva.length, color: 'var(--accent2)' },
                { label: 'Pico máximo', val: fmtK(maxMonto), color: 'var(--warn)' },
              ].map(s => (
                <div key={s.label} className="card" style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Gráfico */}
            <div className="card" style={{ padding: 20, marginBottom: 24, overflowX: 'auto' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 16 }}>
                Plan de desembolso — {modo}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, minHeight: BAR_H + 60, paddingBottom: 40, position: 'relative' }}>
                {/* Líneas guía */}
                {[0, 25, 50, 75, 100].map(p => (
                  <div key={p} style={{ position: 'absolute', left: 0, right: 0, bottom: 40 + (BAR_H * p / 100), borderTop: `1px dashed ${p === 0 ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`, zIndex: 0 }}>
                    {p > 0 && <span style={{ position: 'absolute', left: -36, top: -8, fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{p}%</span>}
                  </div>
                ))}

                {curva.map((c, i) => {
                  const hBar = Math.max(2, Math.round((c.monto / maxMonto) * BAR_H));
                  const hAcum = Math.max(2, Math.round((c.acumulado / maxAcum) * BAR_H));
                  return (
                    <div key={c.fecha} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: BAR_W, position: 'relative', zIndex: 1 }}>
                      {/* Línea acumulado */}
                      <div style={{ position: 'absolute', bottom: 40, left: '50%', width: 2, height: hAcum, background: 'rgba(110,231,183,0.4)', borderRadius: 1, transform: 'translateX(-50%)' }} />
                      {/* Barra período */}
                      <div style={{ position: 'absolute', bottom: 40, width: Math.max(BAR_W - 6, 8), height: hBar, background: 'rgba(167,139,250,0.5)', borderRadius: '4px 4px 0 0', border: '1px solid rgba(167,139,250,0.6)' }}>
                        <div style={{ position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'var(--accent2)', whiteSpace: 'nowrap', fontFamily: 'var(--mono)' }}>
                          {fmtK(c.monto)}
                        </div>
                      </div>
                      {/* Label fecha */}
                      <div style={{ position: 'absolute', bottom: 0, fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap', transform: 'rotate(-45deg) translateX(-50%)', transformOrigin: 'top left', left: '50%' }}>
                        {labelPeriodo(c.fecha, modo)}
                      </div>
                    </div>
                  );
                })}

                {/* Leyenda */}
                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 12, background: 'rgba(167,139,250,0.5)', borderRadius: 2 }}></div>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Desembolso</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 3, background: 'rgba(110,231,183,0.6)', borderRadius: 1 }}></div>
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>Acumulado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['#', 'Período', 'Desembolso', 'Acumulado', '% Avance', 'Distribución'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: h === '#' ? 'center' : h === 'Distribución' ? 'left' : 'right', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {curva.map((c, i) => {
                    const pct = totalObra > 0 ? c.acumulado / totalObra * 100 : 0;
                    const pctPer = maxMonto > 0 ? c.monto / maxMonto * 100 : 0;
                    return (
                      <tr key={c.fecha} style={{ borderBottom: '1px solid var(--border2)' }}>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{i + 1}</td>
                        <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 500 }}>{labelPeriodo(c.fecha, modo)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{fmt(c.monto)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--precio)' }}>{fmt(c.acumulado)}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{pct.toFixed(1)}%</td>
                        <td style={{ padding: '10px 14px', minWidth: 120 }}>
                          <div style={{ height: 6, background: 'var(--surface2)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pctPer}%`, background: 'var(--accent2)', borderRadius: 3, transition: 'width .3s' }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(167,139,250,0.06)', borderTop: '2px solid var(--border)' }}>
                    <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 12 }}>TOTAL</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent2)' }}>{fmt(totalObra)}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
