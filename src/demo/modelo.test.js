import { calcular, crearEjemplo, restaurarEjemplo } from './modelo';

test('duplica una cantidad y recalcula solo el trabajo y sus insumos', () => {
  const estado = crearEjemplo();
  const inicial = calcular(estado);
  const actualizado = calcular({ ...estado, lineas: estado.lineas.map((l, i) => i === 0 ? { ...l, cantidad: l.cantidad * 2 } : l) });
  expect(actualizado.lineas[0].precio_venta_con_iva).toBeCloseTo(inicial.lineas[0].precio_venta_con_iva * 2, 1);
  expect(actualizado.lineas[1].precio_venta_con_iva).toEqual(inicial.lineas[1].precio_venta_con_iva);
  const extraPiedra = actualizado.materiales.find(m => m.id === 'piedra').cantidad - inicial.materiales.find(m => m.id === 'piedra').cantidad;
  expect(extraPiedra).toBeCloseTo(30 * .055 * 1.05, 8);
});

test('un solo cambio de pintura actualiza ambos análisis y la lista de compra', () => {
  const estado = crearEjemplo();
  const inicial = calcular(estado);
  const actualizado = calcular({ ...estado, precios: { ...estado.precios, latex: estado.precios.latex * 1.1 } });
  const cambiados = actualizado.lineas.filter((l, i) => l.precio_venta_con_iva !== inicial.lineas[i].precio_venta_con_iva);
  expect(cambiados.map(l => l.itemId)).toEqual(['pintura', 'cielorraso']);
  const latex = actualizado.materiales.find(m => m.id === 'latex');
  expect(latex.usos).toBe(2);
  expect(latex.cantidad).toBeCloseTo(24.444, 8);
  expect(latex.total).toBeCloseTo(155952.72, 2);
});

test('usa el criterio real de GG/beneficio sobre venta, CS y desperdicio para compras', () => {
  const estado = crearEjemplo();
  estado.lineas = [{ id: 'manual', itemId: 'contrapiso', cantidad: 2 }];
  const linea = calcular(estado).lineas[0];
  // Materiales 7.582, MO 1.920 + 65% CS, equipo 84. Venta / (1 - .10 - .15).
  expect(linea.costoUnitario).toBeCloseTo(10834, 8);
  expect(linea.total_ejecucion).toBe(22426.2);
  expect(linea.precio_venta_sin_iva).toBe(28890.66);
  expect(calcular({ ...estado, iva: 21 }).totales.total_precio_con_iva).toBe(34957.7);
});

test('la salida comercial y el total visible salen del mismo cálculo', () => {
  const salida = calcular(crearEjemplo('bano'));
  const sumaRubros = salida.rubros.reduce((s, r) => s + r.subtotal_precio, 0);
  expect(sumaRubros).toBeCloseTo(salida.totales.total_precio_con_iva, 2);
  expect(salida.rubros.flatMap(r => r.lineas)).toHaveLength(salida.lineas.length);
  expect(salida.observaciones).toMatch(/No incluye instalaciones/);
});

test('resta el ítem quitado sin dejar materiales huérfanos', () => {
  const estado = crearEjemplo();
  estado.lineas = estado.lineas.filter(l => !['pintura', 'cielorraso'].includes(l.itemId));
  expect(calcular(estado).materiales.some(m => m.id === 'latex')).toBe(false);
});

test.each([
  { lineas: [null] },
  { lineas: [{ itemId: 'privado', cantidad: 1 }] },
  { lineas: [{ itemId: 'piso', cantidad: -2 }] },
  { lineas: [{ itemId: 'piso', cantidad: Infinity }] },
  { gg: 80, beneficio: 30 },
  { cargasSociales: NaN },
])('recupera un ejemplo válido ante almacenamiento inválido: %j', invalido => {
  const base = crearEjemplo();
  expect(restaurarEjemplo({ ...base, ...invalido })).toEqual(base);
});

test('conserva el valor cero de un material y no altera las constantes al reiniciar', () => {
  const estado = crearEjemplo();
  estado.precios.latex = 0;
  const restaurado = restaurarEjemplo(estado);
  expect(restaurado.precios.latex).toBe(0);
  expect(calcular(restaurado).materiales.find(m => m.id === 'latex').total).toBe(0);
  expect(crearEjemplo().precios.latex).toBe(5800);
});
