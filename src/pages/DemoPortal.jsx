// Demo pública del portal de clientes — faimobras.com/demo-portal
// Es el link que se le manda a un estudio que está evaluando el sistema para que
// vea, sin registrarse, exactamente lo que va a ver su cliente.
//
// No pega contra la API: todos los datos son ficticios y viven en este archivo.
// La UI es la misma que ClientePortal.jsx (mismas tarjetas, tabs y tipografías),
// así que si cambia el portal real conviene reflejar el cambio acá también.
import React, { useState } from "react";
import { FileText, Check } from "lucide-react";

const fmt = (n) => n != null ? "$ " + Math.round(n || 0).toLocaleString("es-AR") : "—";
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

// El estudio de la demo es inventado a propósito: el color y el nombre están acá
// para mostrarle al prospecto que el portal sale con SU marca, no con la nuestra.
const ESTUDIO = { nombre: "ROVIRA + ASOCIADOS", color: "#0f766e" };
const WHATSAPP = "5493482305155";
const WHATSAPP_MSG = encodeURIComponent("Hola, vi la demo del portal de clientes y quiero coordinar una demo de FAIM OBRAS.");

// ── Planos de muestra ────────────────────────────────────────────────────────
// Van como SVG embebido para que el visor funcione sin subir archivos ni pegarle
// a un storage: el navegador los abre igual que a un PDF real.
const plano = (titulo, cuerpo) => "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 560" font-family="monospace">
    <rect width="800" height="560" fill="#fff"/>
    <rect x="18" y="18" width="764" height="524" fill="none" stroke="#1a1a2e" stroke-width="2"/>
    ${cuerpo}
    <rect x="540" y="452" width="224" height="72" fill="none" stroke="#1a1a2e" stroke-width="1.5"/>
    <text x="552" y="476" font-size="13" font-weight="bold" fill="#1a1a2e">${titulo}</text>
    <text x="552" y="496" font-size="10" fill="#6b7280">ROVIRA + ASOCIADOS</text>
    <text x="552" y="512" font-size="10" fill="#6b7280">Esc 1:100 · Obra Los Álamos</text>
  </svg>`
);

const PLANO_PLANTA = plano("PL-01 · PLANTA GENERAL", `
  <g stroke="#1a1a2e" stroke-width="3" fill="none">
    <rect x="70" y="70" width="420" height="330"/>
    <line x1="270" y1="70" x2="270" y2="250"/><line x1="70" y1="250" x2="490" y2="250"/>
    <line x1="380" y1="250" x2="380" y2="400"/>
  </g>
  <g stroke="#9ca3af" stroke-width="1.4" fill="none">
    <path d="M150 250 A40 40 0 0 1 190 210"/><path d="M300 250 A38 38 0 0 0 338 288"/>
  </g>
  <g font-size="11" fill="#6b7280">
    <text x="120" y="160">ESTAR / COMEDOR</text><text x="120" y="176">32.40 m²</text>
    <text x="315" y="160">COCINA</text><text x="315" y="176">11.80 m²</text>
    <text x="110" y="330">DORM 1</text><text x="110" y="346">14.20 m²</text>
    <text x="410" y="330">BAÑO</text>
  </g>
  <g stroke="#9ca3af" stroke-width="1">
    <line x1="70" y1="430" x2="490" y2="430"/><line x1="70" y1="424" x2="70" y2="436"/><line x1="490" y1="424" x2="490" y2="436"/>
  </g>
  <text x="255" y="448" font-size="11" fill="#6b7280" text-anchor="middle">14.00</text>`);

const PLANO_CORTES = plano("PL-02 · CORTES A-A / B-B", `
  <g stroke="#1a1a2e" stroke-width="3" fill="none">
    <path d="M70 300 L70 150 L280 80 L490 150 L490 300 Z"/>
    <line x1="70" y1="300" x2="490" y2="300"/>
  </g>
  <g stroke="#9ca3af" stroke-width="1.4" fill="none">
    <rect x="130" y="190" width="70" height="60"/><rect x="360" y="190" width="70" height="60"/>
    <line x1="70" y1="150" x2="490" y2="150" stroke-dasharray="6 4"/>
  </g>
  <g font-size="11" fill="#6b7280">
    <text x="105" y="330">N.P.T. ± 0.00</text><text x="500" y="155">Nivel cielorraso +2.60</text>
    <text x="240" y="120">Cubierta chapa s/ estructura metálica</text>
  </g>`);

const PLANO_ELECTRICA = plano("IE-01 · INSTALACIÓN ELÉCTRICA", `
  <g stroke="#1a1a2e" stroke-width="2.4" fill="none"><rect x="70" y="70" width="420" height="330"/>
    <line x1="270" y1="70" x2="270" y2="250"/><line x1="70" y1="250" x2="490" y2="250"/></g>
  <g stroke="#0f766e" stroke-width="1.6" fill="none" stroke-dasharray="7 5">
    <path d="M110 380 L110 200 L250 200 L250 110"/><path d="M110 200 L330 200 L330 130"/>
    <path d="M250 200 L420 200 L420 330"/>
  </g>
  <g fill="#0f766e">
    <circle cx="250" cy="110" r="7"/><circle cx="330" cy="130" r="7"/><circle cx="420" cy="330" r="7"/>
    <rect x="100" y="374" width="20" height="14"/>
  </g>
  <g font-size="11" fill="#6b7280">
    <text x="132" y="386">TABLERO SECCIONAL</text><text x="264" y="106">CIRC. IUG 1</text><text x="434" y="334">TUG 3</text>
  </g>`);

// ── Datos de la demo ─────────────────────────────────────────────────────────
const OBRAS = [
  {
    id: 1,
    nombre_obra: "Vivienda Los Álamos",
    ubicacion: "Resistencia, Chaco · 210 m² cubiertos",
    total_precio_con_iva: 148500000,
    certificados: [
      { id: 1, numero: 1, fecha: "2026-03-15", avance_total_pct: 18.0, total_periodo: 26730000, monto_acumulado: 26730000 },
      { id: 2, numero: 2, fecha: "2026-04-15", avance_total_pct: 34.5, total_periodo: 24502500, monto_acumulado: 51232500 },
      { id: 3, numero: 3, fecha: "2026-05-15", avance_total_pct: 48.2, total_periodo: 20344500, monto_acumulado: 71577000 },
      { id: 4, numero: 4, fecha: "2026-06-15", avance_total_pct: 62.4, total_periodo: 21087000, monto_acumulado: 92664000 },
    ],
    cobros: [
      { id: 1, fecha: "2026-02-20", forma_pago: "Transferencia", referencia: "Anticipo 15%", monto: 22275000 },
      { id: 2, fecha: "2026-03-22", forma_pago: "Transferencia", referencia: "Cert. Nº 1", monto: 26730000 },
      { id: 3, fecha: "2026-04-24", forma_pago: "Cheque diferido", referencia: "Cert. Nº 2", nota: "30 días", monto: 24502500 },
      { id: 4, fecha: "2026-05-21", forma_pago: "Transferencia", referencia: "Cert. Nº 3 (parcial)", monto: 15000000 },
    ],
    contrato: {
      estado: "aceptado", aceptado_en: "2026-02-12T14:20:00", monto_total: 148500000,
      tipo_pago: "mixto", anticipo_pct: 15, plazo_obra_dias: 240,
      lugar_ejecucion: "Resistencia, Chaco", fecha_firma: "2026-02-12",
      clausulas_adicionales: "Los precios se redeterminan por índice CAC cuando la variación acumulada supera el 8%.\nEl comitente provee la conexión de agua y energía de obra.",
      desembolsos: [
        { id: 1, numero: 1, descripcion: "Anticipo de obra", fecha_vencimiento: "2026-02-20", monto: 22275000, estado: "cobrado" },
        { id: 2, numero: 2, descripcion: "Contra certificado Nº 1", fecha_vencimiento: "2026-03-25", monto: 26730000, estado: "cobrado" },
        { id: 3, numero: 3, descripcion: "Contra certificado Nº 2", fecha_vencimiento: "2026-04-25", monto: 24502500, estado: "cobrado" },
        { id: 4, numero: 4, descripcion: "Contra certificado Nº 3", fecha_vencimiento: "2026-05-25", monto: 20344500, estado: "pendiente" },
      ],
    },
    etapas: {
      total_pactado: 148500000, total_devengado: 92664000, total_cobrado: 88507500,
      etapas: [
        { numero: 1, descripcion: "Anticipo, replanteo y movimiento de suelos", monto: 22275000, avance_pct: 100, estado: "cumplida", saldo: 0, fecha_real: "2026-02-28" },
        { numero: 2, descripcion: "Fundaciones y estructura de hormigón", monto: 37125000, avance_pct: 100, estado: "cumplida", saldo: 0, fecha_real: "2026-04-10" },
        { numero: 3, descripcion: "Mampostería, cubierta y contrapisos", monto: 33264000, avance_pct: 100, estado: "cumplida", saldo: 4156500, fecha_real: "2026-06-08" },
        { numero: 4, descripcion: "Instalaciones sanitaria, eléctrica y de gas", monto: 29700000, avance_pct: 0, estado: "en curso", saldo: 29700000, fecha_vencimiento: "2026-08-30" },
        { numero: 5, descripcion: "Terminaciones, aberturas y pintura", monto: 26136000, avance_pct: 0, estado: "pendiente", saldo: 26136000, fecha_vencimiento: "2026-10-15" },
      ],
    },
    planos: [
      { id: 1, nombre: "PL-01 Planta general", bytes: 1834000, created_at: "2026-02-14", mime: "image/svg+xml", url: PLANO_PLANTA },
      { id: 2, nombre: "PL-02 Cortes A-A y B-B", bytes: 1420000, created_at: "2026-02-14", mime: "image/svg+xml", url: PLANO_CORTES },
      { id: 3, nombre: "IE-01 Instalación eléctrica", bytes: 2210000, created_at: "2026-05-02", mime: "image/svg+xml", url: PLANO_ELECTRICA },
    ],
    gantt: [
      { nombre: "Replanteo y movimiento de suelos", fecha_inicio: "2026-02-17", duracion_dias: 12, color: "#0f766e" },
      { nombre: "Fundaciones", fecha_inicio: "2026-03-02", duracion_dias: 26, color: "#0f766e" },
      { nombre: "Estructura de hormigón", fecha_inicio: "2026-03-25", duracion_dias: 34, color: "#7c3aed" },
      { nombre: "Mampostería", fecha_inicio: "2026-04-27", duracion_dias: 30, color: "#7c3aed" },
      { nombre: "Cubierta", fecha_inicio: "2026-05-25", duracion_dias: 18, color: "#d97706" },
      { nombre: "Instalaciones", fecha_inicio: "2026-06-10", duracion_dias: 45, color: "#d97706" },
      { nombre: "Terminaciones y pintura", fecha_inicio: "2026-07-20", duracion_dias: 60, color: "#3b82f6" },
    ],
    comentarios: [
      { nombre: "Laura Benítez", texto: "¿La cubierta se empieza esta semana o pasa para la que viene?", created_at: "2026-05-20T10:12:00" },
      { nombre: "Estudio", es_admin: true, texto: "Arranca el jueves. Ya está la chapa en obra y el equipo de montaje confirmado.", created_at: "2026-05-20T15:40:00" },
      { nombre: "Laura Benítez", texto: "Perfecto. Aviso en casa así dejamos libre el acceso de atrás.", created_at: "2026-05-20T18:02:00" },
    ],
  },
  {
    id: 2,
    nombre_obra: "Local comercial San Martín 480",
    ubicacion: "Corrientes Capital · 96 m²",
    total_precio_con_iva: 41800000,
    certificados: [
      { id: 5, numero: 1, fecha: "2026-06-05", avance_total_pct: 20.0, total_periodo: 8360000, monto_acumulado: 8360000 },
    ],
    cobros: [
      { id: 5, fecha: "2026-05-28", forma_pago: "Transferencia", referencia: "Anticipo", monto: 8360000 },
    ],
    // Queda en "enviado" a propósito: es el estado en el que el cliente todavía
    // tiene que apretar "Aceptar contrato", que es lo que se quiere mostrar.
    contrato: {
      estado: "enviado", monto_total: 41800000, tipo_pago: "por_certificado",
      anticipo_pct: 20, plazo_obra_dias: 120, lugar_ejecucion: "Corrientes Capital",
      fecha_firma: "2026-05-26",
      clausulas_adicionales: "El plazo se cuenta desde la entrega del local libre de ocupantes y con energía disponible.",
      desembolsos: [
        { id: 6, numero: 1, descripcion: "Anticipo de obra", fecha_vencimiento: "2026-05-28", monto: 8360000, estado: "cobrado" },
        { id: 7, numero: 2, descripcion: "Contra certificado Nº 1", fecha_vencimiento: "2026-06-30", monto: 12540000, estado: "pendiente" },
      ],
    },
    etapas: { total_pactado: 41800000, total_devengado: 8360000, total_cobrado: 8360000, etapas: [
      { numero: 1, descripcion: "Demolición y retiro de escombros", monto: 8360000, avance_pct: 100, estado: "cumplida", saldo: 0, fecha_real: "2026-06-04" },
      { numero: 2, descripcion: "Tabiquería, cielorraso y pisos", monto: 18810000, avance_pct: 0, estado: "en curso", saldo: 18810000, fecha_vencimiento: "2026-07-25" },
      { numero: 3, descripcion: "Frente, vidriera y terminaciones", monto: 14630000, avance_pct: 0, estado: "pendiente", saldo: 14630000, fecha_vencimiento: "2026-09-10" },
    ]},
    planos: [],
    gantt: [
      { nombre: "Demolición", fecha_inicio: "2026-05-28", duracion_dias: 8, color: "#0f766e" },
      { nombre: "Tabiquería y cielorraso", fecha_inicio: "2026-06-08", duracion_dias: 25, color: "#7c3aed" },
      { nombre: "Pisos y revestimientos", fecha_inicio: "2026-07-01", duracion_dias: 20, color: "#d97706" },
      { nombre: "Frente y vidriera", fecha_inicio: "2026-07-20", duracion_dias: 22, color: "#3b82f6" },
    ],
    comentarios: [],
  },
];

// ── Componentes visuales (copiados del portal real) ──────────────────────────
function TortaAvance({ pct, size = 120, color }) {
  const r = 46, cx = 60, cy = 60;
  const p = Math.min(100, Math.max(0, pct));
  const rad = (p / 100) * 2 * Math.PI;
  const x = cx + r * Math.sin(rad), y = cy - r * Math.cos(rad);
  const large = p > 50 ? 1 : 0;
  const path = p >= 100
    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
    : `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="#f1f3f5" />
      {p > 0 && <path d={path} fill={color} opacity={0.85} />}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={color}>{p.toFixed(0)}%</text>
    </svg>
  );
}

