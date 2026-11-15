# Demo de presupuesto

## Propósito comercial

Mostrar un resultado concreto antes de pedir el registro: cambiar cantidades,
ver el análisis, actualizar un material y obtener un presupuesto presentable y
su lista de compra. El visitante elige el ritmo; no hay popovers obligatorios,
contador de urgencia ni pago para terminar el recorrido.

Ruta pública: `/demo`. Ejemplos: albañilería y terminaciones de una ampliación
de 30 m², o terminaciones de un baño de 6 m². Son alcances parciales identificados,
no una cotización de una obra completa. Los valores y consumos son ilustrativos;
no se publican precios actuales del catálogo ni datos de clientes.

## Qué funciona

- Editar cantidades con coma o punto; agregar o quitar trabajos; deshacer.
- Ver consumos, desperdicio, mano de obra, cargas sociales y equipos de cada ítem.
- Cambiar una vez el precio de un material compartido y recalcular todos sus usos.
- Ajustar GG, beneficio e IVA. El criterio de cálculo coincide con el cotizador
  (K=1 y sin modo gestión), incluida la separación del desperdicio para compras.
- Obtener la propuesta usando el mismo `PrintPresupuesto` que usa la aplicación,
  con identidad de ejemplo explícita. Imprimir/guardar PDF desde el navegador.
- Listado de materiales agregado desde los mismos análisis, con desperdicio.
- Cierre por WhatsApp con contexto del ejemplo o registro de la cuenta.
- Persistencia solo en la pestaña, con claves `faim_demo_v2_*` separadas de auth.

La demo no es una cuenta de prueba completa. No importa obras reales, no crea
presupuestos en cuentas del cliente y no publica datos de esas cuentas. Visitarla
con una sesión existente conserva sus tokens, identidad y datos de localStorage.
La antigua API `/demo/entrar` permanece en 410; `/demo-portal` sigue retirado.

## Medición y límites

`POST /demo/eventos` envía un UUID aleatorio de pestaña, tipo de acción y escenario.
No envía email, teléfono, nombres, valores editados, JWT ni datos de una obra.
La API deduplica por pestaña y acción y limita solicitudes. La atribución de
cuenta creada se registra en el servidor tras un alta real, no con un clic.

El panel admin muestra por cohorte de visitas: visitas, cambios probados, documento,
materiales, pedidos de impresión, clics a WhatsApp, clics a registro y cuentas
creadas. Un clic a WhatsApp no prueba mensaje enviado, llamada reservada ni venta.
La tasa visita → registro no es la tasa de compra. El histórico se conserva separado.

Esta implementación permite observar dónde se pierde interés; no garantiza ventas.

## Verificación

```text
npm run test:demo
npm run build
node docs/verificar-demo.mjs
node docs/verificar-demo.mjs https://www.faimobras.com
```

La prueba de navegador usa el build real en escritorio y celular, sin servicios
externos. Valida cálculos visibles, análisis, catálogo, deshacer, persistencia,
materiales, documento, contenido de impresión, enlaces y separación de sesión.
Las capturas se guardan en `.demo-qa/`, excluido de Git. El script levanta y cierra
su propio servidor y navegador.

Backend: `test_demo_publica.py` prueba deduplicación, atribución de altas, cohortes,
validación y la coincidencia numérica del ejemplo con `_calcular_linea` real.
Migración aditiva: `C:\obras-backend\migracion_demo_v2.sql`.
