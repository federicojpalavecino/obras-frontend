// FAIM OBRAS — Asistente de ayuda (local, sin IA)
// Widget flotante que responde dudas sobre el uso del sistema.
// Motor: normaliza acentos/mayúsculas, tolera errores de tipeo (distancia de
// edición), entiende sinónimos y prioriza según la pantalla en la que estás.
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, X, Send, Sparkles, ArrowRight } from "lucide-react";

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#10b981", red: "#ef4444",
};

// Color de acento del tenant (cae al verde por defecto)
function tenantAccent() {
  try {
    const t = JSON.parse(localStorage.getItem("obras_tenant") || "null");
    if (t?.color_primario) return t.color_primario;
    const s = JSON.parse(localStorage.getItem("obras_session") || "null");
    if (s?.tenant?.color_primario) return s.tenant.color_primario;
  } catch (e) {}
  return C.accent;
}

// ── Normalización + distancia de edición (tolerancia a errores de tipeo) ──────
const normalizar = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")      // saca acentos
    .replace(/[^a-z0-9ñ ]/g, " ")         // saca puntuación
    .replace(/\s+/g, " ")
    .trim();

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

// Peso de coincidencia entre dos palabras (con tolerancia a errores)
function pesoToken(q, k) {
  if (q === k) return 2;
  if (q.length >= 4 && (k.includes(q) || q.includes(k))) return 1.4;
  const tol = q.length <= 4 ? 1 : 2;          // palabras cortas, menos tolerancia
  if (Math.abs(q.length - k.length) > tol) return 0;
  return lev(q, k) <= tol ? 1 : 0;
}

const tokens = (s) => normalizar(s).split(" ").filter((t) => t.length >= 2);

