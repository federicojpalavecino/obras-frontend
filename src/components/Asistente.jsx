// FAIM OBRAS — Asistente de ayuda (local, sin IA)
// Widget flotante que responde dudas sobre el uso del sistema.
// Motor: normaliza acentos/mayúsculas, tolera errores de tipeo (distancia de
// edición), entiende sinónimos y prioriza según la pantalla en la que estás.
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MessageCircle, X, Send, Sparkles, ArrowRight } from "lucide-react";
import api from "../cotizador/api";

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
  // Prefijo: cubre abreviaturas y morfología (presu→presupuesto, certific→certificado)
  // sin los falsos positivos de un substring suelto (presupuesto ⊅ puesto).
  if (q.length >= 4 && k.length >= 4 && (k.startsWith(q) || q.startsWith(k))) return 1.4;
  const tol = q.length <= 4 ? 1 : 2;          // palabras cortas, menos tolerancia
  if (Math.abs(q.length - k.length) > tol) return 0;
  return lev(q, k) <= tol ? 1 : 0;
}

// Palabras vacías que no aportan al match (no penalizan ni inflan el score)
const STOP = new Set([
  "como", "que", "cual", "cuales", "donde", "para", "porque", "por", "con", "sin",
  "los", "las", "del", "una", "uno", "unos", "unas", "mis", "tus", "sus", "mi", "tu", "su",
  "hago", "hacer", "haces", "puedo", "puede", "quiero", "queria", "necesito", "tengo",
  "the", "and", "este", "esta", "esto", "esos", "esas", "ese", "esa", "eso", "ahi", "aca",
  "es", "el", "la", "de", "un", "al", "lo", "se", "le", "les", "muy", "tan", "hay", "son",
  "ser", "estar", "me", "te", "nos", "ya", "asi", "pero", "mas", "menos", "todo", "toda",
  // Conectores: sin esto "en" se colaba como palabra de contenido y, al ser raro
  // en el catálogo, tenía IDF alto y hacía ganar "REVOQUE 2 EN 1" a una consulta
  // de mampostería.
  "en", "sobre", "entre", "hasta", "desde", "cada", "segun", "tras", "ante", "bajo",
  "contra", "durante", "mediante", "salvo", "cuando", "mientras", "aunque",
]);
const tokens = (s) => normalizar(s).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));

