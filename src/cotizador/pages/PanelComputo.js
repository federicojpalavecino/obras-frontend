import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Copy } from 'lucide-react';
import api from '../api';
import { parseNum } from '../num';

import { imprimirHTML } from '../../utils/imprimir';
// Detectar tipo de fórmula según unidad
function detectarTipo(unidad) {
  if (!unidad) return 'u';
  const u = unidad.toLowerCase().trim();
  if (u === 'm2' || u === 'm²') return 'm2';
  if (u === 'm3' || u === 'm³') return 'm3';
  if (u === 'ml' || u === 'm') return 'ml';
  if (u === 'm2/m' || u === 'm²/m' || u === 'perim') return 'm2pm';
  return 'u';
}

// Calcular resultado de una fila según tipo (acepta coma o punto)
function calcFila(tipo, fila) {
  const n = (v) => parseNum(v);
  switch (tipo) {
    case 'm2':   return n(fila.alto) * n(fila.ancho) * n(fila.cant);
    case 'm3':   return n(fila.alto) * n(fila.ancho) * n(fila.largo) * n(fila.cant);
    case 'ml':   return n(fila.long) * n(fila.cant);
    case 'm2pm': return n(fila.perim) * n(fila.alto) * n(fila.cant);
    case 'u':    return n(fila.cant);
    default:     return n(fila.cant);
  }
}

function filaVacia(tipo) {
  const base = { desc: '', cant: 1, signo: '+' };
  switch (tipo) {
    case 'm2':   return { ...base, alto: '', ancho: '' };
    case 'm3':   return { ...base, alto: '', ancho: '', largo: '' };
    case 'ml':   return { ...base, long: '' };
    case 'm2pm': return { ...base, perim: '', alto: '' };
    default:     return base;
  }
}

// ¿La fila tiene algún dato cargado por el usuario?
function filaTieneDatos(f) {
  return !!(f.desc || f.alto || f.ancho || f.largo || f.long || f.perim || (f.cant !== '' && f.cant !== 1 && f.cant != null));
}
function hayDatos(filas) { return (filas || []).some(filaTieneDatos); }

// Lee el cómputo guardado de una línea.
// localStorage primero (es lo más fresco tras editar en este navegador), sino el del servidor.
function leerComputo(presupuestoId, l) {
  let raw = null;
  try { raw = localStorage.getItem(`computo_${presupuestoId}_${l?.id}`); } catch {}
  if (!raw) raw = l?.computo_detalle;
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (Array.isArray(d)) return { tipo: null, filas: d };
    if (d && Array.isArray(d.filas)) return { tipo: d.tipo || null, filas: d.filas };
  } catch {}
  return null;
}

const TIPO_LABELS = {
  m2:   { label: 'm²', campos: ['Descripción', 'Alto', 'Ancho', 'Cant'] },
  m3:   { label: 'm³', campos: ['Descripción', 'Alto', 'Ancho', 'Largo', 'Cant'] },
  ml:   { label: 'ml', campos: ['Descripción', 'Longitud', 'Cant'] },
  m2pm: { label: 'm²/ml', campos: ['Descripción', 'Perímetro', 'Alto', 'Cant'] },
  u:    { label: 'u/Gl', campos: ['Descripción', 'Cantidad'] },
};

