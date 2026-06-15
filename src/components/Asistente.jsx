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

// Palabras vacías que no aportan al match (no penalizan ni inflan el score)
const STOP = new Set(["como", "que", "cual", "donde", "para", "porque", "por", "con", "los", "las", "del", "una", "uno", "mis", "tus", "sus", "hago", "hacer", "puedo", "quiero", "necesito", "the", "and", "una", "este", "esta", "eso", "ahi", "aca"]);
const tokens = (s) => normalizar(s).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));

// ── Base de conocimiento ──────────────────────────────────────────────────────
// kw: sinónimos / palabras clave (se normalizan en runtime).
// pasos: respuesta paso a paso. route/routeLabel: botón opcional para ir directo.
const BASE = [
  // ── COTIZADOR / PRESUPUESTOS ────────────────────────────────────────────────
  {
    id: "crear-presupuesto", sec: "cotizador",
    titulo: "Crear un presupuesto nuevo",
    kw: "crear nuevo presupuesto cotizacion cotizar armar empezar obra agregar añadir hacer presu cotiza",
    pasos: [
      "Entrá a “Presupuestos y obras” desde el inicio (módulo Cotizador).",
      "Arriba a la derecha tocá “＋ Presupuesto” (en celular dice “＋ Nuevo”).",
      "Elegí el Cliente. Si no existe todavía, tocá “＋ Nuevo cliente” y cargalo en el momento.",
      "Escribí el “Nombre de la obra” (obligatorio) y la Ubicación (opcional).",
      "Tocá “Crear presupuesto”: se abre vacío para que empieces a cargar rubros e ítems.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "crear-cliente", sec: "cotizador",
    titulo: "Cargar un cliente nuevo",
    kw: "cliente nuevo crear cargar agregar añadir comitente contacto alta razon social comprador",
    pasos: [
      "Desde el Cotizador, al hacer un presupuesto nuevo, tocá “＋ Nuevo cliente”.",
      "O entrá al módulo “Clientes y Proyectos” desde el inicio.",
      "Completá Nombre o razón social (obligatorio). Email y Teléfono son opcionales.",
      "Tocá “Crear cliente”: ya te queda disponible para asignarle presupuestos.",
    ],
    route: "/clientes", routeLabel: "Ir a Clientes",
  },
  {
    id: "agregar-rubro-item", sec: "presupuesto",
    titulo: "Agregar rubros e ítems al presupuesto",
    kw: "rubro rubros item items linea lineas agregar añadir cargar catalogo tarea capitulo cantidad meter poner",
    pasos: [
      "Abrí el presupuesto desde la lista del Cotizador.",
      "Creá un rubro (capítulo) con “＋ Rubro” y ponele nombre (ej: Mampostería).",
      "Buscá los ítems del catálogo y elegí a qué rubro van.",
      "Cargá la cantidad de cada ítem: el precio sale solo del análisis de costos.",
      "Si un ítem no está en el catálogo, podés cargarlo como ítem libre (nombre y costo propios).",
    ],
  },
  {
    id: "coeficientes", sec: "presupuesto",
    titulo: "Cambiar coeficientes (GG, Beneficio, IVA, K)",
    kw: "coeficientes coeficiente gg gastos generales beneficio ben iva margen markup k materiales mano obra maquinaria porcentaje ajustar recargo",
    pasos: [
      "Dentro del presupuesto, tocá el botón “Coeficientes” (ícono de engranaje).",
      "Ajustá Gastos Generales (GG), Beneficio (Ben) e IVA en porcentaje.",
      "Si usás actualización, cargá K Materiales, K Mano de obra y K Maquinaria.",
      "Al guardar, los totales del presupuesto se recalculan automáticamente.",
    ],
  },
  {
    id: "cerrar-presupuesto", sec: "presupuesto",
    titulo: "Cerrar o reabrir un presupuesto",
    kw: "cerrar cerrado reabrir abrir bloquear finalizar terminar aprobar estado candado habilitar certificados obra",
    pasos: [
      "Cerrar deja el presupuesto bloqueado (no se modifica por error) y habilita la gestión de obra.",
      "Dentro del presupuesto usá la opción para cerrarlo: queda con un candado en la lista.",
      "Una vez cerrado, en la barra superior aparecen Certificados, Gantt, Curva, Listado y Obra.",
      "Para volver a editarlo, abrilo y tocá “Reabrir”.",
    ],
  },
  {
    id: "duplicar-presupuesto", sec: "cotizador",
    titulo: "Duplicar un presupuesto",
    kw: "duplicar copiar clonar repetir copia igual otro parecido presupuesto",
    pasos: [
      "En la lista del Cotizador, ubicá el presupuesto.",
      "Tocá el ícono de “Duplicar” (dos hojas) a la derecha.",
      "Se crea una copia completa (rubros, ítems y coeficientes) y se abre para editarla.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "eliminar-presupuesto", sec: "cotizador",
    titulo: "Eliminar un presupuesto",
    kw: "eliminar borrar sacar quitar remover presupuesto tacho basura",
    pasos: [
      "En la lista del Cotizador, tocá el ícono de tacho (rojo) del presupuesto.",
      "Confirmá. Ojo: no se puede deshacer.",
    ],
  },
  {
    id: "exportar-presupuesto", sec: "presupuesto",
    titulo: "Exportar / imprimir el presupuesto (PDF)",
    kw: "exportar imprimir pdf presupuesto presentar enviar mandar cliente descargar papel comercial interno guardar compartir",
    pasos: [
      "Abrí el presupuesto. Arriba a la derecha está el grupo de impresión.",
      "Tocá “Cliente” para la versión comercial (limpia, para mandar al cliente, con firma y vigencia).",
      "Tocá “Interno” para la versión de ejecución (con costos, márgenes y coeficientes, uso interno).",
      "Se abre la ventana de impresión: en “Destino” elegí “Guardar como PDF” para descargarlo.",
      "Con “∑ Cómputo” imprimís el cómputo de cantidades.",
    ],
  },
  {
    id: "adicionales", sec: "presupuesto",
    titulo: "Crear un presupuesto adicional",
    kw: "adicional adicionales extra ampliacion mayor obra modificacion aparte vinculado complementario",
    pasos: [
      "Abrí el presupuesto base.",
      "En la sección de Adicionales, creá uno nuevo: se numera y queda vinculado al base.",
      "Cargale sus ítems y, si necesita, sus propios coeficientes (independientes del base).",
    ],
  },

  // ── ANÁLISIS DE COSTOS ──────────────────────────────────────────────────────
  {
    id: "crear-analisis", sec: "costos",
    titulo: "Crear mi propio análisis de costo (ítem)",
    kw: "crear propio analisis costo costos item nuevo armar componer hacer mio personalizado unitario apu",
    pasos: [
      "Desde el Cotizador, entrá a “Análisis de costos” y tocá “＋ Nuevo ítem”.",
      "Cargá Código, Nombre, Rubro y Unidad de ejecución (m2, m3, Gl…) y tocá “Crear ítem”.",
      "Abrí el ítem que creaste: a la derecha aparecen 3 secciones para componerlo.",
      "1/3 Materiales: elegí el material y la cantidad por unidad, y tocá “Agregar”.",
      "2/3 Mano de obra: elegí la función y las horas, y “Agregar”.",
      "3/3 Maquinaria: elegí el equipo y las horas, y “Agregar”.",
      "El Costo total del ítem se calcula solo (Mat + MO + Maq) a medida que cargás.",
    ],
    route: "/cotizador/analisis-costos", routeLabel: "Ir a Análisis de costos",
  },
  {
    id: "editar-analisis", sec: "costos",
    titulo: "Editar el análisis de un ítem (cantidades / quitar líneas)",
    kw: "editar analisis item composicion cambiar cantidad horas quitar sacar linea material rendimiento modificar",
    pasos: [
      "En “Análisis de costos”, buscá el ítem y abrilo para ver su detalle.",
      "Para cambiar una cantidad u horas: tocá el número (en azul) en la fila, editalo y confirmá con ✓.",
      "Para quitar una línea: tocá la “×” al final de la fila.",
      "Para agregar más, usá los selectores de Materiales / Mano de obra / Maquinaria al pie de cada sección.",
      "Para renombrar el ítem, tocá el lápiz al lado del nombre.",
      "Todo recalcula el costo del ítem y se refleja en los presupuestos que lo usan.",
    ],
    route: "/cotizador/analisis-costos", routeLabel: "Ir a Análisis de costos",
  },

  // ── MATERIALES ──────────────────────────────────────────────────────────────
  {
    id: "agregar-material", sec: "costos",
    titulo: "Agregar un material nuevo al catálogo",
    kw: "agregar material nuevo crear cargar alta insumo producto catalogo añadir sumar",
    pasos: [
      "Desde el Cotizador, entrá a “Materiales” y tocá “＋ Nuevo material”.",
      "Cargá Código y Rubro (obligatorios) y el Nombre.",
      "Indicá la Presentación (bolsa, m3, u…) y la Unidad de análisis (kg, m3, u…).",
      "Poné la Cantidad por presentación y el Precio de la presentación.",
      "El Precio unitario se calcula solo (precio ÷ cantidad). Tocá “Crear material”.",
    ],
    route: "/cotizador/materiales", routeLabel: "Ir a Materiales",
  },
  {
    id: "actualizar-precio-material", sec: "costos",
    titulo: "Actualizar el precio de un material",
    kw: "actualizar precio material valor costo cambiar subir modificar inflacion remarcar lista precios",
    pasos: [
      "Desde el Cotizador, entrá a “Materiales” y buscá el material (por nombre o código).",
      "En su fila tocá el botón “Precio”.",
      "Editá el “Precio de presentación” (y la cantidad si cambió). El unitario se recalcula solo.",
      "Tocá “Guardar”. Con la flecha “▼” podés ver el historial de precios.",
      "El cambio se propaga a todos los análisis y presupuestos abiertos que usan ese material.",
    ],
    route: "/cotizador/materiales", routeLabel: "Ir a Materiales",
  },
  {
    id: "duplicar-eliminar-material", sec: "costos",
    titulo: "Duplicar o eliminar un material",
    kw: "duplicar copiar eliminar borrar material quitar sacar catalogo",
    pasos: [
      "En “Materiales”, en la fila del material usá el ícono de copiar para duplicarlo (te pide nombre y código nuevos).",
      "Para eliminarlo, tocá el ícono de tacho. No se podrá usar en nuevos análisis.",
    ],
    route: "/cotizador/materiales", routeLabel: "Ir a Materiales",
  },

  // ── MANO DE OBRA ────────────────────────────────────────────────────────────
  {
    id: "precio-mano-obra", sec: "costos",
    titulo: "Cambiar el precio de la mano de obra",
    kw: "precio mano obra mo salario jornal costo hora actualizar cambiar funcion oficial peon sueldo",
    pasos: [
      "Desde el Cotizador, entrá a “Mano de obra”.",
      "Buscá la función (Oficial, Peón, etc.) y tocá “Actualizar” en su fila.",
      "Editá el “Salario base por hora” y tocá “Guardar”.",
      "El Costo total/hora se calcula solo: salario base + cargas sociales (base × (1 + % cargas)).",
      "Se recalculan los análisis y presupuestos abiertos que usan esa función.",
    ],
    route: "/cotizador/mano-obra", routeLabel: "Ir a Mano de obra",
  },
  {
    id: "crear-funcion-mo", sec: "costos",
    titulo: "Crear una función de mano de obra",
    kw: "crear funcion mano obra nueva categoria oficial peon agregar cargar mo puesto rol",
    pasos: [
      "En “Mano de obra”, tocá “＋ Nueva función”.",
      "Cargá la Función (ej: Oficial Especializado), la Categoría (opcional) y el Salario base por hora.",
      "Te muestra el desglose con cargas sociales antes de guardar. Tocá “Crear”.",
    ],
    route: "/cotizador/mano-obra", routeLabel: "Ir a Mano de obra",
  },
  {
    id: "cargas-sociales", sec: "costos",
    titulo: "Cargar o cambiar las cargas sociales",
    kw: "cargas sociales carga porcentaje jubilacion aportes leyes sociales mano obra recalcular sindicato",
    pasos: [
      "En “Mano de obra”, panel izquierdo “Cargas sociales”.",
      "Para una nueva, tocá “＋ Carga social” y cargá Concepto y Porcentaje.",
      "Para editar una existente, tocá el lápiz, cambiá el % y confirmá.",
      "El total de cargas se aplica al costo/hora de TODAS las funciones automáticamente.",
    ],
    route: "/cotizador/mano-obra", routeLabel: "Ir a Mano de obra",
  },

  // ── MAQUINARIA ──────────────────────────────────────────────────────────────
  {
    id: "precio-maquinaria", sec: "costos",
    titulo: "Cambiar el costo de una máquina o equipo",
    kw: "maquinaria maquina equipo herramienta costo precio hora actualizar cambiar alquiler editar",
    pasos: [
      "Desde el Cotizador, entrá a “Maquinaria” (Máquinas, Equipos y Herramientas).",
      "Buscá el equipo y tocá el lápiz en la columna “Costo/unidad”.",
      "Editá el valor y confirmá con ✓.",
      "Con “▼ Ver usos” ves en qué ítems se usa. El cambio recalcula los presupuestos abiertos.",
    ],
    route: "/cotizador/maquinaria", routeLabel: "Ir a Maquinaria",
  },
  {
    id: "agregar-maquinaria", sec: "costos",
    titulo: "Agregar una máquina, equipo o herramienta",
    kw: "agregar maquina equipo herramienta nueva crear cargar alta maquinaria andamio vehiculo kit",
    pasos: [
      "En “Maquinaria”, al pie está el formulario “Agregar equipo / herramienta”.",
      "Cargá Nombre (obligatorio), Tipo (Máquina/Equipo/Herramienta/Vehículo/Kit), Unidad (hs, día, viaje…) y Costo/unidad.",
      "Tocá “Agregar equipo”. Ya queda disponible para usarlo en los análisis de costos.",
    ],
    route: "/cotizador/maquinaria", routeLabel: "Ir a Maquinaria",
  },
  {
    id: "propagacion-precios", sec: "costos",
    titulo: "¿Si cambio un precio, se actualiza todo?",
    kw: "cambio precio actualiza todo automatico propaga afecta presupuestos recalcula impacto cascada",
    pasos: [
      "Sí: el análisis de costos es la base de todo.",
      "Si cambiás un material, una función de mano de obra o un equipo, se recalculan los ítems que lo usan.",
      "Y esos ítems recalculan los presupuestos que estén abiertos (los cerrados quedan congelados).",
      "Por eso conviene cerrar un presupuesto cuando ya lo presentaste o aprobaste.",
    ],
  },

  // ── CERTIFICADOS / GANTT / CURVA ────────────────────────────────────────────
  {
    id: "certificado", sec: "certificado",
    titulo: "Hacer un certificado de avance",
    kw: "certificado certificar avance medicion porcentaje ejecutado cobrar emitir nuevo egresos obra acumulado",
    pasos: [
      "Conviene tener el presupuesto cerrado. Abrilo y tocá “Cert.” (Certificado) en la barra superior.",
      "Tocá “Nuevo certificado”.",
      "Cargá el avance de cada ítem o rubro (porcentaje o cantidad ejecutada del período).",
      "Si querés, sumá los egresos asociados al certificado.",
      "Guardá: queda vinculado al presupuesto y suma al avance acumulado.",
    ],
  },
  {
    id: "gantt", sec: "presupuesto",
    titulo: "Ver y ajustar el Gantt",
    kw: "gantt planificacion cronograma planning tiempos plazos diagrama barras planificar duracion",
    pasos: [
      "Se arma automáticamente desde los rubros del presupuesto.",
      "Abrí el presupuesto y tocá “Gantt” en la barra superior.",
      "Ajustá las duraciones y el orden de cada tarea según el plan de obra.",
    ],
  },
  {
    id: "curva", sec: "presupuesto",
    titulo: "Curva de inversión",
    kw: "curva inversion flujo desembolso plata dinero tiempo grafico economico avance financiero",
    pasos: [
      "Abrí el presupuesto y tocá “Curva” en la barra superior.",
      "Muestra cómo se distribuye la inversión en el tiempo, según el Gantt.",
    ],
  },
  {
    id: "listado-computo", sec: "presupuesto",
    titulo: "Listado de materiales y cómputo de cantidades",
    kw: "listado materiales computo cantidades comprar pedido totales resumen insumos cuanto material",
    pasos: [
      "Dentro del presupuesto tocá “Listado materiales” para ver los materiales totales a comprar.",
      "Para el cómputo de cantidades general, tocá “∑ Cómputo” (se puede imprimir).",
    ],
  },

  // ── GESTIÓN DE OBRA ─────────────────────────────────────────────────────────
  {
    id: "gestion-obra", sec: "obra",
    titulo: "Gestión de obra (Resumen, Contrato, Cobros…)",
    kw: "gestion obra administrar seguimiento tabs pestañas resumen contrato cobros subcontratos compras certificados ejecutar manejar",
    pasos: [
      "Abrí el presupuesto y tocá el botón “Obra” (destacado en verde).",
      "Arriba están las pestañas: Resumen, Contrato, Cobros, Subcontratos, Compras y Certificados.",
      "En “Resumen” ves el estado general: contratado, cobrado, gastado y saldo.",
      "Cada pestaña te deja cargar y seguir esa parte de la obra.",
    ],
  },
  {
    id: "generar-contrato", sec: "obra",
    titulo: "Generar / cargar el contrato",
    kw: "contrato generar crear cargar hacer firmar monto anticipo plazo desembolsos condiciones imprimir pdf",
    pasos: [
      "Abrí la “Obra” del presupuesto y andá a la pestaña “Contrato”.",
      "Si no hay, tocá “＋ Crear contrato” (si ya existe, tocá “Editar”).",
      "Cargá Monto total, Anticipo (%), Plazo de obra (días) y los desembolsos/cuotas si corresponde.",
      "Guardá. Después tocá “Imprimir” para generar el contrato en PDF (destino “Guardar como PDF”).",
      "Si el cliente tiene portal, puede aceptar el contrato online desde su cuenta.",
    ],
  },
  {
    id: "cobros", sec: "obra",
    titulo: "Registrar un cobro de la obra",
    kw: "cobros cobro cobrar pago recibido ingreso plata cliente cuota anticipo cuenta corriente registrar",
    pasos: [
      "Entrá a la “Obra” y andá a la pestaña “Cobros”.",
      "Cargá el cobro: monto, fecha, forma de pago y referencia/nota.",
      "Se refleja en el Resumen y lo podés importar al Control Financiero como ingreso.",
    ],
  },
  {
    id: "subcontratos", sec: "obra",
    titulo: "Cargar subcontratos y sus pagos",
    kw: "subcontratos subcontrato contratista tercerizado gremio pago avance proveedor mano obra externa",
    pasos: [
      "En la “Obra”, pestaña “Subcontratos”, cargá el contratista, el trabajo y el monto total.",
      "Después registrá pagos parciales con el % de avance al pagar.",
      "Queda el pendiente a la vista y suma a lo gastado en el Resumen.",
    ],
  },
  {
    id: "compras", sec: "obra",
    titulo: "Cargar compras de la obra",
    kw: "compras compra proveedor material gasto egreso pedido factura insumos pagar",
    pasos: [
      "En la “Obra”, pestaña “Compras”, cargá proveedor, fecha, estado y monto.",
      "Todo suma a lo “gastado” en el Resumen de la obra.",
    ],
  },

  // ── CONTROL FINANCIERO ──────────────────────────────────────────────────────
  {
    id: "control-financiero", sec: "finanzas",
    titulo: "Usar el Control Financiero",
    kw: "control financiero finanzas caja ingresos egresos personal sueldos semana quincena mes resultado ganancia flujo",
    pasos: [
      "Entrá al módulo “Control Financiero” desde el inicio.",
      "Elegí el período: Semana, Quincena o Mes.",
      "Cargá los Ingresos, los Egresos y el Personal (sueldos) del período.",
      "El resultado (ingresos − egresos − personal) se calcula automáticamente.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "importar-obra", sec: "finanzas",
    titulo: "Importar cobros/pagos de una obra al financiero",
    kw: "importar obra cobros pagos certificado ingreso egreso traer cargar automatico vincular financiero pasar",
    pasos: [
      "En el Control Financiero, en el período abierto, usá la opción “Importar”.",
      "Elegí la obra: trae los cobros como ingresos y los pagos/compras como egresos.",
      "Así no recargás nada a mano: lo de la obra viaja directo al financiero.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },

  // ── CLIENTES / PORTAL ───────────────────────────────────────────────────────
  {
    id: "clientes-proyectos", sec: "clientes",
    titulo: "Gestionar clientes y proyectos",
    kw: "clientes proyectos cliente proyecto administrar lista contactos editar ver organizar",
    pasos: [
      "Entrá al módulo “Clientes y Proyectos” desde el inicio.",
      "Ahí creás, editás y organizás tus clientes, sus proyectos y contactos.",
      "Cada presupuesto se asigna a un cliente (y opcionalmente a un proyecto).",
    ],
    route: "/clientes", routeLabel: "Ir a Clientes",
  },
  {
    id: "accesos-clientes", sec: "accesos",
    titulo: "Dar acceso a un cliente (portal)",
    kw: "acceso accesos cliente portal ver online clave contraseña usuario invitar habilitar mostrar secciones permiso",
    pasos: [
      "Entrá al módulo “Accesos de clientes” y tocá “＋ Nuevo acceso”.",
      "Elegí el cliente y cargá su email y una contraseña.",
      "Marcá qué secciones puede ver: avance, contrato, cobros, gantt y consultas.",
      "Opcional: limitá a qué presupuestos accede. Guardá y pasale los datos al cliente.",
    ],
    route: "/accesos-clientes", routeLabel: "Ir a Accesos de clientes",
  },
  {
    id: "portal-cliente", sec: "accesos",
    titulo: "Qué ve y cómo entra el cliente al portal",
    kw: "portal cliente entra ingresar ve avance cuenta corriente consultas acepta contrato login como ingresa",
    pasos: [
      "El cliente entra desde la misma pantalla de login, con el email y la clave que le creaste.",
      "Ve, según lo habilitado: avance de obra, contrato (puede aceptarlo), cuenta corriente, planificación y consultas.",
      "Es de solo lectura: consulta y deja consultas, no modifica nada.",
    ],
  },
  {
    id: "revocar-acceso", sec: "accesos",
    titulo: "Quitar el acceso de un cliente",
    kw: "revocar quitar sacar eliminar acceso cliente portal cortar deshabilitar baja",
    pasos: [
      "En “Accesos de clientes”, ubicá el acceso del cliente.",
      "Tocá “Revocar” y confirmá: pierde el acceso al portal al instante.",
    ],
    route: "/accesos-clientes", routeLabel: "Ir a Accesos de clientes",
  },

  // ── CONFIGURACIÓN / CUENTA ──────────────────────────────────────────────────
  {
    id: "config-logo-color", sec: "config",
    titulo: "Cambiar logo, color y nombre del estudio",
    kw: "logo color marca personalizar nombre estudio empresa configuracion imagen branding identidad cambiar datos",
    pasos: [
      "Entrá al módulo “Configuración” desde el inicio.",
      "Subí tu logo (o eliminá el actual), elegí tu color principal y editá nombre y datos del estudio (CUIT, dirección, etc.).",
      "Se aplica en todo el sistema, en los PDF y en el portal de tus clientes.",
    ],
    route: "/config", routeLabel: "Ir a Configuración",
  },
  {
    id: "usuarios", sec: "config",
    titulo: "Agregar usuarios del estudio",
    kw: "usuario usuarios agregar equipo empleado personal sumar persona cuenta acceso estudio colaborador rol admin",
    pasos: [
      "Entrá a “Configuración” → sección “Usuarios del estudio”.",
      "Completá nombre, email, contraseña y rol (admin o personal) y tocá “＋ Agregar usuario”.",
      "El plan base incluye 2 usuarios; cada usuario extra puede tener costo adicional.",
    ],
    route: "/config", routeLabel: "Ir a Configuración",
  },
  {
    id: "suscripcion", sec: "config",
    titulo: "Suscripción, prueba y pago",
    kw: "suscripcion pago pagar precio plan trial prueba vencido mercadopago factura abono mensual cobro renovar",
    pasos: [
      "El sistema arranca con una prueba gratuita; al vencer pide suscribirse para seguir.",
      "El pago es mensual por MercadoPago: plan base 2 usuarios + adicionales por usuario extra.",
      "Si tenés un problema con el pago, escribinos a soporte.",
    ],
  },

  // ── PLANNER ─────────────────────────────────────────────────────────────────
  {
    id: "planner-tarea", sec: "planner",
    titulo: "Crear una tarea en el Planner",
    kw: "planner tarea crear nueva agregar pendiente todo recordatorio hacer cargar kanban tablero",
    pasos: [
      "Entrá al módulo “Planner” desde el inicio (tablero tipo Kanban).",
      "Tocá el “＋” en la columna del estado donde querés que arranque (ej: Pendiente).",
      "Cargá el título (obligatorio), descripción, prioridad y fechas/horas.",
      "Opcional: vinculá la tarea a un proyecto y/o a un presupuesto, y asignala a alguien.",
      "Tocá “Guardar”.",
    ],
    route: "/planner", routeLabel: "Ir al Planner",
  },
  {
    id: "planner-estados", sec: "planner",
    titulo: "Mover tareas entre estados (Kanban)",
    kw: "mover tarea estado arrastrar columna pendiente en progreso completado cancelado avanzar terminar kanban",
    pasos: [
      "El tablero tiene 4 columnas: Pendiente, En progreso, Completado y Cancelado.",
      "Arrastrá la tarjeta de una columna a otra para cambiarle el estado.",
      "También podés editar la tarea y cambiar el estado desde el desplegable.",
      "Usá la búsqueda y los filtros por proyecto/estado para encontrar tareas.",
    ],
    route: "/planner", routeLabel: "Ir al Planner",
  },
  {
    id: "planner-google", sec: "planner",
    titulo: "Conectar el Planner con Google Calendar",
    kw: "google calendar conectar sincronizar agenda evento gcal vincular integrar tareas calendario",
    pasos: [
      "En el Planner, conectá tu cuenta de Google con el botón de Google Calendar.",
      "Las tareas con fecha se sincronizan como eventos en tu calendario.",
      "Las que ya están sincronizadas muestran un ícono de calendario azul.",
    ],
    route: "/planner", routeLabel: "Ir al Planner",
  },
  {
    id: "crear-proyecto", sec: "planner",
    titulo: "Crear un proyecto",
    kw: "proyecto crear nuevo agregar obra agrupar carpeta presupuesto vincular organizar",
    pasos: [
      "Un proyecto agrupa tareas y presupuestos de una misma obra/cliente.",
      "En el Planner, tocá “Nuevo proyecto”, ponele nombre y (opcional) vinculá un presupuesto.",
      "También aparecen al asignar clientes/presupuestos en el Cotizador.",
    ],
    route: "/planner", routeLabel: "Ir al Planner",
  },

  // ── FISCAL ──────────────────────────────────────────────────────────────────
  {
    id: "fiscal-factura", sec: "fiscal",
    titulo: "Cargar una factura",
    kw: "factura facturas cargar nueva emitir registrar fiscal afip comprobante venta iva monto",
    pasos: [
      "Entrá al módulo Fiscal y, en la pestaña “Facturas”, tocá “＋ Nueva factura”.",
      "Elegí el Tipo (A, B, C, M o E) y cargá número, fecha, emisor y cliente.",
      "Poné el Concepto, el Monto neto y la alícuota de IVA: el total se calcula solo.",
      "Elegí el estado (emitida, cobrada o anulada) y tocá “Guardar factura”.",
    ],
    route: "/fiscal", routeLabel: "Ir a Fiscal",
  },
  {
    id: "fiscal-monotributo", sec: "fiscal",
    titulo: "Configurar monotributo / condición fiscal",
    kw: "monotributo categoria fiscal condicion responsable inscripto exento recategorizacion cuit afip limite configurar",
    pasos: [
      "En el módulo Fiscal, andá a la pestaña “Configuración”.",
      "Elegí la condición (Monotributo, Responsable Inscripto o Exento) y cargá CUIT, banco y CBU.",
      "Si sos monotributista, elegí tu categoría (A a K) y la fecha de próxima recategorización.",
      "El módulo te muestra un semáforo con el uso del límite de facturación de tu categoría.",
    ],
    route: "/fiscal", routeLabel: "Ir a Fiscal",
  },
  {
    id: "fiscal-negro", sec: "fiscal",
    titulo: "Cargar un movimiento sin facturar",
    kw: "movimiento sin facturar negro informal efectivo ingreso egreso fiscal no facturado registrar",
    pasos: [
      "En el módulo Fiscal, pestaña “Movimientos sin facturar”.",
      "Cargá el tipo (ingreso o egreso), concepto, monto y fecha.",
      "Sirve para tener la foto real de ingresos/egresos más allá de lo facturado.",
    ],
    route: "/fiscal", routeLabel: "Ir a Fiscal",
  },

  // ── CONTROL FINANCIERO (avanzado) ───────────────────────────────────────────
  {
    id: "cf-honorarios", sec: "finanzas",
    titulo: "Configurar honorarios de socios y reserva",
    kw: "honorarios socios reparto distribucion ganancia reserva porcentaje retiro sueldo socio dividir resultado",
    pasos: [
      "En el Control Financiero, configurá los honorarios (uno por socio).",
      "Cada honorario puede ser un porcentaje del resultado o un monto fijo.",
      "Definí también el % de Reserva que querés guardar del resultado positivo.",
      "Ganancia neta = Resultado − Honorarios − Reserva (se calcula automáticamente).",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "cf-personal", sec: "finanzas",
    titulo: "Cargar personal y sueldos del período",
    kw: "personal sueldos jornales pagar empleados obreros cuadrilla salario semana cargar planilla",
    pasos: [
      "En el Control Financiero, dentro del período abierto, andá a la sección Personal.",
      "Cargá cada persona con su pago del período.",
      "El total de Personal se resta junto con los egresos para dar el resultado.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "cf-imprimir", sec: "finanzas",
    titulo: "Imprimir / exportar un período financiero",
    kw: "imprimir exportar pdf periodo financiero resumen semana mes reporte planilla descargar",
    pasos: [
      "En el Control Financiero, abrí el período que querés.",
      "Usá la opción de imprimir: muestra ingresos, egresos, personal, honorarios, reserva y ganancia neta.",
      "En la ventana de impresión elegí “Guardar como PDF” para descargarlo.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },

  // ── PORTAL / CONSULTAS ──────────────────────────────────────────────────────
  {
    id: "consultas", sec: "accesos",
    titulo: "Ver y responder consultas de un cliente",
    kw: "consultas consulta mensaje cliente pregunta responder contestar portal chat duda comunicacion",
    pasos: [
      "Los clientes con portal pueden dejar consultas desde su cuenta.",
      "Las ves en la sección de la obra/portal y podés responderlas para que el cliente las lea.",
      "Definí en “Accesos de clientes” si el cliente tiene habilitada la sección de consultas.",
    ],
  },

  // ── CONCEPTUALES ────────────────────────────────────────────────────────────
  {
    id: "concepto-costo-margen", sec: "*",
    titulo: "Qué es el costo de ejecución y el margen",
    kw: "costo ejecucion margen ganancia diferencia precio venta significa que es entender concepto utilidad",
    pasos: [
      "Costo de ejecución = lo que te sale hacer la obra (materiales + mano de obra + maquinaria), sin recargos.",
      "Sobre ese costo se aplican los coeficientes: Gastos Generales, Beneficio e IVA.",
      "El Precio de venta es el costo con esos recargos. El Margen es la diferencia entre venta y costo.",
      "En la impresión “Interno” ves el costo de ejecución y el margen; en la “Cliente”, solo el precio final.",
    ],
  },
  {
    id: "concepto-coeficientes", sec: "*",
    titulo: "Qué significan GG, Beneficio, IVA y los K",
    kw: "que significa gg gastos generales beneficio ben iva coeficiente k materiales mano obra concepto entender para que sirve",
    pasos: [
      "GG (Gastos Generales): % para cubrir costos indirectos del estudio/obra (oficina, seguros, etc.).",
      "Beneficio (Ben): % de utilidad que querés ganar sobre el costo.",
      "IVA: impuesto que se suma al final (según corresponda).",
      "K Materiales / K Mano de obra / K Maquinaria: coeficientes de actualización para ajustar precios sin tocar el análisis.",
      "Se configuran en el botón “Coeficientes” dentro del presupuesto.",
    ],
  },
  {
    id: "concepto-flujo", sec: "*",
    titulo: "¿Por dónde empiezo? Flujo recomendado",
    kw: "empezar primero arrancar inicio flujo orden pasos como uso sistema guia tutorial principiante nuevo",
    pasos: [
      "1) Revisá tus precios base en Materiales, Mano de obra y Maquinaria.",
      "2) Cargá tu cliente y creá el presupuesto con sus rubros e ítems.",
      "3) Ajustá los Coeficientes y exportá el presupuesto para el cliente.",
      "4) Cuando lo aprueben, cerralo y gestioná la obra (contrato, cobros, certificados).",
      "5) Importá los cobros y pagos al Control Financiero para ver la rentabilidad.",
    ],
  },

  // ── GENERAL / NAVEGACIÓN ────────────────────────────────────────────────────
  {
    id: "que-es-sistema", sec: "*",
    titulo: "Qué es FAIM OBRAS y qué puedo hacer",
    kw: "que es faim obras sistema sirve hacer puedo modulos para funciones overview general ayuda capacidades",
    pasos: [
      "Es un sistema integral de gestión para estudios y empresas constructoras.",
      "Cotizador: presupuestos con análisis de costos, coeficientes y cómputo.",
      "Obra: contrato, cobros, subcontratos, compras y certificados de avance.",
      "Gantt y Curva de inversión, Control Financiero, Planner, Fiscal y Portal de clientes.",
      "Todo está conectado: cargás el dato una vez y viaja entre los módulos.",
    ],
  },
  {
    id: "navegar-inicio", sec: "*",
    titulo: "Volver al inicio / moverme entre módulos",
    kw: "volver inicio home menu principal navegar moverme modulos ir pantalla atras donde",
    pasos: [
      "Tocá el nombre o logo del estudio (arriba a la izquierda) para volver al inicio.",
      "Desde el inicio elegís cualquier módulo de la lista.",
      "Dentro del Cotizador, el botón con la flecha (←) te lleva atrás.",
    ],
    route: "/", routeLabel: "Ir al inicio",
  },
  {
    id: "salir-sesion", sec: "*",
    titulo: "Cerrar sesión / salir",
    kw: "salir cerrar sesion logout desconectar logout cuenta cerrar terminar",
    pasos: [
      "Arriba a la derecha tocá “Salir” (junto al círculo con tus iniciales).",
      "Volvés a la pantalla de ingreso.",
    ],
  },
  {
    id: "registrarme", sec: "*",
    titulo: "Crear una cuenta / prueba gratuita",
    kw: "registrarme registrar cuenta nueva crear alta prueba gratis trial empezar suscribir estudio",
    pasos: [
      "En la pantalla de ingreso, tocá la pestaña “Registrarme”.",
      "Cargá el nombre del estudio o empresa, tu nombre, email y contraseña.",
      "Tocá “Comenzar prueba gratuita 15 días”. Entrás directo con tu estudio creado.",
    ],
  },
  {
    id: "mobile", sec: "*",
    titulo: "¿Funciona en el celular o tablet?",
    kw: "celular telefono movil mobile tablet android iphone funciona app responsive afuera obra terreno",
    pasos: [
      "Sí, funciona desde el navegador del celular y la tablet, sin instalar nada.",
      "En pantallas chicas, las acciones extra se agrupan en un menú (ícono de tres líneas o desplegable).",
      "Ideal para cargar avances o ver la caja desde la obra.",
    ],
  },
  {
    id: "datos-seguridad", sec: "*",
    titulo: "¿Dónde se guardan mis datos? ¿Es seguro?",
    kw: "datos seguro seguridad nube guardan perder respaldo backup privado donde almacena online proteccion",
    pasos: [
      "Todo se guarda en la nube, no en tu computadora.",
      "Accedés desde cualquier dispositivo con tu usuario y contraseña.",
      "Cada estudio ve solo sus propios datos (sistema multiempresa).",
    ],
  },
  {
    id: "buscar", sec: "*",
    titulo: "Buscar un material, ítem o presupuesto",
    kw: "buscar busqueda encontrar filtrar buscador material item presupuesto lupa filtro rubro",
    pasos: [
      "En Materiales y Análisis de costos tenés un buscador por nombre o código, más un filtro por rubro.",
      "En el Cotizador, los presupuestos están agrupados por cliente (desplegá cada cliente).",
    ],
  },

  // ── TROUBLESHOOTING / PROBLEMAS FRECUENTES ──────────────────────────────────
  {
    id: "no-aparece-certificado", sec: "*",
    titulo: "No me aparecen Certificados / Gantt / Obra",
    kw: "no aparece falta boton certificado gantt obra curva no encuentro no esta no veo donde habilitar",
    pasos: [
      "Esos botones se habilitan cuando el presupuesto está cerrado.",
      "Abrí el presupuesto y cerralo (queda con candado).",
      "Ahí aparecen en la barra superior: Cert., Gantt, Curva, Listado y Obra.",
    ],
  },
  {
    id: "no-puedo-editar", sec: "presupuesto",
    titulo: "No puedo editar el presupuesto",
    kw: "no puedo editar modificar bloqueado cerrado candado no me deja cambiar trabado reabrir",
    pasos: [
      "Si tiene candado, está cerrado: por eso no se edita (para no romper la obra en curso).",
      "Abrí el presupuesto y tocá “Reabrir” para volver a editarlo.",
      "Cuando termines, podés cerrarlo de nuevo.",
    ],
  },
  {
    id: "precio-no-cambia", sec: "*",
    titulo: "Cambié un precio pero el presupuesto no se actualizó",
    kw: "precio no cambia no actualiza viejo desactualizado presupuesto cerrado congelado no recalcula material",
    pasos: [
      "Los presupuestos cerrados quedan congelados a propósito (no recalculan).",
      "Si querés que tome el precio nuevo, reabrí el presupuesto.",
      "Los presupuestos abiertos sí recalculan solos al cambiar un material, MO o equipo.",
    ],
  },
  {
    id: "no-borra-cliente", sec: "cotizador",
    titulo: "No me deja eliminar un cliente",
    kw: "no puedo eliminar borrar cliente error no deja quitar tiene presupuestos",
    pasos: [
      "Un cliente solo se puede eliminar si NO tiene presupuestos asociados.",
      "Primero eliminá o reasigná sus presupuestos, y después borrá el cliente.",
    ],
  },
  {
    id: "sesion-expiro", sec: "*",
    titulo: "Se cerró la sesión sola / me pide ingresar de nuevo",
    kw: "sesion expiro cerro sola caduco token vencio me saco ingresar de nuevo desconecto solo",
    pasos: [
      "Por seguridad, la sesión vence cada cierto tiempo.",
      "Volvé a ingresar con tu email y contraseña y seguís donde estabas.",
      "Lo que guardaste no se pierde: queda en la nube.",
    ],
  },
  {
    id: "olvide-contrasena", sec: "*",
    titulo: "Olvidé mi contraseña / no puedo entrar",
    kw: "olvide contraseña clave password no puedo entrar ingresar recuperar resetear cambiar acceso bloqueado",
    pasos: [
      "Verificá que el email esté bien escrito y sin espacios.",
      "Si sos usuario del estudio, el admin puede recrear tu acceso desde Configuración → Usuarios.",
      "Si no podés resolverlo, escribí a soporte para recuperar el acceso.",
    ],
    route: "/soporte", routeLabel: "Ir a Soporte",
  },
  {
    id: "semaforo-precios", sec: "costos",
    titulo: "Qué significan los colores en los precios",
    kw: "color colores punto verde amarillo rojo semaforo material precio actualizacion dias significa antiguedad",
    pasos: [
      "El puntito de color indica hace cuánto se actualizó el precio.",
      "Verde: actualizado hace poco. Amarillo: más de 30 días. Rojo: más de 60 días.",
      "Sirve para detectar de un vistazo qué precios conviene revisar.",
    ],
  },
  {
    id: "roles-usuarios", sec: "config",
    titulo: "Diferencia entre usuario admin y personal",
    kw: "rol roles admin personal usuario permisos diferencia tipo empleado acceso limitado que puede",
    pasos: [
      "Admin: acceso completo al sistema del estudio.",
      "Personal: acceso acotado (su portal de trabajo), pensado para empleados.",
      "El rol se elige al crear el usuario en Configuración → Usuarios del estudio.",
    ],
    route: "/config", routeLabel: "Ir a Configuración",
  },

  {
    id: "soporte", sec: "*",
    titulo: "Contactar a soporte",
    kw: "soporte ayuda contacto humano problema whatsapp telefono mail email no funciona error reclamo hablar persona",
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
  if (/\/fiscal/.test(p)) return "fiscal";
  return "home";
}

// Sugerencias iniciales según dónde está el usuario
function sugerencias(sec) {
  const m = {
    cotizador: ["¿Cómo creo un presupuesto?", "¿Cómo cargo un cliente?", "¿Cómo exporto un presupuesto a PDF?"],
    presupuesto: ["¿Cómo agrego rubros e ítems?", "¿Cómo cambio los coeficientes?", "¿Cómo exporto el presupuesto?"],
    certificado: ["¿Cómo hago un certificado de avance?", "¿Cómo cargo los egresos?"],
    obra: ["¿Cómo genero el contrato?", "¿Cómo registro un cobro?", "¿Cómo cargo un subcontrato?"],
    costos: ["¿Cómo creo mi propio análisis de costo?", "¿Cómo agrego un material?", "¿Cómo cambio el precio de la mano de obra?"],
    finanzas: ["¿Cómo importo cobros de una obra?", "¿Cómo cargo ingresos y egresos?"],
    accesos: ["¿Cómo le doy acceso a un cliente?", "¿Qué ve el cliente en el portal?"],
    config: ["¿Cómo cambio el logo y color?", "¿Cómo agrego usuarios?"],
    planner: ["¿Cómo creo una tarea?", "¿Cómo conecto Google Calendar?", "¿Cómo creo un proyecto?"],
    fiscal: ["¿Cómo cargo una factura?", "¿Cómo configuro mi monotributo?", "¿Qué es un movimiento sin facturar?"],
    clientes: ["¿Cómo cargo un cliente?", "¿Cómo creo un proyecto?", "¿Cómo creo un presupuesto?"],
    home: ["¿Cómo creo un presupuesto?", "¿Cómo agrego un material?", "¿Cómo le doy acceso a un cliente?"],
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