// ── Base de conocimiento ──────────────────────────────────────────────────────
// kw: sinónimos / palabras clave (se normalizan en runtime).
// pasos: respuesta paso a paso. route/routeLabel: botón opcional para ir directo.
const BASE = [
  {
    id: "crear-presupuesto", sec: "cotizador",
    titulo: "Crear un presupuesto nuevo",
    kw: "crear nuevo presupuesto cotizacion cotizar armar empezar hacer obra agregar añadir como hago un",
    pasos: [
      "Entrá a “Presupuestos y obras” desde el inicio (módulo Cotizador).",
      "Arriba a la derecha tocá el botón “＋ Presupuesto” (en celular dice “＋ Nuevo”).",
      "Elegí el Cliente en el desplegable. Si todavía no existe, tocá “＋ Nuevo cliente” y cargalo.",
      "Escribí el “Nombre de la obra” (obligatorio) y la Ubicación (opcional).",
      "Tocá “Crear presupuesto”. Te abre el presupuesto vacío para empezar a cargar rubros e ítems.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "crear-cliente", sec: "cotizador",
    titulo: "Cargar un cliente nuevo",
    kw: "cliente nuevo crear cargar agregar añadir comitente contacto dar de alta como agrego",
    pasos: [
      "Podés crearlo desde el Cotizador: al hacer un presupuesto nuevo, tocá “＋ Nuevo cliente”.",
      "O desde el módulo “Clientes y Proyectos” en el inicio.",
      "Completá el Nombre o razón social (obligatorio). Email y Teléfono son opcionales.",
      "Tocá “Crear cliente”. Ya te queda disponible para asignarle presupuestos.",
    ],
    route: "/clientes", routeLabel: "Ir a Clientes",
  },
  {
    id: "agregar-rubro-item", sec: "presupuesto",
    titulo: "Agregar rubros e ítems al presupuesto",
    kw: "rubro item items linea lineas agregar añadir cargar catalogo tarea computo cantidad como cargo agrego",
    pasos: [
      "Abrí el presupuesto desde la lista del Cotizador.",
      "Para crear un rubro (capítulo), tocá “＋ Rubro” y ponele nombre (ej: Mampostería).",
      "Para agregar ítems, buscalos en el catálogo por categoría y elegí el rubro de destino.",
      "Cargá la cantidad de cada ítem: el precio se calcula solo según el análisis de costos.",
      "También podés cargar un ítem libre (con nombre y costo propio) si no está en el catálogo.",
    ],
  },
  {
    id: "coeficientes", sec: "presupuesto",
    titulo: "Cambiar coeficientes (GG, Beneficio, IVA, K)",
    kw: "coeficientes coeficiente gg gastos generales beneficio ben iva margen markup k materiales mano obra maquinaria porcentaje cambiar ajustar",
    pasos: [
      "Dentro del presupuesto, tocá el botón “Coeficientes” (ícono de engranaje).",
      "Ajustá los porcentajes: Gastos Generales (GG), Beneficio (Ben) e IVA.",
      "Si usás coeficientes de actualización, cargá K Materiales, K Mano de obra y K Maquinaria.",
      "Los totales del presupuesto se recalculan automáticamente al guardar.",
    ],
  },
  {
    id: "cerrar-presupuesto", sec: "presupuesto",
    titulo: "Cerrar o reabrir un presupuesto",
    kw: "cerrar cerrado reabrir reabrir abrir bloquear finalizar terminar aprobar estado candado",
    pasos: [
      "Un presupuesto “cerrado” queda bloqueado para no modificarse por error.",
      "Dentro del presupuesto usá la opción “Cerrar presupuesto”. Aparece con un candado en la lista.",
      "Para volver a editarlo, abrilo y tocá “Reabrir”.",
    ],
  },
  {
    id: "duplicar-presupuesto", sec: "cotizador",
    titulo: "Duplicar un presupuesto",
    kw: "duplicar copiar clonar repetir copia igual otro parecido",
    pasos: [
      "En la lista del Cotizador, ubicá el presupuesto.",
      "Tocá el ícono de “Duplicar” (dos hojas) a la derecha del presupuesto.",
      "Se crea una copia completa (rubros, ítems y coeficientes) y se abre para que la edites.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "eliminar-presupuesto", sec: "cotizador",
    titulo: "Eliminar un presupuesto",
    kw: "eliminar borrar sacar quitar remover presupuesto deshacer error",
    pasos: [
      "En la lista del Cotizador, tocá el ícono de tacho (rojo) del presupuesto.",
      "Confirmá la acción. Atención: no se puede deshacer.",
    ],
  },
  {
    id: "certificado", sec: "certificado",
    titulo: "Hacer un certificado de avance",
    kw: "certificado certificar avance obra medicion porcentaje ejecutado cobrar emitir nuevo egresos",
    pasos: [
      "Abrí el presupuesto y tocá el botón “Certificado” en la barra superior.",
      "Tocá “Nuevo certificado”.",
      "Cargá el avance de cada ítem o rubro (porcentaje o cantidad ejecutada en este período).",
      "Si querés, sumá los egresos asociados al certificado.",
      "Guardá: el certificado queda vinculado al presupuesto y suma al avance acumulado.",
    ],
  },
  {
    id: "gantt", sec: "presupuesto",
    titulo: "Ver el Gantt (planificación)",
    kw: "gantt planificacion cronograma planning tiempos plazos diagrama barras planificar",
    pasos: [
      "El Gantt se arma automáticamente a partir de los rubros del presupuesto.",
      "Abrí el presupuesto y tocá el botón “Gantt”.",
      "Ajustá las duraciones y el orden de cada tarea según el plan de obra.",
    ],
  },
  {
    id: "curva", sec: "presupuesto",
    titulo: "Curva de inversión",
    kw: "curva inversion flujo desembolso plata dinero tiempo grafico avance economico",
    pasos: [
      "Abrí el presupuesto y tocá el botón “Curva”.",
      "Muestra cómo se distribuye la inversión a lo largo del tiempo, según el Gantt.",
    ],
  },
  {
    id: "listado-computo", sec: "presupuesto",
    titulo: "Listado de materiales y cómputo",
    kw: "listado materiales computo cantidades comprar pedido materiales totales resumen insumos",
    pasos: [
      "Dentro del presupuesto tocá “Listado materiales” para ver los materiales totales.",
      "Para el cómputo de cantidades general, tocá “∑ Cómputo” (lo podés imprimir).",
    ],
  },
  {
    id: "analisis-costos", sec: "costos",
    titulo: "Editar el análisis de costos de un ítem",
    kw: "analisis costos costo unitario item composicion materiales mano obra maquinaria editar precio rendimiento",
    pasos: [
      "Desde el Cotizador, entrá a “Análisis de costos”.",
      "Buscá el ítem y abrí su análisis: ahí ves los materiales, mano de obra y maquinaria que lo componen.",
      "Modificá cantidades, rendimientos o precios. El cambio se refleja en todos los presupuestos que usan ese ítem.",
    ],
    route: "/cotizador/analisis-costos", routeLabel: "Ir a Análisis de costos",
  },
  {
    id: "actualizar-precios", sec: "costos",
    titulo: "Actualizar precios (materiales, mano de obra, maquinaria)",
    kw: "actualizar precio precios materiales mano obra maquinaria valores costo cambiar subir lista inflacion",
    pasos: [
      "Desde el Cotizador, entrá a “Materiales”, “Mano de obra” o “Maquinaria” según corresponda.",
      "Buscá el insumo y editá su precio.",
      "Al guardar, se recalculan automáticamente los análisis y presupuestos que lo usan.",
    ],
    route: "/cotizador/materiales", routeLabel: "Ir a Materiales",
  },
  {
    id: "gestion-obra", sec: "obra",
    titulo: "Gestión de obra (Resumen, Contrato, Cobros, etc.)",
    kw: "gestion obra administrar seguimiento tabs pestañas resumen contrato cobros subcontratos compras certificados ejecutar",
    pasos: [
      "Abrí el presupuesto y tocá el botón “Obra” (destacado en verde).",
      "Arriba tenés las pestañas: Resumen, Contrato, Cobros, Subcontratos, Compras y Certificados.",
      "En “Resumen” ves el estado general: contratado, cobrado, gastado y saldo.",
      "Cada pestaña te deja cargar y seguir esa parte de la obra.",
    ],
  },
  {
    id: "contrato", sec: "obra",
    titulo: "Cargar e imprimir el contrato",
    kw: "contrato contratar firmar imprimir pdf cliente acepta aceptar condiciones anticipo monto",
    pasos: [
      "Entrá a la “Obra” del presupuesto y andá a la pestaña “Contrato”.",
      "Cargá los datos del contrato (monto, anticipo, condiciones).",
      "Podés imprimirlo/guardarlo en PDF con el botón de imprimir.",
      "Si el cliente tiene acceso al portal, puede aceptar el contrato online desde su cuenta.",
    ],
  },
  {
    id: "cobros", sec: "obra",
    titulo: "Registrar cobros de una obra",
    kw: "cobros cobro cobrar pago recibido ingreso plata cliente cuota anticipo cuenta corriente",
    pasos: [
      "Entrá a la “Obra” y andá a la pestaña “Cobros”.",
      "Cargá cada cobro con fecha, monto y concepto.",
      "Se reflejan en el Resumen de la obra y los podés importar al Control Financiero como ingresos.",
    ],
  },
  {
    id: "subcontratos", sec: "obra",
    titulo: "Subcontratos y compras de la obra",
    kw: "subcontratos subcontrato compras proveedor gasto egreso material pago contratista gremio",
    pasos: [
      "En la “Obra”, usá la pestaña “Subcontratos” para los trabajos tercerizados.",
      "Usá la pestaña “Compras” para los materiales y gastos comprados.",
      "Todo suma a lo “gastado” en el Resumen de la obra.",
    ],
  },
  {
    id: "control-financiero", sec: "finanzas",
    titulo: "Usar el Control Financiero",
    kw: "control financiero finanzas caja ingresos egresos personal sueldos semana quincena mes resultado ganancia",
    pasos: [
      "Entrá al módulo “Control Financiero” desde el inicio.",
      "Elegí el período: Semana, Quincena o Mes.",
      "Cargá los Ingresos, los Egresos y el Personal (sueldos) de ese período.",
      "El sistema calcula el resultado (ingresos − egresos − personal) automáticamente.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "importar-obra", sec: "finanzas",
    titulo: "Importar cobros y pagos de una obra al financiero",
    kw: "importar obra cobros pagos certificado ingreso egreso traer cargar automatico vincular financiero",
    pasos: [
      "En el Control Financiero, en el período abierto, usá la opción “Importar”.",
      "Elegí la obra: trae los cobros como ingresos y los pagos/compras como egresos.",
      "Así no recargás los datos a mano: lo que cargaste en la obra ya viaja al financiero.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "adicionales", sec: "presupuesto",
    titulo: "Crear un presupuesto adicional",
    kw: "adicional adicionales extra ampliacion mayor obra modificacion presupuesto aparte vinculado",
    pasos: [
      "Abrí el presupuesto base.",
      "En la sección de Adicionales, tocá para crear uno nuevo: se numera y queda vinculado al base.",
      "Cargale sus ítems y, si necesita, sus propios coeficientes (independientes del base).",
    ],
  },
  {
    id: "accesos-clientes", sec: "accesos",
    titulo: "Dar acceso a un cliente (portal)",
    kw: "acceso accesos cliente portal ver online clave contraseña usuario invitar habilitar mostrar secciones",
    pasos: [
      "Entrá al módulo “Accesos de clientes” desde el inicio.",
      "Tocá “＋ Nuevo acceso”.",
      "Elegí el cliente y cargá su email y una contraseña.",
      "Marcá qué secciones puede ver: avance, contrato, cobros, gantt y consultas.",
      "Opcional: limitá a qué presupuestos accede. Guardá y pasale los datos al cliente.",
    ],
    route: "/accesos-clientes", routeLabel: "Ir a Accesos de clientes",
  },
  {
    id: "portal-cliente", sec: "accesos",
    titulo: "Qué ve y cómo entra el cliente al portal",
    kw: "portal cliente entra ingresar ve avance cuenta corriente consultas acepta contrato como ingresa login",
    pasos: [
      "El cliente entra desde la misma pantalla de login con el email y la clave que le creaste.",
      "Ve, según lo que habilitaste: avance de obra, contrato (puede aceptarlo), cuenta corriente, planificación y consultas.",
      "Es de solo lectura: el cliente no puede modificar nada, solo consultar y dejar consultas.",
    ],
  },
  {
    id: "config-logo-color", sec: "config",
    titulo: "Cambiar logo, color y nombre del estudio",
    kw: "logo color marca personalizar nombre estudio empresa configuracion imagen branding identidad cambiar",
    pasos: [
      "Entrá al módulo “Configuración” desde el inicio.",
      "Subí tu logo (o eliminá el actual), elegí tu color principal y editá el nombre y datos del estudio.",
      "Esos cambios se aplican en todo el sistema y en el portal de tus clientes.",
    ],
    route: "/config", routeLabel: "Ir a Configuración",
  },
  {
    id: "usuarios", sec: "config",
    titulo: "Agregar usuarios del estudio",
    kw: "usuario usuarios agregar equipo empleado personal sumar persona cuenta acceso estudio invitar colaborador",
    pasos: [
      "Entrá a “Configuración” → sección “Usuarios del estudio”.",
      "Completá nombre, email, contraseña y rol (admin o personal) y tocá “＋ Agregar usuario”.",
      "El plan base incluye 2 usuarios; cada usuario extra puede tener un costo adicional.",
    ],
    route: "/config", routeLabel: "Ir a Configuración",
  },
  {
    id: "imprimir", sec: "presupuesto",
    titulo: "Imprimir o exportar el presupuesto a PDF",
    kw: "imprimir pdf exportar presentar enviar mandar cliente impresion descargar papel",
    pasos: [
      "Abrí el presupuesto y usá la opción de imprimir / vista de impresión.",
      "Desde el cuadro de impresión podés guardarlo como PDF (destino “Guardar como PDF”).",
      "También podés imprimir el cómputo general con el botón “∑ Cómputo”.",
    ],
  },
  {
    id: "planner", sec: "planner",
    titulo: "Usar el Planner (tareas y calendario)",
    kw: "planner tareas calendario tablero agenda pendientes organizar planificar to do recordatorio",
    pasos: [
      "Entrá al módulo “Planner” desde el inicio.",
      "Es un tablero de tareas con calendario para organizar lo del estudio.",
    ],
    route: "/planner", routeLabel: "Ir al Planner",
  },
  {
    id: "suscripcion", sec: "config",
    titulo: "Suscripción y pago",
    kw: "suscripcion pago pagar precio plan trial prueba vencido mercadopago factura abono mensual cobro sistema",
    pasos: [
      "El sistema arranca con una prueba gratuita. Al vencer, pide suscribirse para seguir.",
      "El pago es mensual por MercadoPago: plan base 2 usuarios + adicionales según usuarios extra.",
      "Si tenés un problema con el pago, escribinos a soporte.",
    ],
  },
  {
    id: "soporte", sec: "*",
    titulo: "Contactar a soporte",
    kw: "soporte ayuda contacto humano problema whatsapp telefono mail email no funciona error reclamo hablar",
    pasos: [
      "Si necesitás una mano que el asistente no resuelve, escribinos:",
      "WhatsApp: +54 9 362 530-5155.",
      "Email: faimobras@gmail.com.",
      "También está la sección “Soporte técnico” en el inicio.",
    ],
    route: "/soporte", routeLabel: "Ir a Soporte",
  },
];

// Sección actual a partir de la URL (para priorizar respuestas relevantes)
function seccionActual(pathname) {
  const p = pathname || "";
  if (/\/obra$/.test(p)) return "obra";
  if (/\/certificado/.test(p)) return "certificado";
  if (/\/(materiales|mano-obra|maquinaria|analisis-costos)$/.test(p)) return "costos";
  if (/\/cotizador\/presupuesto\//.test(p) || /\/cotizador\/gantt\//.test(p)) return "presupuesto";
  if (/\/cotizador/.test(p)) return "cotizador";
  if (/\/finanzas/.test(p)) return "finanzas";
  if (/\/clientes/.test(p)) return "clientes";
  if (/\/accesos/.test(p)) return "accesos";
  if (/\/config/.test(p)) return "config";
  if (/\/planner/.test(p)) return "planner";
  return "home";
}

// Sugerencias iniciales según dónde está el usuario
function sugerencias(sec) {
  const m = {
    cotizador: ["¿Cómo creo un presupuesto?", "¿Cómo cargo un cliente?", "¿Cómo duplico un presupuesto?"],
    presupuesto: ["¿Cómo agrego rubros e ítems?", "¿Cómo cambio los coeficientes?", "¿Cómo hago un certificado?"],
    certificado: ["¿Cómo hago un certificado de avance?", "¿Cómo cargo los egresos?"],
    obra: ["¿Cómo cargo el contrato?", "¿Cómo registro un cobro?", "¿Qué muestra el Resumen?"],
    costos: ["¿Cómo actualizo precios?", "¿Cómo edito el análisis de un ítem?"],
    finanzas: ["¿Cómo importo cobros de una obra?", "¿Cómo cargo ingresos y egresos?"],
    accesos: ["¿Cómo le doy acceso a un cliente?", "¿Qué ve el cliente en el portal?"],
    config: ["¿Cómo cambio el logo y color?", "¿Cómo agrego usuarios?"],
    planner: ["¿Para qué sirve el Planner?"],
    home: ["¿Cómo creo un presupuesto?", "¿Cómo le doy acceso a un cliente?", "¿Cómo uso el Control Financiero?"],
    clientes: ["¿Cómo cargo un cliente?", "¿Cómo creo un presupuesto?"],
  };
  return m[sec] || m.home;
}

// Motor de búsqueda: devuelve la mejor entrada y alternativas cercanas
function buscar(consulta, sec) {
  const qTokens = [...new Set(tokens(consulta))];
  if (!qTokens.length) return { mejor: null, otras: [] };

  const ranked = BASE.map((e) => {
    const eTokens = tokens(e.kw + " " + e.titulo);
    let score = 0;
    for (const q of qTokens) {
      let best = 0;
      for (const k of eTokens) {
        const w = pesoToken(q, k);
        if (w > best) best = w;
        if (best === 2) break;
      }
      score += best;
    }
    if (e.sec === sec) score += 1.5;   // empujón por contexto de pantalla
    return { e, score };
  }).sort((a, b) => b.score - a.score);

  const umbral = Math.max(2, qTokens.length * 0.6);
  const mejor = ranked[0] && ranked[0].score >= umbral ? ranked[0].e : null;
  const otras = ranked
    .filter((r, i) => i > 0 && r.score >= umbral * 0.8 && r.e.id !== mejor?.id)
    .slice(0, 3)
    .map((r) => r.e);
  return { mejor, otras };
}

const SALUDOS = ["hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "que tal", "hey", "holaa"];
const GRACIAS = ["gracias", "muchas gracias", "genial", "perfecto", "joya", "buenisimo", "ok gracias"];

// ── Componente ────────────────────────────────────────────────────────────────
export default function Asistente() {
  const navigate = useNavigate();
  const location = useLocation();
  const accent = useMemo(() => tenantAccent(), []);
  const sec = seccionActual(location.pathname);

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([]);
  const scrollRef = useRef(null);

  // Mensaje de bienvenida al abrir por primera vez
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        from: "bot",
        titulo: "¡Hola! Soy el asistente de FAIM OBRAS 👋",
        texto: "Preguntame lo que necesites sobre cómo usar el sistema y te explico paso a paso. No importa si escribís rápido o con algún error, te entiendo igual.",
        chips: sugerencias(sec),
      }]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  const responder = (texto) => {
    const limpio = normalizar(texto);
    // Saludos / agradecimientos
    if (SALUDOS.some((s) => limpio === s || (limpio.length <= 12 && pesoToken(limpio, s) >= 1))) {
      return [{
        from: "bot",
        texto: "¡Hola! ¿Con qué te doy una mano? Tocá una sugerencia o escribime tu duda.",
        chips: sugerencias(sec),
      }];
    }
    if (GRACIAS.some((g) => limpio.includes(g) || pesoToken(limpio, g) >= 1)) {
      return [{ from: "bot", texto: "¡De nada! Cualquier otra cosa, acá estoy. 🙌" }];
    }

    const { mejor, otras } = buscar(texto, sec);
    if (!mejor) {
      return [{
        from: "bot",
        titulo: "No estoy seguro de haber entendido 🤔",
        texto: "Probá reformulando con otras palabras, o elegí uno de estos temas. Si es algo puntual, escribí a soporte.",
        chips: [...sugerencias(sec), "Contactar a soporte"],
      }];
    }
    return [{
      from: "bot",
      titulo: mejor.titulo,
      pasos: mejor.pasos,
      route: mejor.route,
      routeLabel: mejor.routeLabel,
      chips: otras.length ? otras.map((o) => o.titulo) : null,
      chipsHint: otras.length ? "¿Buscabas alguno de estos?" : null,
    }];
  };

  const enviar = (textoForzado) => {
    const texto = (textoForzado ?? input).trim();
    if (!texto) return;
    setInput("");
    setMsgs((m) => [...m, { from: "user", texto }, ...responder(texto)]);
  };

  const irA = (route) => { setOpen(false); navigate(route); };

  return (
    <>
      {/* Botón flotante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir asistente de ayuda"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 1000,
            width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
            background: accent, color: "#fff", boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <MessageCircle size={26} strokeWidth={2} />
        </button>
      )}

      {/* Panel de chat */}
      {open && (
        <div
          style={{
            position: "fixed", bottom: 0, right: 0, zIndex: 1000,
            width: "min(380px, 100vw)", height: "min(600px, 100vh)",
            display: "flex", flexDirection: "column",
            background: C.surface, fontFamily: "'Syne', sans-serif",
            border: `1px solid ${C.border}`, borderRadius: "16px 16px 0 0",
            boxShadow: "0 -4px 40px rgba(0,0,0,0.18)", overflow: "hidden",
            margin: "0 20px 0 0",
          }}
          className="faim-asistente-panel"
        >
          {/* Header */}
          <div style={{ background: accent, color: "#fff", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} strokeWidth={2} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1 }}>Asistente FAIM</div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>Ayuda paso a paso</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Cerrar" style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={18} />
            </button>
          </div>

          {/* Mensajes */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 14, background: C.bg, display: "flex", flexDirection: "column", gap: 12 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "88%",
                  background: m.from === "user" ? accent : C.surface,
                  color: m.from === "user" ? "#fff" : C.text,
                  border: m.from === "user" ? "none" : `1px solid ${C.border}`,
                  borderRadius: 14, padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5,
                  boxShadow: m.from === "bot" ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                }}>
                  {m.titulo && <div style={{ fontWeight: 700, marginBottom: 6 }}>{m.titulo}</div>}
                  {m.texto && <div>{m.texto}</div>}
                  {m.pasos && (
                    <ol style={{ margin: "4px 0 0", paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                      {m.pasos.map((p, j) => <li key={j}>{p}</li>)}
                    </ol>
                  )}
                  {m.route && (
                    <button onClick={() => irA(m.route)} style={{
                      marginTop: 10, background: accent, color: "#fff", border: "none", borderRadius: 8,
                      padding: "7px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                      fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
                      {m.routeLabel || "Ir ahí"} <ArrowRight size={14} />
                    </button>
                  )}
                  {m.chipsHint && <div style={{ fontSize: 11, color: C.muted, marginTop: 10, marginBottom: -2 }}>{m.chipsHint}</div>}
                  {m.chips && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {m.chips.map((c, j) => (
                        <button key={j} onClick={() => enviar(c)} style={{
                          background: m.from === "user" ? "rgba(255,255,255,0.2)" : C.surface2,
                          color: m.from === "user" ? "#fff" : C.text,
                          border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 10px",
                          fontSize: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                        }}>{c}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, background: C.surface, display: "flex", gap: 8, flexShrink: 0 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder="Escribí tu duda…"
              style={{
                flex: 1, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px",
                fontSize: 13.5, fontFamily: "inherit", outline: "none", color: C.text, background: C.bg,
              }}
            />
            <button onClick={() => enviar()} aria-label="Enviar" style={{
              background: accent, border: "none", borderRadius: 10, width: 42, cursor: "pointer",
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