// ── Base de conocimiento ──────────────────────────────────────────────────────
// kw: sinónimos / palabras clave (se normalizan en runtime).
// pasos: respuesta paso a paso. route/routeLabel: botón opcional para ir directo.
const BASE = [
  // ── COTIZADOR / PRESUPUESTOS ────────────────────────────────────────────────
  {
    id: "crear-presupuesto", sec: "cotizador",
    titulo: "Crear un presupuesto nuevo",
    kw: "crear creo crea armo hago nuevo presupuesto cotizacion cotizar armar empezar obra agregar añadir hacer presu cotiza",
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
    kw: "cliente nuevo crear creo crea cargo cargar agregar agrego añadir doy comitente contacto alta razon social comprador",
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
    kw: "crear creo crea armo hago propio analisis costo costos item nuevo armar componer hacer mio personalizado unitario apu",
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
    kw: "cargas sociales carga porcentaje jubilacion aportes leyes sociales mano obra recalcular sindicato defecto default vienen aparecen lista desglose",
    pasos: [
      "En “Mano de obra”, panel izquierdo “Cargas sociales”.",
      "La primera vez que entrás ya vienen cargadas las del convenio (aportes patronales, ART, fondo de cese, SAC, vacaciones e improductivos), que suman 65%.",
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
    kw: "certificado certificar avance medicion porcentaje ejecutado cobrar emitir nuevo egresos obra acumulado hago armo creo",
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
    kw: "gantt planificacion cronograma planning tiempos plazos diagrama barras planificar duracion plan trabajos",
    pasos: [
      "Se arma automáticamente desde los rubros del presupuesto.",
      "Abrí el presupuesto y tocá “Gantt” en la barra superior.",
      "Si todavía no hay tareas, tocá “⚡ Generar desde presupuesto”.",
      "Tocá una tarea para editarle el nombre, las fechas, la duración, el avance o el color.",
      "Arriba configurás el inicio de obra, las horas por día y qué días del fin de semana se trabajan.",
    ],
  },
  {
    id: "gantt-fin-de-semana", sec: "presupuesto",
    titulo: "Definir si se trabaja sábado o domingo",
    kw: "sabado sabados domingo domingos fin de semana finde feriado calendario laboral dias habiles trabaja trabajan semana septimo dia jornada",
    pasos: [
      "De lunes a viernes se trabaja siempre; el fin de semana se define obra por obra.",
      "Abrí el Gantt del presupuesto.",
      "En la barra de configuración, al lado de “SE TRABAJA”, tocá “Sáb” o “Dom”.",
      "Se guarda solo y replanifica en el momento: la fecha de fin de obra se corre sin cambiar los días hábiles de trabajo.",
      "En la grilla, los días que NO se trabajan quedan sombreados. Si activás el sábado, deja de verse gris.",
    ],
  },
  {
    id: "gantt-imprimir", sec: "presupuesto",
    titulo: "Imprimir el Gantt",
    kw: "imprimir impresion imprimo papel pdf gantt cronograma plan trabajos hoja a4 exportar llevar obra mostrar cliente",
    pasos: [
      "Abrí el Gantt del presupuesto.",
      "En la barra de configuración tocá “🖨 Imprimir” (en celular está en el menú ⋮).",
      "Sale una hoja A4 apaisada con la tabla de tareas (inicio, fin, días, personas), los meses arriba y las barras.",
      "Los días que no se trabajan salen sombreados y el camino crítico en rojo.",
      "La escala se ajusta sola para que la obra entera entre en el ancho de la hoja.",
    ],
  },
  {
    id: "gantt-vincular", sec: "presupuesto",
    titulo: "Vincular tareas entre sí (dependencias)",
    kw: "vincular vinculo vinculos dependencia dependencias enlazar unir encadenar relacionar tareas predecesora sucesora despues antes flecha camino critico critica holgura",
    pasos: [
      "Abrí el Gantt y tocá “🔗 Vincular” en la barra superior.",
      "Tocá primero la tarea que va ANTES y después la que va DESPUÉS. Queda una flecha entre las dos.",
      "Para encadenar todo de una, usá “⛓ Encadenar”: pone cada tarea después de la anterior (reemplaza los vínculos que haya).",
      "Con vínculos cargados aparece “↻ Recalcular”, que recalcula y guarda las fechas según las dependencias.",
      "“▲ Crítico” resalta en rojo el camino crítico: las tareas sin holgura, las que si se atrasan atrasan toda la obra.",
    ],
  },
  {
    id: "gantt-cuadrilla", sec: "presupuesto",
    titulo: "Cuánta gente trabaja en cada tarea (el plazo se calcula solo)",
    kw: "cuadrilla gente personas operarios oficiales personal cuantos sumar poner mas gente plazo duracion calcula automatico acortar tarea rendimiento horas",
    pasos: [
      "Primero traé las horas: en el Gantt tocá “⏱ Horas”. Toma las horas de mano de obra del análisis de costos de cada ítem.",
      "Con las horas cargadas, cada tarea muestra 👷 y los botones − / + al lado del nombre.",
      "Sumá o sacá gente con esos botones.",
      "La duración se recalcula sola: horas totales ÷ (horas por día × personas), repartido en los días que se trabajan.",
      "Si las tareas están vinculadas, toda la cadena se corre y cambia la fecha de fin de obra.",
    ],
  },
  {
    id: "gantt-jerarquia", sec: "presupuesto",
    titulo: "Indentar una tarea: tareas resumen y subtareas",
    kw: "jerarquia indentar indento indenta indentada sangria subtarea subtareas tarea resumen agrupar anidar colgar padre hija nivel etapa",
    pasos: [
      "Cada fila del Gantt tiene una flecha ⇥ a la izquierda del nombre.",
      "Tocá ⇥ para colgar la tarea de la de arriba: esa pasa a ser tarea resumen.",
      "La tarea resumen toma sus fechas de las hijas, suma sus horas y promedia el avance. Se muestra en MAYÚSCULAS.",
      "Para sacarla del grupo, tocá ⇤ en la subtarea.",
      "Hay un solo nivel de jerarquía, así que no se puede armar un enredo sin salida.",
    ],
  },
  {
    id: "gantt-mover-soltar", sec: "presupuesto",
    titulo: "Mover una tarea de fecha y soltarla si quedó fijada",
    kw: "mover arrastrar correr fecha tarea fijar fijada fijado chinche pin soltar suelto suelta solto liberar desfijar despegar no comenzar antes restriccion",
    pasos: [
      "Arrastrá la barra de una tarea para moverla de fecha. Las tareas que dependen de esa se reacomodan solas.",
      "La tarea arrastrada queda FIJADA con un “no comenzar antes de” y aparece un 📌 al lado del nombre.",
      "Una tarea fijada ya no se mueve sola cuando cambian sus dependencias.",
      "Para soltarla, tocá el 📌: vuelve a regirse por sus dependencias.",
    ],
  },
  {
    id: "gantt-avance", sec: "presupuesto",
    titulo: "Cargar el avance de una tarea del Gantt",
    kw: "avance completado porcentaje progreso ejecutado cuanto va tarea barra pintada",
    pasos: [
      "Tocá la tarea en el Gantt para abrir el modal de edición.",
      "Cargá el “% completado” y guardá.",
      "La barra se pinta con ese porcentaje.",
      "En las tareas resumen el avance es el promedio de sus subtareas: no se carga a mano.",
    ],
  },
  {
    id: "computo-cargar", sec: "presupuesto",
    titulo: "Cargar el cómputo de un ítem (medir cantidades)",
    kw: "computo computar medir medicion cantidad cantidades metros m2 m3 ml largo ancho alto perimetro pared losa descontar aberturas parcial sumar restar",
    pasos: [
      "Abrí el presupuesto y, en la línea del ítem, tocá “cómputo” (a la derecha del nombre).",
      "Se abre un panel a la derecha. Arriba elegís el tipo: m², m³, ml, m²/ml o u/Gl.",
      "Cargá una fila por sector: descripción, medidas y cantidad. El parcial se calcula solo.",
      "Para DESCONTAR (una abertura, un hueco), tocá el parcial de esa fila y pasa a “−”.",
      "Abajo tenés el total. Tocá “Aplicar” para que esa cantidad pase al ítem del presupuesto.",
      "Se guarda solo mientras cargás, así que no se pierde si cerrás el panel.",
    ],
  },
  {
    id: "computo-imprimir", sec: "presupuesto",
    titulo: "Imprimir el cómputo de cantidades",
    kw: "imprimir computo cantidades planilla papel memoria calculo justificar cliente comitente parciales totales",
    pasos: [
      "En la barra superior del presupuesto tocá “∑ Cómputo”.",
      "Sale una planilla con TODOS los ítems que tengan cómputo cargado, agrupados por rubro.",
      "De cada ítem salen las filas con su descripción, la fórmula, el signo (+/−) y el parcial, más el total.",
      "Si el total del cómputo no coincide con la cantidad cargada en el presupuesto, sale un aviso: te faltó tocar “Aplicar”.",
      "Para imprimir el cómputo de un solo ítem, usá “∑ Imprimir” dentro del panel de cómputo.",
    ],
  },
  {
    id: "computo-copiar", sec: "presupuesto",
    titulo: "Copiar el cómputo de otro ítem",
    kw: "copiar computo otro item repetir mismo igual duplicar medidas reutilizar",
    pasos: [
      "Abrí el panel de cómputo del ítem donde lo querés pegar.",
      "Tocá “Copiar cómputo de otro ítem” y elegí de cuál.",
      "Se copian las filas y el tipo. El ítem de origen NO se modifica.",
      "Ajustá lo que haga falta y tocá “Aplicar”.",
    ],
  },
  {
    id: "margen", sec: "presupuesto",
    titulo: "Qué es el margen y cómo se calcula",
    kw: "margen ganancia utilidad beneficio porcentaje rentabilidad cuanto gano da mal raro calcula formula costo ejecucion",
    pasos: [
      "El margen sale de: (precio sin IVA − costo de ejecución) ÷ precio sin IVA.",
      "Se calcula sobre el precio SIN IVA porque el IVA no es tuyo, lo depositás.",
      "El costo de ejecución son materiales + mano de obra (con cargas) + maquinaria.",
      "Si no tocaste nada más, el margen te va a dar justo lo que armás con GG y Beneficio: con coeficiente 1,429 el margen es 30%.",
      "Los materiales cuentan como costo solo si los estás cobrando (K Mat mayor que 0). Con K Mat en 0 el cliente los compra y no son costo tuyo.",
    ],
  },
  {
    id: "gestion-materiales", sec: "presupuesto",
    titulo: "Gestión de materiales (el cliente provee los materiales)",
    kw: "gestion materiales cliente provee compra honorario porcentaje administracion k mat coeficiente modo",
    pasos: [
      "Abrí los coeficientes del presupuesto y activá “Gestión de materiales”.",
      "Cargá el “% Gestión sobre materiales”: es tu honorario por administrar la compra.",
      "Si el cliente compra los materiales y vos NO se los facturás, poné K Mat en 0. El precio pasa a ser mano de obra + maquinaria + tu honorario.",
      "Si los materiales sí van dentro del presupuesto, dejá K Mat en 1 (o el coeficiente que uses) y además cobrás el % de gestión.",
      "El margen se ajusta solo a cada caso.",
    ],
  },
  {
    id: "ver-mis-presupuestos", sec: "cotizador",
    titulo: "Ver mis obras y presupuestos",
    kw: "ver mis obras presupuestos tengo abiertas abiertos cerrados listado lista donde estan encontrar buscar todas todos",
    pasos: [
      "Entrá a “Presupuestos y obras” desde el inicio.",
      "Los presupuestos salen agrupados por cliente, con su estado: ABIERTO (se puede editar) o CERRADO (con candado).",
      "Tocá uno para abrirlo. Con la carpeta entrás directo a la Gestión de obra.",
      "Si tenés muchos, agrupalos por proyecto desde “Clientes y Proyectos”.",
    ],
    route: "/cotizador", routeLabel: "Ver mis presupuestos",
  },
  {
    id: "reabrir-presupuesto", sec: "cotizador",
    titulo: "Reabrir un presupuesto cerrado",
    kw: "reabrir abrir cerrado cerro cerre cerraron candado error equivoque equivoco sin querer desbloquear editar modificar volver atras",
    pasos: [
      "Un presupuesto cerrado no se puede editar: por eso los precios y cantidades quedan congelados.",
      "Abrí el presupuesto y tocá “Reabrir” (el candado) en la barra superior.",
      "Ya podés volver a editar rubros, ítems y coeficientes.",
      "OJO: los certificados que hayas emitido quedan con su monto fijo, no se recalculan.",
      "Cuando termines, cerralo de nuevo para poder sacar el listado de materiales.",
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
      "IMPORTANTE: el presupuesto tiene que estar CERRADO. El botón “Listado materiales” solo aparece con el presupuesto cerrado (con el candado).",
      "Si está abierto, primero cerralo (botón “Cerrar”). Eso congela precios y cantidades.",
      "Ya cerrado, en la barra superior tocá “Listado materiales” para ver los materiales totales a comprar (se puede exportar a PDF y CSV/Excel).",
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
    kw: "contrato generar genero crear creo cargar hacer hago armo firmar monto anticipo plazo desembolsos condiciones imprimir pdf",
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
    titulo: "Cargar un cobro o anticipo del cliente",
    kw: "cobros cobro cobrar pago recibido ingreso plata cliente cuota anticipo adelanto seña cuenta corriente registrar",
    pasos: [
      "Entrá a la “Obra” y andá a la pestaña “Cobros”.",
      "Cargá el cobro: monto, fecha, forma de pago y referencia/nota. Un anticipo se carga igual que cualquier cobro.",
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
      "Ojo: solo suma lo que ya se cobró o se pagó. Lo que está PENDIENTE no entra al resultado y lo ves en la pestaña Previsión.",
    ],
    route: "/finanzas", routeLabel: "Ir a Control Financiero",
  },
  {
    id: "cf-prevision", sec: "finanzas",
    titulo: "Por qué lo pendiente ya no suma al resultado",
    kw: "pendiente prevision previsión no suma desaparecio desapareció bajo bajó resultado cambio cambió me falta plata deuda debo deben cuenta corriente proyeccion proyección futuro",
    pasos: [
      "El Control Financiero ahora muestra caja: solo la plata que se movió de verdad. Si una fila está en PENDIENTE, todavía no entró ni salió, así que no suma al resultado del período.",
      "No se perdió nada. Todo lo pendiente está en la pestaña “Previsión”, que muestra lo que vas a cobrar y lo que vas a pagar según lo ya pactado.",
      "En Previsión lo podés leer de tres formas: por fecha (entradas y salidas separadas), por obra, o por persona — quién te debe y a quién le debés, con el detalle de por qué.",
      "Cuando marcás una fila como COBRADO o PAGADO, entra al resultado del período y desaparece sola de Previsión. No hay que cargarla dos veces.",
      "Lo mismo vale para la obra: un desembolso, un certificado, lo certificado a un contratista o una compra con saldo aparecen en Previsión hasta que la plata se mueve.",
    ],
    route: "/finanzas", routeLabel: "Ver la Previsión",
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
    kw: "acceso accesos cliente portal ver online clave contraseña usuario invitar habilitar mostrar secciones permiso doy dar darle nuevo crear",
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
    id: "ubicacion-estudio", sec: "config",
    titulo: "Poner la ciudad de mi estudio en presupuestos y certificados",
    kw: "ciudad localidad provincia ubicacion lugar resistencia chaco sale arriba encabezado esquina fecha imprime mi ciudad donde estoy domicilio",
    pasos: [
      "Ese “Ciudad, fecha” de los presupuestos y certificados sale de los datos de tu estudio, no está fijo.",
      "Entrá a “Configuración” y cargá Ciudad y Provincia.",
      "Guardá y volvé a imprimir: ya sale tu localidad.",
      "Si no cargás nada, se imprime solo la fecha.",
      "Ojo: esta es la ciudad de TU estudio. La ubicación de cada obra se carga aparte, en los datos del presupuesto.",
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
    titulo: "Suscripción y pago",
    kw: "suscripcion pago pagar precio plan vencido mercadopago factura abono mensual cobro renovar",
    pasos: [
      "El pago es mensual por MercadoPago: plan base con 2 usuarios incluidos, más un adicional por cada usuario extra.",
      "El monto se muestra al momento de activar la suscripción.",
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
    titulo: "Crear una cuenta",
    kw: "registrarme registrar cuenta nueva crear alta empezar suscribir suscripcion estudio",
    pasos: [
      "En la pantalla de ingreso, tocá la pestaña “Registrarme”.",
      "Cargá el nombre del estudio o empresa, tu nombre, email y contraseña.",
      "Tocá “Crear cuenta y suscribirme”. Entrás directo con tu estudio creado.",
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
      "Email: contacto.faimobras@gmail.com.",
      "También está la sección “Soporte técnico” en el inicio.",
    ],
    route: "/soporte", routeLabel: "Ir a Soporte",
  },

  // ── OBRA / ANÁLISIS DE PRECIOS ──────────────────────────────────────────────
  // Conocimiento de oficio, no de la app. Los números concretos salen siempre
  // del catálogo del estudio (ver resolverRendimiento), no de acá.
  {
    id: "armar-analisis", sec: "costos",
    titulo: "Cómo se arma un análisis de precio unitario",
    kw: "armar analisis precio unitario apu como se arma componer desglosar costo directo item tarea armado estructura",
    pasos: [
      "Un análisis calcula cuánto cuesta UNA unidad de la tarea (1 m² de mampostería, 1 m³ de hormigón).",
      "Materiales: cuánto entra por unidad, ya con desperdicio. Ej.: 1 m² de pared de ladrillo común lleva ladrillos + mortero de asiento.",
      "Mano de obra: horas de cada gremio por unidad. Eso es el rendimiento (ver “Qué es un rendimiento”).",
      "Maquinaria/equipos: horas de uso por unidad (hormigonera, andamios, amoladora).",
      "La suma de los tres es el COSTO DIRECTO. Sobre eso el sistema aplica los coeficientes K, después GG + Beneficio, y al final IVA.",
      "En la app: abrí el presupuesto, tocá el nombre del ítem y se abre el panel de análisis a la derecha.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "que-es-rendimiento", sec: "costos",
    titulo: "Qué es un rendimiento y cómo se lee",
    kw: "rendimiento que es como se lee horas unidad hs m2 jornada productividad significa interpretar",
    pasos: [
      "El rendimiento son las horas de mano de obra que lleva UNA unidad de tarea. Se escribe h/m², h/m³ o h/m.",
      "Ej.: 0,6 h/m² de un oficial quiere decir que en 1 hora hace 1,67 m², y en una jornada de 8 h hace ~13 m².",
      "Para pasar de horas a producción diaria: 8 ÷ (horas por unidad).",
      "Si el análisis tiene varios gremios trabajando a la par, el ritmo lo marca el que más horas necesita, no la suma.",
      "Preguntame “rendimiento de …” y te lo calculo con los valores cargados en TU catálogo.",
    ],
  },
  {
    id: "cuadrilla-jornada", sec: "costos",
    titulo: "Cuadrilla, jornada y cómo pasar horas a días de obra",
    kw: "cuadrilla jornada dias obra plazo cuantos dias equipo gente personal calcular duracion tarea",
    pasos: [
      "Jornada de referencia: 8 horas. Se puede cambiar en la configuración del Gantt.",
      "Horas totales de una tarea = rendimiento (h/unidad) × cantidad del cómputo.",
      "Días = horas totales ÷ (8 × cantidad de personas de ese gremio).",
      "Ej.: 200 m² de mampostería a 0,6 h/m² de oficial = 120 h. Con 2 oficiales: 120 ÷ 16 = 7,5 días.",
      "El Gantt del presupuesto hace esta cuenta solo a partir de los análisis.",
    ],
    route: "/cotizador", routeLabel: "Ir a Presupuestos",
  },
  {
    id: "cargas-sociales-factor", sec: "costos",
    titulo: "Cargas sociales: por qué la mano de obra sale más que el jornal",
    kw: "cargas sociales jornal basico uocra aportes contribuciones porcentaje factor mano obra costo real encarece",
    pasos: [
      "El valor por hora que cargás en el maestro de mano de obra es el jornal básico, sin cargas.",
      "El presupuesto le suma el factor de cargas sociales que tengas configurado (por defecto 65%).",
      "O sea: una hora de oficial a $5.000 de básico entra al costo a $8.250 con el 65%.",
      "El factor se edita en los coeficientes del presupuesto, y el maestro de gremios en Análisis de costos → Mano de obra.",
      "Si cargás el jornal YA con cargas incluidas, poné el factor en 0 para no contarlas dos veces.",
    ],
  },
  {
    id: "computo-unidades", sec: "costos",
    titulo: "En qué unidad se computa cada tarea",
    kw: "computo unidad medida como se mide m2 m3 ml global tarea medir cubicar metrar cuantificar",
    pasos: [
      "Mampostería, revoques, contrapisos, carpetas, pisos, revestimientos y pintura: m² (superficie).",
      "Hormigones, excavaciones, rellenos y submuraciones: m³ (volumen).",
      "Zócalos, cordones, cañerías, cenefas y babetas: m lineal.",
      "Artefactos, aberturas, bocas de electricidad: unidad.",
      "Ayuda de gremios, limpieza de obra y similares: global (Gl).",
      "El panel de cómputo del ítem ya te calcula m², m³ y ml a partir de largo, ancho, alto y cantidad.",
    ],
  },
];

// Sección actual a partir de la URL (para priorizar respuestas relevantes)

// ═══════════════════════════════════════════════════════════════════════════
//  EL ASISTENTE COMO SECRETARIO
//
//  Hasta acá sabía explicar cómo se usa el sistema, pero no sabía nada del
//  estudio: preguntarle «cuánto me deben» era preguntarle a un manual. Estas
//  preguntas se contestan con los números de verdad, sin vueltas y sin
//  mandar a nadie a buscar la pantalla.
// ═══════════════════════════════════════════════════════════════════════════

const plata = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const fechaCorta = (f) => f ? new Date(f + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" }) : "";

// Cada pregunta de datos: cómo se reconoce y cómo se contesta.
const PREGUNTAS_DATOS = [
  {
    id: "cobrar",
    claves: ["cuanto me deben", "quien me debe", "por cobrar", "cobranzas", "que tengo por cobrar",
             "cuanto tengo que cobrar", "deudas de clientes", "me deben"],
    responder: (d) => {
      const c = d.por_cobrar || {};
      if (!c.cuantos) return { texto: "No tenés nada pendiente de cobro: todo lo pactado ya está cobrado." };
      const venc = c.vencido > 0
        ? `\n\n⚠ De eso, **${plata(c.vencido)}** ya está vencido.` : "";
      const lista = (c.detalle || []).slice(0, 6)
        .map(x => `· ${x.obra || "sin obra"} — ${plata(x.monto)}${x.vencido ? " (vencido)" : x.fecha ? ` · ${fechaCorta(x.fecha)}` : ""}`)
        .join("\n");
      return {
        texto: `Te deben **${plata(c.total)}** en ${c.cuantos} ${c.cuantos === 1 ? "cosa" : "cosas"} pendientes.${venc}\n\n${lista}`,
        ir: "/finanzas", irLabel: "Ver la previsión completa",
      };
    },
  },
  {
    id: "pagar",
    claves: ["cuanto debo", "a quien le debo", "por pagar", "que tengo que pagar", "deudas",
             "cuanto tengo que pagar", "le debo"],
    responder: (d) => {
      const c = d.por_pagar || {};
      const pers = d.personal || {};
      const partes = [];
      if (c.cuantos) {
        const venc = c.vencido > 0 ? ` (${plata(c.vencido)} vencido)` : "";
        partes.push(`Tenés **${plata(c.total)}** para pagar en ${c.cuantos} ${c.cuantos === 1 ? "cosa" : "cosas"}${venc}:\n` +
          (c.detalle || []).slice(0, 6)
            .map(x => `· ${x.persona || x.obra || x.concepto || "—"} — ${plata(x.monto)}${x.vencido ? " (vencido)" : ""}`)
            .join("\n"));
      }
      if (pers.total > 0) {
        partes.push(`Y al personal, esta semana: **${plata(pers.total)}**.\n` +
          (pers.grupos || []).filter(g => g.total > 0)
            .map(g => `· ${g.modalidad}: ${plata(g.total)}`).join("\n"));
      }
      if (!partes.length) return { texto: "No tenés nada pendiente de pago." };
      return { texto: partes.join("\n\n"), ir: "/finanzas", irLabel: "Ver la previsión" };
    },
  },
  {
    id: "personal",
    claves: ["cuanto le pago al personal", "sueldos", "jornales", "cuanto le tengo que pagar a",
             "pago del personal", "quien vino esta semana", "asistencia"],
    responder: (d) => {
      const p = d.personal || {};
      if (!p.total) return { texto: "Esta semana no hay nada para pagarle al personal. Si falta marcar la asistencia, entrá a Personal.", ir: "/personal", irLabel: "Ir a Personal" };
      const det = (p.grupos || []).filter(g => g.total > 0).map(g =>
        `**${g.modalidad}** — ${plata(g.total)}\n` +
        g.personas.map(x => `  · ${x.nombre}: ${plata(x.queda)} (${x.detalle})`).join("\n")
      ).join("\n\n");
      return {
        texto: `Del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)} tenés que pagar **${plata(p.total)}**:\n\n${det}`,
        ir: "/personal", irLabel: "Ir a pagar",
      };
    },
  },
  {
    id: "atrasadas",
    claves: ["que obra esta atrasada", "obras atrasadas", "atraso", "como vienen las obras",
             "estado de las obras", "que obras tengo"],
    responder: (d) => {
      const o = d.obras || {};
      if (!o.total) return { texto: "Todavía no hay ninguna obra con el plan armado en el Gantt." };
      const atr = o.atrasadas || [];
      if (!atr.length) {
        const prox = (o.todas || []).filter(x => x.fin).slice(0, 4)
          .map(x => `· ${x.obra} — termina el ${fechaCorta(x.fin)} (${Math.round(x.avance_pct)}%)`).join("\n");
        return { texto: `Ninguna obra está atrasada. Tenés ${o.total} con plan armado:\n\n${prox}`,
                 ir: "/planner", irLabel: "Ver todas en el Planner" };
      }
      const lista = atr.map(x =>
        `· **${x.obra}** — tenía que terminar el ${fechaCorta(x.fin)} y va ${Math.round(x.avance_pct)}%`).join("\n");
      return {
        texto: `${atr.length} obra${atr.length !== 1 ? "s" : ""} pasada${atr.length !== 1 ? "s" : ""} de fecha:\n\n${lista}`,
        ir: "/planner", irLabel: "Ver todas en el Planner",
      };
    },
  },
  {
    id: "deposito",
    claves: ["cuanto stock", "que hay en el deposito", "material que queda", "falta material",
             "hay que pedir", "cuanto cemento", "stock"],
    responder: (d) => {
      const dep = d.deposito || {};
      if (!(dep.items || []).length) return { texto: "El depósito está vacío: todavía no cargaste material.", ir: "/panol", irLabel: "Ir al depósito" };
      const falt = dep.faltantes || [];
      const lista = dep.items.slice(0, 8)
        .map(x => `· ${x.nombre}: **${x.disponible} ${x.unidad}**${x.disponible < x.minimo ? " ⚠ bajo el mínimo" : ""}`).join("\n");
      const aviso = falt.length
        ? `\n\n⚠ Hay que pedir: ${falt.map(x => x.nombre).join(", ")}.` : "";
      return { texto: `En el depósito:\n\n${lista}${aviso}`, ir: "/panol", irLabel: "Ir al depósito" };
    },
  },
  {
    id: "panol",
    claves: ["donde estan las herramientas", "herramientas", "andamios", "donde esta el andamio",
             "que herramientas hay", "panol"],
    responder: (d) => {
      const p = d.panol || {};
      if (!(p.herramientas || []).length) return { texto: "Todavía no cargaste herramientas al pañol.", ir: "/panol", irLabel: "Ir al pañol" };
      const libres = p.herramientas.map(x => `· ${x.nombre}: **${x.libre}** libre${x.libre !== 1 ? "s" : ""} de ${x.total}`).join("\n");
      const fuera = (p.en_obra || []).length
        ? "\n\nEn obra:\n" + p.en_obra.map(x => `· ${x.cantidad} ${x.herramienta} en ${x.obra || "—"}${x.desde ? ` desde el ${fechaCorta(x.desde)}` : ""}`).join("\n")
        : "";
      return { texto: `En el pañol:\n\n${libres}${fuera}`, ir: "/panol", irLabel: "Ir al pañol" };
    },
  },
  {
    id: "caja",
    claves: ["como viene la caja", "cuanto entro", "cuanto sali", "resultado del periodo",
             "cuanto gaste", "caja", "cuanto llevo"],
    responder: (d) => {
      const c = d.caja;
      if (!c) return { texto: "No hay un período abierto en el control financiero.", ir: "/finanzas", irLabel: "Ir al control financiero" };
      const signo = c.resultado >= 0 ? "a favor" : "en contra";
      return {
        texto: `En el período abierto entraron **${plata(c.ingresos)}** y salieron **${plata(c.egresos)}**.\n\nQuedás **${plata(Math.abs(c.resultado))} ${signo}**.`,
        ir: "/finanzas", irLabel: "Ver el detalle",
      };
    },
  },
];

// ¿La pregunta es de datos? Se compara contra las frases clave, tolerando
// errores de tipeo con la misma medida que usa el resto del asistente.
function preguntaDeDatos(texto) {
  const q = normalizar(texto);
  if (q.length < 3) return null;
  let mejor = null, mejorPuntaje = 0;
  for (const p of PREGUNTAS_DATOS) {
    for (const k of p.claves) {
      const kn = normalizar(k);
      let puntaje = 0;
      if (q.includes(kn)) puntaje = kn.length * 2;
      else {
        // cuántas palabras de la clave aparecen en la pregunta
        const pal = kn.split(" ").filter(w => w.length > 3);
        const hits = pal.filter(w => q.split(" ").some(x => pesoToken(x, w) >= 1)).length;
        if (pal.length && hits === pal.length) puntaje = kn.length;
      }
      if (puntaje > mejorPuntaje) { mejorPuntaje = puntaje; mejor = p; }
    }
  }
  return mejorPuntaje >= 8 ? mejor : null;
}

// Las cifras van en negrita: en una respuesta de tres renglones, el número es
// lo único que se busca con la vista.
function conNegritas(t) {
  const partes = String(t ?? "").split(/\*\*(.+?)\*\*/g);
  return partes.map((x, i) => i % 2 ? <b key={i}>{x}</b> : x);
}

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
    presupuesto: ["¿Cómo agrego rubros e ítems?", "¿Cómo cargo el cómputo de un ítem?", "¿Cómo vinculo tareas del Gantt?", "¿Cómo pongo que se trabaja el sábado?", "¿Cómo cambio los coeficientes?"],
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

// Tokens precalculados por entrada + IDF (palabras distintivas pesan más)
const ENTRADAS = BASE.map((e) => ({
  e,
  toks: [...new Set(tokens(e.kw + " " + e.titulo))],
  titleToks: new Set(tokens(e.titulo)),
}));
const N_DOCS = ENTRADAS.length;
const DF = {};
for (const { toks } of ENTRADAS) for (const t of toks) DF[t] = (DF[t] || 0) + 1;
// idf alto = palabra rara/distintiva; bajo = palabra común a muchos temas
const idf = (t) => Math.log((N_DOCS + 1) / ((DF[t] || 0) + 1)) + 0.4;

function puntuar(qTokens, entryToks, titleToks) {
  let score = 0, hits = 0;
  for (const q of qTokens) {
    let best = 0, bestTok = null;
    for (const k of entryToks) {
      const w = pesoToken(q, k);
      if (w > best) { best = w; bestTok = k; }
      if (best === 2) break;
    }
    if (best > 0) {
      const titleBoost = titleToks.has(bestTok) ? 1.7 : 1;  // la palabra está en el título
      score += best * idf(bestTok) * titleBoost;
      hits++;
    }
  }
  return { score, hits };
}

// Devuelve TODAS las entradas con score > 0, ordenadas de mejor a peor
function rankear(consulta, sec) {
  const qTokens = [...new Set(tokens(consulta))];
  if (!qTokens.length) return [];
  return ENTRADAS.map(({ e, toks, titleToks }) => {
    let { score, hits } = puntuar(qTokens, toks, titleToks);
    if (e.sec === sec) score *= 1.25;   // empujón por contexto de pantalla
    return { e, score, hits };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}

// ¿La pregunta es "cómo hago X" (ayuda de uso) y no "cuánto/cuál es X" (dato)?
// Sin esto, la capa de datos secuestraba las preguntas de uso: "quiero vincular
// dos tareas del gantt" veía la palabra "tarea", se iba a buscar en la base y
// contestaba "¿de qué tarea?" en vez de explicar cómo se vinculan.
const RE_COMO_HAGO = new RegExp(
  "\\b(como|donde|puedo|puedes|podes|se puede|quiero|queria|necesito|hago|hacer|haces|" +
  "agrego|agregar|creo|crear|cargo|cargar|pongo|poner|saco|sacar|borro|borrar|elimino|eliminar|" +
  "cambio|cambiar|edito|editar|configuro|configurar|activo|activar|desactivar|habilitar|" +
  "imprimo|imprimir|exporto|exportar|mando|mandar|envio|enviar|vinculo|vincular|" +
  "sirve|significa|que es|que pasa|pasa si|para que|por que|porque|ayuda|explica|explicame|" +
  "no me aparece|no aparece|no funciona|no anda|no sale|no puedo|da mal|esta mal|error|falla)\\b"
);
const esComoHago = (texto) => RE_COMO_HAGO.test(normalizar(texto));

// "quién trabaja en el quincho" no es una pregunta de uso: es un dato. Sin
// esto la base de conocimiento se la llevaba puesta —la palabra "trabaja"
// matcheaba fortísimo con "definir si se trabaja sábado o domingo"— y el
// estudio recibía un instructivo del Gantt cuando preguntaba por su gente.
const RE_PIDE_DATO = new RegExp(
  "^(quien|quienes|cuanto|cuanta|cuantos|cuantas|cuando|a quien|con quien|" +
  "que obra|que obras|cual obra|me deben|le debo|tengo que cobrar|tengo que pagar)\\b"
);
const pideUnDato = (texto) => RE_PIDE_DATO.test(normalizar(texto));

// "acá", "esta obra", "este presupuesto": el que está parado en una obra la
// señala, no la nombra. normalizar() saca los acentos, por eso va sin ellos.
const RE_ESTA_OBRA = new RegExp(
  "\\b(aca|aqui|est[ae] (obra|presupuesto|proyecto)|de aca|en esta|la de aca)\\b"
);
const hablaDeEstaObra = (texto) => RE_ESTA_OBRA.test(normalizar(texto));

const SALUDOS = ["hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "que tal", "hey", "holaa"];
const GRACIAS = ["gracias", "muchas gracias", "genial", "perfecto", "joya", "buenisimo", "ok gracias"];

// ── Consultas de DATOS reales (precios, costos, materiales, cobros, certificados, rendimiento) ──
const money = (n) => "$ " + Math.round(Number(n) || 0).toLocaleString("es-AR");
const tieneAlguna = (texto, arr) => {
  const ts = tokens(texto);
  return arr.some((k) => ts.some((q) => pesoToken(q, k) >= 1));
};
// Palabras que disparan una consulta de datos por sí solas (sin nombre de obra)
const KW_DATOS = ["precio", "precios", "costo", "costos", "cuanto", "cuesta", "sale", "vale",
  "saldo", "cobro", "cobros", "cobrado", "cobre", "certificado", "certificados", "avance",
  "margen", "ganancia", "gano", "rendimiento"];
const KW_RENDIMIENTO = ["rendimiento", "rendimientos", "rinde", "tiempo", "tarda", "tardan",
  "demora", "demoran", "hora", "horas", "jornada", "jornal", "productividad"];
// Nombrar un gremio ya es preguntar por rendimiento ("¿cuánto hace un oficial…?")
const KW_GREMIO = ["oficial", "oficiales", "ayudante", "ayudantes", "cuadrilla", "operario"];
const KW_PRECIO = ["precio", "precios", "costo", "costos", "cuanto", "cuesta", "sale", "vale"];
// Si aparecen, la pregunta es de gestión y no del catálogo de análisis
const KW_GESTION = ["cobro", "cobros", "cobrado", "saldo", "certificado", "certificados",
  "cliente", "clientes", "factura", "presupuesto", "presupuestos", "obra", "avance", "margen"];

// Busca el ítem de una lista cuyo `campo` se parece más a las palabras de la pregunta
function matchPorNombre(texto, lista, campo) {
  const qt = tokens(texto);
  let best = null, bestHits = 0, bestCov = 0, bestLargo = 0;
  for (const it of lista || []) {
    const nt = tokens(it[campo] || "");
    if (!nt.length) continue;
    let hits = 0, largo = 0;
    for (const k of nt) {
      if (qt.some((q) => pesoToken(q, k) >= 1)) { hits++; largo = Math.max(largo, k.length); }
    }
    const cov = hits / nt.length;
    if (hits > bestHits || (hits === bestHits && cov > bestCov)) {
      best = it; bestHits = hits; bestCov = cov; bestLargo = largo;
    }
  }
  // Una sola palabra alcanza si es rara: "el quincho" identifica a "Casa
  // Quiroga — Ampliación quincho" sin ambigüedad, y antes no lo reconocía
  // porque pedía cubrir la mitad del nombre. Nadie escribe el nombre entero.
  if (best && (bestHits >= 2 || (bestHits === 1 && (bestCov >= 0.5 || bestLargo >= 6)))) return best;
  return null;
}

// ── Búsqueda de ítems del catálogo ────────────────────────────────────────────
// matchPorNombre alcanza para nombres de obra y clientes (textos cortos que el
// usuario escribe casi igual), pero NO para el catálogo: puntuaba por cuántas
// palabras del nombre se tocaban, sin pesar cuán rara es cada palabra, así que
// "GUARDA CANTO POR UNIDAD" le ganaba a "MAMPOST. ELEVACIÓN LADRILLO 15 HCCA"
// en "cuánto tarda un oficial en un m2 de mampostería" (canto≈cuanto,
// guarda≈tarda). Acá se puntúa por IDF, por cobertura DE LA CONSULTA y por
// posición en el nombre.

// Raíz aproximada: acerca verbo y sustantivo (pintar~pintura, colocar~colocación).
const stem = (w) => {
  let s = w;
  s = s.replace(/(aciones|acion|amiento|imiento)$/, "");
  s = s.replace(/(ciones|cion|siones|sion)$/, "");
  s = s.replace(/(uras|ura)$/, "");
  s = s.replace(/(ados|adas|ado|ada|idos|idas|ido|ida)$/, "");
  s = s.replace(/(ares|ar|er|ir)$/, "");
  s = s.replace(/(es|s)$/, "");
  return s.length >= 4 ? s : w;
};

function pesoItem(q, k) {
  if (q === k) return 2;
  if (q.length >= 5 && k.length >= 5 && (k.startsWith(q) || q.startsWith(k))) return 1.5;
  const sq = stem(q), sk = stem(k);
  if (sq.length >= 4 && sq === sk) return 1.2;
  if (Math.min(q.length, k.length) >= 6 && Math.abs(q.length - k.length) <= 2 && lev(q, k) <= 1) return 1;
  return 0;
}

// Palabras que dicen QUÉ se pregunta, no CUÁL ítem. Nunca deben identificar uno.
const INTENCION = new Set([
  "cuanto", "cuanta", "cuantos", "cuantas", "tarda", "tardan", "demora", "demoran",
  "lleva", "llevan", "toma", "tomar", "rendimiento", "rendimientos", "tiempo", "tiempos",
  "hora", "horas", "jornal", "jornada", "jornadas", "dia", "dias",
  "oficial", "oficiales", "ayudante", "ayudantes", "medio", "especializado",
  "cuadrilla", "obrero", "operario", "personal",
  "precio", "precios", "costo", "costos", "vale", "sale", "cuesta", "analisis",
  "unitario", "unitarios", "m2", "m3", "ml", "mt", "mts", "metro", "metros",
  "unidad", "unidades", "kilo", "kilos",
  "levantar", "ejecutar", "construir", "armar", "colocar", "poner",
]);

const tokensNombre = (s) => normalizar(s).split(" ").filter((t) => t.length >= 2 && !STOP.has(t));
const tokensContenido = (s) => {
  const t = tokens(s).filter((x) => !INTENCION.has(x));
  const palabras = t.filter((x) => !/^\d+$/.test(x));
  return palabras.length ? t : palabras;   // un número suelto no identifica nada
};

// "DEMOLICIÓN DE REVOQUES" no es "REVOQUE".
const MODIF = ["demolicion", "demoler", "retiro", "retirar", "extraccion", "extraer",
  "picado", "picar", "reparacion", "reparar", "reposicion", "recolocacion",
  "desarme", "desmonte", "limpieza", "remocion", "remover", "rotura", "relleno"];

function construirIndice(items) {
  const df = new Map();
  const docs = (items || []).map((it) => {
    const toks = [...new Set(tokensNombre(it.nombre))];
    for (const t of toks) df.set(t, (df.get(t) || 0) + 1);
    return { it, toks, set: new Set(toks) };
  });
  const N = docs.length || 1;
  return { docs, idf: (t) => Math.log(1 + N / (1 + (df.get(t) || 0))) };
}

const UNIDAD_Q = [["m2", /\bm2\b|\bmetros? cuadrados?\b/], ["m3", /\bm3\b|\bmetros? cubicos?\b/],
                  ["ml", /\bml\b|\bmetros? lineales?\b/]];

function buscarItems(consulta, indice, max = 4) {
  const q = normalizar(consulta);
  const cont = [...new Set(tokensContenido(consulta))];
  if (!cont.length || !indice) return [];
  const unidadPedida = (UNIDAD_Q.find(([, re]) => re.test(q)) || [null])[0];
  const pideModif = MODIF.some((m) => q.includes(m.slice(0, 6)));

  const res = [];
  for (const d of indice.docs) {
    let score = 0, hits = 0;
    for (const qt of cont) {
      let mejor = 0;
      for (let i = 0; i < d.toks.length; i++) {
        const w = pesoItem(qt, d.toks[i]);
        if (w <= 0) continue;
        // la cabeza del nombre identifica el ítem; el final suele ser detalle
        const pos = 1 + 0.7 * (1 - i / Math.max(d.toks.length, 1));
        mejor = Math.max(mejor, w * indice.idf(d.toks[i]) * pos);
      }
      if (mejor > 0) { score += mejor; hits++; }
    }
    if (!hits) continue;
    const cobertura = hits / cont.length;
    if (cobertura < 0.5) continue;          // el ítem tiene que explicar lo que preguntaste
    score *= 0.6 + 0.4 * cobertura;
    const esModif = MODIF.some((m) => d.set.has(m));
    if (esModif && !pideModif) score *= 0.3;
    if (!esModif && pideModif) score *= 0.5;
    if (unidadPedida && normalizar(d.it.unidad_ejecucion || d.it.unidad || "") === unidadPedida) score *= 1.35;
    res.push({ it: d.it, score });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, max);
}

const GREMIOS = [
  ["Oficial Especializado", /oficial\s+especializad/],
  ["Medio Oficial", /medio\s+oficial/],
  ["Ayudante", /\bayudantes?\b/],
  // OJO: /oficiales?/ pide "oficiale"+s y NUNCA matchea "oficial". Va (es)?.
  ["Oficial", /\boficial(es)?\b/],
];
const gremioPedido = (s) => (GREMIOS.find(([, re]) => re.test(normalizar(s))) || [null])[0];

// ── Formato de rendimientos ──────────────────────────────────────────────────
const JORNADA = 8; // horas
const nfmt = (n, d = 2) => Number(n).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: d });
// De "horas por unidad" a "unidades por jornada"
const porJornada = (h) => (h > 0 ? JORNADA / h : null);

// ── Preguntas sobre UNA obra ─────────────────────────────────────────────────
// Todas se contestan con la misma llamada a /asistente/obra/{id}: se pide una
// vez y de ahí salen materiales, avance, contrato, plan, cobros, quién trabaja
// y adicionales. `kw` son las palabras que la eligen; gana la que más suma.
const fechaLarga = (f) => f
  ? new Date(f + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
  : "";
const pct = (n) => (Number(n) || 0).toFixed(1).replace(".0", "") + "%";

const SUB_OBRA = [
  {
    id: "materiales",
    kw: ["material", "materiales", "insumo", "insumos", "comprar", "compra", "computo"],
    responder: (d, ruta) => {
      const m = d.materiales || {};
      const abierto = (d.estado || "").toLowerCase() !== "cerrado";
      const aviso = abierto
        ? "⚠️ El presupuesto está ABIERTO: las cantidades y los precios todavía se mueven. La lista firme sale con el presupuesto cerrado."
        : null;
      if (!m.cuantos) {
        return { titulo: `Materiales — ${d.obra}`,
                 texto: (aviso ? aviso + "\n\n" : "") + "No hay materiales en los análisis de esta obra.",
                 route: `${ruta}/materiales`, routeLabel: "Abrir el listado" };
      }
      return {
        titulo: `Materiales — ${d.obra}`,
        texto: (aviso ? aviso + "\n\n" : "") + `**${m.cuantos}** materiales · **${plata(m.total)}** en total`,
        pasos: (m.top || []).slice(0, 10).map(
          (x) => `${x.nombre} — ${Math.round(x.cantidad).toLocaleString("es-AR")} ${x.unidad} · ${plata(x.subtotal)}`),
        route: `${ruta}/materiales`, routeLabel: "Ver el listado completo",
      };
    },
  },
  {
    id: "personal",
    kw: ["quien", "quienes", "personal", "gente", "trabaja", "trabajando", "trabajaron",
         "obrero", "obreros", "cuadrilla", "jornal", "jornales", "asistencia", "equipo"],
    responder: (d, ruta) => {
      const p = d.personal || {};
      const asig = p.asignados_del_estudio || [];
      if (!p.cuantos && !asig.length) {
        return { titulo: `Personal — ${d.obra}`,
                 texto: "Todavía nadie tiene asistencia imputada a esta obra.\n\nEn Personal → Asistencia, elegí la obra arriba a la derecha antes de marcar los días: así cada jornal queda cargado acá.",
                 route: "/personal", routeLabel: "Ir a Personal" };
      }
      const partes = [];
      if (p.semana && p.semana.quienes && p.semana.quienes.length) {
        partes.push(`Esta semana están **${p.semana.quienes.join(", ")}** — ${p.semana.jornadas} jornada${p.semana.jornadas === 1 ? "" : "s"}` +
                    (p.semana.horas ? ` (${p.semana.horas} h)` : "") + ".");
      } else if (p.cuantos) {
        partes.push("Esta semana no hay nadie marcado en esta obra.");
      }
      if (p.cuantos) {
        partes.push(`En total pasaron **${p.cuantos}** persona${p.cuantos === 1 ? "" : "s"}: **${p.jornadas}** jornadas` +
                    (p.horas ? ` y **${p.horas} h**` : "") + ".");
      }
      const lineas = (p.detalle || []).slice(0, 10).map(
        (x) => `${x.nombre}${x.funcion ? " (" + x.funcion + ")" : ""} — ${x.jornadas} jorn.` +
               (x.horas ? ` · ${x.horas} h` : "") +
               (x.ultimo ? ` · último ${fechaCorta(x.ultimo)}` : ""));
      if (asig.length) {
        lineas.push("─".repeat(28));
        asig.forEach((a) => lineas.push(`${a.nombre} — ${a.rol} (del estudio)`));
      }
      return { titulo: `Personal — ${d.obra}`, texto: partes.join("\n"), lineas,
               route: "/personal", routeLabel: "Ir a Personal" };
    },
  },
  {
    id: "certificado",
    kw: ["certificado", "certificados", "certificacion", "certifique", "certifico"],
    responder: (d, ruta) => {
      const c = d.certificados || {};
      if (!c.cuantos) {
        const cerrado = (d.estado || "").toLowerCase() === "cerrado";
        return { titulo: `Certificados — ${d.obra}`,
                 texto: "Todavía no hay certificados emitidos." + (cerrado ? "" : "\n\nPara certificar, el presupuesto tiene que estar cerrado."),
                 route: cerrado ? `${ruta}/certificado` : ruta,
                 routeLabel: cerrado ? "Emitir el primero" : "Abrir el presupuesto" };
      }
      const u = c.ultimo || {};
      return {
        titulo: `Último certificado — ${d.obra}`,
        texto: `El **N° ${u.numero}**, del ${fechaLarga(u.fecha)}.`,
        lineas: [
          `  Período          ${fechaCorta(u.desde)} al ${fechaCorta(u.hasta)}`,
          `  Del período      ${plata(u.del_periodo)}`,
          `  Acumulado        ${plata(u.acumulado)}`,
          `  Avance           ${pct(u.avance_pct)}`,
          "─".repeat(34),
          `  Emitidos         ${c.cuantos}`,
        ],
        route: `${ruta}/certificado`, routeLabel: "Ver los certificados",
        chips: [`cobros de ${d.obra}`, `avance de ${d.obra}`], chipsHint: "Preguntame también:",
      };
    },
  },
  {
    id: "contrato",
    kw: ["contrato", "contratos", "firma", "firmado", "firmo", "clausula", "clausulas",
         "anticipo", "desembolso", "desembolsos"],
    responder: (d, ruta) => {
      const c = d.contrato || {};
      if (!c.existe) {
        return { titulo: `Contrato — ${d.obra}`,
                 texto: "Esta obra todavía no tiene contrato generado.",
                 route: `${ruta}/obra`, routeLabel: "Generar el contrato" };
      }
      const lineas = [
        `  Monto            ${plata(c.monto_total)}`,
        `  Firmado          ${c.fecha_firma ? fechaLarga(c.fecha_firma) : "sin fecha"}`,
        `  Plazo de obra    ${c.plazo_obra_dias ? c.plazo_obra_dias + " días" : "no cargado"}`,
        `  Se cobra por     ${c.tipo_pago || "no definido"}`,
      ];
      if (c.anticipo > 0) lineas.push(`  Anticipo         ${plata(c.anticipo)}`);
      if (c.lugar) lineas.push(`  Lugar            ${c.lugar}`);
      lineas.push(`  Estado           ${(c.estado || "—").toUpperCase()}` +
                  (c.aceptado_en ? " · aceptado por el cliente" : ""));
      const des = c.desembolsos || [];
      if (des.length) {
        lineas.push("─".repeat(34));
        des.slice(0, 8).forEach((x) => {
          const falta = (x.monto || 0) - (x.cobrado || 0);
          lineas.push(`  ${x.numero}. ${(x.descripcion || "Desembolso").slice(0, 24)}  ${plata(x.monto)}` +
                      (falta <= 0 ? "  ✓ cobrado" : x.vence ? `  vence ${fechaCorta(x.vence)}` : ""));
        });
      }
      return { titulo: `Contrato — ${d.obra}`, lineas,
               route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra",
               chips: [`cuánto me deben en ${d.obra}`], chipsHint: "Preguntame también:" };
    },
  },
  {
    id: "plan",
    kw: ["plan", "planificacion", "planificado", "gantt", "cronograma", "tarea", "tareas",
         "etapa", "etapas", "diagrama"],
    responder: (d, ruta) => {
      const pl = d.plan;
      if (!pl) {
        return { titulo: `Planificación — ${d.obra}`,
                 texto: "Esta obra no tiene el plan armado en el Gantt todavía.",
                 route: `${ruta}/gantt`, routeLabel: "Armar el plan" };
      }
      const lineas = [];
      if (pl.en_curso && pl.en_curso.length) {
        lineas.push("EN CURSO HOY");
        pl.en_curso.forEach((t) => lineas.push(`  ${t.nombre} — ${pct(t.progreso)} · hasta ${fechaCorta(t.fin)}`));
      }
      if (pl.vencidas && pl.vencidas.length) {
        lineas.push("PASADAS DE FECHA");
        pl.vencidas.forEach((t) => lineas.push(`  ${t.nombre} — ${pct(t.progreso)} · vencía ${fechaCorta(t.fin)}`));
      }
      if (pl.proximas && pl.proximas.length) {
        lineas.push("LO QUE VIENE");
        pl.proximas.slice(0, 4).forEach((t) => lineas.push(`  ${t.nombre} — arranca ${fechaCorta(t.inicio)}`));
      }
      return {
        titulo: `Planificación — ${d.obra}`,
        texto: `**${pl.tareas}** tareas, del ${fechaLarga(pl.inicio)} al ${fechaLarga(pl.fin)}` +
               (pl.duracion_dias ? ` · ${pl.duracion_dias} días hábiles` : "") + ".",
        lineas: lineas.length ? lineas : null,
        route: `${ruta}/gantt`, routeLabel: "Ver el Gantt",
        chips: [`cuándo termina ${d.obra}`, `avance de ${d.obra}`], chipsHint: "Preguntame también:",
      };
    },
  },
  {
    id: "fin",
    kw: ["termina", "terminar", "entrega", "entregar", "fin", "finaliza", "vence",
         "plazo", "cuando", "falta", "restan", "atrasada", "atraso", "demora"],
    responder: (d, ruta) => {
      const f = d.fechas || {};
      if (!f.termina) {
        return { titulo: `${d.obra}`,
                 texto: "No puedo decirte cuándo termina: no hay plan en el Gantt ni plazo cargado en el contrato.\n\nArmá el plan y la fecha sale sola de las tareas.",
                 route: `${ruta}/gantt`, routeLabel: "Armar el plan" };
      }
      const dr = f.dias_restantes;
      const cola = f.atrasada
        ? `\n\n⚠ Está **pasada de fecha**: tenía que terminar hace ${Math.abs(dr)} día${Math.abs(dr) === 1 ? "" : "s"} y va ${pct((d.avance || {}).pct)}.`
        : dr != null && dr >= 0
          ? `\n\nFaltan **${dr} día${dr === 1 ? "" : "s"}** y va ${pct((d.avance || {}).pct)}.`
          : "";
      return {
        titulo: `${d.obra} — cuándo termina`,
        texto: `Termina el **${fechaLarga(f.termina)}**, según ${f.termina_segun}.${cola}`,
        route: `${ruta}/gantt`, routeLabel: "Ver el plan",
        chips: [`planificación de ${d.obra}`, `avance de ${d.obra}`], chipsHint: "Preguntame también:",
      };
    },
  },
  {
    id: "inicio",
    kw: ["arranco", "arrancar", "empezo", "empezar", "comenzo", "comienzo", "inicio",
         "inicia", "arranca"],
    responder: (d, ruta) => {
      const f = d.fechas || {};
      if (!f.arranco) return { titulo: d.obra, texto: "No tengo fecha de arranque para esta obra." };
      return {
        titulo: `${d.obra} — cuándo arrancó`,
        texto: `Arrancó el **${fechaLarga(f.arranco)}**, según ${f.arranco_segun}.` +
               (f.termina ? `\n\nY termina el ${fechaLarga(f.termina)} (${f.termina_segun}).` : ""),
        route: `${ruta}/gantt`, routeLabel: "Ver el plan",
      };
    },
  },
  {
    id: "adicionales",
    kw: ["adicional", "adicionales", "ampliacion", "ampliaciones", "extra", "extras", "demasia"],
    responder: (d, ruta) => {
      const a = d.adicionales || {};
      if (d.es_adicional) {
        const base = d.adicional_de;
        return { titulo: `${d.obra}`,
                 texto: `Esta obra **es un adicional**${base ? ` de «${base.nombre}»` : ""}.`,
                 route: ruta, routeLabel: "Abrir el presupuesto" };
      }
      if (!a.cuantos) {
        return { titulo: `Adicionales — ${d.obra}`,
                 texto: "Esta obra **no tiene adicionales** cargados.",
                 route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra" };
      }
      return {
        titulo: `Adicionales — ${d.obra}`,
        texto: `Tiene **${a.cuantos}** adicional${a.cuantos === 1 ? "" : "es"} por **${plata(a.total)}**.`,
        pasos: (a.detalle || []).map((x) => `${x.nombre} — ${plata(x.monto)} (${(x.estado || "").toUpperCase()})`),
        route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra",
      };
    },
  },
  {
    id: "pagar",
    kw: ["pagar", "pago", "pagos", "debo", "proveedor", "proveedores", "subcontrato",
         "subcontratos", "contratista", "contratistas", "gremio", "egreso", "egresos"],
    responder: (d, ruta) => {
      const pp = d.por_pagar || {};
      const s = pp.subcontratos || {}, c = pp.compras || {};
      if (!pp.total_pendiente) {
        return { titulo: `Por pagar — ${d.obra}`,
                 texto: (s.cuantos || c.cuantos)
                   ? "No queda nada pendiente de pago en esta obra: subcontratos y compras están al día."
                   : "Esta obra no tiene subcontratos ni compras cargadas.",
                 route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra" };
      }
      const lineas = [];
      if (s.pendiente > 0) {
        lineas.push(`SUBCONTRATOS — falta ${plata(s.pendiente)} de ${plata(s.total)}`);
        (s.detalle || []).filter((x) => x.pendiente > 0).slice(0, 5)
          .forEach((x) => lineas.push(`  ${x.contratista || "—"} — ${plata(x.pendiente)}`));
      }
      if (c.pendiente > 0) {
        lineas.push(`COMPRAS — falta ${plata(c.pendiente)} de ${plata(c.total)}`);
        (c.detalle || []).filter((x) => x.pendiente > 0).slice(0, 5)
          .forEach((x) => lineas.push(`  ${x.proveedor || "—"} — ${plata(x.pendiente)}`));
      }
      return {
        titulo: `Por pagar — ${d.obra}`,
        texto: `Te falta pagar **${plata(pp.total_pendiente)}** en esta obra.`,
        lineas,
        route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra",
        chips: [`cuánto me deben en ${d.obra}`], chipsHint: "Preguntame también:",
      };
    },
  },
  {
    id: "cobros",
    kw: ["cobro", "cobros", "cobrado", "cobrar", "saldo", "deben", "debe", "adeuda",
         "resta", "cuenta", "corriente", "falta", "pendiente"],
    responder: (d, ruta) => {
      const c = d.cobros;
      if (!c) return { titulo: d.obra, texto: "No pude leer la cuenta corriente de esta obra." };
      const rotulo = c.metodologia === "desembolsos" ? "Devengado" : "Certificado";
      const lineas = [
        `  ${rotulo.padEnd(16)} ${plata(c.devengado)}`,
        `  ${"Cobrado".padEnd(16)} ${plata(c.cobrado)}`,
        "─".repeat(34),
        `  ${"Te deben".padEnd(16)} ${plata(Math.max(0, c.saldo))}`,
      ];
      if (c.pactado > 0) lineas.push(`  ${"Pactado total".padEnd(16)} ${plata(c.pactado)}`);
      if (c.a_favor_cliente > 0) {
        lineas.push("─".repeat(34));
        lineas.push(`  A favor del cliente ${plata(c.a_favor_cliente)}`);
      }
      const nota = c.a_favor_cliente > 0
        ? "\n\nHay plata cobrada por adelantado que todavía no tiene obra hecha detrás."
        : "";
      return {
        titulo: `Cobros — ${d.obra}`,
        texto: `Te deben **${plata(Math.max(0, c.saldo))}**.` +
               (c.ultimo ? ` El último cobro fue el ${fechaCorta(c.ultimo.fecha)} por ${plata(c.ultimo.monto)}.` : "") + nota,
        lineas,
        route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra",
        chips: [`contrato de ${d.obra}`, `certificados de ${d.obra}`], chipsHint: "Preguntame también:",
      };
    },
  },
  {
    id: "avance",
    kw: ["avance", "avanza", "avanzo", "porcentaje", "lleva", "va", "adelanto", "ejecutado"],
    responder: (d, ruta) => {
      const a = d.avance || {};
      const f = d.fechas || {};
      const partes = [`La obra va en **${pct(a.pct)}**` +
                      (a.origen ? ` (según ${a.origen === "certificado" ? "el último certificado" : "los avances cargados"})` : "") + "."];
      if (a.pct_plan != null && Math.abs(a.pct_plan - a.pct) >= 1) {
        partes.push(`En el Gantt las tareas suman ${pct(a.pct_plan)}.`);
      }
      if (f.termina) {
        partes.push(f.atrasada
          ? `⚠ Tenía que terminar el ${fechaLarga(f.termina)}: está pasada de fecha.`
          : `Termina el ${fechaLarga(f.termina)}` + (f.dias_restantes != null ? ` — faltan ${f.dias_restantes} días.` : "."));
      }
      return {
        titulo: `Avance — ${d.obra}`, texto: partes.join("\n\n"),
        route: `${ruta}/obra`, routeLabel: "Abrir gestión de obra",
        chips: [`planificación de ${d.obra}`, `certificados de ${d.obra}`, `quién trabaja en ${d.obra}`],
        chipsHint: "Preguntame también:",
      };
    },
  },
];

// Elige de qué se está preguntando. Puntúa por palabra encontrada para que
// "¿cuánto me deben en X?" gane cobros y no se lo lleve "fin" por el "cuánto".
function subIntencion(texto) {
  const qs = tokens(texto);
  let mejor = null, mejorPuntaje = 0;
  for (const s of SUB_OBRA) {
    let n = 0;
    for (const k of s.kw) if (qs.some((q) => pesoToken(q, k) >= 1.4)) n += 2;
    else if (qs.some((q) => pesoToken(q, k) >= 1)) n += 1;
    if (n > mejorPuntaje) { mejorPuntaje = n; mejor = s; }
  }
  return mejorPuntaje >= 1 ? mejor : null;
}

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
  const presuRef = useRef(null);   // cache de presupuestos del tenant
  const cliRef = useRef(null);     // cache de clientes
  const esCliente = useMemo(() => !!localStorage.getItem("obras_cliente"), []);

  // Mensaje de bienvenida al abrir por primera vez
  useEffect(() => {
    if (open && msgs.length === 0) {
      const inicial = [{
        from: "bot",
        titulo: "¡Hola! Soy el asistente de FAIM OBRAS 👋",
        texto: "Te ayudo con tres cosas:\n• Cómo usar el sistema, paso a paso.\n• Todo de una obra tuya: materiales, avance, último certificado, contrato, plan, cuánto te deben, cuánto falta pagar, quién trabaja ahí, cuándo arrancó y cuándo termina, y si tiene adicionales.\n• Análisis de precios: rendimientos de mano de obra y costo por m².\n\nNombrá la obra y preguntame: \"¿cuánto me deben en …?\"",
        chips: [...(esCliente ? [] : ["materiales de una obra", "cuánto me deben en una obra", "quién trabaja en una obra", "cuándo termina una obra", "cuánto tarda un oficial en un m2 de mampostería"]), ...sugerencias(sec)],
      }];

      // Aviso de la Previsión, una sola vez por navegador. Un aviso que vuelve
      // a aparecer cada vez que se abre el asistente deja de leerse enseguida.
      const AVISO = "aviso_prevision_visto";
      if (!esCliente && !localStorage.getItem(AVISO)) {
        inicial.push({
          from: "bot",
          titulo: "Nuevo: la pestaña Previsión",
          texto: "En Control Financiero agregamos Previsión: ahí ves lo que vas a cobrar y lo que vas a pagar según lo que ya tenés pactado — desembolsos, certificados, contratistas y compras. Se lee por fecha, por obra o por persona, así sabés de un vistazo quién te debe y a quién le debés.",
          chips: ["por qué lo pendiente no suma"],
          route: "/finanzas", routeLabel: "Ver la Previsión",
        });
        try { localStorage.setItem(AVISO, "1"); } catch {}
      }
      setMsgs(inicial);
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

    // Atajo: si el texto es exactamente el título de un tema (clic en chip)
    const exacto = BASE.find((e) => e.titulo === texto.trim());
    const ranked = exacto ? [{ e: exacto, score: 999, hits: 9 }] : rankear(texto, sec);

    // Nada se parece → fallback con sugerencias
    if (!ranked.length || ranked[0].score < 1.5) {
      return [{
        from: "bot",
        titulo: "No estoy seguro de haber entendido 🤔",
        texto: "Probá reformulando con otras palabras, o elegí uno de estos temas. Si es algo puntual, escribí a soporte.",
        chips: [...sugerencias(sec), "Contactar a soporte"],
      }];
    }

    const top = ranked[0];
    const segundo = ranked[1];
    // Umbral bajo y sin comparar contra el segundo: cuando hay varios temas
    // parecidos (todo el Gantt comparte palabras), pedir ventaja sobre el
    // segundo devolvía un menú. Es mejor contestar el mejor y dejar los otros
    // como sugerencias abajo, que hacerlo tocar dos veces para leer algo.
    const confiado = top.score >= 999 || top.score >= 3.2;

    // Confiado → respuesta directa + alternativas cercanas
    if (confiado) {
      const otras = ranked.slice(1, 4).filter((r) => r.score >= 2.5).map((r) => r.e);
      return [{
        from: "bot",
        titulo: top.e.titulo,
        pasos: top.e.pasos,
        route: top.e.route,
        routeLabel: top.e.routeLabel,
        chips: otras.length ? otras.map((o) => o.titulo) : null,
        chipsHint: otras.length ? "Temas relacionados:" : null,
      }];
    }

    // Ambiguo pero hay candidatos → ofrecer opciones para que elija
    const candidatos = ranked.slice(0, 4).map((r) => r.e);
    return [{
      from: "bot",
      titulo: "Puede que busques alguno de estos 👇",
      texto: "Tocá el que más se acerque a lo que necesitás:",
      chips: [...candidatos.map((c) => c.titulo), "Contactar a soporte"],
    }];
  };

  // ── Capa de DATOS ──────────────────────────────────────────────────────────
  const ensureData = async () => {
    if (esCliente) return;
    if (presuRef.current === null) {
      try { presuRef.current = (await api.get("/presupuestos")).data || []; } catch { presuRef.current = []; }
    }
    if (cliRef.current === null) {
      try { cliRef.current = (await api.get("/clientes")).data || []; } catch { cliRef.current = []; }
    }
  };
  // Precargar al abrir para que las respuestas salgan al instante
  useEffect(() => { if (open) ensureData(); }, [open]);

  // Decide si la pregunta es de DATOS y de qué tipo (usa los datos ya cacheados)
  // El id de la obra abierta, si estas parado en una.
  const obraDeLaPantalla = () => {
    const m = (location.pathname || "").match(/\/cotizador\/(?:presupuesto|gantt)\/(\d+)/);
    if (!m) return null;
    return (presuRef.current || []).find((x) => String(x.id) === m[1]) || null;
  };

  const clasificar = (texto) => {
    if (esCliente) return null;
    const presu = presuRef.current || [];
    const clientes = cliRef.current || [];
    // ¿Quedan palabras que identifiquen una tarea del catálogo, sacando las de intención?
    const hayTarea = tokensContenido(texto).length > 0;
    const esGestion = tieneAlguna(texto, KW_GESTION);

    // 1) Rendimiento / horas de mano de obra de una tarea
    if (hayTarea && !esGestion && (tieneAlguna(texto, KW_RENDIMIENTO) || tieneAlguna(texto, KW_GREMIO))) {
      return { tipo: "rendimiento" };
    }
    if (tieneAlguna(texto, ["cliente", "clientes"])) {
      const c = matchPorNombre(texto, clientes, "nombre");
      if (c) return { tipo: "cliente", c };
    }
    // Parado en una obra y nombrandola, gana ESA. Dos obras pueden compartir
    // una palabra —"Casa Quiroga — Ampliacion quincho" y "Quincho Matias"— y
    // sin esto ganaba la de nombre mas corto, que cubre mas del nombre con la
    // misma palabra. Si estas mirando una obra, de esa estas hablando.
    const aca_ = obraDeLaPantalla();
    if (aca_ && matchPorNombre(texto, [aca_], "nombre_obra")) {
      return { tipo: "presupuesto", p: aca_ };
    }
    // Nombro una obra Y pregunto algo que es de la obra: gana la obra. Sin
    // esto "cuantas horas trabajo Juan en lo de Perez" se lo llevaba la capa
    // de rendimientos del catalogo por la palabra "horas".
    const pObra = matchPorNombre(texto, presu, "nombre_obra");
    if (pObra && subIntencion(texto)) return { tipo: "presupuesto", p: pObra };
    if (pObra) return { tipo: "presupuesto", p: pObra };
    // 2) Costo unitario de una tarea del catálogo ("¿cuánto sale el m2 de …?")
    if (hayTarea && !esGestion && tieneAlguna(texto, KW_PRECIO)) return { tipo: "precioItem" };
    if (tieneAlguna(texto, KW_RENDIMIENTO)) return { tipo: "rendimiento" };
    const c2 = matchPorNombre(texto, clientes, "nombre");
    if (c2) return { tipo: "cliente", c: c2 };
    // Parado en una obra, una pregunta suelta ("y el contrato?") es de esa obra.
    const aca = obraDeLaPantalla();
    if (aca && subIntencion(texto)) return { tipo: "presupuesto", p: aca };
    if (tieneAlguna(texto, KW_DATOS)) return { tipo: "ambiguo" };
    return null;
  };

  // Una obra, una llamada. De ahi salen materiales, avance, ultimo certificado,
  // contrato, plan, cobros, lo que hay que pagar, quien trabaja ahi, cuando
  // arranco, cuando termina y si hay adicionales.
  const resolverPresupuesto = async (texto, p) => {
    const ruta = `/cotizador/presupuesto/${p.id}`;
    let d;
    try {
      d = (await api.get(`/asistente/obra/${p.id}`)).data || {};
    } catch (e) {
      return [{ from: "bot", titulo: p.nombre_obra,
                texto: "No pude traer los datos de esta obra ahora. Probá de nuevo en un momento." }];
    }

    const sub = subIntencion(texto);
    if (sub) return [{ from: "bot", ...sub.responder(d, ruta) }];

    // Sin una pregunta puntual: la foto de la obra y de que mas se puede hablar.
    const ec = d.economico || {}, co = d.cobros || {}, f = d.fechas || {};
    const lineas = [];
    if (ec.total_con_iva) lineas.push(`  ${"Contrato/presupuesto".padEnd(22)} ${plata(ec.total_con_iva)}`);
    if (co && co.saldo > 0) lineas.push(`  ${"Te deben".padEnd(22)} ${plata(co.saldo)}`);
    if (co && co.cobrado) lineas.push(`  ${"Cobrado".padEnd(22)} ${plata(co.cobrado)}`);
    const pp = (d.por_pagar || {}).total_pendiente;
    if (pp) lineas.push(`  ${"Falta pagar".padEnd(22)} ${plata(pp)}`);
    lineas.push(`  ${"Avance".padEnd(22)} ${pct((d.avance || {}).pct)}`);
    if (f.arranco) lineas.push(`  ${"Arrancó".padEnd(22)} ${fechaLarga(f.arranco)}`);
    if (f.termina) lineas.push(`  ${"Termina".padEnd(22)} ${fechaLarga(f.termina)}` + (f.atrasada ? "  ⚠ pasada de fecha" : ""));
    if ((d.materiales || {}).cuantos) lineas.push(`  ${"Materiales".padEnd(22)} ${d.materiales.cuantos} · ${plata(d.materiales.total)}`);
    if ((d.certificados || {}).cuantos) lineas.push(`  ${"Certificados".padEnd(22)} ${d.certificados.cuantos}`);
    if ((d.personal || {}).cuantos) lineas.push(`  ${"Personal".padEnd(22)} ${d.personal.cuantos} · ${d.personal.jornadas} jornadas`);
    if ((d.adicionales || {}).cuantos) lineas.push(`  ${"Adicionales".padEnd(22)} ${d.adicionales.cuantos} · ${plata(d.adicionales.total)}`);

    return [{
      from: "bot", titulo: d.obra || p.nombre_obra,
      texto: [d.cliente ? `Cliente: ${d.cliente}` : null,
              `Estado: ${(d.estado || "").toUpperCase()}`].filter(Boolean).join(" · "),
      lineas,
      route: ruta, routeLabel: "Abrir el presupuesto",
      chips: [`materiales de ${d.obra}`, `avance de ${d.obra}`, `cuánto me deben en ${d.obra}`,
              `quién trabaja en ${d.obra}`, `cuándo termina ${d.obra}`, `contrato de ${d.obra}`,
              `último certificado de ${d.obra}`, `adicionales de ${d.obra}`],
      chipsHint: "Preguntame también:",
    }];
  };

  const resolverCliente = (c) => {
    const presu = (presuRef.current || []).filter((p) => p.cliente_id === c.id);
    if (!presu.length) return [{ from: "bot", titulo: c.nombre, texto: "No tiene presupuestos cargados." }];
    const total = presu.reduce((s, p) => s + (p.total_precio_con_iva || 0), 0);
    return [{ from: "bot", titulo: `Cliente: ${c.nombre}`, texto: `${presu.length} presupuesto(s) · total ${money(total)}`,
      pasos: presu.slice(0, 10).map((p) => `${p.nombre_obra} — ${money(p.total_precio_con_iva)} (${(p.estado || "").toUpperCase()})`),
      chips: presu.slice(0, 6).map((p) => p.nombre_obra), chipsHint: "Ver detalle de:" }];
  };

  // Índice del catálogo (se arma una sola vez por sesión)
  const idxRef = useRef(null);
  const ensureCatalogo = async () => {
    if (idxRef.current) return idxRef.current;
    try {
      const items = (await api.get("/analisis/items")).data || [];
      idxRef.current = { indice: construirIndice(items), items };
    } catch { idxRef.current = { indice: construirIndice([]), items: [] }; }
    return idxRef.current;
  };

  // Detalle de mano de obra de un ítem, ya formateado
  const detalleMO = async (it, gremio) => {
    const d = (await api.get(`/analisis/items/${it.id}`)).data || {};
    const mos = (d.lineas_mo || d.mo || []).filter((m) => Number(m.horas) > 0);
    const un = it.unidad_ejecucion || d.unidad_ejecucion || "unidad";
    return { d, mos, un, gremio };
  };

  const resolverRendimiento = async (texto) => {
    const { indice } = await ensureCatalogo();
    const cands = buscarItems(texto, indice);
    if (!cands.length) {
      return [{ from: "bot", titulo: "¿De qué tarea?", texto: "Decime la tarea y te paso las horas de mano de obra por unidad, y cuánto rinde por jornada.", chips: ["rendimiento de mampostería", "rendimiento de revoque", "rendimiento de contrapiso", "rendimiento de cerámico"] }];
    }
    const gremio = gremioPedido(texto);
    const top = cands[0], seg = cands[1];
    const confiado = !seg || top.score >= seg.score * 1.35;

    // Ambiguo: en vez de pedirte que elijas a ciegas, te muestro el rango de las
    // variantes que coinciden, con el rendimiento de cada una.
    if (!confiado) {
      const detalles = await Promise.all(cands.slice(0, 4).map((c) => detalleMO(c.it, gremio)));
      const lineas = [];
      detalles.forEach(({ d: dd, mos, un }, i) => {
        const it = cands[i].it;
        const foco = gremio ? mos.filter((m) => normalizar(m.funcion || "") === normalizar(gremio)) : mos;
        const usa = foco.length ? foco : mos;
        const h = usa.reduce((s, m) => s + Number(m.horas || 0), 0);
        const pj = porJornada(h);
        lineas.push(`${it.nombre}`);
        lineas.push(`   ${gremio && foco.length ? gremio : "Mano de obra"}: ${nfmt(h)} h/${un}` + (pj ? `  →  ${nfmt(pj, 1)} ${un}/jornada` : ""));
      });
      return [{
        from: "bot",
        titulo: gremio ? `${gremio} — variantes que coinciden` : "Variantes que coinciden",
        texto: `Jornada de ${JORNADA} h. Tocá una para ver el análisis completo:`,
        lineas,
        chips: cands.slice(0, 4).map((c) => `rendimiento de ${c.it.nombre}`),
        chipsHint: "Ver una en detalle:",
      }];
    }

    const it = top.it;
    const { mos, un } = await detalleMO(it, gremio);
    if (!mos.length) return [{ from: "bot", titulo: it.nombre, texto: "Ese ítem no tiene mano de obra cargada en su análisis." }];

    const lineas = [];
    for (const m of mos) {
      const h = Number(m.horas) || 0;
      const pj = porJornada(h);
      const marca = gremio && normalizar(m.funcion || "") === normalizar(gremio) ? "▸ " : "  ";
      lineas.push(`${marca}${(m.funcion || "Mano de obra").padEnd(22)} ${nfmt(h)} h/${un}` + (pj ? `  →  ${nfmt(pj, 1)} ${un} por jornada` : ""));
    }
    const total = mos.reduce((s, m) => s + (Number(m.horas) || 0), 0);
    lineas.push("─".repeat(30));
    lineas.push(`  Total mano de obra     ${nfmt(total)} h/${un}`);

    // Cuadrilla: trabajando en paralelo, el que más tarda marca el ritmo
    const cuello = mos.reduce((a, b) => (Number(a.horas) > Number(b.horas) ? a : b), mos[0]);
    const ritmo = porJornada(Number(cuello.horas) || 0);
    const nota = mos.length > 1 && ritmo
      ? `Con una cuadrilla de ${mos.map((m) => "1 " + (m.funcion || "")).join(" + ")} trabajando a la par, avanzás ~${nfmt(ritmo, 1)} ${un} por jornada (lo marca ${cuello.funcion}).`
      : null;

    return [{
      from: "bot",
      titulo: `Rendimiento — ${it.nombre}`,
      texto: nota,
      lineas,
      route: "/cotizador/analisis",
      routeLabel: "Ver análisis completo",
      chips: [`cuánto sale el ${un} de ${it.nombre}`, ...cands.slice(1, 3).map((c) => `rendimiento de ${c.it.nombre}`)],
      chipsHint: "Preguntame también:",
    }];
  };

  // "¿Cuánto sale el m2 de …?" — costo del análisis unitario del ítem
  const resolverPrecioItem = async (texto) => {
    const { indice } = await ensureCatalogo();
    const cands = buscarItems(texto, indice);
    if (!cands.length) return null;
    const top = cands[0], seg = cands[1];
    if (seg && top.score < seg.score * 1.35) {
      return [{
        from: "bot", titulo: "¿Cuál de estas?",
        texto: "Tocá la que buscás y te paso el costo unitario desglosado:",
        chips: cands.slice(0, 4).map((c) => `cuánto sale ${c.it.nombre}`),
      }];
    }
    const it = top.it;
    const d = (await api.get(`/analisis/items/${it.id}`)).data || {};
    const un = it.unidad_ejecucion || "unidad";
    const mat = Number(d.costo_materiales) || 0, mo = Number(d.costo_mano_obra) || 0, maq = Number(d.costo_maquinaria) || 0;
    const tot = mat + mo + maq;
    if (!tot) return [{ from: "bot", titulo: it.nombre, texto: "Ese ítem no tiene análisis de costos cargado todavía." }];
    const pct = (n) => (tot > 0 ? ` (${Math.round((n / tot) * 100)}%)` : "");
    return [{
      from: "bot",
      titulo: `Costo por ${un} — ${it.nombre}`,
      texto: "Costo directo del análisis, sin GG, beneficio ni IVA:",
      lineas: [
        `  Materiales      ${money(mat)}${pct(mat)}`,
        `  Mano de obra    ${money(mo)}${pct(mo)}`,
        `  Maquinaria      ${money(maq)}${pct(maq)}`,
        "─".repeat(30),
        `  Costo directo   ${money(tot)} por ${un}`,
      ],
      chips: [`rendimiento de ${it.nombre}`, "cómo se arma un análisis de precio"],
      chipsHint: "Preguntame también:",
    }];
  };

  const resolverDatos = async (intent, texto) => {
    try {
      if (intent.tipo === "rendimiento") return await resolverRendimiento(texto);
      if (intent.tipo === "precioItem") return await resolverPrecioItem(texto);
      if (intent.tipo === "cliente") return resolverCliente(intent.c);
      if (intent.tipo === "presupuesto") return await resolverPresupuesto(texto, intent.p);
      const presu = presuRef.current || [];
      if (!presu.length) return [{ from: "bot", texto: "Todavía no tenés presupuestos cargados." }];
      return [{ from: "bot", titulo: "¿Sobre qué presupuesto?", texto: "Tocá uno (o escribí el nombre) y te paso materiales, avance, contrato, plan, cobros, quién trabaja ahí o adicionales.", chips: presu.slice(0, 8).map((p) => p.nombre_obra) }];
    } catch (e) {
      return [{ from: "bot", texto: "Tuve un problema consultando los datos. Probá de nuevo en un momento." }];
    }
  };

  const enviar = async (textoForzado) => {
    const texto = (textoForzado ?? input).trim();
    if (!texto) return;
    setInput("");
    setMsgs((m) => [...m, { from: "user", texto }]);

    // Si preguntó por un dato del estudio, se contesta con la cifra. Un
    // secretario no te manda a buscar el número: te lo dice.
    //
    // Pero "cuánto me deben" es del estudio entero y "cuánto me deben EN EL
    // QUINCHO" es de una obra sola. Si el texto nombra una obra —o estás
    // parado en una y la nombrás— gana la obra: contestar con la lista de
    // todas las obras cuando alguien preguntó por una es peor que no contestar.
    const pd = preguntaDeDatos(texto);
    const deUnaObra = (() => {
      const presu = presuRef.current || [];
      if (!presu.length) return null;
      const aca = obraDeLaPantalla();
      if (aca && matchPorNombre(texto, [aca], "nombre_obra")) return aca;
      // Parado en una obra: "acá" la señala igual que nombrarla, y una
      // pregunta suelta de obra ("¿y el contrato?", "¿hay adicionales?") es
      // de la que estás mirando. Salvo que sea un "¿cómo hago…?", que es una
      // duda de uso y la contesta la ayuda, no los datos.
      if (aca && !esComoHago(texto) && (hablaDeEstaObra(texto) || subIntencion(texto))) return aca;
      return matchPorNombre(texto, presu, "nombre_obra");
    })();
    if (pd && !deUnaObra) {
      setMsgs((m) => [...m, { from: "bot", texto: "Un segundo, lo miro…", cargando: true }]);
      try {
        const r = await api.get("/asistente/datos");
        const res = pd.responder(r.data);
        setMsgs((m) => [...m.filter(x => !x.cargando),
          { from: "bot", texto: res.texto, route: res.ir, routeLabel: res.irLabel }]);
      } catch (e) {
        setMsgs((m) => [...m.filter(x => !x.cargando),
          { from: "bot", texto: "No pude traer los números ahora. Probá de nuevo en un momento." }]);
      }
      return;
    }
    await ensureData();
    // Si es una pregunta de USO y la base de conocimiento tiene una respuesta
    // firme, contesta la base. La capa de datos queda para las preguntas de
    // dato ("cuánto sale…", "cuánto me deben en…"), que es para lo que está.
    const kb = rankear(texto, sec);
    const kbFirme = kb.length > 0 && kb[0].score >= 3.2;
    // Umbral alto: varias palabras fuertes del tema, título incluido. A esa
    // altura la pregunta es de uso aunque no tenga un "cómo" adelante.
    const kbMuyFirme = kb.length > 0 && kb[0].score >= 6;
    // Una pregunta de dato nunca se la queda la base de conocimiento, por muy
    // fuerte que matchee: el que pregunta "quién" o "cuánto" quiere el número.
    // Si ya sabemos de qué obra habla y qué le está preguntando, es un dato:
    // "hay adicionales acá" quiere los adicionales de la obra, no el
    // instructivo de cómo se crea uno.
    const dato = pideUnDato(texto) || !!(deUnaObra && subIntencion(texto));
    let intent = (!dato && ((esComoHago(texto) && kbFirme) || kbMuyFirme))
      ? null : clasificar(texto);
    // "ambiguo" es la capa de datos diciendo "algo de datos me suena, pero no
    // sé qué". Si la base de conocimiento sí sabe, gana la base.
    if (intent && intent.tipo === "ambiguo" && kbFirme) intent = null;
    if (intent) {
      setMsgs((m) => [...m, { from: "bot", texto: "Un segundo, busco eso… ⏳", loading: true }]);
      const res = await resolverDatos(intent, texto);
      // Si la capa de datos no encontró nada, caemos a la base de conocimiento
      // en vez de dejar al usuario en un callejón sin salida.
      const salida = res && res.length ? res : responder(texto);
      setMsgs((m) => [...m.filter((x) => !x.loading), ...salida]);
      return;
    }
    setMsgs((m) => [...m, ...responder(texto)]);
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
            width: "min(380px, 100vw)", height: "min(600px, 100dvh)",
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
                  {m.texto && <div style={{ whiteSpace: "pre-wrap" }}>{conNegritas(m.texto)}</div>}
                  {m.lineas && (
                    <div style={{ margin: "6px 0 0", display: "flex", flexDirection: "column", gap: 3 }}>
                      {m.lineas.map((l, j) => <div key={j} style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12.5 }}>{l}</div>)}
                    </div>
                  )}
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
