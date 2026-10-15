// Pantalla final del tour guiado del demo (ver DemoTour.jsx): un resumen con
// todo lo que se generó en el recorrido — presupuesto, planificación, curva
// de inversión, materiales y certificado — como para que se vea de un
// vistazo todo lo que entrega el sistema, antes de invitar a registrarse.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, BarChart2, TrendingUp, Package, FileCheck, ArrowRight, Clock, MessageCircle, Zap } from 'lucide-react';
import api from '../api';

const C = { bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5", border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280", accent: "#059669", accent2: "#7c3aed", warn: "#d97706", red: "#ef4444" };
const fmt = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");

// Mismo precio promo que la pantalla real post-registro (ver App.js,
// PantallaVentaPostRegistro): $35.000 los primeros 3 meses vs $57.000 base.
const PRECIO_BASE = 57000;
const PRECIO_PROMO = 35000;

const WHATSAPP = "5493625305155";
const WHATSAPP_MSG_DEMO = encodeURIComponent("Hola! Estoy probando la demo de FAIM OBRAS y tengo una consulta.");

// Cuenta regresiva de la promo. Es ficticia a propósito (no hay vencimiento
// real detrás) — el objetivo es transmitir urgencia, no cronometrar nada. Se
// fija una sola vez por navegador para que no "resetee" cada vez que alguien
// entra a la demo de nuevo.
function useCuentaRegresivaPromo() {
  const [restante, setRestante] = useState(null);
  useEffect(() => {
    const KEY = "obras_demo_promo_deadline";
    // localStorage puede fallar (privado estricto, storage bloqueado, cuota
    // llena) — si pasa, la cuenta regresiva sigue andando en memoria nomás,
    // sin persistir entre visitas, en vez de romper toda la pantalla.
    let limite;
    try { limite = Number(localStorage.getItem(KEY) || 0); } catch { limite = 0; }
    if (!limite || limite < Date.now()) {
      limite = Date.now() + 47.5 * 3600 * 1000; // ~2 días
      try { localStorage.setItem(KEY, String(limite)); } catch {}
    }
    const tick = () => {
      const ms = Math.max(0, limite - Date.now());
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setRestante(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return restante;
}

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

// El cuadradito punteado que ocupa el logo del estudio en cada entregable —
// para que quien está probando la demo vea, literalmente, dónde va a
// aparecer SU marca (no la de FAIM OBRAS) en lo que le entrega a su cliente.
function TuLogo({ small }) {
  return (
    <div style={{
      border: `1.5px dashed ${C.border}`, borderRadius: 6, color: "#b0b0c0",
      fontSize: small ? 7.5 : 8.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
      padding: small ? "4px 7px" : "5px 9px", display: "inline-flex", alignItems: "center",
      fontFamily: "'Syne', sans-serif", flexShrink: 0, background: "#fafafc",
    }}>
      Tu logo
    </div>
  );
}

function PapelEntregable({ titulo, caption, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        background: "#fff", borderRadius: 8, padding: 14, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 10px 24px rgba(26,26,46,0.08)",
        border: "1px solid #eceef2", minHeight: 190, display: "flex", flexDirection: "column", gap: 10,
      }}>
        {children}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.text }}>{titulo}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{caption}</div>
      </div>
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
  const restante = useCuentaRegresivaPromo();

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

  // Unas pocas líneas reales para los mini-entregables — no hace falta (ni
  // conviene) mostrar todo, con 3-4 filas representativas alcanza.
  const primerasLineas = (presu?.rubros || []).flatMap(r => r.lineas || []).slice(0, 4);
  const primerasTareas = tareas.slice(0, 4);
  const duracionMax = Math.max(1, ...primerasTareas.map(t => t.duracion_dias || 1));
  const primerosMateriales = (materiales?.materiales || []).slice(0, 4);
  const coloresGantt = [C.accent2, C.warn, C.accent, "#2563eb"];

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 40 }}>
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

        {/* Entregables en formato "documento real" — con el logo del estudio
            donde hoy dice "Tu logo": así se lo manda cada estudio a SU
            cliente, no a FAIM OBRAS. */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: "clamp(17px,3vw,21px)", fontWeight: 800, color: C.text }}>Así se ve en la vida real</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>Con tu logo, tu nombre y tus colores — no los de FAIM OBRAS.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>

            <PapelEntregable titulo="Presupuesto" caption="Listo para imprimir o mandar por mail">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.surface2}` }}>
                <TuLogo />
                <div style={{ fontSize: 9, color: C.muted, textAlign: "right" }}>Presupuesto<br />{presu?.nombre_obra || "Casa"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {primerasLineas.map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 9.5 }}>
                    <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nombre_item || l.nombre_libre}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.muted, flexShrink: 0 }}>{fmt(l.precio_venta_con_iva)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 800 }}>
                <span>TOTAL</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(totalObra)}</span>
              </div>
            </PapelEntregable>

            <PapelEntregable titulo="Planificación" caption="Fechas y dependencias, calculadas solas">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.surface2}` }}>
                <TuLogo />
                <div style={{ fontSize: 9, color: C.muted }}>Diagrama de Gantt</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1, justifyContent: "center" }}>
                {primerasTareas.map((t, i) => (
                  <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 8.5, color: C.muted, width: 56, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
                    <div style={{ flex: 1, height: 9, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(14, (t.duracion_dias || 1) / duracionMax * 100)}%`, background: coloresGantt[i % coloresGantt.length], borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </PapelEntregable>

            <PapelEntregable titulo="Listado de materiales" caption="Para pedirle cotización a tus proveedores">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingBottom: 8, borderBottom: `1px solid ${C.surface2}` }}>
                <TuLogo />
                <div style={{ fontSize: 9, color: C.muted }}>Pedido de materiales</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {primerosMateriales.map(m => (
                  <div key={m.material_id} style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 9.5 }}>
                    <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nombre}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.muted, flexShrink: 0 }}>{m.cantidad_total} {m.unidad}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "auto", paddingTop: 8, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10.5, fontWeight: 800 }}>
                <span>TOTAL</span>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(totalMateriales)}</span>
              </div>
            </PapelEntregable>

          </div>
        </div>

        {/* Promo + cuenta regresiva — mismo precio que la pantalla real
            post-registro (PantallaVentaPostRegistro en App.js). */}
        <div style={{
          background: "#fff", border: `1.5px solid #fecaca`, borderRadius: 16,
          padding: "clamp(18px,3vw,26px)", marginBottom: 18, display: "flex", flexWrap: "wrap",
          alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.red, color: "#fff", fontSize: 11.5, fontWeight: 800, padding: "6px 12px", borderRadius: 20, flexShrink: 0 }}>
              <Zap size={12} strokeWidth={2.5} /> PROMO DE LANZAMIENTO
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.muted }}>
                <span style={{ textDecoration: "line-through" }}>{fmt(PRECIO_BASE)}</span>
                {" "}<strong style={{ color: C.accent, fontSize: 15 }}>{fmt(PRECIO_PROMO)}/mes</strong> los primeros 3 meses · débito automático
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Clock size={15} strokeWidth={2.25} color={C.red} />
            <span style={{ fontSize: 11, color: C.muted }}>Termina en</span>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800, fontSize: 16, color: C.red, minWidth: 68, textAlign: "center" }}>
              {restante || "—"}
            </span>
          </div>
        </div>

        <div style={{ background: `linear-gradient(135deg, ${C.accent} 0%, #047857 100%)`, borderRadius: 18, padding: "clamp(24px,4vw,40px)", textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: "clamp(18px,3vw,24px)", fontWeight: 800, marginBottom: 8 }}>
            Todos estos entregables, en menos de 10 minutos
          </div>
          <div style={{ fontSize: 14, opacity: 0.92, marginBottom: 22, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
            Sumate a FAIM OBRAS y disfrutá de todas las herramientas que las obras necesitan.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <button onClick={onRegistrarme} style={{ background: "#fff", color: C.accent, border: "none", borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Quiero registrarme <ArrowRight size={17} strokeWidth={2.5} />
            </button>
            <a href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_MSG_DEMO}`} target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,0.14)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 10, padding: "14px 24px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <MessageCircle size={17} strokeWidth={2.25} /> Tengo dudas, quiero hablar con alguien
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
