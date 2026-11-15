// Ejemplos didácticos. No contienen obras, clientes ni precios de ningún tenant.
// Criterio de cálculo del cotizador: main.py/_calcular_linea (K=1, sin gestión).
export const MATERIALES = {
  cemento: { nombre: 'Cemento · bolsa de 50 kg', unidad: 'bolsa', precio: 11800 },
  arena: { nombre: 'Arena', unidad: 'm³', precio: 42000 },
  piedra: { nombre: 'Piedra partida', unidad: 'm³', precio: 52000 },
  cal: { nombre: 'Cal · bolsa de 25 kg', unidad: 'bolsa', precio: 8300 },
  ladrillo: { nombre: 'Ladrillo cerámico hueco', unidad: 'u', precio: 1450 },
  porcelanato: { nombre: 'Porcelanato', unidad: 'm²', precio: 26500 },
  adhesivo: { nombre: 'Adhesivo · bolsa de 25 kg', unidad: 'bolsa', precio: 18700 },
  pastina: { nombre: 'Pastina', unidad: 'kg', precio: 6200 },
  latex: { nombre: 'Pintura látex interior', unidad: 'litro', precio: 5800 },
  sellador: { nombre: 'Sellador fijador', unidad: 'litro', precio: 3900 },
};
export const MANO_OBRA = {
  oficial: { nombre: 'Oficial', unidad: 'hora', precio: 4500 },
  ayudante: { nombre: 'Ayudante', unidad: 'hora', precio: 3400 },
};
export const EQUIPOS = { mezcladora: { nombre: 'Mezcladora', unidad: 'hora', precio: 1400 } };
const mat = (id, cantidad, desperdicio = 5) => ({ id, cantidad, desperdicio });
export const CATALOGO = [
  { id: 'contrapiso', rubro: 'Albañilería', nombre: 'Contrapiso de hormigón pobre · 10 cm', unidad: 'm²',
    materiales: [mat('cemento', .24), mat('arena', .045), mat('piedra', .055)], mo: { oficial: .2, ayudante: .3 }, equipos: { mezcladora: .06 } },
  { id: 'mamposteria', rubro: 'Albañilería', nombre: 'Mampostería de ladrillo hueco · 18 cm', unidad: 'm²',
    materiales: [mat('ladrillo', 12, 7), mat('cemento', .12), mat('arena', .025), mat('cal', .16)], mo: { oficial: .5, ayudante: .45 }, equipos: { mezcladora: .03 } },
  { id: 'revoque', rubro: 'Albañilería', nombre: 'Revoque interior grueso y fino', unidad: 'm²',
    materiales: [mat('cemento', .08), mat('arena', .025), mat('cal', .12)], mo: { oficial: .35, ayudante: .3 }, equipos: { mezcladora: .02 } },
  { id: 'carpeta', rubro: 'Pisos y revestimientos', nombre: 'Carpeta niveladora · 3 cm', unidad: 'm²',
    materiales: [mat('cemento', .2), mat('arena', .025)], mo: { oficial: .18, ayudante: .2 }, equipos: { mezcladora: .02 } },
  { id: 'piso', rubro: 'Pisos y revestimientos', nombre: 'Piso de porcelanato', unidad: 'm²',
    materiales: [mat('porcelanato', 1, 10), mat('adhesivo', .2), mat('pastina', .12)], mo: { oficial: .45, ayudante: .3 }, equipos: {} },
  { id: 'revestimiento', rubro: 'Pisos y revestimientos', nombre: 'Revestimiento de pared de porcelanato', unidad: 'm²',
    materiales: [mat('porcelanato', 1, 10), mat('adhesivo', .24), mat('pastina', .15)], mo: { oficial: .55, ayudante: .35 }, equipos: {} },
  { id: 'pintura', rubro: 'Pintura', nombre: 'Pintura látex en paredes · dos manos', unidad: 'm²',
    materiales: [mat('latex', .18), mat('sellador', .06)], mo: { oficial: .12, ayudante: .08 }, equipos: {} },
  { id: 'cielorraso', rubro: 'Pintura', nombre: 'Pintura látex en cielorraso · dos manos', unidad: 'm²',
    materiales: [mat('latex', .2), mat('sellador', .06)], mo: { oficial: .15, ayudante: .1 }, equipos: {} },
  { id: 'zocalo', rubro: 'Pisos y revestimientos', nombre: 'Zócalo de porcelanato', unidad: 'ml',
    materiales: [mat('porcelanato', .12, 10), mat('adhesivo', .03), mat('pastina', .04)], mo: { oficial: .12, ayudante: .08 }, equipos: {} },
  { id: 'retiro', rubro: 'Trabajos previos', nombre: 'Retiro de piso y carpeta existentes', unidad: 'm²',
    materiales: [], mo: { oficial: .35, ayudante: .5 }, equipos: {} },
];
export const ESCENARIOS = {
  ampliacion: { nombre: 'Ampliación de vivienda', etiqueta: 'Ampliación · 30 m²',
    alcance: 'Ejemplo parcial de albañilería y terminaciones. No incluye estructura, cubierta ni instalaciones.',
    lineas: [['contrapiso', 30], ['mamposteria', 48], ['revoque', 96], ['piso', 30], ['pintura', 96], ['cielorraso', 30]] },
  bano: { nombre: 'Terminaciones de un baño', etiqueta: 'Baño · 6 m²',
    alcance: 'Ejemplo parcial de pisos, revestimientos y pintura. No incluye instalaciones ni artefactos.',
    lineas: [['retiro', 6], ['carpeta', 6], ['piso', 6], ['revestimiento', 18], ['pintura', 6], ['cielorraso', 6]] },
};
export const redondear = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const dinero = n => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
export const cantidad = n => Number(n.toFixed(3)).toLocaleString('es-AR', { maximumFractionDigits: 3 });

