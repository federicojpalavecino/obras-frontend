// ── Prueba en frío del ruteo del asistente ───────────────────────────────────
//
//     node docs/test-ruteo-asistente.js
//
// No necesita navegador ni sistema levantado. Carga las funciones reales de
// Asistente.jsx y reproduce la decisión de enviar(): con qué capa se queda
// cada pregunta —la ayuda, los datos del estudio, una obra o un cliente—.
//
// Es la mitad que se puede verificar barato y la que más se rompe: el texto de
// las respuestas casi nunca falla, lo que falla es que la pregunta termine en
// la capa equivocada. Para probar el texto renderizado está
// docs/circuito-asistente.js, que sí necesita el navegador.
//
// Los casos apuntan al tenant Simulación. Contra otro hay que cambiar los
// nombres de obras y clientes de abajo.

const fs = require("fs");
const RUTA = require("path").join(__dirname, "..", "src", "components", "Asistente.jsx");
const src = fs.readFileSync(RUTA, "utf8");

// ── Cargar el módulo sin la parte de React ──────────────────────────────────
const desde = src.indexOf("const normalizar = (s) =>");
const hasta = src.indexOf("// ── Componente");
if (desde < 0 || hasta < 0) throw new Error("cambió la forma de Asistente.jsx");

let modulo = src.slice(desde, hasta)
  // conNegritas devuelve JSX y no participa del ruteo.
  .replace(/function conNegritas\(t\) \{[\s\S]*?\n\}/, "function conNegritas(t) { return t; }")
  // `const` no sale del eval: se lifta para poder usarlo desde acá.
  .replace(/^const (\w+)/gm, "globalThis.$1");
eval(modulo);

// ── El estudio de prueba ────────────────────────────────────────────────────
const CLIENTES = [
  { id: 55, nombre: "Marta Quiroga" }, { id: 7, nombre: "Matias Gonzalez" },
  { id: 27, nombre: "Gaston Falcon" }, { id: 30, nombre: "Adrian Solis + Mariana Sosa" },
  { id: 28, nombre: "Milagros" }, { id: 29, nombre: "Rodrigo Carrio" },
];
const OBRAS = [
  { id: 164, nombre_obra: "Casa Quiroga — Ampliación quincho" },
  { id: 165, nombre_obra: "Casa Quiroga — Ampliación quincho — Adicional 1" },
  { id: 160, nombre_obra: "Casa Quiroga — Vivienda 96 m2" },
  { id: 109, nombre_obra: "Casa Matias" },
  { id: 131, nombre_obra: "Muro cierre" },
  { id: 129, nombre_obra: "Muro perimetral" },
  { id: 79, nombre_obra: "Baño 2" },
  { id: 59, nombre_obra: "Baño nuevo" },
];

// ── La misma decisión que toma enviar() ─────────────────────────────────────
// Si esto se separa de enviar(), la prueba deja de servir: es una copia a
// propósito, corta, para poder correrla sin React ni red.
function rutear(texto, obraEnPantalla) {
  const pd = preguntaDeDatos(texto);

  const deUnaObra = (() => {
    if (obraEnPantalla && matchPorNombre(texto, [obraEnPantalla], "nombre_obra")) return obraEnPantalla;
    if (obraEnPantalla && !esComoHago(texto) &&
        (hablaDeEstaObra(texto) || subIntencion(texto))) return obraEnPantalla;
    return matchPorNombre(texto, OBRAS, "nombre_obra");
  })();

  if (pd && !deUnaObra) return { capa: "estudio", que: pd.id };

  const kb = rankear(texto, null);
  const kbFirme = kb.length > 0 && kb[0].score >= 3.2;
  const kbMuyFirme = kb.length > 0 && kb[0].score >= 6;
  const dato = pideUnDato(texto)
    || !!(deUnaObra && subIntencion(texto) && !esComoHago(texto));
  const porPersona = preguntaPorPersona(texto);
  const esKB = !dato && !porPersona && ((esComoHago(texto) && kbFirme) || kbMuyFirme);
  if (esKB) return { capa: "ayuda", que: (kb[0].e || {}).titulo };

  if (porPersona) {
    const c = matchPorNombre(texto, CLIENTES, "nombre");
    if (c) return { capa: "cliente", que: c.nombre };
  }
  if (deUnaObra) return { capa: "obra", que: deUnaObra.nombre_obra };
  const c2 = matchPorNombre(texto, CLIENTES, "nombre");
  if (c2) return { capa: "cliente", que: c2.nombre };
  if (kb.length) return { capa: "ayuda", que: kb[0].e ? kb[0].e.t : kb[0].t };
  return { capa: "nada", que: "" };
}

// ── Los casos ───────────────────────────────────────────────────────────────
const AQUI = OBRAS[0];   // parado en Casa Quiroga — Ampliación quincho

