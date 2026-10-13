// Pantalla final del tour guiado del demo (ver DemoTour.jsx): un resumen con
// todo lo que se generó en el recorrido — presupuesto, planificación, curva
// de inversión, materiales y certificado — como para que se vea de un
// vistazo todo lo que entrega el sistema, antes de invitar a registrarse.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, BarChart2, TrendingUp, Package, FileCheck, ArrowRight } from 'lucide-react';
import api from '../api';

const C = { bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5", border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280", accent: "#059669", accent2: "#7c3aed", warn: "#d97706" };
const fmt = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");

function Tarjeta({ icon: Icon, color, titulo, subtitulo, filas, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={18} strokeWidth={1.75} color={color} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{subtitulo}</div>
        </div>
      </div>
      {filas && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filas.map(([label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ color: C.muted }}>{label}</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, color: C.text }}>{val}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

export default function ResumenDemo({ onRegistrarme }) {
  const { id } = useParams();
  const [cargando, setCargando] = useState(true);
  const [presu, setPresu] = useState(null);
  const [tareas, setTareas] = useState([]);
  const [materiales, setMateriales] = useState(null);
  const [certificados, setCertificados] = useState([]);

  useEffect(() => {
    let activo = true;
    Promise.all([
      api.get(`/presupuestos/${id}`).then(r => r.data).catch(() => null),
      api.get(`/presupuestos/${id}/gantt/tareas`).then(r => r.data).catch(() => []),
      api.get(`/presupuestos/${id}/materiales-listado`).then(r => r.data).catch(() => null),
      api.get(`/presupuestos/${id}/certificados`).then(r => r.data?.certificados).catch(() => []),
    ]).then(([p, t, m, c]) => {
      if (!activo) return;
      setPresu(p); setTareas(t || []); setMateriales(m); setCertificados(c || []);
      setCargando(false);
    });
    return () => { activo = false; };
  }, [id]);

  const totalObra = presu?.totales?.total_precio_con_iva || 0;
  const cantItems = presu?.cant_items ?? 0;
  const duracionDias = tareas.length
    ? Math.max(1, Math.round(tareas.reduce((max, t) => Math.max(max, t.duracion_dias || 0), 0)))
    : 0;
  const totalMateriales = materiales?.total_materiales ?? 0;
  const cantMateriales = (materiales?.materiales || []).length;

  if (cargando) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }}>
      Armando el resumen…
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "'Syne', sans-serif" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "clamp(28px,5vw,56px) clamp(16px,4vw,24px)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
            {presu?.nombre_obra || "Tu obra"}
          </div>
          <div style={{ fontSize: "clamp(22px,4vw,30px)", fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
            Todo esto lo armaste en menos de 10 minutos
          </div>
          <div style={{ fontSize: 14, color: C.muted, marginTop: 6, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            Presupuesto, planificación, curva de inversión, materiales y certificación — las cinco herramientas que necesitás para llevar una obra, en un solo lugar.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 32 }}>
          <Tarjeta icon={FileText} color={C.accent2} titulo="Presupuesto" subtitulo="Para el cliente, listo para imprimir"
            filas={[["Ítems", cantItems], ["Total c/IVA", fmt(totalObra)]]} />
          <Tarjeta icon={BarChart2} color={C.warn} titulo="Planificación" subtitulo="Diagrama de Gantt, con fechas y dependencias"
            filas={[["Tareas", tareas.length], ["Duración", duracionDias ? `${duracionDias} días` : "—"]]} />
          <Tarjeta icon={TrendingUp} color={C.accent} titulo="Curva de inversión" subtitulo="Cuánto invertir, mes a mes"
            filas={[["Total a invertir", fmt(totalObra)]]} />
          <Tarjeta icon={Package} color={C.accent2} titulo="Listado de materiales" subtitulo="Para pedir cotizaciones a proveedores"
            filas={[["Materiales", cantMateriales], ["Total", fmt(totalMateriales)]]} />
          <Tarjeta icon={FileCheck} color={C.accent} titulo="Certificado de obra" subtitulo="Avance y cobro por etapas"
            filas={[["Emitidos", certificados.length], ["Estado", certificados.length ? "Al día" : "Listo para emitir"]]} />
        </div>

        <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #047857 100%)`, borderRadius: 18, padding: "clamp(24px,4vw,40px)", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 800, marginBottom: 8 }}>
            Todos estos entregables, en menos de 10 minutos
          </div>
          <div style={{ fontSize: 14, opacity: 0.92, marginBottom: 22, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            Sumate a FAIM OBRAS y disfrutá de todas las herramientas que las obras necesitan.
          </div>
          <button onClick={onRegistrarme} style={{ background: "#fff", color: C.accent, border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}>
            Quiero registrarme <ArrowRight size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
