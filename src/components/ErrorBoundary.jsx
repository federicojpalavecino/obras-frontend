import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Red de contención para errores de render.
 *
 * Sin esto, cualquier excepción durante el render desmonta el árbol entero y
 * la app queda literalmente en blanco: el usuario no ve ni un mensaje, y lo
 * único que queda del error es una línea en la consola que nadie va a mirar.
 * Ya pasó una vez — un honorario nulo guardado en un período dejó el Control
 * Financiero inaccesible sin ninguna pista en pantalla.
 *
 * Acá el objetivo no es recuperarse: es que se vea qué pasó y que se pueda
 * salir del módulo roto sin cerrar el navegador.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Error de render:", error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const C = { bg: "#f8f9fa", surface: "#ffffff", border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280", accent: "#059669", red: "#ef4444" };
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "28px 30px", maxWidth: 620, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <AlertTriangle size={22} strokeWidth={1.5} color={C.red} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>Esta pantalla no se pudo dibujar</div>
          </div>
          <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 18 }}>
            Tus datos están a salvo: el error es de la pantalla, no de lo que
            tenés cargado. Si se repite, pasale a soporte el detalle de acá abajo.
          </div>
          <pre style={{ background: "#f1f3f5", border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: C.text, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 20 }}>
            {String(error?.message || error)}
          </pre>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => { window.location.href = "/"; }}
              style={{ padding: "11px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Volver al inicio
            </button>
            <button onClick={() => window.location.reload()}
              style={{ padding: "11px 20px", background: "#f1f3f5", color: C.text, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }
}
