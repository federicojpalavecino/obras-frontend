import { useState, useEffect } from "react";

// Cada vez que se publica algo, el navegador que ya tenía la aplicación
// abierta sigue con la versión vieja hasta que alguien recarga a mano. Eso
// termina en "no me aparece lo nuevo" y en media hora buscando un problema que
// no existe. Esto compara cada tanto la versión cargada contra la publicada y,
// si cambió, lo dice.
//
// Create React App deja en `asset-manifest.json` el nombre del bundle, que
// lleva un hash del contenido: si el hash cambió, hay algo nuevo.

export default function AvisoVersion() {
  const [hayOtra, setHayOtra] = useState(false);

  useEffect(() => {
    // El bundle que está corriendo ahora mismo.
    const actual = (() => {
      const s = [...document.getElementsByTagName("script")]
        .map(x => x.src)
        .find(x => /\/static\/js\/main\.[^/]+\.js$/.test(x || ""));
      return s ? s.split("/").pop() : null;
    })();
    if (!actual) return;

    let vivo = true;
    const mirar = async () => {
      if (!vivo || hayOtra || document.hidden) return;
      try {
        const r = await fetch("/asset-manifest.json", { cache: "no-store" });
        if (!r.ok) return;
        const m = await r.json();
        const publicado = (m.files && m.files["main.js"]) || "";
        const nombre = publicado.split("/").pop();
        if (nombre && nombre !== actual) setHayOtra(true);
      } catch (e) {
        // Sin internet o servidor caído: no es asunto de este aviso.
      }
    };

    const cada = setInterval(mirar, 5 * 60 * 1000);
    // Y al volver a la pestaña, que es cuando la gente retoma el trabajo.
    const alVolver = () => { if (!document.hidden) mirar(); };
    document.addEventListener("visibilitychange", alVolver);
    const t = setTimeout(mirar, 15000);

    return () => {
      vivo = false;
      clearInterval(cada);
      clearTimeout(t);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [hayOtra]);

  if (!hayOtra) return null;

  return (
    <div style={{
      position: "fixed", left: 16, bottom: 16, zIndex: 900,
      background: "#1a1a2e", color: "#fff", borderRadius: 12,
      padding: "11px 14px", display: "flex", alignItems: "center", gap: 12,
      fontFamily: "'Syne', sans-serif", fontSize: 13,
      boxShadow: "0 8px 28px rgba(0,0,0,.28)", maxWidth: "calc(100vw - 32px)",
    }}>
      <span>Hay una versión nueva del sistema.</span>
      <button onClick={() => window.location.reload(true)}
        style={{
          background: "#10b981", color: "#fff", border: "none", borderRadius: 8,
          padding: "6px 14px", fontWeight: 700, fontSize: 12.5, cursor: "pointer",
          fontFamily: "inherit", flexShrink: 0,
        }}>
        Actualizar
      </button>
      <button onClick={() => setHayOtra(false)} aria-label="Después"
        style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer",
                 fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
    </div>
  );
}