export function crearEjemplo(escenario = 'ampliacion') {
  const elegido = ESCENARIOS[escenario] ? escenario : 'ampliacion';
  return { version: 2, escenario: elegido, nombre: ESCENARIOS[elegido].nombre, gg: 10, beneficio: 15, iva: 0,
    cargasSociales: 65, precios: Object.fromEntries(Object.entries(MATERIALES).map(([id, m]) => [id, m.precio])),
    lineas: ESCENARIOS[elegido].lineas.map(([itemId, cant], i) => ({ id: `ejemplo-${i}`, itemId, cantidad: cant })) };
}

export function restaurarEjemplo(valor) {
  const base = crearEjemplo(valor?.escenario);
  if (valor?.version !== 2 || !Array.isArray(valor.lineas) || !valor.lineas.length || valor.lineas.length > 30) return base;
  const valido = (n, min, max) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (valor.lineas.some(l => !l || !CATALOGO.some(i => i.id === l.itemId) || !valido(l.cantidad, .01, 10000)) ||
      !valido(valor.gg, 0, 90) || !valido(valor.beneficio, 0, 90) || valor.gg + valor.beneficio >= 95 ||
      !valido(valor.iva, 0, 27) || !valido(valor.cargasSociales, 0, 150)) return base;
  return { ...base, nombre: typeof valor.nombre === 'string' ? valor.nombre.slice(0, 80) : base.nombre,
    lineas: valor.lineas.map((l, i) => ({ id: `ejemplo-${i}`, itemId: l.itemId, cantidad: l.cantidad })),
    gg: valor.gg, beneficio: valor.beneficio, iva: valor.iva, cargasSociales: valor.cargasSociales,
    precios: Object.fromEntries(Object.entries(base.precios).map(([id, precio]) => [id,
      valido(valor.precios?.[id], 0, 10000000) ? valor.precios[id] : precio])) };
}

export function calcular(ejemplo) {
  const coef = Number((1 / (1 - ejemplo.gg / 100 - ejemplo.beneficio / 100)).toFixed(6));
  const materiales = {};
  const lineas = ejemplo.lineas.map(linea => {
    const item = CATALOGO.find(i => i.id === linea.itemId);
    let materialSin = 0, materialCon = 0;
    const detalleMateriales = item.materiales.map(m => {
      const precio = ejemplo.precios[m.id];
      materialSin += m.cantidad * precio;
      materialCon += m.cantidad * (1 + m.desperdicio / 100) * precio;
      const comprar = m.cantidad * (1 + m.desperdicio / 100) * linea.cantidad;
      if (!materiales[m.id]) materiales[m.id] = { id: m.id, ...MATERIALES[m.id], precio, cantidad: 0, usos: 0 };
      materiales[m.id].cantidad += comprar;
      materiales[m.id].usos += 1;
      return { ...m, ...MATERIALES[m.id], precio, subtotal: m.cantidad * precio };
    });
    const costoMo = Object.entries(item.mo).reduce((s, [id, horas]) => s + horas * MANO_OBRA[id].precio, 0) * (1 + ejemplo.cargasSociales / 100);
    const costoEquipo = Object.entries(item.equipos).reduce((s, [id, horas]) => s + horas * EQUIPOS[id].precio, 0);
    const costoUnitario = materialSin + costoMo + costoEquipo;
    const precioSinIva = costoUnitario * coef * linea.cantidad;
    return { ...linea, item, detalleMateriales, costoUnitario, costoMo, costoEquipo,
      costo_mat: redondear(materialCon * linea.cantidad), costo_mo: redondear(costoMo * linea.cantidad),
      costo_maq: redondear(costoEquipo * linea.cantidad),
      total_ejecucion: redondear((materialCon + costoMo + costoEquipo) * linea.cantidad),
      precio_venta_sin_iva: redondear(precioSinIva), precio_venta_con_iva: redondear(precioSinIva * (1 + ejemplo.iva / 100)),
      iva_monto: redondear(precioSinIva * ejemplo.iva / 100),
      nombre_item: item.nombre, unidad_item: item.unidad, tipo: 'catalogo' };
  });
  const suma = campo => redondear(lineas.reduce((s, l) => s + l[campo], 0));
  const total = suma('precio_venta_con_iva');
  const ejecucion = suma('total_ejecucion');
  const sinIva = suma('precio_venta_sin_iva');
  const rubros = [...new Set(lineas.map(l => l.item.rubro))].map((nombre, i) => {
    const filas = lineas.filter(l => l.item.rubro === nombre);
    return { numero: i + 1, nombre, lineas: filas,
      subtotal_ejecucion: redondear(filas.reduce((s, l) => s + l.total_ejecucion, 0)),
      subtotal_precio: redondear(filas.reduce((s, l) => s + l.precio_venta_con_iva, 0)) };
  });
  return { lineas, materiales: Object.values(materiales).map(m => ({ ...m, total: redondear(m.cantidad * m.precio) })),
    nombre_obra: ejemplo.nombre, estado: 'abierto', observaciones: 'DEMOSTRACIÓN · Valores ilustrativos, no constituyen una cotización. ' + ESCENARIOS[ejemplo.escenario].alcance,
    coeficientes: { gg_porcentaje: ejemplo.gg, ben_porcentaje: ejemplo.beneficio, iva_porcentaje: ejemplo.iva, coef_gg_ben: coef },
    rubros, totales: { total_precio_con_iva: total, total_precio_sin_iva: sinIva, total_ejecucion: ejecucion,
      total_iva: suma('iva_monto'), margen_pct: sinIva ? redondear((sinIva - ejecucion) / sinIva * 100) : 0 } };
}
