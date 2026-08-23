import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Printer, TrendingUp, Award, BarChart2, FileText, DollarSign, Users, ShoppingCart, CheckCircle } from "lucide-react";
import api from "../cotizador/api";
import MenuAcciones from "../shared/MenuAcciones";
import { imprimirHTML } from '../utils/imprimir';
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

// Las clausulas que aparecen en casi todo contrato de obra en Argentina. No
// son un modelo legal cerrado: son el punto de partida que el estudio ajusta.
const CLAUSULAS_FRECUENTES = [
  { titulo: "Mayores costos",
    texto: "MAYORES COSTOS: Los precios se ajustarán conforme a la variación del índice de la construcción publicado por el INDEC entre la fecha del presupuesto y la de cada certificación o desembolso." },
  { titulo: "Plazo y prórrogas",
    texto: "PLAZO: El plazo de obra se contará en días hábiles a partir del acta de inicio, y se prorrogará por los días de lluvia, paros, falta de provisión de materiales por causas ajenas al contratista, y toda causa de fuerza mayor debidamente notificada." },
  { titulo: "Anticipo",
    texto: "ANTICIPO: El comitente abonará un anticipo a la firma del presente, que se descontará proporcionalmente de cada certificación o desembolso posterior." },
  { titulo: "Fondo de reparo",
    texto: "FONDO DE REPARO: De cada certificación se retendrá un porcentaje en concepto de fondo de reparo, que se devolverá a la recepción definitiva de la obra." },
  { titulo: "Trabajos adicionales",
    texto: "ADICIONALES: Todo trabajo no previsto en el presupuesto será presupuestado por separado y requerirá aprobación escrita del comitente antes de su ejecución." },
  { titulo: "Recepción de obra",
    texto: "RECEPCIÓN: A la finalización se labrará acta de recepción provisoria. La recepción definitiva operará transcurrido el plazo de garantía convenido, sin observaciones pendientes." },
  { titulo: "Seguros y ART",
    texto: "SEGUROS: El contratista mantendrá vigentes durante toda la obra los seguros de responsabilidad civil y la cobertura de ART de todo el personal afectado, y acreditará su vigencia cuando le sea requerido." },
  { titulo: "Rescisión",
    texto: "RESCISIÓN: Cualquiera de las partes podrá rescindir el contrato por incumplimiento grave de la otra, previa intimación fehaciente a subsanarlo en un plazo razonable." },
];

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
  const [desembolsos, setDesembolsos] = useState([]);
  const [editDes, setEditDes] = useState(null);   // { id, avance_pct, fecha_real }
  const [certSub, setCertSub] = useState(null);  // resumen del subcontrato abierto
  const [archivos, setArchivos] = useState([]);
  const [almacen, setAlmacen] = useState({ configurado: true, max_mb: 60 });
  const [subiendo, setSubiendo] = useState(null);   // { nombre, pct }
  const [verArchivo, setVerArchivo] = useState(null);
  const [etapasElegidas, setEtapasElegidas] = useState([]);   // ids a cobrar juntas
  const [cobrandoLote, setCobrandoLote] = useState(false);
  const [certForm, setCertForm] = useState({ pct_acumulado: '', fecha: today(), nota: '', generar_pago: true });
  const [avForm, setAvForm] = useState({});      // linea_id -> pct escrito
  const [avFecha, setAvFecha] = useState(today());
  const [avNota, setAvNota] = useState("");
  const [guardandoAv, setGuardandoAv] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // Formularios
  const [showCobro, setShowCobro] = useState(false);
  const [cobForm, setCobForm] = useState({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null, desembolso_id: null });
  const [showSub, setShowSub] = useState(false);
  // `lineas_ids`: que items del presupuesto cubre este contratista. Un subcontrato
  // suele cubrir varios —"instalacion electrica" son varias lineas— y sin esto no
  // se sabe quien ejecuta cada parte de la obra, ni el Gantt lo puede mostrar.
  const [subForm, setSubForm] = useState({ nombre_contratista: "", cuit_contratista: "", tipo: "empresa", descripcion_trabajo: "", monto_total: "", fecha_inicio: today(), tipo_pago: "por_avance", estado: "activo", notas: "", lineas_ids: [] });
  const [showCompra, setShowCompra] = useState(false);
  // `lineas_ids`: para que items de la obra es esta compra. Sin esto el Gantt no
  // puede decir si una tarea ya tiene sus materiales comprados.
  const [compraForm, setCompraForm] = useState({ proveedor_nombre: "", fecha_pedido: today(), estado: "pedido", monto_total: "", nota: "", destino: "interna", lineas_ids: [], items: [] });
  const [showPagoSub, setShowPagoSub] = useState(null); // subcontrato id
  const [pagoSubForm, setPagoSubForm] = useState({ monto: "", fecha: today(), concepto: "Pago parcial", forma_pago: "transferencia", pct_avance_al_pagar: "" });
  const [showContrato, setShowContrato] = useState(false);
  const [certificados, setCertificados] = useState([]);
  // Lo que está físicamente en esta obra: herramientas del pañol y material
  // que salió del depósito. Se carga aparte porque no todos los estudios lo
  // usan y no vale la pena demorar la pantalla por eso.
  const [panolObra, setPanolObra] = useState({ en_obra: [], devueltas: [] });
  const [stockObra, setStockObra] = useState([]);
  // Para poder pedir desde acá hace falta saber qué hay libre del otro lado.
  const [panolLibre, setPanolLibre] = useState([]);
  const [stockLibre, setStockLibre] = useState([]);
  const [pedir, setPedir] = useState(null);   // { tipo:'herramienta'|'material', item, cantidad }

  // Las dos puntas leen lo mismo, así que después de mover algo hay que
  // refrescar las cuatro listas o una de las dos queda mintiendo.
  const refrescarPanol = async () => {
    const [a, b, c, d] = await Promise.all([
      api.get(`/presupuestos/${id}/panol`).then(r => r.data).catch(() => null),
      api.get(`/presupuestos/${id}/stock`).then(r => r.data).catch(() => null),
      api.get(`/panol/herramientas`).then(r => r.data?.herramientas).catch(() => null),
      api.get(`/stock`).then(r => r.data?.items).catch(() => null),
    ]);
    if (a) setPanolObra(a);
    if (b) setStockObra(b);
    if (c) setPanolLibre(c);
    if (d) setStockLibre(d);
  };

  const confirmarPedido = async () => {
    const q = parseFloat(String(pedir.cantidad).replace(",", "."));
    if (!(q > 0)) { showToast("⚠ Poné la cantidad"); return; }
    try {
      if (pedir.tipo === "herramienta") {
        await api.post(`/panol/herramientas/${pedir.item.id}/asignar`, {
          presupuesto_id: parseInt(id), cantidad: q, desde: today(),
        });
        showToast(`✓ ${q} ${pedir.item.nombre} salieron del pañol para esta obra`);
      } else {
        await api.post(`/stock/${pedir.item.id}/movimientos`, {
          tipo: "retiro", cantidad: q, presupuesto_id: parseInt(id), fecha: today(),
        });
        showToast(`✓ Se retiraron ${q} ${pedir.item.unidad} de ${pedir.item.nombre}`);
      }
      setPedir(null);
      refrescarPanol();
    } catch (e) { showToast("⚠ " + (e.response?.data?.detail || "No se pudo")); }
  };
  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id
  // Quien trabajo aca. Sale de la asistencia que se imputa a esta obra en
  // Personal; hasta ahora ese dato se cargaba y no se leia en ningun lado.
  const [personalObra, setPersonalObra] = useState(null);

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
      api.get(`/presupuestos/${id}/panol`).then(r => setPanolObra(r.data)).catch(() => {});
      api.get(`/presupuestos/${id}/personal`).then(r => setPersonalObra(r.data)).catch(() => {});
      api.get(`/presupuestos/${id}/stock`).then(r => setStockObra(r.data || [])).catch(() => {});
      api.get(`/panol/herramientas`).then(r => setPanolLibre(r.data?.herramientas || [])).catch(() => {});
      api.get(`/stock`).then(r => setStockLibre(r.data?.items || [])).catch(() => {});

      // Cuenta corriente
      const cc = await api.get(`/presupuestos/${id}/cuenta-corriente`).then(r => r.data);
      setCuentaCorriente(cc);
      const av = await api.get(`/presupuestos/${id}/avance`).then(r => r.data).catch(() => null);
      setAvance(av);
      const des = await api.get(`/presupuestos/${id}/desembolsos`).then(r => r.data).catch(() => []);
      setDesembolsos(Array.isArray(des) ? des : []);
      const arc = await api.get(`/presupuestos/${id}/archivos`).then(r => r.data).catch(() => []);
      setArchivos(Array.isArray(arc) ? arc : []);
      api.get('/almacenamiento/estado').then(r => setAlmacen(r.data)).catch(() => {});
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

  const guardarDesembolso = async () => {
    if (!editDes) return;
    try {
      await api.patch(`/presupuestos/${id}/desembolsos/${editDes.id}`, {
        avance_pct: parseFloat(editDes.avance_pct) || 0,
        fecha_real: editDes.fecha_real || null,
      });
      setEditDes(null); showToast("✓ Etapa actualizada"); cargar();
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo actualizar la etapa");
    }
  };

  // Cobrar contra una etapa concreta: asi el control financiero despues sabe
  // decir "Desembolso 2 — Casa Perez" en vez de un cobro suelto.
  const cobrarDesembolso = (d) => {
    setCobForm({ monto: String(d.saldo > 0 ? d.saldo : d.monto), fecha: today(),
                 forma_pago: "transferencia", referencia: "", nota: `Desembolso ${d.numero}`,
                 certificado_id: null, desembolso_id: d.id });
    setShowCobro(true);
  };

  // Las etapas al tablero: el planner tiene que mostrar todo lo pendiente del
  // estudio, venga de una obra o de un proyecto.
  const mandarAlPlanner = async () => {
    try {
      const r = await api.post(`/planner/desde-etapas/${id}`);
      const n = (r.data?.creadas || 0) + (r.data?.actualizadas || 0);
      showToast(`✓ ${n} etapa${n !== 1 ? "s" : ""} en el planner`);
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo mandar al planner");
    }
  };

  // Cobrar varias etapas juntas: el caso real es que el cliente deposita una
  // vez por dos o tres etapas cumplidas, y cargarlas de a una es tedioso.
  const cobrarEtapasElegidas = async () => {
    if (!etapasElegidas.length) return;
    setCobrandoLote(true);
    try {
      const r = await api.post(`/presupuestos/${id}/cobros/lote`, {
        desembolso_ids: etapasElegidas, fecha: today(),
      });
      setEtapasElegidas([]);
      showToast(r.data?.en_control_financiero
        ? `✓ ${r.data.cobros} cobro(s) · ya están en el control financiero`
        : `✓ ${r.data?.cobros} cobro(s) registrados`);
      cargar();
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo registrar el cobro");
    }
    setCobrandoLote(false);
  };

  const cambiarMetodologia = async (metodologia) => {
    await api.patch(`/presupuestos/${id}/metodologia`, { metodologia });
    if (metodologia === "desembolsos" && tab === "certificados") setTab("avance");
    showToast(metodologia === "desembolsos" ? "Gestión por desembolsos" : "Gestión por certificación");
    cargar();
  };

  // ── Certificado interno del contratista ─────────────────────────────────
  const abrirCertSub = async (sid) => {
    try {
      const r = await api.get(`/presupuestos/${id}/subcontratos/${sid}/certificados`);
      setCertSub(r.data);
      const sugerido = r.data?.pct_avance_obra;
      setCertForm({
        pct_acumulado: (sugerido != null && sugerido > (r.data?.pct_certificado || 0))
          ? String(Math.round(sugerido)) : "",
        fecha: today(), nota: "", generar_pago: true,
      });
    } catch (e) { showToast("No se pudo abrir el certificado"); }
  };

  const guardarCertSub = async () => {
    if (!certSub || certForm.pct_acumulado === "") return;
    try {
      const r = await api.post(`/presupuestos/${id}/subcontratos/${certSub.subcontrato.id}/certificados`, {
        pct_acumulado: parseFloat(certForm.pct_acumulado),
        fecha: certForm.fecha, nota: certForm.nota, ya_pagado: false,
      });
      setCertSub(r.data);
      setCertForm(f => ({ ...f, pct_acumulado: "", nota: "" }));
      showToast("✓ Certificado · ya está en el control financiero como pendiente");
      cargar();
    } catch (e) {
      showToast(e?.response?.data?.detail || "No se pudo certificar");
    }
  };

  const pagarCertSub = async (pagoId) => {
    try {
      const r = await api.patch(`/presupuestos/${id}/subcontratos/${certSub.subcontrato.id}/pagos/${pagoId}`,
                                { pagado: true, fecha: today() });
      setCertSub(r.data); showToast("✓ Pagado"); cargar();
    } catch (e) { showToast(e?.response?.data?.detail || "No se pudo marcar el pago"); }
  };

  const borrarCertSub = async (cid) => {
    if (!window.confirm("¿Borrar el último certificado?")) return;
    try {
      const r = await api.delete(`/presupuestos/${id}/subcontratos/${certSub.subcontrato.id}/certificados/${cid}`);
      setCertSub(r.data); showToast("Certificado borrado"); cargar();
    } catch (e) { showToast(e?.response?.data?.detail || "No se pudo borrar"); }
  };

  const guardarLineasSub = async (sid, lineas_ids) => {
    const sub = subcontratos.find(x => x.id === sid) || certSub?.subcontrato || {};
    await api.put(`/presupuestos/${id}/subcontratos/${sid}`, {
      nombre_contratista: sub.nombre_contratista, cuit_contratista: sub.cuit_contratista,
      descripcion_trabajo: sub.descripcion_trabajo, monto_total: sub.monto_total,
      fecha_inicio: sub.fecha_inicio, fecha_fin_estimada: sub.fecha_fin_estimada,
      tipo_pago: sub.tipo_pago, estado: sub.estado, notas: sub.notas,
      lineas_ids,
    });
    abrirCertSub(sid);
  };

  // ── Planos y documentacion ──────────────────────────────────────────────
  // El archivo va del navegador al bucket sin pasar por el backend: un plano
  // de 20 MB atravesando FastAPI le come memoria al mismo proceso que atiende
  // el cotizador. El backend solo firma y despues registra la fila.
  const subirArchivo = async (file) => {
    if (!file) return;
    if (file.size > (almacen.max_mb || 60) * 1024 * 1024) {
      showToast(`El archivo supera los ${almacen.max_mb} MB`); return;
    }
    setSubiendo({ nombre: file.name, pct: 0 });
    try {
      const { data: firma } = await api.post(`/presupuestos/${id}/archivos/subida`, {
        nombre: file.name, mime: file.type, bytes: file.size,
      });
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", firma.url);
        xhr.setRequestHeader("Content-Type", firma.mime);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable) setSubiendo({ nombre: file.name, pct: Math.round(e.loaded / e.total * 100) });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error("Falló la subida"));
        xhr.onerror = () => reject(new Error("Falló la subida"));
        xhr.send(file);
      });
      await api.post(`/presupuestos/${id}/archivos`, {
        clave: firma.clave, nombre: file.name, mime: firma.mime,
        tipo: file.type === "application/pdf" ? "plano" : "foto",
      });
      showToast("✓ Archivo subido"); cargar();
    } catch (e) {
      showToast(e?.response?.data?.detail || e.message || "No se pudo subir");
    }
    setSubiendo(null);
  };

  const cambiarVisibilidad = async (a) => {
    await api.patch(`/presupuestos/${id}/archivos/${a.id}`, { visible_cliente: !a.visible_cliente });
    showToast(a.visible_cliente ? "Ya no lo ve el cliente" : "✓ Ahora lo ve el cliente");
    cargar();
  };

  const borrarArchivo = async (a) => {
    if (!window.confirm(`¿Borrar "${a.nombre}"?`)) return;
    await api.delete(`/presupuestos/${id}/archivos/${a.id}`);
    showToast("Archivo borrado"); cargar();
  };

  const crearCobro = async () => {
    if (!cobForm.monto) return;
    const r = await api.post(`/presupuestos/${id}/cobros`, { ...cobForm, monto: parseFloat(cobForm.monto) });
    setShowCobro(false); setCobForm({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null, desembolso_id: null });
    showToast(r.data?.en_control_financiero
      ? "✓ Cobro registrado · ya está en el control financiero"
      : "✓ Cobro registrado");
    cargar();
  };

  const eliminarCobro = async (cid) => {
    if (!window.confirm("¿Eliminar este cobro?")) return;
    await api.delete(`/presupuestos/${id}/cobros/${cid}`);
    showToast("Cobro eliminado"); cargar();
  };

  // Ajustar una etapa pactada: pasa seguido que se renegocia, se le suma un
  // adicional o se le descuenta algo. Antes habia que rehacer el contrato.
  const [ajustando, setAjustando] = useState(null);
  const [ajusteForm, setAjusteForm] = useState({ monto: "", descripcion: "", fecha_vencimiento: "" });
  const abrirAjuste = (d) => {
    setAjusteForm({ monto: String(Math.round(d.monto || 0)), descripcion: d.descripcion || "",
                    fecha_vencimiento: d.fecha_vencimiento || "" });
    setAjustando(d);
  };
  const guardarAjuste = async () => {
    await api.patch(`/presupuestos/${id}/desembolsos/${ajustando.id}`, {
      monto: parseFloat(ajusteForm.monto) || 0,
      descripcion: ajusteForm.descripcion,
      fecha_vencimiento: ajusteForm.fecha_vencimiento || null,
    });
    setAjustando(null); showToast("✓ Etapa ajustada"); cargar();
  };

  // Un anticipo o adelanto no corresponde a ninguna etapa: es plata a cuenta.
  const registrarAnticipo = async () => {
    const txt = window.prompt("¿De cuánto es el anticipo?");
    if (!txt) return;
    const monto = parseFloat(String(txt).replace(/\./g, "").replace(",", "."));
    if (!monto || monto <= 0) { showToast("Monto inválido"); return; }
    const r = await api.post(`/presupuestos/${id}/cobros`, {
      monto, fecha: today(), forma_pago: "transferencia",
      nota: "Anticipo", es_anticipo: true,
    });
    showToast(r.data?.en_control_financiero
      ? "✓ Anticipo registrado · ya está en el control financiero"
      : "✓ Anticipo registrado");
    cargar();
  };

  const crearSubcontrato = async () => {
    if (!subForm.nombre_contratista) return;
    await api.post(`/presupuestos/${id}/subcontratos`, { ...subForm, monto_total: parseFloat(subForm.monto_total) || 0 });
    setShowSub(false); setSubForm({ nombre_contratista: "", cuit_contratista: "", tipo: "empresa", descripcion_trabajo: "", monto_total: "", fecha_inicio: today(), tipo_pago: "por_avance", estado: "activo", notas: "", lineas_ids: [] });
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
    const r = await api.post(`/presupuestos/${id}/compras`, {
      ...compraForm,
      // Si se cargaron materiales, el total sale de ellos: escribirlo aparte
      // invita a que los dos numeros no coincidan.
      monto_total: compraForm.items.length
        ? compraForm.items.reduce((a, it) => a + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0)
        : (parseFloat(compraForm.monto_total) || 0),
      // Solo la compra hecha mueve plata: una solicitud todavia no se pago.
      monto_pagado: compraForm.destino === "compra" ? (parseFloat(compraForm.monto_total) || 0) : 0,
    });
    setShowCompra(false); setCompraForm({ proveedor_nombre: "", fecha_pedido: today(), estado: "pedido", monto_total: "", nota: "", destino: "interna", lineas_ids: [], items: [] });
    showToast(r.data?.en_control_financiero ? "✓ Compra registrada · ya está en el control financiero" : "✓ Registrado");
    cargar();
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
    imprimirHTML(html, { titulo: "Obra" });
  };

  if (loading) return (
    <div style={{ minHeight: "100dvh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Syne',sans-serif", color: C.muted }}>
      Cargando...
    </div>
  );

  const total_pres = presupuesto?.totales?.total_precio_con_iva || 0;
  const cc = cuentaCorriente || {};
  // La metodologia manda: la obra que se cobra por desembolsos pactados no
  // certifica, asi que no tiene sentido rotularle todo como "certificado".
  const porDesembolsos = cc.metodologia === "desembolsos"
    || presupuesto?.metodologia === "desembolsos";
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
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: "'Syne', sans-serif" }}>
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
                ...(porDesembolsos ? [] : [{ label: "Certificados", icon: <Award size={16} strokeWidth={1.5} />, color: C.accent2, onClick: () => setTab("certificados") }]),
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
              <button onClick={() => setTab(porDesembolsos ? "avance" : "certificados")}
                style={{ ...btn(C.accent2), fontSize: 12, display:"flex", alignItems:"center", gap:5 }}>
                {porDesembolsos ? <TrendingUp size={13} strokeWidth={1.5} /> : <Award size={13} strokeWidth={1.5} />}
                {porDesembolsos ? "Avance" : "Certificados"}
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
            <option value="panol">Pañol</option>
            <option value="personal">Personal</option>
            {!porDesembolsos && <option value="certificados">Certificados</option>}
          </select>
        </div>
      ) : (
        <div className="tabs-scroll" style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", width: "100%" }}>
            <TabBtn id="resumen" label="Resumen" />
            <TabBtn id="contrato" label="Contrato" />
            <TabBtn id="cobros" label="Cobros" />
            <TabBtn id="subcontratos" label="Subcontratos" />
            <TabBtn id="compras" label="Compras" />
            <TabBtn id="panol" label="Pañol" />
            <TabBtn id="personal" label="Personal" />
            <TabBtn id="avance" label="Avance" />
            <TabBtn id="planos" label="Planos" />
            {!porDesembolsos && <TabBtn id="certificados" label="Certificados" />}
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
                      : avance.origen === "desembolso" ? "según las etapas cumplidas"
                      : avance.origen === "subcontrato" ? "según lo certificado a los contratistas"
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
            {avance?.origen === "subcontrato" && (
              <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>
                Parte de este avance viene de lo que le certificaste a los contratistas. Lo que
                cargues acá lo pisa a partir de su fecha.
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
                  {desembolsos.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", marginBottom: 8 }}>Etapas pactadas</div>
                      {desembolsos.map(d => {
                        const editando = editDes?.id === d.id;
                        const col = { cobrado: C.green, parcial: C.warn, cumplido: C.accent2, "en curso": C.accent2, pendiente: C.muted }[d.estado] || C.muted;
                        return (
                          <div key={d.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border2}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>Etapa {d.numero}</span>
                                <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{d.descripcion}</span>
                                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                                  Vence {d.fecha_vencimiento || "—"}
                                  {d.fecha_real ? ` · cumplida ${d.fecha_real}` : ""}
                                  {d.cobrado > 0 ? ` · cobrado ${fmt(d.cobrado)}` : ""}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                                <span style={{ fontSize: 12, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>{Number(d.avance_pct || 0).toFixed(0)}%</span>
                                <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(d.monto)}</span>
                                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: col + "1a", color: col, textTransform: "capitalize" }}>{d.estado}</span>
                              </div>
                            </div>
                            <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden", marginTop: 8 }}>
                              <div style={{ height: "100%", width: `${Math.min(100, d.avance_pct || 0)}%`, background: C.accent2, borderRadius: 3, transition: "width .4s" }} />
                            </div>
                            {editando ? (
                              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                                <input type="number" min="0" max="100" value={editDes.avance_pct}
                                  onChange={e => setEditDes(v => ({ ...v, avance_pct: e.target.value }))}
                                  style={{ width: 90, padding: "6px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, textAlign: "right", background: C.surface, color: C.text }} />
                                <span style={{ fontSize: 12, color: C.muted }}>% cumplido</span>
                                <input type="date" value={editDes.fecha_real || ""}
                                  onChange={e => setEditDes(v => ({ ...v, fecha_real: e.target.value }))}
                                  style={{ padding: "6px 9px", border: `1px solid ${C.border}`, borderRadius: 7, fontFamily: "inherit", fontSize: 12.5, background: C.surface, color: C.text }} />
                                <button onClick={guardarDesembolso} style={{ padding: "6px 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 7, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Guardar</button>
                                <button onClick={() => setEditDes(null)} style={{ padding: "6px 12px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12.5, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                                <button onClick={() => setEditDes({ id: d.id, avance_pct: d.avance_pct || 0, fecha_real: d.fecha_real || "" })}
                                  style={{ padding: "5px 12px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.accent2, cursor: "pointer", fontFamily: "inherit" }}>
                                  Marcar avance
                                </button>
                                {d.saldo > 0 && (
                                  <button onClick={() => cobrarDesembolso(d)}
                                    style={{ padding: "5px 12px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.green, cursor: "pointer", fontFamily: "inherit" }}>
                                    Registrar cobro de {fmt(d.saldo)}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button onClick={mandarAlPlanner}
                          style={{ padding: "6px 13px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.accent2, cursor: "pointer", fontFamily: "inherit" }}>
                          Mandar las etapas al planner
                        </button>
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                        El avance de las etapas alimenta el avance del trabajo, ponderado por el peso
                        en plata de cada una. El cobro que registres acá entra al control financiero
                        identificado como esa etapa, y el cliente ve las etapas en su portal.
                      </div>
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
          <>
          {/* Las etapas pendientes, a la vista y cobrables de a varias */}
          {desembolsos.some(d => d.saldo > 0) && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Etapas por cobrar</div>
                <button onClick={registrarAnticipo}
                  style={{ padding: "5px 12px", borderRadius: 7, border: `1px solid ${C.accent}`,
                           background: "transparent", color: C.accent, fontSize: 12, fontWeight: 700,
                           cursor: "pointer", fontFamily: "inherit" }}>
                  + Anticipo / adelanto
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, marginBottom: 10, lineHeight: 1.5 }}>
                Tildá las que te pagaron y registralas juntas. Cada una queda como su propio
                cobro, y entran solas al control financiero.
              </div>
              {desembolsos.filter(d => d.saldo > 0).map(d => {
                const elegida = etapasElegidas.includes(d.id);
                return (
                  <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border2}`, cursor: "pointer" }}>
                    <input type="checkbox" checked={elegida}
                      onChange={() => setEtapasElegidas(v => elegida ? v.filter(x => x !== d.id) : [...v, d.id])} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Etapa {d.numero}</span>
                      <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{d.descripcion}</span>
                      <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>
                        {Number(d.avance_pct || 0).toFixed(0)}% cumplido
                        {d.fecha_vencimiento ? ` · vence ${d.fecha_vencimiento}` : ""}
                        {d.cobrado > 0 ? ` · ya cobrado ${fmt(d.cobrado)}` : ""}
                      </span>
                    </span>
                    <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13.5 }}>{fmt(d.saldo)}</span>
                    <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); abrirAjuste(d); }}
                      style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.border}`,
                               background: "transparent", color: C.muted, fontSize: 11.5,
                               cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>Ajustar</button>
                  </label>
                );
              })}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12.5, color: C.muted }}>
                  {etapasElegidas.length > 0
                    ? <>Seleccionadas: <b style={{ color: C.text, fontFamily: "'IBM Plex Mono',monospace" }}>
                        {fmt(desembolsos.filter(d => etapasElegidas.includes(d.id)).reduce((a, d) => a + d.saldo, 0))}
                      </b></>
                    : "Ninguna seleccionada"}
                </div>
                <button onClick={cobrarEtapasElegidas} disabled={!etapasElegidas.length || cobrandoLote}
                  style={{ padding: "9px 18px", background: C.green, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: (!etapasElegidas.length || cobrandoLote) ? .45 : 1 }}>
                  {cobrandoLote ? "Registrando…" : "Registrar cobro"}
                </button>
              </div>
            </div>
          )}
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
          </>
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
                  {s.tipo_pago === "por_avance" && (
                    <button onClick={() => abrirCertSub(s.id)} style={{ ...btn(C.accent2), fontSize: 12 }}>Certificar avance</button>
                  )}
                  <button onClick={() => eliminarSubcontrato(s.id)} style={{ ...btn("#fee2e2"), color: C.red, fontSize: 12 }}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── PLANOS Y DOCUMENTACION ── */}
        {tab === "planos" && (
          <div>
            {!almacen.configurado ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.warn}`, borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Falta configurar el almacenamiento</div>
                <div style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Los archivos se guardan fuera de la base. Hasta que esté configurado,
                  esta sección queda deshabilitada — nada más del sistema se ve afectado.
                </div>
              </div>
            ) : (
              <>
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Planos y documentación</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 3, maxWidth: 520, lineHeight: 1.5 }}>
                        PDF e imágenes, hasta {almacen.max_mb} MB. Se suben acá y se ven en la app,
                        sin bajarlos. El cliente sólo ve los que marques.
                      </div>
                    </div>
                    <label style={{ padding: "9px 16px", background: C.accent, color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: subiendo ? "wait" : "pointer", opacity: subiendo ? .6 : 1 }}>
                      {subiendo ? `Subiendo… ${subiendo.pct}%` : "+ Subir archivo"}
                      <input type="file" accept="application/pdf,image/*" disabled={!!subiendo}
                        onChange={e => { subirArchivo(e.target.files?.[0]); e.target.value = ""; }}
                        style={{ display: "none" }} />
                    </label>
                  </div>
                  {subiendo && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 5 }}>{subiendo.nombre}</div>
                      <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${subiendo.pct}%`, background: C.accent, borderRadius: 3, transition: "width .2s" }} />
                      </div>
                    </div>
                  )}
                </div>

                {archivos.length === 0 ? (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center", color: C.muted, fontSize: 13 }}>
                    Todavía no hay planos cargados en esta obra.
                  </div>
                ) : (
                  <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
                    {archivos.map(a => (
                      <div key={a.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderBottom: `1px solid ${C.border2}`, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            {(a.bytes / 1024 / 1024).toFixed(1)} MB · {a.subido_por || "—"} · {String(a.created_at).slice(0, 10)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                          <button onClick={() => cambiarVisibilidad(a)}
                            style={{ padding: "5px 11px", borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                                     border: `1px solid ${a.visible_cliente ? C.accent : C.border}`,
                                     background: a.visible_cliente ? "rgba(5,150,105,.09)" : "none",
                                     color: a.visible_cliente ? C.accent : C.muted }}>
                            {a.visible_cliente ? "Lo ve el cliente" : "Sólo interno"}
                          </button>
                          <button onClick={() => setVerArchivo(a)}
                            style={{ padding: "5px 11px", background: "none", border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 12, color: C.accent2, cursor: "pointer", fontFamily: "inherit" }}>Ver</button>
                          <button onClick={() => borrarArchivo(a)}
                            style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Visor: el navegador renderiza PDFs e imagenes solo, sin libreria */}
        {verArchivo && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 400, display: "flex", flexDirection: "column" }}
            onClick={() => setVerArchivo(null)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", color: "#fff", gap: 12 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{verArchivo.nombre}</div>
              <button onClick={() => setVerArchivo(null)}
                style={{ background: "none", border: "none", color: "#fff", fontSize: 26, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, padding: "0 18px 18px" }} onClick={e => e.stopPropagation()}>
              {String(verArchivo.mime || "").startsWith("image/") ? (
                <img src={verArchivo.url} alt={verArchivo.nombre}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              ) : (
                <iframe src={verArchivo.url} title={verArchivo.nombre}
                  style={{ width: "100%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
              )}
            </div>
          </div>
        )}

        {/* ── CERTIFICADO INTERNO DEL CONTRATISTA ── */}
        {certSub && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}
            onClick={() => setCertSub(null)}>
            <div style={{ width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", background: C.surface, borderRadius: 14, padding: 22 }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>{certSub.subcontrato.nombre_contratista}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>Certificado interno · no lo ve el cliente</div>
                </div>
                <button onClick={() => setCertSub(null)} style={{ background: "none", border: "none", fontSize: 22, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(122px, 1fr))", gap: 8, marginTop: 16 }}>
                {[["Pactado", certSub.monto_total, C.text],
                  ["Certificado", certSub.certificado, C.accent2],
                  ["Pagado", certSub.pagado, C.green],
                  ["Le debés", certSub.a_pagar ?? certSub.saldo_a_pagar, (certSub.a_pagar ?? certSub.saldo_a_pagar) > 0 ? C.red : C.green]].map(([l, v, col]) => (
                  <div key={l} style={{ background: C.surface2, borderRadius: 9, padding: "10px 12px" }}>
                    <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px" }}>{l}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: col, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(v || 0)}</div>
                  </div>
                ))}
              </div>

              {/* Contra que costo se lo compara */}
              <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Qué ítems cubre</div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>
                  Elegí los ítems del presupuesto que hace este contratista. Sirve para comparar
                  lo que le pagás contra lo que habías costeado que salía hacerlos.
                </div>
                <select multiple value={(certSub.lineas_ids || []).map(String)}
                  onChange={e => guardarLineasSub(certSub.subcontrato.id, [...e.target.selectedOptions].map(o => parseInt(o.value)))}
                  style={{ width: "100%", marginTop: 10, minHeight: 96, padding: 8, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, background: C.surface, color: C.text }}>
                  {lineasObra.map(l => (
                    <option key={l.id} value={l.id}>{l.nombre_override || l.nombre_item || l.nombre_libre}</option>
                  ))}
                </select>
                {certSub.costo_ejecucion_cubierto > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, flexWrap: "wrap", fontSize: 12.5 }}>
                    <span style={{ color: C.muted }}>Costo de ejecución de esos ítems</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{fmt(certSub.costo_ejecucion_cubierto)}</span>
                  </div>
                )}
                {certSub.diferencia_vs_costo !== null && certSub.diferencia_vs_costo !== undefined && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5, fontSize: 12.5 }}>
                    <span style={{ color: C.muted }}>
                      {certSub.diferencia_vs_costo > 0 ? "Te sale más caro que lo costeado" : "Te sale más barato que lo costeado"}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, color: certSub.diferencia_vs_costo > 0 ? C.red : C.green }}>
                      {certSub.diferencia_vs_costo > 0 ? "+" : ""}{fmt(certSub.diferencia_vs_costo)}
                    </span>
                  </div>
                )}
              </div>

              {/* Certificar */}
              <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Certificar avance</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  {[["Certificado anterior", `${Number(certSub.pct_certificado || 0).toFixed(0)}%`, fmt(certSub.certificado)],
                    ["Este período", certForm.pct_acumulado !== ""
                      ? `${Math.max(0, (parseFloat(certForm.pct_acumulado) || 0) - Number(certSub.pct_certificado || 0)).toFixed(0)}%` : "—",
                      certForm.pct_acumulado !== ""
                        ? fmt(Math.max(0, (certSub.monto_total || 0) * (parseFloat(certForm.pct_acumulado) || 0) / 100 - (certSub.certificado || 0)))
                        : "—"],
                    ["Quedaría acumulado", certForm.pct_acumulado !== "" ? `${(parseFloat(certForm.pct_acumulado) || 0).toFixed(0)}%` : "—",
                      certForm.pct_acumulado !== ""
                        ? fmt((certSub.monto_total || 0) * (parseFloat(certForm.pct_acumulado) || 0) / 100) : "—"],
                  ].map(([l, pct, monto]) => (
                    <div key={l} style={{ flex: 1, minWidth: 118, background: C.surface2, borderRadius: 9, padding: "9px 11px" }}>
                      <div style={{ fontSize: 9.5, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px" }}>{l}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'IBM Plex Mono',monospace" }}>{pct}</div>
                      <div style={{ fontSize: 11, color: C.muted, fontFamily: "'IBM Plex Mono',monospace" }}>{monto}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                  Poné el acumulado nuevo.
                  {certSub.pct_avance_obra != null && (
                    <> El avance de obra de esos ítems va por el{" "}
                      <b style={{ color: C.accent2 }}>{Number(certSub.pct_avance_obra).toFixed(0)}%</b>.</>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
                  Lo que certifiques acá se carga al avance de la obra en los ítems que cubre.
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <input type="number" min="0" max="100" placeholder="%" value={certForm.pct_acumulado}
                    onChange={e => setCertForm(f => ({ ...f, pct_acumulado: e.target.value }))}
                    style={{ width: 92, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, textAlign: "right", background: C.surface, color: C.text }} />
                  <input type="date" value={certForm.fecha} onChange={e => setCertForm(f => ({ ...f, fecha: e.target.value }))}
                    style={{ padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, background: C.surface, color: C.text }} />
                  <input placeholder="Nota (opcional)" value={certForm.nota} onChange={e => setCertForm(f => ({ ...f, nota: e.target.value }))}
                    style={{ flex: 1, minWidth: 140, padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: "inherit", fontSize: 12.5, background: C.surface, color: C.text }} />
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginTop: 10, lineHeight: 1.5 }}>
                  Al certificar queda registrado lo que le debés, y aparece en el control
                  financiero como pendiente. Cuando se lo pagues, tocás Pagar.
                </div>
                <button onClick={guardarCertSub} disabled={certForm.pct_acumulado === ""}
                  style={{ marginTop: 12, padding: "9px 18px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: certForm.pct_acumulado === "" ? .5 : 1 }}>
                  Certificar
                </button>
              </div>

              {(certSub.certificados || []).length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Certificados emitidos</div>
                  {certSub.certificados.map((c, i, arr) => {
                    const mov = (certSub.movimientos || []).find(m => m.cert_id === c.id);
                    const pendiente = mov && (mov.estado || "pagado") === "pendiente";
                    return (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border2}`, fontSize: 12.5, flexWrap: "wrap" }}>
                        <span style={{ color: C.muted, minWidth: 0 }}>
                          Nº {c.numero} · {c.fecha} · {Number(c.pct_acumulado).toFixed(0)}% acum.
                          {c.nota ? ` · ${c.nota}` : ""}
                          {mov && !pendiente && mov.fecha_pago ? ` · pagado ${mov.fecha_pago}` : ""}
                        </span>
                        <span style={{ display: "flex", gap: 9, alignItems: "center" }}>
                          <b style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto_periodo)}</b>
                          {pendiente ? (
                            <button onClick={() => pagarCertSub(mov.id)}
                              style={{ padding: "4px 14px", background: C.green, color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                              Pagar
                            </button>
                          ) : mov ? (
                            <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Pagado</span>
                          ) : null}
                          {i === arr.length - 1 && (
                            <button onClick={() => borrarCertSub(c.id)}
                              style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── COMPRAS ── */}
        {tab === "personal" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Quién trabajó acá</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Sale de la asistencia imputada a esta obra. Se marca desde
              <button onClick={() => navigate("/personal")}
                style={{ background: "none", border: "none", padding: "0 4px", cursor: "pointer",
                         color: C.accent, font: "inherit", textDecoration: "underline" }}>Personal</button>
              eligiendo la obra antes de marcar los días.
            </div>

            {!personalObra || (!personalObra.cuantos && !(personalObra.asignados_del_estudio || []).length) ? (
              <div style={{ padding: "18px 16px", borderRadius: 10, background: C.surface,
                            border: `1px solid ${C.border}`, fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
                Todavía nadie tiene jornadas imputadas a esta obra.
                <div style={{ marginTop: 6 }}>
                  En Personal → Asistencia, elegí esta obra en el selector de arriba antes de marcar
                  los días. Con el botón ✎ de cada fila también podés cargar las horas exactas.
                </div>
              </div>
            ) : (
              <>
                {personalObra.cuantos > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                                gap: 12, marginBottom: 20 }}>
                    {[["Personas", personalObra.cuantos],
                      ["Jornadas", personalObra.jornadas],
                      ["Horas", personalObra.horas ? personalObra.horas + " h" : "—"],
                      ["Esta semana", (personalObra.semana?.jornadas || 0) + " jorn."]].map(([k, v]) => (
                      <div key={k} style={{ background: C.surface, border: `1px solid ${C.border}`,
                                            borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 10.5, color: C.muted, textTransform: "uppercase",
                                      letterSpacing: .6 }}>{k}</div>
                        <div style={{ fontFamily: "var(--mono, 'IBM Plex Mono', monospace)", fontSize: 19,
                                      fontWeight: 800, marginTop: 2 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(personalObra.semana?.quienes || []).length > 0 && (
                  <div style={{ padding: "10px 13px", borderRadius: 10, marginBottom: 16,
                                background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 13 }}>
                    Esta semana están en la obra: <b>{personalObra.semana.quienes.join(", ")}</b>
                    {personalObra.semana.horas ? ` · ${personalObra.semana.horas} h` : ""}
                  </div>
                )}

                {(personalObra.detalle || []).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                        marginBottom: 7, borderRadius: 10, background: C.surface,
                                        border: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {p.nombre}
                        {!p.activo && <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}> · dado de baja</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>
                        {p.funcion ? p.funcion + " · " : ""}
                        {p.dias} día{p.dias === 1 ? "" : "s"}
                        {p.primero ? ` · desde el ${new Date(p.primero + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                        {p.ultimo ? ` · último ${new Date(p.ultimo + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontFamily: "var(--mono, 'IBM Plex Mono', monospace)" }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.jornadas} jorn.</div>
                      {p.horas > 0 && <div style={{ fontSize: 11.5, color: C.muted }}>{p.horas} h</div>}
                    </div>
                  </div>
                ))}

                {(personalObra.asignados_del_estudio || []).length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6,
                                  color: C.muted, margin: "20px 0 8px" }}>Del estudio, asignados a esta obra</div>
                    {personalObra.asignados_del_estudio.map((a, i) => (
                      <div key={i} style={{ padding: "9px 12px", marginBottom: 6, borderRadius: 10,
                                            background: C.surface, border: `1px solid ${C.border}`,
                                            fontSize: 13.5 }}>
                        {a.nombre} <span style={{ color: C.muted, fontSize: 11.5 }}>· {a.rol}</span>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {tab === "panol" && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Lo que hay en la obra</div>
            <div style={{ fontSize: 12.5, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Herramientas del pañol y material que salió del depósito. Se maneja desde
              <button onClick={() => navigate("/panol")}
                style={{ background: "none", border: "none", padding: "0 4px", cursor: "pointer",
                         color: C.accent, font: "inherit", textDecoration: "underline" }}>Pañol y depósito</button>.
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6,
                            color: C.muted }}>Herramientas acá</div>
              {panolLibre.some(h => h.disponible > 0) && (
                <button onClick={() => setPedir({ tipo: "herramienta", item: null, cantidad: 1 })}
                  style={{ marginLeft: "auto", padding: "6px 13px", borderRadius: 8, cursor: "pointer",
                           font: "inherit", fontSize: 12.5, fontWeight: 700,
                           background: C.accent, border: "none", color: "#fff" }}>
                  + Pedir del pañol
                </button>
              )}
            </div>
            {panolObra.en_obra.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
                Ninguna herramienta del pañol está asignada a esta obra.
              </div>
            ) : panolObra.en_obra.map(h => (
              <div key={h.asignacion_id}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 7,
                         borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{h.nombre}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>
                    {h.desde ? `Desde el ${new Date(h.desde + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                    {h.quien ? ` · ${h.quien}` : ""}{h.nota ? ` · ${h.nota}` : ""}
                  </div>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, flexShrink: 0 }}>
                  {h.cantidad} {h.unidad}
                </div>
                <button onClick={async () => {
                    try {
                      await api.post(`/panol/asignaciones/${h.asignacion_id}/devolver`, { hasta: today() });
                      await refrescarPanol();
                      showToast("✓ Volvió al pañol");
                    } catch (e) { showToast("⚠ No se pudo"); }
                  }}
                  style={{ flexShrink: 0, padding: "5px 11px", borderRadius: 8, cursor: "pointer",
                           font: "inherit", fontSize: 12, background: "transparent",
                           border: `1px solid ${C.border}`, color: C.text }}>Volvió</button>
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "20px 0 8px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6,
                            color: C.muted }}>Material que se llevó del depósito</div>
              {stockLibre.some(m => m.disponible > 0) && (
                <button onClick={() => setPedir({ tipo: "material", item: null, cantidad: "" })}
                  style={{ marginLeft: "auto", padding: "6px 13px", borderRadius: 8, cursor: "pointer",
                           font: "inherit", fontSize: 12.5, fontWeight: 700,
                           background: C.accent, border: "none", color: "#fff" }}>
                  + Retirar del depósito
                </button>
              )}
            </div>
            {stockObra.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>
                Esta obra todavía no retiró material del depósito.
              </div>
            ) : stockObra.map(m => (
              <div key={m.stock_id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                         padding: "10px 12px", marginBottom: 7, borderRadius: 10,
                         background: C.surface, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{m.nombre}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>
                  {m.cantidad} {m.unidad}
                </span>
              </div>
            ))}

            {panolObra.devueltas.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: .6,
                              color: C.muted, margin: "20px 0 8px" }}>Ya volvieron al pañol</div>
                {panolObra.devueltas.map(h => (
                  <div key={h.asignacion_id}
                    style={{ display: "flex", justifyContent: "space-between", padding: "7px 12px",
                             marginBottom: 5, borderRadius: 8, background: C.surface2, fontSize: 12.5, color: C.muted }}>
                    <span>{h.cantidad} {h.nombre}</span>
                    <span>
                      {h.desde ? new Date(h.desde + "T12:00:00").toLocaleDateString("es-AR") : "—"}
                      {" → "}
                      {h.hasta ? new Date(h.hasta + "T12:00:00").toLocaleDateString("es-AR") : ""}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

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

      {pedir && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 520,
                      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setPedir(null)}>
          <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                        width: "min(520px,100%)", maxHeight: "90dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              {pedir.tipo === "herramienta" ? "Traer una herramienta a la obra" : "Retirar material del depósito"}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 14, lineHeight: 1.5 }}>
              Sale del {pedir.tipo === "herramienta" ? "pañol" : "depósito"} y queda anotado acá.
              Es lo mismo que hacerlo desde Pañol y depósito: son los dos lados de la misma cuenta.
            </div>

            {!pedir.item ? (
              <>
                {(pedir.tipo === "herramienta"
                  ? panolLibre.filter(h => h.disponible > 0)
                  : stockLibre.filter(m => m.disponible > 0)
                ).map(x => (
                  <button key={x.id} onClick={() => setPedir(p => ({ ...p, item: x, cantidad: p.tipo === "herramienta" ? 1 : "" }))}
                    style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between",
                             alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 6, cursor: "pointer",
                             font: "inherit", borderRadius: 9, border: `1px solid ${C.border}`, background: C.surface2 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{x.nombre}</span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12.5, color: C.accent, flexShrink: 0 }}>
                      {x.disponible} {x.unidad} libre{x.disponible !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </>
            ) : (
              <>
                <div style={{ padding: "10px 12px", borderRadius: 9, marginBottom: 14,
                              background: "rgba(5,150,105,.08)", border: `1px solid ${C.accent}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{pedir.item.nombre}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                    Quedan {pedir.item.disponible} {pedir.item.unidad}
                  </div>
                </div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Cuánto</label>
                <input type="number" inputMode="decimal" autoFocus value={pedir.cantidad}
                  onChange={e => setPedir(p => ({ ...p, cantidad: e.target.value }))}
                  style={{ ...inp, fontFamily: "'IBM Plex Mono',monospace", fontSize: 18, textAlign: "right" }} />
                <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                  <button onClick={() => setPedir(p => ({ ...p, item: null }))}
                    style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", font: "inherit",
                             fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                    Elegir otro
                  </button>
                  <button onClick={confirmarPedido}
                    style={{ flex: 1.6, padding: "12px 0", borderRadius: 10, cursor: "pointer", font: "inherit",
                             fontSize: 14, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
                    {pedir.tipo === "herramienta" ? "Traer a la obra" : "Retirar"}
                  </button>
                </div>
              </>
            )}

            {!pedir.item && (
              <button onClick={() => setPedir(null)}
                style={{ width: "100%", marginTop: 8, padding: "11px 0", borderRadius: 10, cursor: "pointer",
                         font: "inherit", fontSize: 13.5, background: "transparent",
                         border: `1px solid ${C.border}`, color: C.muted }}>Cerrar</button>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL COBRO ── */}
      {showCobro && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, border: `1px solid ${C.border}`, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar cobro</div>
              <button onClick={() => setShowCobro(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>

            {/* Lo que está pendiente de cobro tiene que estar acá adentro. Si
                no, hay que ir a buscar el monto a otra pantalla, anotarlo y
                volver a tipearlo: se equivoca cualquiera. */}
            {(() => {
              const certPend = (certificados || []).filter(c => {
                const total = Number(c.total_cobrar ?? c.total_periodo ?? c.monto_periodo ?? c.monto_total ?? 0);
                const cobrado = (cobros || [])
                  .filter(x => x.certificado_id === c.id)
                  .reduce((a, x) => a + Number(x.monto || 0), 0);
                return total - cobrado > 1;
              });
              if (desembolsos.some(d => d.saldo > 0) || certPend.length) return null;
              return (
                <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10,
                              background: C.surface2, border: `1px solid ${C.border}`, fontSize: 12.5,
                              color: C.muted, lineHeight: 1.55 }}>
                  <b style={{ color: C.text }}>No hay nada pactado pendiente de cobro.</b><br />
                  Si esta obra se cobra por etapas, cargalas en <b>Cobros → Etapas de pago</b> y
                  después aparecen acá para cobrarlas de un toque. Mientras tanto, cargá el monto
                  a mano: sirve igual para un anticipo o un adelanto.
                </div>
              );
            })()}

            {/* Certificados emitidos que el cliente todavía no pagó */}
            {(() => {
              const pend = (certificados || []).map(c => {
                const total = Number(c.total_cobrar ?? c.total_periodo ?? c.monto_periodo ?? c.monto_total ?? 0);
                const cobrado = (cobros || [])
                  .filter(x => x.certificado_id === c.id)
                  .reduce((a, x) => a + Number(x.monto || 0), 0);
                return { ...c, saldo: total - cobrado };
              }).filter(c => c.saldo > 1);
              if (!pend.length) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 7 }}>
                    Certificados emitidos sin cobrar
                  </div>
                  {pend.map(c => {
                    const elegida = cobForm.certificado_id === c.id;
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setCobForm(f => elegida
                          ? { ...f, certificado_id: null, monto: "", nota: "" }
                          : { ...f, certificado_id: c.id, desembolso_id: null,
                              monto: String(Math.round(c.saldo)), nota: `Certificado Nº ${c.numero}` })}
                        style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between",
                                 gap: 10, alignItems: "center", padding: "9px 12px", marginBottom: 6, cursor: "pointer",
                                 font: "inherit", borderRadius: 9,
                                 border: `1px solid ${elegida ? C.accent : C.border}`,
                                 background: elegida ? "rgba(5,150,105,.08)" : C.surface2 }}>
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Certificado Nº {c.numero}</span>
                          <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>
                            {c.fecha ? new Date(c.fecha + "T12:00:00").toLocaleDateString("es-AR") : ""}
                          </span>
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, flexShrink: 0 }}>{fmt(c.saldo)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {desembolsos.some(d => d.saldo > 0) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 7 }}>
                  ¿Qué etapa te pagaron?
                </div>
                {desembolsos.filter(d => d.saldo > 0).map(d => {
                  const elegida = cobForm.desembolso_id === d.id;
                  return (
                    <button key={d.id} type="button"
                      onClick={() => setCobForm(f => elegida
                        ? { ...f, desembolso_id: null, monto: "", nota: "" }
                        : { ...f, desembolso_id: d.id, certificado_id: null, monto: String(d.saldo), nota: `Etapa ${d.numero}` })}
                      style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between",
                               gap: 10, alignItems: "center", padding: "9px 12px", marginBottom: 6, cursor: "pointer",
                               font: "inherit", borderRadius: 9,
                               border: `1px solid ${elegida ? C.accent : C.border}`,
                               background: elegida ? "rgba(5,150,105,.08)" : C.surface2 }}>
                      <span style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>Etapa {d.numero}</span>
                        <span style={{ display: "block", fontSize: 11, color: C.muted, marginTop: 1 }}>
                          {d.descripcion || "Sin descripción"} · {Number(d.avance_pct || 0).toFixed(0)}% cumplido
                        </span>
                      </span>
                      <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, flexShrink: 0 }}>{fmt(d.saldo)}</span>
                    </button>
                  );
                })}
                <button type="button" onClick={() => setCobForm(f => ({ ...f, desembolso_id: null, monto: "", nota: "" }))}
                  style={{ background: "none", border: "none", padding: 0, marginTop: 2, fontSize: 11.5,
                           color: C.muted, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  Es un cobro que no corresponde a ninguna etapa
                </button>
              </div>
            )}
            <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
              {["Anticipo", "Adelanto", "Ajuste"].map(t => (
                <button key={t} type="button"
                  onClick={() => setCobForm(f => ({ ...f, desembolso_id: null, certificado_id: null, nota: t }))}
                  style={{ flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", font: "inherit",
                           fontSize: 12,
                           border: `1px solid ${cobForm.nota === t ? C.accent : C.border}`,
                           background: cobForm.nota === t ? "rgba(5,150,105,.08)" : "transparent",
                           color: cobForm.nota === t ? C.accent : C.muted }}>
                  {t}
                </button>
              ))}
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
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>
                ¿Qué ítems del presupuesto hace? <span style={{ color: C.muted }}>(opcional, se puede elegir más de uno)</span>
              </label>
              {lineasObra.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>Este presupuesto todavía no tiene ítems cargados.</div>
              ) : (
                <div style={{ maxHeight: 168, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {lineasObra.map(l => {
                    const elegida = subForm.lineas_ids.includes(l.id);
                    return (
                      <div key={l.id} onClick={() => setSubForm(p => ({ ...p,
                          lineas_ids: elegida ? p.lineas_ids.filter(x => x !== l.id) : [...p.lineas_ids, l.id] }))}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer",
                                 borderBottom: `1px solid ${C.border}`, background: elegida ? "#f0fdf4" : "transparent" }}>
                        <input type="checkbox" readOnly checked={elegida} style={{ pointerEvents: "none", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nombre_override || l.nombre_libre || l.nombre}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{l.rubro}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {subForm.lineas_ids.length > 0 && (
                <div style={{ fontSize: 11.5, color: C.accent, marginTop: 6 }}>
                  {subForm.lineas_ids.length} ítem{subForm.lineas_ids.length > 1 ? "s" : ""} asignado{subForm.lineas_ids.length > 1 ? "s" : ""} · el Gantt va a mostrar quién los ejecuta
                </div>
              )}
            </div>
            <button onClick={crearSubcontrato} style={{ ...btn(C.accent), width: "100%", padding: 12 }}>Crear subcontrato</button>
          </div>
        </div>
      )}

      {/* ── MODAL AJUSTAR ETAPA ── */}
      {ajustando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 620,
                      display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setAjustando(null)}>
          <div style={{ background: C.surface, borderRadius: 14, padding: 22, width: "min(420px,100%)",
                        border: `1px solid ${C.border}`, maxHeight: '88vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 3 }}>Ajustar etapa {ajustando.numero}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
              Si se renegoció, se le sumó un adicional o se le descontó algo.
              {ajustando.cobrado > 0 && <> Ya se cobró {fmt(ajustando.cobrado)} de esta etapa.</>}
            </div>
            {[["Monto pactado", "monto", "number"], ["Descripción", "descripcion", "text"], ["Vence", "fecha_vencimiento", "date"]].map(([lab, key, tipo]) => (
              <div key={key} style={{ marginBottom: 11 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>{lab}</label>
                <input style={inp} type={tipo} value={ajusteForm[key]}
                  onChange={e => setAjusteForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setAjustando(null)} style={{ ...btn(C.surface2), flex: 1, padding: 11, color: C.text }}>Cancelar</button>
              <button onClick={guardarAjuste} style={{ ...btn(C.accent), flex: 2, padding: 11 }}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL PAGO SUBCONTRATO ── */}
      {showPagoSub && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, border: `1px solid ${C.border}`, maxHeight: '88vh', overflowY: 'auto' }}>
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
          <div style={{ background: C.surface, borderRadius: 16, padding: 24, width: "100%", maxWidth: 420, border: `1px solid ${C.border}`, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Registrar compra</div>
              <button onClick={() => setShowCompra(false)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 22 }}>×</button>
            </div>

            {/* Que es esta compra: de eso depende que pasa con ella despues */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 7 }}>
                ¿Qué estás registrando?
              </div>
              {[["interna", "Solicitud interna", "Un pedido del estudio. No lo ve el cliente ni toca la plata."],
                ["cliente", "Solicitud para el cliente", "Aparece en su portal para que la vea y la apruebe."],
                ["compra", "Compra hecha", "Ya se compró: impacta en la obra y va al control financiero como egreso."],
              ].map(([valor, titulo, ayuda]) => {
                const elegido = compraForm.destino === valor;
                return (
                  <button key={valor} type="button" onClick={() => setCompraForm(p => ({ ...p, destino: valor }))}
                    style={{ width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 6, cursor: "pointer",
                             font: "inherit", borderRadius: 9,
                             border: `1px solid ${elegido ? C.accent : C.border}`,
                             background: elegido ? "rgba(5,150,105,.08)" : C.surface2 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{titulo}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{ayuda}</div>
                  </button>
                );
              })}
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
            <div style={{ margin: "14px 0 6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: C.muted }}>
                  Materiales <span style={{ color: C.muted }}>(opcional — si los cargás, el total sale de acá)</span>
                </label>
                <button type="button" onClick={() => setCompraForm(p => ({ ...p,
                    items: [...p.items, { material_nombre: "", unidad: "u", cantidad: "", precio_unitario: "", linea_id: "" }] }))}
                  style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${C.accent}`, background: "transparent",
                           color: C.accent, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>+ Material</button>
              </div>
              {compraForm.items.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 62px 88px 1fr 26px", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input style={{ ...inp, fontSize: 12.5 }} placeholder="Material" value={it.material_nombre}
                    onChange={e => setCompraForm(p => { const a = [...p.items]; a[i] = { ...a[i], material_nombre: e.target.value }; return { ...p, items: a }; })} />
                  <input style={{ ...inp, fontSize: 12.5, textAlign: "center" }} type="number" placeholder="Cant." value={it.cantidad}
                    onChange={e => setCompraForm(p => { const a = [...p.items]; a[i] = { ...a[i], cantidad: e.target.value }; return { ...p, items: a }; })} />
                  <input style={{ ...inp, fontSize: 12.5, textAlign: "right" }} type="number" placeholder="$ unit." value={it.precio_unitario}
                    onChange={e => setCompraForm(p => { const a = [...p.items]; a[i] = { ...a[i], precio_unitario: e.target.value }; return { ...p, items: a }; })} />
                  {/* Acá está la precisión: cada material dice a qué parte de la
                      obra va, en vez de repartir el total en partes iguales. */}
                  <select style={{ ...inp, fontSize: 12 }} value={it.linea_id}
                    onChange={e => setCompraForm(p => { const a = [...p.items]; a[i] = { ...a[i], linea_id: e.target.value }; return { ...p, items: a }; })}>
                    <option value="">— ¿para qué ítem? —</option>
                    {lineasObra.map(l => <option key={l.id} value={l.id}>{l.nombre_override || l.nombre_libre || l.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setCompraForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }))}
                    style={{ padding: "4px 0", background: "none", border: `1px solid rgba(239,68,68,.3)`, borderRadius: 6,
                             color: C.red, cursor: "pointer", fontSize: 14, lineHeight: 1 }}>×</button>
                </div>
              ))}
              {compraForm.items.length > 0 && (
                <div style={{ fontSize: 12.5, textAlign: "right", marginTop: 6, fontFamily: "'IBM Plex Mono',monospace" }}>
                  Total: <b style={{ color: C.accent }}>{fmt(compraForm.items.reduce((a, it) => a + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0))}</b>
                </div>
              )}
            </div>

            <div style={{ margin: "14px 0 16px" }}>
              <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 6 }}>
                ¿Para qué ítems de la obra? <span style={{ color: C.muted }}>(lo que no tenga material asignado arriba)</span>
              </label>
              {lineasObra.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted }}>Este presupuesto todavía no tiene ítems cargados.</div>
              ) : (
                <div style={{ maxHeight: 150, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  {lineasObra.map(l => {
                    const elegida = (compraForm.lineas_ids || []).includes(l.id);
                    return (
                      <div key={l.id} onClick={() => setCompraForm(p => ({ ...p,
                          lineas_ids: elegida ? p.lineas_ids.filter(x => x !== l.id) : [...(p.lineas_ids || []), l.id] }))}
                        style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", cursor: "pointer",
                                 borderBottom: `1px solid ${C.border}`, background: elegida ? "#f0fdf4" : "transparent" }}>
                        <input type="checkbox" readOnly checked={elegida} style={{ pointerEvents: "none", flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nombre_override || l.nombre_libre || l.nombre}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>{l.rubro}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
          {/* Las que se escriben en casi todos los contratos. Se tocan y se
              agregan al texto: es mas rapido borrar lo que no va que escribir
              de cero cada vez, y evita que se olvide la de mayores costos. */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
            {CLAUSULAS_FRECUENTES.map(c => {
              const puesta = (form.clausulas_adicionales || "").includes(c.texto);
              return (
                <button key={c.titulo} type="button" title={c.texto}
                  onClick={() => setForm(f => ({
                    ...f,
                    clausulas_adicionales: puesta
                      ? (f.clausulas_adicionales || "").replace(c.texto, "").replace(/\n{3,}/g, "\n\n").trim()
                      : ((f.clausulas_adicionales || "").trim() + "\n\n" + c.texto).trim(),
                  }))}
                  style={{ padding: "5px 10px", borderRadius: 20, fontSize: 11.5, cursor: "pointer",
                           fontFamily: "inherit",
                           border: `1px solid ${puesta ? "#059669" : "#e0e0e8"}`,
                           background: puesta ? "rgba(5,150,105,.09)" : "#f1f3f5",
                           color: puesta ? "#059669" : "#6b7280" }}>
                  {puesta ? "✓ " : "+ "}{c.titulo}
                </button>
              );
            })}
          </div>
          <textarea style={{ ...inp2, height: 120, resize: "vertical" }} value={form.clausulas_adicionales} onChange={e => setForm(f => ({ ...f, clausulas_adicionales: e.target.value }))} />
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
