import { useState, useEffect, useRef } from 'react';

/**
 * MobileMenu — botón "⋯" que despliega acciones en pantalla chica
 * Props:
 *   actions: [{ label, icon, onClick, color, disabled }]
 *   breakpoint: número en px (default 768)
 */
export default function MobileMenu({ actions = [], breakpoint = 768 }) {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= breakpoint);
  const ref = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!isMobile) return null;

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: open ? 'var(--surface2)' : 'transparent',
          border: '1px solid var(--border2)',
          borderRadius: 6,
          padding: '5px 10px',
          cursor: 'pointer',
          fontSize: 18,
          color: 'var(--text)',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 36,
          minHeight: 32,
        }}
        title="Más opciones"
      >
        ⋯
      </button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 998,
          background: 'rgba(0,0,0,0.3)',
        }} onClick={() => setOpen(false)}>
          <div
            style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              background: 'var(--surface)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 16px 32px',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
              zIndex: 999,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: 40, height: 4, background: 'var(--border2)',
              borderRadius: 2, margin: '0 auto 16px',
            }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actions.map((a, i) => (
                <button
                  key={i}
                  disabled={a.disabled}
                  onClick={() => { a.onClick(); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    background: 'var(--surface2)',
                    border: `1px solid ${a.color ? a.color + '33' : 'var(--border)'}`,
                    borderRadius: 10,
                    cursor: a.disabled ? 'not-allowed' : 'pointer',
                    opacity: a.disabled ? 0.4 : 1,
                    fontSize: 14,
                    fontWeight: 600,
                    color: a.color || 'var(--text)',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {a.icon && <span style={{ fontSize: 18, lineHeight: 1 }}>{a.icon}</span>}
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
