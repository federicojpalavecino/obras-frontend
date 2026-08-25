import { useState, useEffect, useRef } from "react";
import { PlayCircle, X } from "lucide-react";

/* Tutorial en video de una pantalla concreta.

   Va montado donde aparece la duda, no en una seccion de ayuda aparte: el que
   se traba no sale a buscar el manual, se va. Por eso el enlace vive pegado al
   boton que la persona no llego a apretar.

   El mp4 se sirve estatico desde /public y no entra al bundle: recien se baja
   cuando alguien abre el video. Los tutoriales se rearman con
   `node whatsapp/tutorial/render-tutorial.mjs <nombre>`. */

const C = { text: "#1a1a2e", muted: "#6b7280", accent: "#059669" };

export default function VideoTutorial({ archivo, titulo, duracion, variante = "enlace" }) {
  const [abierto, setAbierto] = useState(false);

  // Escape cierra, y mientras esta abierto no se scrollea lo de atras.
  useEffect(() => {
    if (!abierto) return;
    const fn = e => { if (e.key === "Escape") setAbierto(false); };
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", fn);
    return () => { window.removeEventListener("keydown", fn); document.body.style.overflow = previo; };
  }, [abierto]);

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        title={titulo}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "none", border: "none", cursor: "pointer",
          color: C.muted, fontSize: 12.5, fontFamily: "inherit",
          padding: variante === "enlace" ? "8px 4px" : "6px 12px",
        }}
        onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
        onMouseLeave={e => (e.currentTarget.style.color = C.muted)}>
        <PlayCircle size={15} strokeWidth={1.6} />
        ¿Cómo se hace?{duracion ? ` · ${duracion}` : ""}
      </button>

      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(10,14,20,.82)", zIndex: 700,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: "100%", maxWidth: 940, background: "#0d1117",
                     borderRadius: 14, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,.5)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "12px 16px", color: "#fff" }}>
              <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>{titulo}</div>
              <button onClick={() => setAbierto(false)}
                      style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)",
                               cursor: "pointer", display: "flex", padding: 4 }}>
                <X size={19} strokeWidth={1.8} />
              </button>
            </div>
            {/* autoPlay sin sonido: los tutoriales no tienen audio, asi que no
                hay nada que un autoplay pueda arruinar. */}
            <video src={`/tutoriales/${archivo}`} autoPlay muted controls playsInline
                   style={{ display: "block", width: "100%", background: "#000" }} />
          </div>
        </div>
      )}
    </>
  );
}
