import { useState, useEffect, useRef } from "react";
import { MoreHorizontal } from "lucide-react";

/**
 * MenuAcciones — botón "⋯ Acciones" que abre un bottom-sheet con opciones.
 * Pensado para mobile, donde no queremos botones que se apilen o scrolleen.
 * Props:
 *   acciones: [{ label, icon, onClick, color }]
 *   C: paleta de colores { surface, surface2, border, border2, text }
 *   label: texto del botón (default "Acciones")
 */
export default function MenuAcciones({ acciones = [], C = {}, label = "Acciones" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const col = {
    surface: C.surface || "#ffffff",
    surface2: C.surface2 || "#f1f3f5",
    border: C.border || "#e0e0e8",
    border2: C.border2 || "#d0d0dc",
    text: C.text || "#1a1a2e",
  };
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ background: open ? col.surface2 : "transparent", border: `1px solid ${col.border2}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: col.text, display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600, fontFamily: "inherit", whiteSpace: "nowrap" }}>
        <MoreHorizontal size={16} /> {label}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(0,0,0,0.3)" }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                        background: col.surface, borderRadius: "16px 16px 0 0", padding: "16px 16px 32px",
                        maxHeight: "85dvh", overflowY: "auto", WebkitOverflowScrolling: "touch",
                        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ width: 40, height: 4, background: col.border2, borderRadius: 2, margin: "0 auto 16px" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {acciones.map((a, i) => (
                <button key={i} disabled={a.disabled} onClick={() => { a.onClick(); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: col.surface2, border: `1px solid ${(a.color || col.border) + "44"}`, borderRadius: 10, cursor: a.disabled ? "not-allowed" : "pointer", opacity: a.disabled ? 0.4 : 1, fontSize: 14, fontWeight: 600, color: a.color || col.text, fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                  {a.icon && <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>{a.icon}</span>}
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
