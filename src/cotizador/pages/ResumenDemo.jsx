// Pantalla final del tour guiado del demo (ver DemoTour.jsx): un resumen con
// todo lo que se generó en el recorrido, los entregables en formato
// "documento real", y la oferta completa — acá es donde se vende la
// suscripción, así que va compacto y sin vueltas.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowRight, Clock, MessageCircle, Zap, TrendingUp, Users, Package, Building2, Calendar } from 'lucide-react';
import api from '../api';

const C = { bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5", border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280", accent: "#059669", accent2: "#7c3aed", warn: "#d97706", red: "#ef4444" };
const fmt = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");

// Mismo precio promo que la pantalla real post-registro (ver App.js,
// PantallaVentaPostRegistro): $35.000 los primeros 3 meses vs $57.000 base.
const PRECIO_BASE = 57000;
const PRECIO_PROMO = 35000;

const WHATSAPP = "5493625548783"; // asistente de WhatsApp (mismo numero del bot)
const WHATSAPP_MSG_DEMO = encodeURIComponent("Hola! Estoy probando la demo de FAIM OBRAS y tengo una consulta.");

// Todo lo que vive en el sistema además del cotizador — para que quien
// prueba la demo (que solo recorrió presupuesto/gantt/materiales/
// certificado) sepa que hay mucho más antes de decidir si se suscribe.
const HERRAMIENTAS = [
  { icon: TrendingUp, label: "Control financiero", desc: "ingresos y egresos, semana a semana" },
  { icon: Users, label: "Personal", desc: "asistencia y jornales" },
  { icon: Package, label: "Pañol y depósito", desc: "herramientas y materiales, por obra" },
  { icon: Building2, label: "Portal del cliente", desc: "con tu logo, sin cargo" },
  { icon: Calendar, label: "Planner", desc: "con Google Calendar" },
  { icon: MessageCircle, label: "Asistente por WhatsApp", desc: "para vos y tu equipo, 24/7" },
];

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

// El cuadradito punteado que ocupa el logo del estudio en cada entregable —
// para que quien está probando la demo vea, literalmente, dónde va a
// aparecer SU marca (no la de FAIM OBRAS) en lo que le entrega a su cliente.
function TuLogo() {
  return (
    <div style={{
      border: `1.5px dashed ${C.border}`, borderRadius: 6, color: "#b0b0c0",
      fontSize: 7.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase",
      padding: "4px 7px", display: "inline-flex", alignItems: "center",
      fontFamily: "'Syne', sans-serif", flexShrink: 0, background: "#fafafc",
    }}>
      Tu logo
    </div>
  );
}

function PapelEntregable({ titulo, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        background: "#fff", borderRadius: 8, padding: 11, boxShadow: "0 1px 2px rgba(0,0,0,0.04), 0 8px 18px rgba(26,26,46,0.08)",
        border: "1px solid #eceef2", minHeight: 165, display: "flex", flexDirection: "column", gap: 7,
      }}>
        {children}
      </div>
      <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: C.text }}>{titulo}</div>
    </div>
  );
}