const CASOS = [
  // Ayuda del sistema: tiene que explicar, no tirar números.
  ["ayuda",   null, "como creo un presupuesto"],
  ["ayuda",   null, "como cargo un adicional"],
  ["ayuda",   null, "como marco dias de lluvia"],
  ["ayuda",   null, "como le doy acceso al portal a un cliente"],
  ["ayuda",   null, "para que sirve el control financiero"],
  ["ayuda",   null, "como cierro un presupuesto"],
  ["ayuda",   null, "no me recalcula el plazo con la lluvia"],

  // Parado en una obra, sin nombrarla.
  ["obra",    AQUI, "cuanto me deben aca"],
  ["obra",    AQUI, "quien trabaja aca"],
  ["obra",    AQUI, "cuando termina esta obra"],
  ["obra",    AQUI, "cuando arranco"],
  ["obra",    AQUI, "que materiales lleva esta obra"],
  ["obra",    AQUI, "hay adicionales aca"],
  ["obra",    AQUI, "cual es el ultimo certificado"],
  ["obra",    AQUI, "y el contrato"],
  ["obra",    AQUI, "como viene el avance"],
  ["obra",    AQUI, "cuanto falta pagar aca"],

  // Sin obra en pantalla: el estudio entero.
  ["estudio", null, "cuanto me deben en total"],
  ["estudio", null, "que tengo vencido"],
  ["estudio", null, "cuanto tengo que pagar"],
  ["estudio", null, "a quien le debo"],
  ["estudio", null, "que obras tengo atrasadas"],
  ["estudio", null, "cuantas obras tengo"],
  ["estudio", null, "como viene la caja de este mes"],
  ["estudio", null, "que hay en el panol"],
  ["estudio", null, "que hay en el deposito"],
  ["estudio", null, "cuanto le pago al personal esta semana"],

  // Un cliente, por su nombre.
  ["cliente", null, "quien es marta quiroga"],
  ["cliente", null, "datos de matias gonzalez"],
  ["cliente", null, "el telefono de gaston falcon"],
  ["cliente", null, "contacto de rodrigo carrio"],

  // Una obra por su nombre, sin tenerla en pantalla.
  ["obra",    null, "cuanto me deben en casa quiroga vivienda"],
  ["obra",    null, "quien trabaja en el quincho"],
  ["obra",    null, "cuando termina casa matias"],
  ["obra",    null, "materiales de muro cierre"],
  ["obra",    null, "el contrato del quincho"],
  ["obra",    null, "hay adicionales en el quincho"],
];

// Y algunas que además tienen que dar en el blanco exacto, no solo en la capa:
// son los choques que ya rompieron una vez.
const EXACTOS = {
  // Para la ayuda no alcanza con caer en la capa correcta: tiene que ser EL
  // articulo. "Como marco dias de lluvia" caia en ayuda y contestaba uno sobre
  // cuadrillas y horas, porque "dias" matcheaba ahi — y la prueba lo daba por
  // bueno. La base no tenia nada de dias perdidos, que es de lo que mas se
  // pregunta en obra.
  "como creo un presupuesto": "Crear un presupuesto nuevo",
  "como cargo un adicional": "Crear un presupuesto adicional",
  "como marco dias de lluvia": "Marcar dias de lluvia (o cualquier dia perdido)",
  "como le doy acceso al portal a un cliente": "Dar acceso a un cliente (portal)",
  "para que sirve el control financiero": "Usar el Control Financiero",
  "como cierro un presupuesto": "Cerrar un presupuesto y convertirlo en obra",
  "no me recalcula el plazo con la lluvia": "Cargue dias de lluvia y el plazo no se movio",

  "quien es marta quiroga": "Marta Quiroga",
  "cuanto me deben en casa quiroga vivienda": "Casa Quiroga — Vivienda 96 m2",
  "cuando termina casa matias": "Casa Matias",
  "materiales de muro cierre": "Muro cierre",
  "quien trabaja en el quincho": "Casa Quiroga — Ampliación quincho",
};

let ok = 0;
const fallas = [];
for (const [espera, aqui, q] of CASOS) {
  const r = rutear(q, aqui);
  let bien = r.capa === espera;
  const plano = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (bien && EXACTOS[q]) bien = plano(r.que) === plano(EXACTOS[q]);
  if (bien) ok++; else fallas.push([q, espera, r]);
  console.log((bien ? "ok   " : "MAL  ") + q.padEnd(42) + "→ " + r.capa +
              (r.que ? ": " + String(r.que).slice(0, 46) : ""));
}

console.log("");
console.log(ok + "/" + CASOS.length);
for (const [q, espera, r] of fallas) {
  console.log("  falla: «" + q + "» debía ir a " + espera + " y fue a " + r.capa + " (" + r.que + ")");
}
process.exit(fallas.length ? 1 : 0);
