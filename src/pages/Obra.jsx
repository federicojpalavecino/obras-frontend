import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, TrendingUp, Award, BarChart2, FileText, DollarSign, Users, ShoppingCart, CheckCircle } from "lucide-react";
import api from "../cotizador/api";
import MenuAcciones from "../shared/MenuAcciones";
const fmt = (n) => "$" + Math.round(n || 0).toLocaleString("es-AR");
const today = () => new Date().toISOString().split("T")[0];

function useIsMobile(bp = 720) {
  const [m, setM] = useState(typeof window !== "undefined" && window.innerWidth <= bp);
  useEffect(() => { const fn = () => setM(window.innerWidth <= bp); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, [bp]);
  return m;
}

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", border2: "#d0d0dc",
  text: "#1a1a2e", muted: "#6b7280", muted2: "#9ca3af",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#10b981", red: "#ef4444", blue: "#3b82f6",
};

const inp = {
  background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8,
  color: C.text, padding: "8px 10px", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box", width: "100%",
};

const btn = (color = C.accent) => ({
  padding: "8px 16px", background: color, color: "#fff", border: "none",
  borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
});

export default function Obra() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("resumen");
  const [presupuesto, setPresupuesto] = useState(null);
  const [contrato, setContrato] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [subcontratos, setSubcontratos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [cuentaCorriente, setCuentaCorriente] = useState(null);
  const [avance, setAvance] = useState(null);
  const [avForm, setAvForm] = useState({});      // linea_id -> pct escrito
  const [avFecha, setAvFecha] = useState(today());
  const [avNota, setAvNota] = useState("");
  const [guardandoAv, setGuardandoAv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Formularios
  const [showCobro, setShowCobro] = useState(false);
  const [cobForm, setCobForm] = useState({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null });
  const [showSub, setShowSub] = useState(false);
  const [subForm, setSubForm] = useState({ nombre_contratista: "", cuit_contratista: "", tipo: "empresa", descripcion_trabajo: "", monto_total: "", fecha_inicio: today(), tipo_pago: "por_avance", estado: "activo", notas: "" });
  const [showCompra, setShowCompra] = useState(false);
  const [compraForm, setCompraForm] = useState({ proveedor_nombre: "", fecha_pedido: today(), estado: "pedido", monto_total: "", nota: "" });
  const [showPagoSub, setShowPagoSub] = useState(null); // subcontrato id
  const [pagoSubForm, setPagoSubForm] = useState({ monto: "", fecha: today(), concepto: "Pago parcial", forma_pago: "transferencia", pct_avance_al_pagar: "" });
  const [showContrato, setShowContrato] = useState(false);
  const [certificados, setCertificados] = useState([]);
  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const cargar = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3, r4, r5, r6] = await Promise.all([
        api.get(`/presupuestos/${id}`).then(r => r.data),
        api.get(`/presupuestos/${id}/contrato`).then(r => r.data).catch(() => null),
        api.get(`/presupuestos/${id}/cobros`).then(r => r.data),
        api.get(`/presupuestos/${id}/subcontratos`).then(r => r.data),
        api.get(`/presupuestos/${id}/compras`).then(r => r.data),
        api.get(`/presupuestos/${id}/certificados`).then(r => r.data).catch(() => ({certificados:[]})),
      ]);
      setPresupuesto(r1);
      setContrato(r2);
      setCobros(Array.isArray(r3) ? r3 : []);
      setSubcontratos(Array.isArray(r4) ? r4 : []);
      setCompras(Array.isArray(r5) ? r5 : []);
      const certsData = r6?.certificados || (Array.isArray(r6) ? r6 : []);
      setCertificados(certsData);

      // Cuenta corriente
      const cc = await api.get(`/presupuestos/${id}/cuenta-corriente`).then(r => r.data);
      setCuentaCorriente(cc);
      const av = await api.get(`/presupuestos/${id}/avance`).then(r => r.data).catch(() => null);
      setAvance(av);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const guardarAvance = async () => {
    const lineas = Object.entries(avForm)
      .filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([linea_id, pct]) => ({ linea_id: parseInt(linea_id), pct: parseFloat(pct) }));
    if (!lineas.length) return;
    setGuardandoAv(true);
    try {
      await api.post(`/presupuestos/${id}/avance`, { fecha: avFecha, nota: avNota, lineas });
      setAvForm({}); setAvNota("");
      showToast("✓ Avance registrado"); await cargar();
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo guardar el avance");
    }
    setGuardandoAv(false);
  };

  const cambiarMetodologia = async (metodologia) => {
    await api.patch(`/presupuestos/${id}/metodologia`, { metodologia });
    showToast(metodologia === "desembolsos" ? "Gestión por desembolsos" : "Gestión por certificación");
    cargar();
  };

  const crearCobro = async () => {
    if (!cobForm.monto) return;
    await api.post(`/presupuestos/${id}/cobros`, { ...cobForm, monto: parseFloat(cobForm.monto) });
    setShowCobro(false); setCobForm({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null });
    showToast("✓ Cobro registrado"); cargar();
  };

  const eliminarCobro = async (cid) => {
    if (!window.confirm("¿Eliminar este cobro?")) return;
    await api.delete(`/presupuestos/${id}/cobros/${cid}`);
    showToast("Cobro eliminado"); cargar();
  };

  const crearSubcontrato = async () => {
    if (!subForm.nombre_contratista) return;
    await api.post(`/presupuestos/${id}/subcontratos`, { ...subForm, monto_total: parseFloat(subForm.monto_total) || 0 });
    setShowSub(false); setSubForm({ nombre_contratista: "", cuit_contratista: "", tipo: "empresa", descripcion_trabajo: "", monto_total: "", fecha_inicio: today(), tipo_pago: "por_avance", estado: "activo", notas: "" });
    showToast("✓ Subcontrato creado"); cargar();
  };

  const eliminarSubcontrato = async (sid) => {
    if (!window.confirm("¿Eliminar este subcontrato y todos sus pagos?")) return;
    await api.delete(`/presupuestos/${id}/subcontratos/${sid}`);
    showToast("Subcontrato eliminado"); cargar();
  };

  const crearPagoSubcontrato = async (sid) => {
    if (!pagoSubForm.monto) return;
    await api.post(`/presupuestos/${id}/subcontratos/${sid}/pagos`, { ...pagoSubForm, monto: parseFloat(pagoSubForm.monto), pct_avance_al_pagar: parseFloat(pagoSubForm.pct_avance_al_pagar) || 0 });
    setShowPagoSub(null); setPagoSubForm({ monto: "", fecha: today(), concepto: "Pago parcial", forma_pago: "transferencia", pct_avance_al_pagar: "" });
    showToast("✓ Pago registrado"); cargar();
  };

  const crearCompra = async () => {
    if (!compraForm.proveedor_nombre) return;
    await api.post(`/presupuestos/${id}/compras`, { ...compraForm, monto_total: parseFloat(compraForm.monto_total) || 0 });
    setShowCompra(false); setCompraForm({ proveedor_nombre: "", fecha_pedido: today(), estado: "pedido", monto_total: "", nota: "" });
    showToast("✓ Compra registrada"); cargar();
  };

  const eliminarCompra = async (cid) => {
    if (!window.confirm("¿Eliminar esta compra?")) return;
    await api.delete(`/presupuestos/${id}/compras/${cid}`);
    showToast("Compra eliminada"); cargar();
  };

  const imprimirContrato = () => {
    if (!presupuesto || !contrato) return;
    const tenant = presupuesto.tenant || {};
    const cliente = presupuesto.cliente || {};
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Contrato de Obra — ${presupuesto.nombre_obra}</title>
<style>
  body { font-family: 'Georgia', serif; color: #1a1a2e; padding: 48px; font-size: 13px; line-height: 1.8; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; letter-spacing: 1px; }
  .subtitle { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 36px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #059669; }
  .logo { font-size: 18px; font-weight: 900; color: #059669; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #059669; margin-bottom: 8px; border-bottom: 1px solid #e0e0e8; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 8px; }
  .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; }
  .value { font-size: 13px; font-weight: 600; }
  .firma { margin-top: 80px; display: flex; justify-content: space-around; }
  .firma-box { text-align: center; width: 200px; }
  .firma-line { border-top: 1px solid #1a1a2e; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e0e0e8; }
  td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #f1f3f5; }
  @media print { body { padding: 24px; } }
</style></head><body>
<div class="header">
  <div><div class="logo">${tenant.nombre || "FAIM OBRAS"}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">${tenant.cuit ? `CUIT: ${tenant.cuit}` : ""}</div></div>
  <div style="text-align:right;font-size:11px;color:#6b7280">
    ${new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"})}
  </div>
</div>
<h1>CONTRATO DE LOCACIÓN DE OBRA</h1>
<div class="subtitle">Nº ${id} — ${presupuesto.nombre_obra}</div>

<div class="section">
  <h3>Partes</h3>
  <div class="grid">
    <div>
      <div class="field"><div class="label">Comitente (Cliente)</div><div class="value">${cliente.nombre || "—"}</div></div>
      ${cliente.cuit ? `<div class="field"><div class="label">CUIT</div><div class="value">${cliente.cuit}</div></div>` : ""}
    </div>
    <div>
      <div class="field"><div class="label">Profesional / Empresa</div><div class="value">${tenant.nombre || "—"}</div></div>
      ${tenant.cuit ? `<div class="field"><div class="label">CUIT</div><div class="value">${tenant.cuit}</div></div>` : ""}
    </div>
  </div>
</div>

<div class="section">
  <h3>Objeto del contrato</h3>
  <div class="field"><div class="label">Obra</div><div class="value">${presupuesto.nombre_obra}</div></div>
  ${presupuesto.ubicacion ? `<div class="field"><div class="label">Ubicación</div><div class="value">${presupuesto.ubicacion}</div></div>` : ""}
  ${contrato.lugar_ejecucion ? `<div class="field"><div class="label">Lugar de ejecución</div><div class="value">${contrato.lugar_ejecucion}</div></div>` : ""}
</div>

<div class="section">
  <h3>Monto y forma de pago</h3>
  <div class="grid">
    <div class="field"><div class="label">Monto total</div><div class="value" style="font-size:18px;color:#059669">${fmt(contrato.monto_total)}</div></div>
    <div class="field"><div class="label">Forma de pago</div><div class="value">${contrato.tipo_pago === "por_certificado" ? "Por certificado de avance" : contrato.tipo_pago === "desembolsos" ? "Desembolsos acordados" : "Mixto"}</div></div>
  </div>
  ${contrato.anticipo_pct ? `<div class="field"><div class="label">Anticipo</div><div class="value">${contrato.anticipo_pct}% — ${fmt(contrato.monto_total * contrato.anticipo_pct / 100)}</div></div>` : ""}
  ${(contrato.desembolsos || []).length > 0 ? `
  <h4 style="font-size:11px;color:#6b7280;margin-top:12px">Calendario de pagos</h4>
  <table>
    <thead><tr><th>Cuota</th><th>Descripción</th><th>Monto</th><th>Vencimiento</th></tr></thead>
    <tbody>
      ${(contrato.desembolsos || []).map(d => `<tr><td>${d.numero}</td><td>${d.descripcion}</td><td>${fmt(d.monto)}</td><td>${d.fecha_vencimiento || "—"}</td></tr>`).join("")}
    </tbody>
  </table>` : ""}
</div>

${contrato.plazo_obra_dias ? `<div class="section"><h3>Plazo</h3><div class="value">${contrato.plazo_obra_dias} días corridos desde el inicio de obra</div></div>` : ""}

${contrato.clausulas_adicionales ? `<div class="section"><h3>Cláusulas adicionales</h3><p style="white-space:pre-line">${contrato.clausulas_adicionales}</p></div>` : ""}

<div class="section">
  <h3>Conformidad</h3>
  <p>Las partes declaran estar de acuerdo con los términos del presente contrato y se obligan a cumplirlo.</p>
</div>

<div class="firma">
  <div class="firma-box"><div class="firma-line"></div><div>${cliente.nombre || "Comitente"}</div><div style="font-size:11px;color:#6b7280">Firma y aclaración</div></div>
  <div class="firma-box"><div class="firma-line"></div><div>${tenant.nombre || "Profesional"}</div><div style="font-size:11px;color:#6b7280">Firma y aclaración</div></div>
</div>

<div style="text-align:center;margin-top:60px;font-size:10px;color:#9ca3af">
  Emitido con FAIM OBRAS · ${new Date().toLocaleDateString("es-AR")}
</div>
</body></html>`;
    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", color: C.muted }}>
      Cargando...
    </div>
  );

  const total_pres = presupuesto?.totales?.total_precio_con_iva || 0;
  const cc = cuentaCorriente || {};
  // La metodologia manda: la obra que se cobra por desembolsos pactados no
  // certifica, asi que no tiene sentido rotularle todo como "certificado".
  const porDesembolsos = cc.metodologia === "desembolsos";
  const rotuloDevengado = porDesembolsos ? "Desembolsos devengados" : "Certificado acumulado";
  const aFavor = cc.a_favor_cliente || 0;
  const lineasObra = (presupuesto?.rubros || []).flatMap(r =>
    (r.lineas || []).map(l => ({ ...l, rubro: r.nombre })));
  const avancePorLinea = Object.fromEntries((avance?.por_linea || []).map(a => [a.linea_id, a]));

  const TabBtn = ({ id: tid, label }) => (
    <button onClick={() => setTab(tid)} style={{
      padding: "10px 16px", background: "none", border: "none",
      borderBottom: `2px solid ${tab === tid ? C.accent : "transparent"}`,
      color: tab === tid ? C.accent : C.muted,
      fontWeight: tab === tid ? 700 : 500, cursor: "pointer", fontSize: 13, fontFamily: "inherit", whiteSpace: "nowrap"
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif" }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/cotizador/presupuesto/${id}`)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display:"flex", alignItems:"center" }}><ArrowLeft size={18} strokeWidth={1.5} /></button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{presupuesto?.nombre_obra}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Gestión de obra</span>
              {presupuesto?.proyecto && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: (presupuesto.proyecto.color || '#6ee7b7') + '22', color: presupuesto.proyecto.color || '#059669' }}>
                  {presupuesto.proyecto.nombre}
                </span>
              )}
            </div>
          </div>
          {isMobile ? (
            <div style={{ marginLeft: "auto" }}>
              <MenuAcciones C={C} acciones={[
                { label: "Ver Gantt", icon: <BarChart2 size={16} strokeWidth={1.5} />, color: C.blue, onClick: () => navigate(`/cotizador/gantt/${id}`) },
                { label: "Curva de inversión", icon: <TrendingUp size={16} strokeWidth={1.5} />, color: C.warn, onClick: () => navigate(`/cotizador/presupuesto/${id}/curva`) },
                { label: "Certificados", icon: <Award size={16} strokeWidth={1.5} />, color: C.accent2, onClick: () => setTab("certificados") },
              ]} />
            </div>
          ) : (
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button onClick={() => navigate(`/cotizador/gantt/${id}`)}
                style={{ ...btn(C.blue), fontSize: 12, display:"flex", alignItems:"center", gap:5 }}>
                <BarChart2 size={13} strokeWidth={1.5} /> Gantt
              </button>
              <button onClick={() => navigate(`/cotizador/presupuesto/${id}/curva`)}
                style={{ ...btn(C.warn), fontSize: 12, display:"flex", alignItems:"center", gap:5 }}>
                <TrendingUp size={13} strokeWidth={1.5} /> Curva
              </button>
              <button onClick={() => setTab("certificados")}
                style={{ ...btn(C.accent2), fontSize: 12, display:"flex", alignItems:"center", gap:5 }}>
                <Award size={13} strokeWidth={1.5} /> Certificados
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs — en mobile selector desplegable, en desktop pestañas */}
      {isMobile ? (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 16px" }}>
          <select value={tab} onChange={e => setTab(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border2}`, borderRadius: 8, fontSize: 15, fontWeight: 700, color: C.text, background: C.surface2, fontFamily: "inherit", outline: "none" }}>
            <option value="resumen">Resumen</option>
            <option value="contrato">Contrato</option>
            <option value="cobros">Cobros</option>
            <option value="subcontratos">Subcontratos</option>
            <option value="compras">Compras</option>
            <option value="certificados">Certificados</option>
          </select>
        </div>
      ) : (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", width: "100%" }}>
            <TabBtn id="resumen" label="Resumen" />
            <TabBtn id="contrato" label="Contrato" />
            <TabBtn id="cobros" label="Cobros" />
            <TabBtn id="subcontratos" label="Subcontratos" />
            <TabBtn id="compras" label="Compras" />
            <TabBtn id="avance" label="Avance" />
            {(!porDesembolsos || certificados.length > 0) && <TabBtn id="certificados" label="Certificados" />}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px 60px" }}>

        {/* ── RESUMEN ── */}
        {tab === "resumen" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
              {[
                ["Presupuesto", total_pres, C.text],
                [rotuloDevengado, cc.total_devengado ?? cc.total_certificado, C.accent2],
                ["Cobrado", cc.total_cobrado, C.green],
                // Cobrar mas de lo devengado no es un error: es anticipo. Se
                // nombra como lo que es, en vez de un saldo negativo en rojo.
                aFavor > 0
                  ? ["A favor del cliente", aFavor, C.accent2]
                  : ["Saldo pendiente", cc.saldo_pendiente, cc.saldo_pendiente > 0 ? C.red : C.green],
                ["Subcontratos pagados", cc.total_subcontratos, C.warn],
                ["Compras pagadas", cc.total_compras, C.warn],
                ["Resultado neto", cc.resultado_neto, (cc.resultado_neto || 0) >= 0 ? C.accent : C.red],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "'IBM Plex Mono', monospace" }}>{fmt(val || 0)}</div>
                </div>
              ))}
            </div>

            {/* Avance de obra — se registra igual con cualquier metodologia */}
            {avance && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Avance de obra</span>
                  <span style={{ fontSize: 11, color: C.muted }}>
                    {avance.origen === "certificado" ? "según el último certificado"
                      : avance.origen === "avance" ? "cargado a mano" : "sin registrar"}
                    {avance.fecha ? ` · ${avance.fecha}` : ""}
                  </span>
                  <span style={{ fontSize: 13, color: C.accent2, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {(avance.pct || 0).toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: 10, background: C.surface2, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, avance.pct || 0)}%`, background: C.accent2, borderRadius: 5, transition: "width 0.5s" }} />
                </div>
                {!avance.pct && (
                  <button onClick={() => setTab("avance")} className="btn btn-secondary btn-sm"
                    style={{ marginTop: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.accent, cursor: "pointer", fontFamily: "inherit" }}>
                    Registrar el primer avance
                  </button>
                )}
              </div>
            )}

            {/* Barra de cobro */}
            {total_pres > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Avance de cobro</span>
                  <span style={{ fontSize: 13, color: C.accent, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {Math.round((cc.total_cobrado || 0) / total_pres * 100)}%
                  </span>
                </div>
                <div style={{ height: 10, background: C.surface2, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (cc.total_cobrado || 0) / total_pres * 100)}%`, background: C.green, borderRadius: 5, transition: "width 0.5s" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.muted }}>
                  <span>Cobrado: {fmt(cc.total_cobrado || 0)}</span>
                  <span>Total: {fmt(total_pres)}</span>
                </div>
              </div>
            )}

            {/* Cobros recientes */}
            {cobros.length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Últimos cobros</div>
                {cobros.slice(0, 5).map(c => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                    <div>
                      <div style={{ fontSize: 13 }}>{c.forma_pago} {c.referencia ? `— ${c.referencia}` : ""}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{c.fecha} {c.nota ? `· ${c.nota}` : ""}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CONTRATO ── */}
        {/* ── AVANCE ── */}
        {tab === "avance" && (
          <div>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Avance de obra</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 3, maxWidth: 560, lineHeight: 1.5 }}>
                    Se registra igual se cobre como se cobre. Poné el porcentaje acumulado de
                    cada ítem: el total se pondera por precio, así hormigonar la platea no pesa
                    lo mismo que revocar un baño.
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>
                    {(avance?.pct || 0).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: C.muted }}>
                    gestión por {porDesembolsos ? "desembolsos" : "certificación"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={() => cambiarMetodologia(porDesembolsos ? "certificacion" : "desembolsos")}
                  style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
                  Cambiar a {porDesembolsos ? "certificación" : "desembolsos pactados"}
                </button>
              </div>
            </div>

            {avance?.origen === "certificado" && (
              <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                El avance que se muestra hoy sale del último certificado emitido. Lo que cargues
                acá pasa a mandar a partir de su fecha, sin tocar el certificado.
              </div>
            )}

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Fecha</div>
                  <input type="date" value={avFecha} onChange={e => setAvFecha(e.target.value)}
                    style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 13, background: C.surface, color: C.text }} />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Nota (opcional)</div>
                  <input value={avNota} onChange={e => setAvNota(e.target.value)} placeholder="Ej: medición de fin de mes"
                    style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 13, background: C.surface, color: C.text }} />
                </div>
                <button onClick={guardarAvance} disabled={guardandoAv || !Object.values(avForm).some(v => v !== "")}
                  style={{ padding: "9px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: guardandoAv ? .6 : 1 }}>
                  {guardandoAv ? "Guardando..." : "Registrar avance"}
                </button>
              </div>
            </div>

            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              {lineasObra.length === 0 ? (
                <div style={{ padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                  Este presupuesto todavía no tiene ítems cargados.
                </div>
              ) : lineasObra.map(l => {
                const act = avancePorLinea[l.id];
                const pctActual = act ? act.pct : 0;
                return (
                  <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 92px 120px", gap: 12, alignItems: "center", padding: "11px 16px", borderBottom: `1px solid ${C.border2}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {l.nombre_override || l.nombre_item || l.nombre_libre}
                      </div>
                      <div style={{ fontSize: 11, color: C.muted }}>
                        {l.rubro} · {fmt(l.precio_venta_con_iva || 0)}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, color: C.muted, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" }}>
                      {pctActual.toFixed(0)}%
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" min="0" max="100" step="1"
                        value={avForm[l.id] ?? ""} placeholder="—"
                        onChange={e => setAvForm(f => ({ ...f, [l.id]: e.target.value }))}
                        style={{ width: "100%", padding: "7px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, textAlign: "right", background: C.surface, color: C.text }} />
                      <span style={{ fontSize: 12, color: C.muted }}>%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {(avance?.historial || []).length > 0 && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Historial</div>
                {[...avance.historial].reverse().slice(0, 12).map(h => (
                  <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderBottom: `1px solid ${C.border2}`, fontSize: 12.5 }}>
                    <span style={{ color: C.muted }}>
                      {h.fecha} · {h.creado_por_nombre || "—"}{h.nota ? ` · ${h.nota}` : ""}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{Number(h.pct).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "contrato" && (
          <div>
            {contrato ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Contrato de obra</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={imprimirContrato} style={{ ...btn(C.surface2), color: C.text, border: `1px solid ${C.border}`, display:"flex", alignItems:"center", gap:5 }}><Printer size={13} strokeWidth={1.5} /> Imprimir</button>
                    <button onClick={() => setShowContrato(true)} style={btn(C.accent)}>Editar</button>
                  </div>
                </div>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                    {[
                      ["Monto total", fmt(contrato.monto_total)],
                      ["Forma de pago", contrato.tipo_pago === "por_certificado" ? "Por certificado" : contrato.tipo_pago],
                      ["Anticipo", contrato.anticipo_pct ? `${contrato.anticipo_pct}%` : "Sin anticipo"],
                      ["Plazo", contrato.plazo_obra_dias ? `${contrato.plazo_obra_dias} días` : "—"],
                      ["Estado", contrato.estado],
                      ["Fecha firma", contrato.fecha_firma || "—"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {contrato.clausulas_adicionales && (
                    <div>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 6 }}>Cláusulas adicionales</div>
                      <div style={{ fontSize: 13, whiteSpace: "pre-line", color: C.text }}>{contrato.clausulas_adicionales}</div>
                    </div>
                  )}
                  {(contrato.desembolsos || []).length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Calendario de pagos</div>
                      {contrato.desembolsos.map(d => (
                        <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border2}` }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>Cuota {d.numero}</span>
                            <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{d.descripcion}</span>
                          </div>
                          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: C.muted }}>{d.fecha_vencimiento || "Sin fecha"}</span>
                            <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(d.monto)}</span>
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: d.estado === "cobrado" ? "#f0fdf4" : "#fef3c7", color: d.estado === "cobrado" ? C.green : C.warn }}>{d.estado}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <FileText size={36} strokeWidth={1} color={C.muted} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Sin contrato</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Creá el contrato para esta obra</div>
                <button onClick={() => setShowContrato(true)} style={btn(C.accent)}>+ Crear contrato</button>
              </div>
            )}
          </div>
        )}

        {/* ── COBROS ── */}
        {tab === "cobros" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Cobros del cliente</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  Cobrado: {fmt(cc.total_cobrado || 0)} · Saldo: {fmt(cc.saldo_pendiente || 0)}
                </div>
              </div>
              <button onClick={() => setShowCobro(true)} style={btn(C.green)}>+ Registrar cobro</button>
            </div>
            {cobros.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted }}>
                Sin cobros registrados
              </div>
            ) : (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                {cobros.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderBottom: i < cobros.length - 1 ? `1px solid ${C.border2}` : "none" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{c.forma_pago}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{c.fecha} {c.referencia ? `· Ref: ${c.referencia}` : ""} {c.nota ? `· ${c.nota}` : ""}</div>
                      {c.creado_por_nombre && <div style={{ fontSize: 11, color: C.muted2 }}>Registró: {c.creado_por_nombre}</div>}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto)}</div>
                    <button onClick={() => eliminarCobro(c.id)} style={{ background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6, color: C.red, cursor: "pointer", padding: "4px 10px", fontSize: 13 }}>×</button>
                  </div>
                ))}
                <div style={{ padding: "10px 16px", background: C.surface2, display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <span style={{ fontSize: 13, color: C.muted }}>Total cobrado:</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(cc.total_cobrado || 0)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SUBCONTRATOS ── */}
        {tab === "subcontratos" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Subcontratos</div>
              <button onClick={() => setShowSub(true)} style={btn(C.accent)}>+ Agregar subcontrato</button>
            </div>
            {subcontratos.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted }}>
                Sin subcontratos
              </div>
            ) : subcontratos.map(s => (
              <div key={s.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{s.nombre_contratista}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{s.tipo} {s.cuit_contratista ? `· CUIT: ${s.cuit_contratista}` : ""}</div>
                    {s.descripcion_trabajo && <div style={{ fontSize: 13, color: C.text, marginTop: 4 }}>{s.descripcion_trabajo}</div>}
                    {s.creado_por_nombre && <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Cargó: {s.creado_por_nombre}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: C.warn, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(s.monto_total)}</div>
                    <div style={{ fontSize: 12, color: C.green }}>Pagado: {fmt(s.pagado || 0)}</div>
                    <div style={{ fontSize: 12, color: C.red }}>Pendiente: {fmt((s.monto_total || 0) - (s.pagado || 0))}</div>
                  </div>
                </div>
                {/* Pagos */}
                {(s.pagos || []).length > 0 && (
                  <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                    {s.pagos.map(p => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                        <span>{p.fecha} · {p.concepto}</span>
                        <span style={{ fontWeight: 700, color: C.warn, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(p.monto)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setShowPagoSub(s.id); setPagoSubForm({ monto: "", fecha: today(), concepto: "Pago parcial", forma_pago: "transferencia", pct_avance_al_pagar: "" }); }} style={{ ...btn(C.warn), fontSize: 12 }}>+ Registrar pago</button>
                  <button onClick={() => eliminarSubcontrato(s.id)} style={{ ...btn("#fee2e2"), color: C.red, fontSize: 12 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── COMPRAS ── */}
        {tab === "compras" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Compras de materiales</div>
              <button onClick={() => setShowCompra(true)} style={btn(C.accent)}>+ Registrar compra</button>
            </div>
            {compras.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted }}>
                Sin compras registradas
              </div>
            ) : compras.map(c => (
              <div key={c.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.proveedor_nombre}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{c.fecha_pedido} · {c.estado}</div>
                    {c.nota && <div style={{ fontSize: 12, color: C.muted }}>{c.nota}</div>}
                    {c.creado_por_nombre && <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Cargó: {c.creado_por_nombre}</div>}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.warn, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto_total)}</div>
                    <div style={{ fontSize: 12, color: C.green }}>Pagado: {fmt(c.monto_pagado || 0)}</div>
                  </div>
                </div>
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button onClick={() => eliminarCompra(c.id)} style={{ ...btn("#fee2e2"), color: C.red, fontSize: 12 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB CERTIFICADOS ── */}
        {tab === "certificados" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Certificados de avance</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {certificados.length} certificado{certificados.length !== 1 ? "s" : ""} emitido{certificados.length !== 1 ? "s" : ""}
                  {certificados.length > 0 && ` · Acumulado: ${fmt(certificados[certificados.length-1]?.monto_acumulado || 0)}`}
                </div>
              </div>
              <button onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)} style={btn(C.accent2)}>
                + Emitir certificado
              </button>
            </div>

            {certificados.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <Award size={32} strokeWidth={1} color={C.muted} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Sin certificados emitidos</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Emití el primer certificado de avance</div>
                <button onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)} style={btn(C.accent2)}>
                  Emitir certificado →
                </button>
              </div>
            ) : (
              <div>
                {certificados.map((cert, i) => {
                  const cobrosVinculados = cobros.filter(cb => cb.certificado_id === cert.id);
                  const montoCobrado = cobrosVinculados.reduce((s, cb) => s + parseFloat(cb.monto || 0), 0);
                  const pendiente = parseFloat(cert.total_periodo || cert.monto_periodo || 0) - montoCobrado;
                  return (
                    <div key={cert.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>Certificado Nº {cert.numero}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>
                            {cert.fecha}
                            {cert.periodo_desde && ` · ${cert.periodo_desde} → ${cert.periodo_hasta}`}
                          </div>
                          <div style={{ fontSize: 12, color: C.accent2, marginTop: 2 }}>
                            Avance acumulado: {parseFloat(cert.avance_total_pct || 0).toFixed(1)}%
                          </div>
                          {cert.creado_por_nombre && <div style={{ fontSize: 11, color: C.muted2, marginTop: 2 }}>Emitió: {cert.creado_por_nombre}</div>}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>
                            {fmt(cert.total_periodo || cert.monto_periodo)}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>período · acum: {fmt(cert.monto_acumulado)}</div>
                        </div>
                      </div>

                      {/* Cobros vinculados a este certificado */}
                      <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cobrosVinculados.length > 0 ? 8 : 0 }}>
                          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Cobros vinculados
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {pendiente > 0 && (
                              <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>Pendiente: {fmt(pendiente)}</span>
                            )}
                            {pendiente <= 0 && montoCobrado > 0 && (
                              <span style={{ fontSize: 12, color: C.green, fontWeight: 700, display:"flex", alignItems:"center", gap:3 }}><CheckCircle size={12} strokeWidth={2} /> Cobrado completo</span>
                            )}
                            <button
                              onClick={() => {
                                setShowCobro(true);
                                setCobForm({ monto: String(Math.round(pendiente > 0 ? pendiente : cert.total_periodo || cert.monto_periodo)), fecha: today(), forma_pago: "transferencia", referencia: "", nota: `Cert. Nº ${cert.numero}`, certificado_id: cert.id });
                              }}
                              style={{ ...btn(C.green), padding: "4px 10px", fontSize: 11 }}>
                              + Cobro
                            </button>
                          </div>
                        </div>
                        {cobrosVinculados.length === 0 ? (
                          <div style={{ fontSize: 12, color: C.muted }}>Sin cobros registrados para este certificado</div>
                        ) : cobrosVinculados.map(cb => (
                          <div key={cb.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12 }}>{cb.fecha} · {cb.forma_pago} {cb.referencia ? `· ${cb.referencia}` : ""}</div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(cb.monto)}</span>
                              <button onClick={() => eliminarCobro(cb.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Resumen total */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, color: C.muted }}>Total certificado / Total cobrado</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <span style={{ fontWeight: 700, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(certificados[certificados.length-1]?.monto_acumulado || 0)}</span>
                    <span style={{ color: C.muted }}>/</span>
                    <span style={{ fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(cobros.reduce((s,cb) => s + parseFloat(cb.monto||0), 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB CERTIFICADOS ── */}
      </div>

      {/* ── MODAL COBRO ── */}
      {showCobro && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar cobro</div>
              <button onClick={() => setShowCobro(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            {[
              { label: "Monto", key: "monto", type: "number", placeholder: "0" },
              { label: "Fecha", key: "fecha", type: "date" },
              { label: "Referencia (nº transferencia, cheque...)", key: "referencia", placeholder: "Opcional" },
              { label: "Nota", key: "nota", placeholder: "Opcional" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={inp} type={f.type || "text"} placeholder={f.placeholder} value={cobForm[f.key]} onChange={e => setCobForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Forma de pago</label>
              <select style={inp} value={cobForm.forma_pago} onChange={e => setCobForm(p => ({ ...p, forma_pago: e.target.value }))}>
                {["transferencia", "cheque", "efectivo", "depósito", "otro"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <button onClick={crearCobro} style={{ ...btn(C.green), width: "100%", padding: 12 }}>Guardar cobro</button>
          </div>
        </div>
      )}

      {/* ── MODAL SUBCONTRATO ── */}
      {showSub && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 480, border: `1px solid ${C.border}`, maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Nuevo subcontrato</div>
              <button onClick={() => setShowSub(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            {[
              { label: "Nombre del contratista", key: "nombre_contratista" },
              { label: "CUIT (opcional)", key: "cuit_contratista" },
              { label: "Descripción del trabajo", key: "descripcion_trabajo" },
              { label: "Monto total acordado", key: "monto_total", type: "number" },
              { label: "Fecha de inicio", key: "fecha_inicio", type: "date" },
              { label: "Notas", key: "notas" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={inp} type={f.type || "text"} value={subForm[f.key]} onChange={e => setSubForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Tipo</label>
                <select style={inp} value={subForm.tipo} onChange={e => setSubForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="empresa">Empresa</option>
                  <option value="persona">Persona física</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Forma de pago</label>
                <select style={inp} value={subForm.tipo_pago} onChange={e => setSubForm(p => ({ ...p, tipo_pago: e.target.value }))}>
                  <option value="por_avance">Por avance</option>
                  <option value="anticipo_cuotas">Anticipo + cuotas</option>
                  <option value="al_terminar">Al terminar</option>
                </select>
              </div>
            </div>
            <button onClick={crearSubcontrato} style={{ ...btn(C.accent), width: "100%", padding: 12 }}>Crear subcontrato</button>
          </div>
        </div>
      )}

      {/* ── MODAL PAGO SUBCONTRATO ── */}
      {showPagoSub && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar pago al subcontratista</div>
              <button onClick={() => setShowPagoSub(null)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            {[
              { label: "Monto", key: "monto", type: "number" },
              { label: "Fecha", key: "fecha", type: "date" },
              { label: "Concepto", key: "concepto" },
              { label: "% avance al pagar", key: "pct_avance_al_pagar", type: "number", placeholder: "0" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={inp} type={f.type || "text"} placeholder={f.placeholder} value={pagoSubForm[f.key]} onChange={e => setPagoSubForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Forma de pago</label>
              <select style={inp} value={pagoSubForm.forma_pago} onChange={e => setPagoSubForm(p => ({ ...p, forma_pago: e.target.value }))}>
                {["transferencia", "cheque", "efectivo", "otro"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <button onClick={() => crearPagoSubcontrato(showPagoSub)} style={{ ...btn(C.warn), width: "100%", padding: 12 }}>Registrar pago</button>
          </div>
        </div>
      )}

      {/* ── MODAL COMPRA ── */}
      {showCompra && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar compra</div>
              <button onClick={() => setShowCompra(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>
            {[
              { label: "Proveedor", key: "proveedor_nombre" },
              { label: "Monto total", key: "monto_total", type: "number" },
              { label: "Fecha del pedido", key: "fecha_pedido", type: "date" },
              { label: "Nota", key: "nota", placeholder: "Opcional" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{f.label}</label>
                <input style={inp} type={f.type || "text"} placeholder={f.placeholder} value={compraForm[f.key]} onChange={e => setCompraForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Estado</label>
              <select style={inp} value={compraForm.estado} onChange={e => setCompraForm(p => ({ ...p, estado: e.target.value }))}>
                {["pedido", "entregado_parcial", "entregado", "pagado"].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <button onClick={crearCompra} style={{ ...btn(C.accent), width: "100%", padding: 12 }}>Registrar compra</button>
          </div>
        </div>
      )}

      {/* ── MODAL CONTRATO ── */}
      {showContrato && (
        <ContratoModal presupuestoId={id} presupuesto={presupuesto} existing={contrato}
          onClose={() => setShowContrato(false)} onSave={() => { setShowContrato(false); cargar(); showToast("✓ Contrato guardado"); }} />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: C.text, color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function ContratoModal({ presupuestoId, presupuesto, existing, onClose, onSave }) {
  const total = presupuesto?.totales?.total_precio_con_iva || 0;
  const [form, setForm] = useState({
    monto_total: existing?.monto_total || total,
    tipo_pago: existing?.tipo_pago || "por_certificado",
    anticipo_pct: existing?.anticipo_pct || 0,
    plazo_obra_dias: existing?.plazo_obra_dias || "",
    lugar_ejecucion: existing?.lugar_ejecucion || presupuesto?.ubicacion || "",
    fecha_firma: existing?.fecha_firma || new Date().toISOString().split("T")[0],
    estado: existing?.estado || "borrador",
    clausulas_adicionales: existing?.clausulas_adicionales || "",
    desembolsos: existing?.desembolsos || [],
  });

  const addDesembolso = () => setForm(f => ({ ...f, desembolsos: [...f.desembolsos, { descripcion: "", monto: 0, fecha_vencimiento: "", estado: "pendiente" }] }));
  const updDesembolso = (i, k, v) => setForm(f => { const d = [...f.desembolsos]; d[i] = { ...d[i], [k]: v }; return { ...f, desembolsos: d }; });
  const delDesembolso = (i) => setForm(f => ({ ...f, desembolsos: f.desembolsos.filter((_, j) => j !== i) }));

  const guardar = async () => {
    await api.post(`/presupuestos/${presupuestoId}/contrato`, form);
    onSave();
  };

  const inp2 = { ...{ background: "#f1f3f5", border: "1px solid #d0d0dc", borderRadius: 8, color: "#1a1a2e", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%" } };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, border: "1px solid #e0e0e8", maxHeight: "90vh", overflow: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Contrato de obra</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 22 }}>×</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Monto total</label>
            <input style={inp2} type="number" value={form.monto_total} onChange={e => setForm(f => ({ ...f, monto_total: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Fecha de firma</label>
            <input style={inp2} type="date" value={form.fecha_firma} onChange={e => setForm(f => ({ ...f, fecha_firma: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Forma de pago</label>
            <select style={inp2} value={form.tipo_pago} onChange={e => setForm(f => ({ ...f, tipo_pago: e.target.value }))}>
              <option value="por_certificado">Por certificado de avance</option>
              <option value="desembolsos">Desembolsos acordados</option>
              <option value="mixto">Mixto (anticipo + certificado)</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Anticipo (%)</label>
            <input style={inp2} type="number" value={form.anticipo_pct} onChange={e => setForm(f => ({ ...f, anticipo_pct: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Plazo (días)</label>
            <input style={inp2} type="number" value={form.plazo_obra_dias} onChange={e => setForm(f => ({ ...f, plazo_obra_dias: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Estado</label>
            <select style={inp2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
              {["borrador", "enviado", "aceptado", "firmado"].map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Lugar de ejecución</label>
          <input style={inp2} value={form.lugar_ejecucion} onChange={e => setForm(f => ({ ...f, lugar_ejecucion: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Cláusulas adicionales</label>
          <textarea style={{ ...inp2, height: 80, resize: "vertical" }} value={form.clausulas_adicionales} onChange={e => setForm(f => ({ ...f, clausulas_adicionales: e.target.value }))} />
        </div>

        {/* Desembolsos */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Calendario de pagos</div>
            <button onClick={addDesembolso} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}>+ Agregar</button>
          </div>
          {form.desembolsos.map((d, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginBottom: 6 }}>
              <input style={inp2} placeholder="Descripción" value={d.descripcion} onChange={e => updDesembolso(i, "descripcion", e.target.value)} />
              <input style={inp2} type="number" placeholder="Monto" value={d.monto} onChange={e => updDesembolso(i, "monto", e.target.value)} />
              <input style={inp2} type="date" value={d.fecha_vencimiento} onChange={e => updDesembolso(i, "fecha_vencimiento", e.target.value)} />
              <button onClick={() => delDesembolso(i)} style={{ background: "none", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, color: "#ef4444", cursor: "pointer", padding: "4px 8px" }}>×</button>
            </div>
          ))}
        </div>

        <button onClick={guardar} style={{ background: "#059669", color: "#fff", border: "none", borderRadius: 8, padding: "12px", width: "100%", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Guardar contrato
        </button>
      </div>
    </div>
  );
}
