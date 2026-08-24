// Prueba en frío del ruteo cliente-vs-obra, sin navegador.
// El navegador viene congelándose; esto prueba la decisión misma, que es lo
// que importa: con qué se queda el asistente cuando el cliente y la obra
// comparten el apellido.
const fs = require("fs");
const src = fs.readFileSync("C:/obras-frontend/src/components/Asistente.jsx", "utf8");

function trozo(a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("no encontré " + a);
  return src.slice(i, j);
}
// `const` no sale del eval: se pasa a global para poder usarlo desde acá.
const aGlobal = (s) => s.replace(/^const (\w+)/gm, "globalThis.$1");

eval(aGlobal(trozo("const normalizar = (s) =>", "// ── Base de conocimiento")));
eval(aGlobal(trozo("const RE_ESTA_OBRA", "// ── Consultas de DATOS reales")));
eval(aGlobal(trozo("const money = (n) =>", "// ── Búsqueda de ítems del catálogo")));

const CL = [{ nombre: "Marta Quiroga" }, { nombre: "Matias Gonzalez" },
            { nombre: "Gaston Falcon" }, { nombre: "Adrian Solis + Mariana Sosa" },
            { nombre: "Milagros" }, { nombre: "Rodrigo Carrio" }];
const OB = [{ nombre_obra: "Casa Quiroga — Ampliación quincho" },
            { nombre_obra: "Casa Quiroga — Vivienda 96 m2" },
            { nombre_obra: "Casa Matias" }, { nombre_obra: "Muro cierre" },
            { nombre_obra: "Muro perimetral" }];

const CASOS = [
  ["quien es marta quiroga",                    "cliente", "Marta Quiroga"],
  ["datos de matias gonzalez",                  "cliente", "Matias Gonzalez"],
  ["el telefono de gaston falcon",              "cliente", "Gaston Falcon"],
  ["contacto de rodrigo carrio",                "cliente", "Rodrigo Carrio"],
  ["quien trabaja en el quincho",               "obra",    "Casa Quiroga — Ampliación quincho"],
  ["cuando termina casa matias",                "obra",    "Casa Matias"],
  ["materiales de muro cierre",                 "obra",    "Muro cierre"],
  ["cuanto me deben en casa quiroga vivienda",  "obra",    "Casa Quiroga — Vivienda 96 m2"],
  ["que obras tiene marta quiroga",             "obra",    "Casa Quiroga — Ampliación quincho"],
];

let ok = 0;
for (const [q, esperaTipo, esperaNombre] of CASOS) {
  // La misma decisión que toma clasificar(): persona primero, obra después.
  const pp = preguntaPorPersona(q);
  const c = matchPorNombre(q, CL, "nombre");
  const o = matchPorNombre(q, OB, "nombre_obra");
  const gana = (pp && c) ? ["cliente", c.nombre]
             : o ? ["obra", o.nombre_obra]
             : c ? ["cliente", c.nombre] : ["nada", ""];
  const bien = gana[0] === esperaTipo && gana[1] === esperaNombre;
  if (bien) ok++;
  console.log((bien ? "ok   " : "MAL  ") + q.padEnd(42) + "-> " + gana[0] + ": " + gana[1]);
}
console.log("");
console.log(ok + "/" + CASOS.length);
process.exit(ok === CASOS.length ? 0 : 1);
