import fs from "fs";
const src = fs.readFileSync("C:/obras-frontend/src/pages/admin/EsferaFlujo.jsx", "utf8");
const i = src.indexOf("const NODOS"), j = src.indexOf("export default");
eval(src.slice(i, j).replace(/^const (\w+)/gm, "globalThis.$1").replace(/^function (\w+)/gm, "globalThis.$1 = function"));

let fallas = [];
// 1. Todo nodo cae sobre la esfera unidad.
for (const n of NODOS) {
  const v = aVector(n.lat, n.lon);
  const largo = Math.hypot(...v);
  if (Math.abs(largo - 1) > 1e-9) fallas.push(`${n.id} no cae en la esfera (|v|=${largo})`);
}
// 2. Ningun par de nodos encimado: si dos caen en el mismo punto, se tapan.
for (let a = 0; a < NODOS.length; a++)
  for (let b = a + 1; b < NODOS.length; b++) {
    const va = aVector(NODOS[a].lat, NODOS[a].lon), vb = aVector(NODOS[b].lat, NODOS[b].lon);
    const ang = Math.acos(Math.max(-1, Math.min(1, va[0]*vb[0]+va[1]*vb[1]+va[2]*vb[2]))) * 180 / Math.PI;
    if (ang < 22) fallas.push(`${NODOS[a].id} y ${NODOS[b].id} muy juntos (${ang.toFixed(0)}°)`);
  }
// 3. Todo arco apunta a nodos que existen.
const ids = new Set(NODOS.map(n => n.id));
for (const [d, a, et] of ARCOS) {
  if (!ids.has(d)) fallas.push(`arco desde "${d}" que no existe`);
  if (!ids.has(a)) fallas.push(`arco hacia "${a}" que no existe`);
  if (!et || et.length > 32) fallas.push(`etiqueta rara en ${d}->${a}`);
}
// 4. Ningun nodo suelto: uno sin conexiones queda flotando sin sentido.
for (const n of NODOS) {
  if (!ARCOS.some(([d, a]) => d === n.id || a === n.id)) fallas.push(`${n.id} no se conecta con nada`);
}
// 5. slerp devuelve puntos sobre la esfera en todo el recorrido.
const va = aVector(62, 0), vb = aVector(-62, 165);
for (let t = 0; t <= 1.0001; t += 0.1) {
  const p = slerp(va, vb, t), l = Math.hypot(...p);
  if (Math.abs(l - 1) > 1e-9) fallas.push(`slerp se sale de la esfera en t=${t.toFixed(1)} (|p|=${l})`);
}
// 6. Colores validos.
for (const n of NODOS) if (!/^#[0-9a-f]{6}$/i.test(n.color)) fallas.push(`color raro en ${n.id}`);

console.log(`${NODOS.length} nodos, ${ARCOS.length} arcos`);
console.log(fallas.length ? "FALLAS:\n  " + fallas.join("\n  ") : "geometria y mapa: sin problemas");
process.exit(fallas.length ? 1 : 0);