function CabeceraPapel({ sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, paddingBottom: 6, borderBottom: `1px solid ${C.surface2}` }}>
      <TuLogo />
      <div style={{ fontSize: 8.5, color: C.muted, textAlign: "right", lineHeight: 1.3 }}>{sub}</div>
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
  const totalMateriales = materiales?.total_materiales ?? 0;

  // Unas pocas líneas reales para los mini-entregables — no hace falta (ni
  // conviene) mostrar todo, con 3-4 filas representativas alcanza.
  const primerasLineas = (presu?.rubros || []).flatMap(r => r.lineas || []).slice(0, 4);
  const primerasTareas = tareas.slice(0, 4);
  const duracionMax = Math.max(1, ...primerasTareas.map(t => t.duracion_dias || 1));
  const primerosMateriales = (materiales?.materiales || []).slice(0, 4);
  const coloresBarras = [C.accent2, C.warn, C.accent, "#2563eb"];
  // Curva de inversión: reparto ilustrativo del total proporcional a la
  // duración de cada tarea — mismo criterio que el Gantt, sin pedirle al
  // backend el cálculo real (acá solo hace falta que se vea representativo).
  const barrasCurva = primerasTareas.map(t => Math.max(10, (t.duracion_dias || 1) / duracionMax * 100));
  const ultimoCert = certificados[certificados.length - 1];

  if (cargando) return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 22 }}>
      Armando el resumen…
    </div>
  );

  return (
    <div style={{ minHeight: "100dvh", background: C.bg, fontFamily: "'Syne', sans-serif" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "clamp(22px,4vw,36px) clamp(16px,4vw,24px)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
            {presu?.nombre_obra || "Tu obra"}
          </div>
          <div style={{ fontSize: "clamp(20px,3.6vw,27px)", fontWeight: 800, color: C.text, letterSpacing: "-0.5px" }}>
            Todo esto lo armaste en menos de 10 minutos
          </div>
        </div>

        {/* Entregables en formato "documento real" — con el logo del estudio
            donde hoy dice "Tu logo": así se lo manda cada estudio a SU
            cliente, no a FAIM OBRAS. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))", gap: 12, marginBottom: 20 }}>

          <PapelEntregable titulo="Presupuesto">
            <CabeceraPapel sub={<>Presupuesto<br />{presu?.nombre_obra || "Casa"}</>} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {primerasLineas.map(l => (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 5, fontSize: 9 }}>
                  <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nombre_item || l.nombre_libre}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.muted, flexShrink: 0 }}>{fmt(l.precio_venta_con_iva)}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 6, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800 }}>
              <span>TOTAL</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(totalObra)}</span>
            </div>
          </PapelEntregable>

          <PapelEntregable titulo="Planificación">
            <CabeceraPapel sub="Diagrama de Gantt" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, justifyContent: "center" }}>
              {primerasTareas.map((t, i) => (
                <div key={t.id || i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 7.5, color: C.muted, width: 46, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</span>
                  <div style={{ flex: 1, height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(14, (t.duracion_dias || 1) / duracionMax * 100)}%`, background: coloresBarras[i % coloresBarras.length], borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          </PapelEntregable>

          <PapelEntregable titulo="Curva de inversión">
            <CabeceraPapel sub="Plan de desembolso" />
            <div style={{ display: "flex", alignItems: "flex-end", gap: 5, flex: 1, paddingBottom: 2 }}>
              {barrasCurva.map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, minHeight: 6, background: C.accent2, borderRadius: "3px 3px 0 0", opacity: 0.35 + (i / barrasCurva.length) * 0.5 }} />
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 6, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800 }}>
              <span>TOTAL</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(totalObra)}</span>
            </div>
          </PapelEntregable>

          <PapelEntregable titulo="Materiales">
            <CabeceraPapel sub="Pedido de materiales" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {primerosMateriales.map(m => (
                <div key={m.material_id} style={{ display: "flex", justifyContent: "space-between", gap: 5, fontSize: 9 }}>
                  <span style={{ color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.nombre}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.muted, flexShrink: 0 }}>{m.cantidad_total} {m.unidad}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: "auto", paddingTop: 6, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800 }}>
              <span>TOTAL</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(totalMateriales)}</span>
            </div>
          </PapelEntregable>

          <PapelEntregable titulo="Certificado">
            <CabeceraPapel sub={ultimoCert ? `Certificado N° ${ultimoCert.numero}` : "Certificado de avance"} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace", color: C.accent }}>
                {(ultimoCert?.avance_total_pct ?? 0).toFixed(0)}%
              </div>
              <div style={{ fontSize: 9, color: C.muted }}>avance certificado</div>
            </div>
            <div style={{ marginTop: "auto", paddingTop: 6, borderTop: `1px solid ${C.surface2}`, display: "flex", justifyContent: "space-between", fontSize: 10, fontWeight: 800 }}>
              <span>ESTE PERÍODO</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.accent2 }}>{fmt(ultimoCert?.total_periodo)}</span>
            </div>
          </PapelEntregable>

        </div>

        {/* La oferta — acá se vende, todo junto y sin que haga falta más
            scroll: qué más trae el sistema, precio y los dos CTA. */}
        <div style={{ background: "linear-gradient(160deg, #047857 0%, #059669 55%, #047857 100%)", borderRadius: 18, padding: "clamp(20px,3.5vw,32px)", color: "#fff" }}>

          <div style={{ textAlign: "center", marginBottom: 18 }}>
            <div style={{ fontSize: "clamp(18px,3vw,23px)", fontWeight: 800, marginBottom: 4 }}>
              Esto fue solo el cotizador
            </div>
            <div style={{ fontSize: 13.5, opacity: 0.75, maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
              FAIM OBRAS también incluye todo esto, para llevar la obra de punta a punta:
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 24 }}>
            {HERRAMIENTAS.map(h => (
              <div key={h.label} style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 12px" }}>
                <h.icon size={15} strokeWidth={2} color="#6ee7b7" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 700 }}>{h.label}</div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: 14, padding: "16px 18px", marginBottom: 20, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.red, color: "#fff", fontSize: 11, fontWeight: 800, padding: "5px 11px", borderRadius: 20, flexShrink: 0 }}>
                <Zap size={11} strokeWidth={2.5} /> OFERTA POR TIEMPO LIMITADO
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ textDecoration: "line-through", opacity: 0.55 }}>{fmt(PRECIO_BASE)}</span>
                {" "}<strong style={{ color: "#6ee7b7", fontSize: 16 }}>{fmt(PRECIO_PROMO)}/mes</strong> los primeros 3 meses · débito automático
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <Clock size={14} strokeWidth={2.25} color="#f87171" />
              <span style={{ fontSize: 10.5, opacity: 0.7 }}>Termina en</span>
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 800, fontSize: 15, color: "#f87171", minWidth: 64, textAlign: "center" }}>
                {restante || "—"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <button onClick={onRegistrarme} style={{ background: "#fff", color: "#047857", border: "none", borderRadius: 10, padding: "15px 30px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Quiero registrarme <ArrowRight size={17} strokeWidth={2.5} />
            </button>
            <a href={`https://wa.me/${WHATSAPP}?text=${WHATSAPP_MSG_DEMO}`} target="_blank" rel="noreferrer"
              style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 10, padding: "15px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Syne', sans-serif", display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              <MessageCircle size={16} strokeWidth={2.25} /> Tengo dudas, quiero hablar con alguien
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