export default function PanelComputo({ presupuestoId, linea, onClose, onCantidadChange, lineas = [] }) {
  const unidad = linea?.unidad_item || linea?.unidad_libre || 'u';
  const tipoDetectado = detectarTipo(unidad);
  const storageKey = `computo_${presupuestoId}_${linea?.id}`;

  // Estado inicial: servidor → localStorage → vacío
  const inicial = leerComputo(presupuestoId, linea);
  const [tipo, setTipo] = useState(inicial?.tipo || tipoDetectado);
  const [filas, setFilas] = useState(inicial?.filas?.length ? inicial.filas : [filaVacia(tipoDetectado)]);
  const [guardando, setGuardando] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const [estadoGuardado, setEstadoGuardado] = useState('guardado'); // 'guardado' | 'guardando' | 'pendiente'
  const [copiarOpen, setCopiarOpen] = useState(false);
  const primerRender = useRef(true);

  // Guardado robusto: localStorage al instante + servidor (debounce)
  const persistir = async (fs, tp) => {
    const payload = JSON.stringify({ tipo: tp, filas: fs });
    try { localStorage.setItem(storageKey, payload); } catch {}
    try {
      setEstadoGuardado('guardando');
      await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}`, { computo_detalle: payload });
      setEstadoGuardado('guardado');
    } catch { setEstadoGuardado('pendiente'); }
  };

  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    setEstadoGuardado('pendiente');
    const t = setTimeout(() => { persistir(filas, tipo); }, 700);
    return () => clearTimeout(t);
  }, [filas, tipo]);

  // Recalcular total
  const totalFilas = filas.reduce((acc, f) => {
    const val = calcFila(tipo, f);
    return f.signo === '-' ? acc - val : acc + val;
  }, 0);
  const total = Math.round(totalFilas * 1000) / 1000;

  const addFila = () => setFilas(f => [...f, filaVacia(tipo)]);
  const delFila = (i) => setFilas(f => (f.length <= 1 ? [filaVacia(tipo)] : f.filter((_, j) => j !== i)));
  const updFila = (i, campo, val) => setFilas(f => {
    const arr = [...f];
    arr[i] = { ...arr[i], [campo]: val };
    return arr;
  });

  const changeTipo = (nuevoTipo) => {
    if (nuevoTipo === tipo) return;
    if (hayDatos(filas) && !window.confirm('Cambiar el tipo de cómputo vacía las filas que cargaste. ¿Querés continuar?')) return;
    setTipo(nuevoTipo);
    setFilas([filaVacia(nuevoTipo)]);
  };

  // Copiar el cómputo de otra línea (la otra NO se modifica)
  const lineasConComputo = (lineas || []).filter(l => l && l.id !== linea?.id && leerComputo(presupuestoId, l));
  const copiarDe = (l) => {
    const data = leerComputo(presupuestoId, l);
    if (!data || !data.filas?.length) { alert('Ese ítem no tiene cómputo cargado.'); return; }
    if (hayDatos(filas) && !window.confirm(`Esto reemplaza el cómputo actual por el de "${l.nombre_override || l.nombre_item || l.nombre_libre || 'ese ítem'}". El otro ítem no se modifica. ¿Continuar?`)) return;
    const srcTipo = data.tipo || detectarTipo(l.unidad_item || l.unidad_libre || 'u');
    setTipo(srcTipo);
    setFilas(data.filas.map(f => ({ ...f })));   // copia profunda → no toca el origen
    setCopiarOpen(false);
  };

  const aplicarCantidad = async () => {
    if (total <= 0) return;
    setGuardando(true);
    try {
      await persistir(filas, tipo); // asegura que el detalle quede guardado
      await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}`, { cantidad: total });
      setAplicado(true);
      setTimeout(() => setAplicado(false), 2000);
      if (onCantidadChange) onCantidadChange(linea.id, total);
    } catch(e) { alert('Error al aplicar: ' + e.message); }
    setGuardando(false);
  };

  const imprimir = () => {
    const nombre = linea?.nombre_override || linea?.nombre_item || linea?.nombre_libre || 'Ítem';
    const rows = filas.map((f, i) => {
      const val = calcFila(tipo, f);
      const campos = [];
      if (f.desc) campos.push(f.desc);
      if (tipo === 'm2')   campos.push(`${f.alto||0} × ${f.ancho||0} × ${f.cant||1}`);
      if (tipo === 'm3')   campos.push(`${f.alto||0} × ${f.ancho||0} × ${f.largo||0} × ${f.cant||1}`);
      if (tipo === 'ml')   campos.push(`${f.long||0} × ${f.cant||1}`);
      if (tipo === 'm2pm') campos.push(`${f.perim||0} × ${f.alto||0} × ${f.cant||1}`);
      if (tipo === 'u')    campos.push(`Cant: ${f.cant||1}`);
      return `<tr>
        <td>${i + 1}</td>
        <td>${campos.join(' — ')}</td>
        <td style="text-align:right">${f.signo === '-' ? '-' : '+'}</td>
        <td style="text-align:right;font-family:monospace">${val.toFixed(3)}</td>
      </tr>`;
    }).join('');
    imprimirHTML(`<!DOCTYPE html><html><head><title>Cómputo — ${nombre}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; padding: 20px; }
      h2 { font-size: 14pt; margin-bottom: 4px; }
      .sub { font-size: 10pt; color: #666; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f0f0f0; padding: 6px 8px; text-align: left; font-size: 10pt; border: 1px solid #ddd; }
      td { padding: 5px 8px; border: 1px solid #eee; font-size: 10pt; }
      .total-row { font-weight: bold; background: #f8f8f8; }
    </style></head><body>
    <h2>Cómputo — ${nombre}</h2>
    <div class="sub">Unidad: ${unidad} · Tipo: ${TIPO_LABELS[tipo]?.label}</div>
    <table>
      <thead><tr><th>#</th><th>Detalle</th><th style="text-align:right">±</th><th style="text-align:right">Parcial</th></tr></thead>
      <tbody>${rows}
      <tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right;font-family:monospace">${total.toFixed(3)} ${unidad}</td></tr>
      </tbody>
    </table>
    </body></html>`, { titulo: 'Cómputo' });
  };

  const inp = {
    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4,
    padding: '3px 6px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11,
    width: '100%', boxSizing: 'border-box',
  };
  const numProps = { type: 'text', inputMode: 'decimal' };

  return (
    <div style={{
      width: 420, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4 }}>
            {linea?.nombre_override || linea?.nombre_item || linea?.nombre_libre}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', marginTop: 3 }}>
            Cómputo métrico · {unidad} · {estadoGuardado === 'guardando' ? 'guardando…' : estadoGuardado === 'pendiente' ? 'sin guardar…' : '✓ guardado'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={imprimir} title="Imprimir este ítem" style={{ fontSize: 10, letterSpacing: 0.3 }}>
            ∑ Imprimir
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
      </div>

      {/* Copiar de otro ítem */}
      {lineasConComputo.length > 0 && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setCopiarOpen(o => !o)}
            style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Copy size={12} /> Copiar cómputo de otro ítem
          </button>
          {copiarOpen && (
            <div style={{ marginTop: 6, border: '1px solid var(--border)', borderRadius: 6, maxHeight: 160, overflowY: 'auto', background: 'var(--bg)' }}>
              {lineasConComputo.map(l => (
                <div key={l.id} onClick={() => copiarDe(l)}
                  style={{ padding: '7px 10px', fontSize: 11, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {l.nombre_override || l.nombre_item || l.nombre_libre || `Ítem ${l.id}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selector de tipo */}
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {Object.entries(TIPO_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => changeTipo(k)}
            style={{ padding: '3px 10px', borderRadius: 12, border: `1px solid ${tipo === k ? 'var(--accent2)' : 'var(--border)'}`,
              background: tipo === k ? 'rgba(167,139,250,0.15)' : 'transparent',
              color: tipo === k ? 'var(--accent2)' : 'var(--muted)', fontSize: 11, cursor: 'pointer', fontFamily: 'var(--mono)' }}>
            {v.label}
          </button>
        ))}
      </div>

      {/* Tabla de filas */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: columnas(tipo), gap: 4, marginBottom: 4 }}>
          {colLabels(tipo).map((l, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i > 0 ? 'center' : 'left' }}>{l}</div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Parcial</div>
          <div />
        </div>

        {filas.map((fila, i) => {
          const parcial = calcFila(tipo, fila);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: columnas(tipo), gap: 4, marginBottom: 5, alignItems: 'center' }}>
              <input style={inp} value={fila.desc || ''} onChange={e => updFila(i, 'desc', e.target.value)} placeholder={`Sector ${i + 1}`} />
              {tipo === 'm2' && <>
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.ancho || ''} onChange={e => updFila(i, 'ancho', e.target.value)} placeholder="Ancho" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'm3' && <>
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.ancho || ''} onChange={e => updFila(i, 'ancho', e.target.value)} placeholder="Ancho" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.largo || ''} onChange={e => updFila(i, 'largo', e.target.value)} placeholder="Largo" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'ml' && <>
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.long || ''} onChange={e => updFila(i, 'long', e.target.value)} placeholder="Long." />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'm2pm' && <>
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.perim || ''} onChange={e => updFila(i, 'perim', e.target.value)} placeholder="Perím." />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'u' && <>
                <input style={{ ...inp, textAlign: 'right' }} {...numProps} value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: fila.signo === '-' ? 'var(--danger)' : 'var(--accent)', textAlign: 'right', cursor: 'pointer' }}
                title="Click para cambiar signo (+/-)"
                onClick={() => updFila(i, 'signo', fila.signo === '-' ? '+' : '-')}>
                {fila.signo === '-' ? '−' : '+'}{parcial.toFixed(3)}
              </div>
              <button onClick={() => delFila(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        <button onClick={addFila}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 6, border: '1px dashed var(--border2)', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11, width: '100%', justifyContent: 'center', marginTop: 4 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent2)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border2)'}>
          <Plus size={12} /> Agregar fila
        </button>
      </div>

      {/* Footer con total y botón aplicar */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total cómputo</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent2)' }}>
              {total.toFixed(3)} <span style={{ fontSize: 12, color: 'var(--muted)' }}>{unidad}</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={aplicarCantidad} disabled={guardando || total <= 0} style={{ minWidth: 120 }}>
            {guardando ? '...' : aplicado ? '✓ Aplicado' : `Aplicar ${total.toFixed(2)} ${unidad}`}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          El cómputo se guarda solo (en el servidor). Click en el parcial de cada fila cambia el signo (+/−) para descontar áreas.
        </div>
      </div>
    </div>
  );
}

function columnas(tipo) {
  switch (tipo) {
    case 'm2':   return '2fr 1fr 1fr 1fr 1fr 22px';
    case 'm3':   return '2fr 1fr 1fr 1fr 1fr 1fr 22px';
    case 'ml':   return '2fr 1fr 1fr 1fr 22px';
    case 'm2pm': return '2fr 1fr 1fr 1fr 1fr 22px';
    case 'u':    return '2fr 1fr 1fr 22px';
    default:     return '2fr 1fr 1fr 22px';
  }
}

function colLabels(tipo) {
  switch (tipo) {
    case 'm2':   return ['Descripción', 'Alto', 'Ancho', 'Cant'];
    case 'm3':   return ['Descripción', 'Alto', 'Ancho', 'Largo', 'Cant'];
    case 'ml':   return ['Descripción', 'Long.', 'Cant'];
    case 'm2pm': return ['Descripción', 'Perím.', 'Alto', 'Cant'];
    case 'u':    return ['Descripción', 'Cant'];
    default:     return ['Descripción', 'Cant'];
  }
}
