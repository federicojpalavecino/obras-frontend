// El control Z del sistema.
//
// Todo lo que se borra queda guardado unos minutos. Este componente pregunta si
// hay algo para deshacer y, si hay, ofrece el botón. No vive en ninguna pantalla
// en particular: escucha el evento `faim:borrado` que dispara quien borró, y
// también chequea al montar, para que el botón siga estando después de recargar.
//
// Por qué un solo lugar y no un "Deshacer" en cada pantalla: el arrepentimiento
// no distingue módulos. Si borraste un ítem del presupuesto y te fuiste a la
// obra, el botón te sigue.
import { useState, useEffect, useCallback } from "react";
import { RotateCcw, X } from "lucide-react";
import api from "../cotizador/api";

const C = {
  surface: "#1a1a2e", texto: "#ffffff", muted: "#b9bdcc", accent: "#10b981",
};

export default function Deshacer() {
  const [hay, setHay] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState("");

  const mirar = useCallback(async () => {
    // El portal del cliente no borra nada y no tiene por qué preguntar.
    if (localStorage.getItem("obras_cliente")) return;
    if (!localStorage.getItem("obras_token")) return;
    try {
      const r = await api.get("/deshacer");
      setHay(r.data?.hay ? r.data : null);
    } catch { setHay(null); }
  }, []);

  useEffect(() => {
    mirar();
    const alBorrar = () => mirar();
    window.addEventListener("faim:borrado", alBorrar);
    return () => window.removeEventListener("faim:borrado", alBorrar);
  }, [mirar]);

  // Ctrl+Z / Cmd+Z, salvo cuando estás escribiendo en un campo.
  useEffect(() => {
    const tecla = (e) => {
      if (!(e.key === "z" || e.key === "Z") || !(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      const t = e.target;
      const escribiendo = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (escribiendo) return;
      if (!hay) return;
      e.preventDefault();
      deshacer();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  const deshacer = async () => {
    if (!hay || ocupado) return;
    setOcupado(true);
    try {
      const r = await api.post("/deshacer", { id: hay.id });
      setMsg(`✓ Volvió: ${r.data?.etiqueta || "lo borrado"}`);
      setHay(null);
      // Quien esté mirando la pantalla que recargue lo suyo.
      window.dispatchEvent(new CustomEvent("faim:deshecho", { detail: r.data }));
      setTimeout(() => setMsg(""), 4000);
    } catch (e) {
      setMsg("No se pudo deshacer: " + (e.response?.data?.detail || "probá de nuevo"));
      setTimeout(() => setMsg(""), 5000);
    }
    setOcupado(false);
  };

  if (!hay && !msg) return null;

  return (
    <div style={{
      position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 22, zIndex: 900,
      display: "flex", alignItems: "center", gap: 12, maxWidth: "calc(100vw - 32px)",
      background: C.surface, color: C.texto, borderRadius: 12, padding: "11px 14px",
      boxShadow: "0 8px 30px rgba(0,0,0,.32)", fontFamily: "'Syne', sans-serif", fontSize: 13.5,
    }}>
      {msg ? (
        <span style={{ color: msg.startsWith("✓") ? C.accent : "#fca5a5" }}>{msg}</span>
      ) : (
        <>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Borraste <b>{hay.etiqueta}</b>
          </span>
          <button onClick={deshacer} disabled={ocupado}
            style={{
              display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
              padding: "6px 13px", borderRadius: 8, border: "none",
              cursor: ocupado ? "not-allowed" : "pointer", fontFamily: "inherit",
              fontSize: 13, fontWeight: 700, background: C.accent, color: "#06281e",
            }}>
            <RotateCcw size={14} strokeWidth={2.2} />
            {ocupado ? "Volviendo…" : "Deshacer"}
          </button>
          <button onClick={() => setHay(null)} aria-label="Cerrar"
            style={{
              display: "flex", flexShrink: 0, padding: 3, borderRadius: 6, border: "none",
              background: "transparent", color: C.muted, cursor: "pointer",
            }}>
            <X size={15} strokeWidth={2} />
          </button>
        </>
      )}
    </div>
  );
}