function GanttReadonly({ tareas }) {
  if (!tareas.length) return <div style={{ color: "#6b7280", fontSize: 13, padding: 20 }}>Sin planificación cargada</div>;
  const fechas = tareas.map(t => new Date(t.fecha_inicio + "T12:00:00"));
  const fechasFin = tareas.map(t => { const fi = new Date(t.fecha_inicio + "T12:00:00"); fi.setDate(fi.getDate() + (t.duracion_dias || 1)); return fi; });
  const minDate = new Date(Math.min(...fechas)), maxDate = new Date(Math.max(...fechasFin));
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000) + 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{minDate.toLocaleDateString("es-AR")} → {maxDate.toLocaleDateString("es-AR")}</div>
      {tareas.map((t, i) => {
        const start = new Date(t.fecha_inicio + "T12:00:00");
        const left = Math.max(0, Math.ceil((start - minDate) / 86400000) / totalDays * 100);
        const width = Math.max(1, (t.duracion_dias || 1)) / totalDays * 100;
        return (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#1a1a2e", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</div>
            <div style={{ height: 20, background: "#f1f3f5", borderRadius: 4, position: "relative", border: "1px solid #e0e0e8" }}>
              <div style={{ position: "absolute", left: left + "%", width: width + "%", height: "100%", borderRadius: 3, background: t.color || "#7c3aed", opacity: 0.85, minWidth: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Barra fija de arriba. Es lo único que el cliente real no ve: acá está para
// avisar que es una demo y para que el prospecto tenga el contacto a mano.
function BarraDemo() {
  return (
    <div style={{ background: "#0e1411", color: "#eef3f0", padding: "9px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", fontFamily: "'Syne', sans-serif", fontSize: 13 }}>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "#0f766e", background: "#0f766e18", border: "1px solid #0f766e55", borderRadius: 20, padding: "3px 10px" }}>Demo</span>
      <span style={{ color: "#8fa79b" }}>
        Así ve tu cliente su obra. Los datos son de ejemplo — el portal sale con <strong style={{ color: "#eef3f0" }}>tu nombre, tu logo y tus colores</strong>.
      </span>
      <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <a href={"https://wa.me/" + WHATSAPP + "?text=" + WHATSAPP_MSG} target="_blank" rel="noreferrer"
          style={{ background: "#059669", color: "#fff", textDecoration: "none", padding: "6px 14px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
          Coordinar una demo →
        </a>
        <a href="/presentacion" style={{ color: "#8fa79b", textDecoration: "none", fontSize: 13, borderBottom: "1px solid #24322b" }}>Ver el sistema completo</a>
      </span>
    </div>
  );
}

export default function DemoPortal() {
  const [obraId, setObraId] = useState(OBRAS[0].id);
  const [tab, setTab] = useState("avance");
  const [verPlano, setVerPlano] = useState(null);
  const [toast, setToast] = useState("");
  const [nuevoComentario, setNuevoComentario] = useState("");
  // Lo que el visitante hace en la demo se guarda sólo en memoria, por obra.
  const [extras, setExtras] = useState({});       // comentarios agregados
  const [aceptados, setAceptados] = useState({}); // contratos aceptados

  const obra = OBRAS.find(o => o.id === obraId);
  const tenantColor = ESTUDIO.color;
  const clienteNombre = "Laura Benítez";

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const certs = obra.certificados;
  const cobros = obra.cobros;
  const etapas = obra.etapas;
  const planos = obra.planos;
  const comentarios = [...obra.comentarios, ...(extras[obra.id] || [])];
  const contrato = aceptados[obra.id]
    ? { ...obra.contrato, estado: "aceptado", aceptado_en: aceptados[obra.id] }
    : obra.contrato;

  const ultimoCert = certs.length > 0 ? certs[certs.length - 1] : null;
  const avancePct = ultimoCert ? parseFloat(ultimoCert.avance_total_pct || 0) : 0;
  const totalCobrado = cobros.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const totalCertificado = parseFloat(ultimoCert?.monto_acumulado || 0);
  const saldoPendiente = totalCertificado - totalCobrado;

  const enviarComentario = () => {
    if (!nuevoComentario.trim()) return;
    const mio = { nombre: clienteNombre, texto: nuevoComentario.trim(), created_at: new Date().toISOString() };
    setExtras(p => ({ ...p, [obra.id]: [...(p[obra.id] || []), mio] }));
    setNuevoComentario("");
    showToast("✓ Mensaje enviado");
    // En el portal real el estudio contesta desde su panel; acá simulamos la
    // respuesta para que se entienda que la conversación es de ida y vuelta.
    setTimeout(() => {
      setExtras(p => ({ ...p, [obra.id]: [...(p[obra.id] || []), {
        nombre: "Estudio", es_admin: true, created_at: new Date().toISOString(),
        texto: "Recibido. Te respondemos en el día. (En el portal real esta respuesta la escribe el estudio desde su panel.)",
      }] }));
    }, 1600);
  };

  const aceptarContrato = () => {
    setAceptados(p => ({ ...p, [obra.id]: new Date().toISOString() }));
    showToast("✓ Contrato aceptado correctamente");
  };

  const card = { background: "#fff", border: "1px solid #e0e0e8", borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "#f1f3f5", border: "1px solid #e0e0e8", borderRadius: 8, color: "#1a1a2e", fontSize: 13, fontFamily: "inherit", outline: "none" };

  const TABS = [
    { id: "avance", label: "Avance" },
    { id: "etapas", label: "Etapas" },
    { id: "planos", label: "Planos" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#f8f9fa", fontFamily: "'Syne', sans-serif", color: "#1a1a2e" }}>
      <BarraDemo />

      {/* Header — en el portal real acá va el logo del estudio */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 18, fontWeight: 900, color: tenantColor }}>{ESTUDIO.nombre}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{clienteNombre}</span>
          <button onClick={() => showToast("En el portal real, acá cierra la sesión del cliente")} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Salir</button>
        </div>
      </div>

      {/* Selector de obra */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {OBRAS.map(p => (
          <button key={p.id} onClick={() => setObraId(p.id)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${obraId === p.id ? tenantColor : "#e0e0e8"}`, background: obraId === p.id ? tenantColor + "12" : "transparent", color: obraId === p.id ? tenantColor : "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            {p.nombre_obra}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", display: "flex", padding: "0 20px", overflowX: "auto" }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? tenantColor : "transparent"}`, color: tab === id ? tenantColor : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Nota de contexto para el estudio que está mirando la demo */}
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "14px 16px 0" }}>
        <div style={{ background: "#fff", border: "1px dashed #d0d0dc", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#6b7280" }}>
          Cada sección se prende o se apaga por cliente desde <strong style={{ color: "#1a1a2e" }}>Accesos de clientes</strong>. Si no querés
          que vea la cuenta corriente, no la ve.
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "14px 16px 60px" }}>
        {/* ── AVANCE ── */}
        {tab === "avance" && (
          <>
            <div style={{ ...card, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <TortaAvance pct={avancePct} color={tenantColor} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{obra.nombre_obra}</div>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{obra.ubicacion}</div>
                <div style={{ fontSize: 13, marginBottom: 4 }}><span style={{ color: "#6b7280" }}>Avance: </span><span style={{ fontWeight: 700, color: tenantColor }}>{avancePct.toFixed(1)}%</span></div>
                <div style={{ fontSize: 13 }}><span style={{ color: "#6b7280" }}>Presupuesto: </span><span style={{ fontWeight: 700 }}>{fmt(obra.total_precio_con_iva)}</span></div>
              </div>
            </div>

            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Certificados de avance</div>
              {certs.map(cert => (
                <div key={cert.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f3f5" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Certificado Nº {cert.numero}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(cert.fecha)} · {parseFloat(cert.avance_total_pct || 0).toFixed(1)}% avance</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: tenantColor }}>{fmt(cert.total_periodo)}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Acum: {fmt(cert.monto_acumulado)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── ETAPAS ── */}
        {tab === "etapas" && (
          <>
            <div style={{ ...card, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
              {[["Pactado", etapas.total_pactado, "#1a1a2e"],
                ["Cumplido", etapas.total_devengado, tenantColor],
                ["Pagaste", etapas.total_cobrado, "#059669"]].map(([l, v, col]) => (
                <div key={l}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 5 }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: col, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(v || 0)}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              {etapas.etapas.map(e => (
                <div key={e.numero} style={{ padding: "12px 0", borderBottom: "1px solid #f1f3f5" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "baseline" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Etapa {e.numero}</div>
                      <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>{e.descripcion}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(e.monto)}</div>
                      <div style={{ fontSize: 11, color: e.saldo > 0 ? "#d97706" : "#059669" }}>
                        {e.saldo > 0 ? `Falta pagar ${fmt(e.saldo)}` : "Pagada"}
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 8, background: "#f1f3f5", borderRadius: 4, overflow: "hidden", marginTop: 9 }}>
                    <div style={{ height: "100%", width: `${Math.min(100, e.avance_pct || 0)}%`, background: tenantColor, borderRadius: 4, transition: "width .5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11, color: "#6b7280" }}>
                    <span>{Number(e.avance_pct || 0).toFixed(0)}% · {e.estado}</span>
                    <span>{e.fecha_real ? `Cumplida ${fmtDate(e.fecha_real)}` : e.fecha_vencimiento ? `Prevista ${fmtDate(e.fecha_vencimiento)}` : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PLANOS ── */}
        {tab === "planos" && (
          planos.length === 0 ? (
            <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 48 }}>
              Todavía no hay planos publicados para esta obra.
            </div>
          ) : (
            <div style={card}>
              {planos.map(a => (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "12px 0", borderBottom: "1px solid #f1f3f5", alignItems: "center" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{(a.bytes / 1024 / 1024).toFixed(1)} MB · {a.created_at}</div>
                  </div>
                  <button onClick={() => setVerPlano(a)}
                    style={{ padding: "6px 14px", background: "none", border: `1px solid ${tenantColor}`, borderRadius: 8, fontSize: 12.5, color: tenantColor, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    Ver
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── CONTRATO ── */}
        {tab === "contrato" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Contrato de obra</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{obra.nombre_obra}</div>
              </div>
              <div style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", background: contrato.estado === "aceptado" ? "#f0fdf4" : "#fffbeb", color: contrato.estado === "aceptado" ? "#059669" : "#d97706" }}>
                {contrato.estado === "aceptado"
                  ? <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Check size={12} strokeWidth={2.5} /> Aceptado</span>
                  : "Pendiente de aceptación"}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                ["Monto total", fmt(contrato.monto_total)],
                ["Forma de pago", contrato.tipo_pago === "por_certificado" ? "Por certificado" : contrato.tipo_pago === "desembolsos" ? "Por desembolsos" : "Mixto"],
                ["Anticipo", contrato.anticipo_pct ? `${contrato.anticipo_pct}%` : "Sin anticipo"],
                ["Plazo", `${contrato.plazo_obra_dias} días`],
                ["Lugar", contrato.lugar_ejecucion],
                ["Fecha de firma", fmtDate(contrato.fecha_firma)],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8f9fa", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Cláusulas adicionales</div>
              <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{contrato.clausulas_adicionales}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>Calendario de pagos</div>
              {contrato.desembolsos.map(d => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #f1f3f5", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Cuota {d.numero}</span>
                    <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{d.descripcion}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(d.fecha_vencimiento)}</span>
                    <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(d.monto)}</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: d.estado === "cobrado" ? "#f0fdf4" : "#fef3c7", color: d.estado === "cobrado" ? "#059669" : "#d97706" }}>{d.estado}</span>
                  </div>
                </div>
              ))}
            </div>

            {contrato.estado !== "aceptado" ? (
              <div style={{ marginTop: 16, padding: 16, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, textAlign: "center" }}>
                <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                  Al aceptar este contrato confirmás que leíste y acordás con los términos indicados.
                </div>
                <button onClick={aceptarContrato} style={{ padding: "10px 24px", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Check size={13} strokeWidth={2.5} /> Aceptar contrato</span>
                </button>
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 10 }}>Probalo: en el sistema real te queda la aceptación con fecha y hora.</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#059669", textAlign: "center", marginTop: 8 }}>
                Aceptado el {new Date(contrato.aceptado_en).toLocaleDateString("es-AR")}
              </div>
            )}
          </div>
        )}

        {/* ── CUENTA CORRIENTE ── */}
        {tab === "cobros" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
              {[
                ["Certificado acumulado", fmt(totalCertificado), "#7c3aed"],
                ["Cobrado", fmt(totalCobrado), "#059669"],
                ["Saldo pendiente", fmt(saldoPendiente), saldoPendiente > 0 ? "#ef4444" : "#059669"],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background: "#fff", border: "1px solid #e0e0e8", borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'IBM Plex Mono',monospace" }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Historial de cobros</div>
              {cobros.map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f3f5" }}>
                  <div>
                    <div style={{ fontSize: 13 }}>{c.forma_pago}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(c.fecha)} {c.referencia ? `· ${c.referencia}` : ""} {c.nota ? `· ${c.nota}` : ""}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: "#059669", fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── GANTT ── */}
        {tab === "gantt" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Planificación</div>
            <GanttReadonly tareas={obra.gantt} />
          </div>
        )}

        {/* ── CONSULTAS ── */}
        {tab === "consultas" && (
          <div style={card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Consultas y mensajes</div>
            {comentarios.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>Sin mensajes todavía. Escribí tu consulta abajo.</div>}
            <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 16 }}>
              {comentarios.map((com, i) => (
                <div key={i} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: com.es_admin ? "#f1f3f5" : tenantColor + "12", border: "1px solid #e0e0e8" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{com.nombre} · {new Date(com.created_at).toLocaleDateString("es-AR")}</div>
                  <div style={{ fontSize: 13 }}>{com.texto}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} placeholder="Escribí tu consulta..." value={nuevoComentario}
                onChange={e => setNuevoComentario(e.target.value)} onKeyDown={e => e.key === "Enter" && enviarComentario()} />
              <button onClick={enviarComentario} disabled={!nuevoComentario.trim()}
                style={{ padding: "8px 16px", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !nuevoComentario.trim() ? 0.5 : 1 }}>
                Enviar
              </button>
            </div>
          </div>
        )}

        {/* Cierre comercial */}
        <div style={{ marginTop: 28, background: "#0e1411", borderRadius: 12, padding: "24px 22px", color: "#eef3f0", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>Esto es una parte del sistema.</div>
          <div style={{ fontSize: 13.5, color: "#8fa79b", maxWidth: 460, margin: "0 auto 18px" }}>
            El portal se llena solo con lo que ya cargaste: el presupuesto, los certificados y los cobros de la obra.
            No hay que cargar nada dos veces.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href={"https://wa.me/" + WHATSAPP + "?text=" + WHATSAPP_MSG} target="_blank" rel="noreferrer"
              style={{ background: "#059669", color: "#fff", textDecoration: "none", padding: "12px 24px", borderRadius: 10, fontWeight: 700, fontSize: 14.5 }}>
              Coordinar una demo →
            </a>
            <a href="/presentacion" style={{ color: "#eef3f0", textDecoration: "none", padding: "12px 20px", borderRadius: 10, border: "1px solid #24322b", fontWeight: 600, fontSize: 14 }}>
              Ver el sistema completo
            </a>
          </div>
          <div style={{ marginTop: 20, fontSize: 10.5, color: "#5d6b64", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.08em" }}>
            FAIM OBRAS · DATOS DE EJEMPLO · NINGUNA OBRA REAL
          </div>
        </div>
      </div>

      {/* Visor de planos */}
      {verPlano && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 400, display: "flex", flexDirection: "column" }}
          onClick={() => setVerPlano(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", color: "#fff", gap: 12 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verPlano.nombre}</div>
            <button onClick={() => setVerPlano(null)}
              style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ flex: 1, padding: "0 12px 12px" }} onClick={e => e.stopPropagation()}>
            <img src={verPlano.url} alt={verPlano.nombre} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
