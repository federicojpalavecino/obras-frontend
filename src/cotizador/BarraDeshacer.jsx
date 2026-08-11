// Aviso flotante con el botón "Deshacer".
//
// Aparece al hacer algo reversible y se va solo. El botón importa tanto como el
// Ctrl+Z: en celular no hay teclado, y mucha gente no prueba el atajo si nadie
// le dijo que existe.

import React, { useEffect, useState } from 'react';
import { suscribir, etiquetaUltima } from './deshacer';

export default function BarraDeshacer({ mensaje, onDeshacer, onCerrar, segundos = 7 }) {
  const [hay, setHay] = useState(0);
  useEffect(() => suscribir(setHay), []);

  // Se esconde solo, pero la acción sigue en la pila: Ctrl+Z anda igual después.
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(onCerrar, segundos * 1000);
    return () => clearTimeout(t);
  }, [mensaje, onCerrar, segundos]);

  if (!mensaje) return null;
  const puede = hay > 0;

  return (
    <div role="status" style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#222228', border: '1px solid #3a3a48', borderRadius: 20,
      padding: '9px 10px 9px 18px', display: 'flex', alignItems: 'center', gap: 12,
      fontSize: 13, color: 'var(--text)', zIndex: 500, maxWidth: 'calc(100vw - 32px)',
      boxShadow: '0 8px 28px rgba(0,0,0,.35)',
    }}>
      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mensaje}</span>
      {puede && (
        <button onClick={onDeshacer}
          title={`Deshacer: ${etiquetaUltima() || ''} (Ctrl+Z)`}
          style={{
            background: 'var(--accent)', border: 'none', borderRadius: 14,
            color: '#0f0f11', fontWeight: 700, fontSize: 12, padding: '5px 14px',
            cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}>
          Deshacer
        </button>
      )}
      <button onClick={onCerrar} aria-label="Cerrar aviso" style={{
        background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
        fontSize: 16, lineHeight: 1, padding: '0 4px', flexShrink: 0,
      }}>×</button>
    </div>
  );
}
