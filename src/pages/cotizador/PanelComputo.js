import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import api from '../../api';

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

// Calcular resultado de una fila según tipo
function calcFila(tipo, fila) {
  const n = (v) => parseFloat(v) || 0;
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

const TIPO_LABELS = {
  m2:   { label: 'm²', campos: ['Descripción', 'Alto', 'Ancho', 'Cant'] },
  m3:   { label: 'm³', campos: ['Descripción', 'Alto', 'Ancho', 'Largo', 'Cant'] },
  ml:   { label: 'ml', campos: ['Descripción', 'Longitud', 'Cant'] },
  m2pm: { label: 'm²/ml', campos: ['Descripción', 'Perímetro', 'Alto', 'Cant'] },
  u:    { label: 'u/Gl', campos: ['Descripción', 'Cantidad'] },
};

export default function PanelComputo({ presupuestoId, linea, onClose, onCantidadChange }) {
  const unidad = linea?.unidad_item || linea?.unidad_libre || 'u';
  const tipoDetectado = detectarTipo(unidad);

  const [tipo, setTipo] = useState(tipoDetectado);
  const [filas, setFilas] = useState(() => {
    // Intentar cargar desde localStorage
    const key = `computo_${presupuestoId}_${linea?.id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [filaVacia(tipoDetectado)];
  });
  const [guardando, setGuardando] = useState(false);
  const [aplicado, setAplicado] = useState(false);

  const storageKey = `computo_${presupuestoId}_${linea?.id}`;

  // Guardar en localStorage cada vez que cambian las filas
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(filas)); } catch {}
  }, [filas, storageKey]);

  // Recalcular total
  const totalFilas = filas.reduce((acc, f) => {
    const val = calcFila(tipo, f);
    return f.signo === '-' ? acc - val : acc + val;
  }, 0);
  const total = Math.round(totalFilas * 1000) / 1000;

  const addFila = () => setFilas(f => [...f, filaVacia(tipo)]);
  const delFila = (i) => setFilas(f => f.filter((_, j) => j !== i));
  const updFila = (i, campo, val) => setFilas(f => {
    const arr = [...f];
    arr[i] = { ...arr[i], [campo]: val };
    return arr;
  });

  const changeTipo = (nuevoTipo) => {
    setTipo(nuevoTipo);
    setFilas([filaVacia(nuevoTipo)]);
  };

  const aplicarCantidad = async () => {
    if (total <= 0) return;
    setGuardando(true);
    try {
      await api.patch(`/presupuestos/${presupuestoId}/lineas/${linea.id}`, { cantidad: total });
      setAplicado(true);
      setTimeout(() => setAplicado(false), 2000);
      if (onCantidadChange) onCantidadChange(linea.id, total);
    } catch(e) { alert('Error al aplicar: ' + e.message); }
    setGuardando(false);
  };

  const imprimir = () => {
    const nombre = linea?.nombre_override || linea?.nombre_item || linea?.nombre_libre || 'Ítem';
    const win = window.open('', '_blank');
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
    win.document.write(`<!DOCTYPE html><html><head><title>Cómputo — ${nombre}</title>
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
    </body></html>`);
    win.document.close();
    win.print();
  };

  const inp = {
    background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4,
    padding: '3px 6px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11,
    width: '100%', boxSizing: 'border-box',
  };

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
            Cómputo métrico · {unidad}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" onClick={imprimir} title="Imprimir este ítem" style={{ fontSize: 10, letterSpacing: 0.3 }}>
            ∑ Imprimir
          </button>
          <button className="btn btn-secondary btn-sm" onClick={onClose}><X size={14} /></button>
        </div>
      </div>

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
        {/* Encabezado columnas */}
        <div style={{ display: 'grid', gridTemplateColumns: columnas(tipo), gap: 4, marginBottom: 4 }}>
          {colLabels(tipo).map((l, i) => (
            <div key={i} style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i > 0 ? 'center' : 'left' }}>{l}</div>
          ))}
          <div style={{ fontSize: 9, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'right' }}>Parcial</div>
          <div />
        </div>

        {/* Filas */}
        {filas.map((fila, i) => {
          const parcial = calcFila(tipo, fila);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: columnas(tipo), gap: 4, marginBottom: 5, alignItems: 'center' }}>
              {/* Descripción */}
              <input style={inp} value={fila.desc || ''} onChange={e => updFila(i, 'desc', e.target.value)} placeholder={`Sector ${i + 1}`} />
              {/* Campos numéricos según tipo */}
              {tipo === 'm2' && <>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.ancho || ''} onChange={e => updFila(i, 'ancho', e.target.value)} placeholder="Ancho" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="1" value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'm3' && <>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.ancho || ''} onChange={e => updFila(i, 'ancho', e.target.value)} placeholder="Ancho" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.largo || ''} onChange={e => updFila(i, 'largo', e.target.value)} placeholder="Largo" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="1" value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'ml' && <>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.long || ''} onChange={e => updFila(i, 'long', e.target.value)} placeholder="Long." />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="1" value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'm2pm' && <>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.perim || ''} onChange={e => updFila(i, 'perim', e.target.value)} placeholder="Perím." />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="0.01" value={fila.alto || ''} onChange={e => updFila(i, 'alto', e.target.value)} placeholder="Alto" />
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="1" value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {tipo === 'u' && <>
                <input style={{ ...inp, textAlign: 'right' }} type="number" step="1" value={fila.cant || ''} onChange={e => updFila(i, 'cant', e.target.value)} placeholder="Cant" />
              </>}
              {/* Parcial */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: fila.signo === '-' ? 'var(--danger)' : 'var(--accent)', textAlign: 'right', cursor: 'pointer' }}
                title="Click para cambiar signo (+/-)"
                onClick={() => updFila(i, 'signo', fila.signo === '-' ? '+' : '-')}>
                {fila.signo === '-' ? '−' : '+'}{parcial.toFixed(3)}
              </div>
              {/* Eliminar */}
              <button onClick={() => delFila(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}

        {/* Botón agregar fila */}
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
          <button
            className="btn btn-primary"
            onClick={aplicarCantidad}
            disabled={guardando || total <= 0}
            style={{ minWidth: 120 }}>
            {guardando ? '...' : aplicado ? '✓ Aplicado' : `Aplicar ${total.toFixed(2)} ${unidad}`}
          </button>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)' }}>
          Click en el parcial de cada fila para cambiar el signo (+/−) y descontar áreas.
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
