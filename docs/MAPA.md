# Mapa de FAIM OBRAS

**Para qué sirve este archivo.** Para no tener que revisar todo el sistema cada
vez que se abre una sesión nueva. Acá está qué hay, qué resuelve cada cosa, cómo
se conectan y en qué estado están. Si algo de acá no coincide con el código, gana
el código — y hay que corregir este archivo en el mismo commit.

Última verificación contra producción: **11/08/2026**.

---

## En una línea

Un estudio de arquitectura carga un presupuesto y, a partir de ese mismo
presupuesto, le salen el plazo de obra, los certificados de avance, la curva de
inversión, el listado de materiales, el control financiero y lo que ve el
cliente. **Se carga una vez y se usa siete veces.** Eso es el producto; todo lo
demás es consecuencia.

## La columna vertebral

Todo cuelga del presupuesto. Es la razón por la que esto no es «un Excel más
lindo»: en un Excel cada una de estas cosas es una planilla aparte que hay que
volver a cargar y que se desincroniza sola.

```
        catálogo global (436 ítems, cada uno con su análisis de costo)
                              │
                    override por tenant (precios propios)
                              │
                        PRESUPUESTO ──────────┬──────────┬──────────┐
                              │               │          │          │
                    certificados          Gantt      curva de   listado de
                    (avance + egresos)  (plazo)     inversión   materiales
                              │               │
                              └──── gestión de obra ────┘
                                (contrato, cobros, compras, subcontratos)
                                          │
                                  control financiero
                                          │
                                   portal del cliente
```

**El dato clave**: el análisis de costo ya viene cargado. El estudio no compone
el precio del ítem, elige el ítem. De ahí sale que subir un material recalcule
todos los presupuestos a la vez.

---

## Los módulos

La última columna es la que sirve para marketing: es lo que cada módulo *vende*,
no lo que hace.

| Módulo | Qué resuelve | Dónde vive | Qué vende |
|---|---|---|---|
| **Cotizador** | Presupuestar con análisis de costo real, no con precio a ojo | `cotizador/pages/Presupuesto.js`, `Menu.js` · API `/presupuestos` (71 endpoints) | «Cotizás en minutos, no en tres días» |
| **Análisis de costos** | Catálogo global de 436 ítems con composición real (materiales + MO + maquinaria), con override por tenant | `AnalisisCostos.js`, `PanelAnalisis.js` · API `/analisis`, `/maestros` | «No inventás el precio: sabés de dónde sale cada peso» |
| **Materiales / Mano de obra / Maquinaria** | Los precios que alimentan todos los análisis | `Materiales.js`, `ManoObra.js`, `Maquinaria.js` | «Subió el hierro: lo cambiás una vez y se recalcula todo» |
| **Cómputo** | Cantidades parciales y totales por ítem | `PanelComputo.js` | Menos error de medición, y queda escrito |
| **Certificados** | Avance de obra sobre el presupuesto, con egresos | `Certificado.js` · API `/certificados` | «Certificás sin rehacer el presupuesto» |
| **Gantt / Planner** | Plazo automático desde el presupuesto: horas de MO ÷ (horas-día × personas) | `Gantt.jsx`, `Planner.jsx` · `planificador.py`, API `/planner` | «El plazo no lo estimás a ojo: sumás gente y te da la fecha» |
| **Curva de inversión** | Cuánta plata hace falta y cuándo | `CurvaInversion.jsx` | «Sabés cuándo te va a faltar plata, antes de que falte» |
| **Listado de materiales** | Qué comprar y cuánto, sacado del cómputo | `ListadoMateriales.jsx` | Comprás contra un listado, no contra la memoria |
| **Gestión de obra** | Contrato, cobros, subcontratos, compras y certificados de una obra | `pages/Obra.jsx` · ruta `/cotizador/presupuesto/:id/obra` | «La obra entera en una pantalla» |
| **Control financiero** | Ingresos, egresos y personal por semana / quincena / mes; importa de Obra | `pages/ControlFinanciero.jsx` · API `/cf` (9) | «¿Cuánto ganaste en tu última obra?» — el hook del reel |
| **Portal del cliente** | El cliente ve avance, contrato (lo puede aceptar), cuenta corriente, planificación y consultas | `ClientePortal.jsx`, `AccesosClientes.jsx` · API `/portal` (12) | «Tu cliente entra y ve el avance solo, en vez de llamarte» |
| **Portal del personal** | Vista acotada para la gente del estudio | `PersonalPortal.jsx` | — |
| **Fiscal (ARCA)** | Facturación electrónica, perfiles fiscales, movimientos | `pages/Fiscal.jsx` · `arca.py`, API `/fiscal` (11) | Facturás desde donde ya está la obra |
| **Adicionales** | Presupuestos adicionales colgados del base, con coeficientes propios | dentro del cotizador | El adicional no rompe el presupuesto original |
| **Asistente** | Chatbot que explica cómo hacer cada cosa del sistema | `components/Asistente.jsx` | Baja el costo de aprender a usarlo |
| **Presentación** | La página de venta animada, `/presentacion` | `pages/Presentacion.jsx` | Es el material de venta, no una sección del producto |
| **Admin de plataforma** | Alta de tenants, catálogo global, pagos | `AdminSuperPanel.jsx` · API `/admin` (29) | Interno |
| **Suscripción** | Cobro mensual por MercadoPago | API `/suscripcion` (5) | Interno |

## Quién ve qué

- **Estudio** (`admin` / `personal`) — todo el sistema. Login con email y clave.
- **Cliente** — solo el portal, y solo las secciones y presupuestos que el
  estudio le habilitó en Accesos de Clientes. Es de lectura, salvo aceptar el
  contrato y dejar consultas.
- **Admin de plataforma** — nosotros. Catálogo global, tenants, pagos.

Todo filtra por `tenant_id`. **Siempre.** Un endpoint nuevo que no filtre por
tenant es una fuga de datos entre estudios, no un bug de conveniencia.

---

## Cómo están los datos

Global (lo nuestro, compartido) vs. por tenant (lo de cada estudio):

- **`g_*`** — catálogo global: ítems de obra, materiales, unidades de mano de
  obra, maquinaria, y las líneas de composición de cada análisis.
- **`t_*`** — del tenant: presupuestos, líneas, certificados, clientes, semanas
  financieras, perfiles fiscales, tareas de Gantt y planner, cargas sociales.
- **`t_override_*`** — el puente: un tenant puede pisar el análisis global de un
  ítem sin tocar el catálogo de los demás.
- **`admin_*`**, **`anuncios`**, **`t_actividad`** — plataforma.

42 tablas, 215 endpoints. La densidad está en `/presupuestos` (71), que es
coherente con que el presupuesto sea la columna vertebral.

---

## Estado real (11/08/2026)

| | |
|---|---|
| Estudios usando el sistema | **5** |
| Presupuestos cargados | 25 |
| Certificados emitidos | 4 |
| Ítems de obra activos | 436 (554 con los de baja lógica) |
| Materiales activos | 829, fechados al 07/08/2026 |
| Categorías / maquinaria / unidades de MO | 21 / 26 / 14 |

**Estos son los números que se pueden publicar** (436 ítems, 829 materiales): son
del catálogo global, del sistema, no de ningún estudio. Lo que nunca sale en
material público es un dato de tenant: nombres de obras, de clientes, o montos.

## Lo que existe pero nadie usa

Es el patrón que más se repite en este código y conviene revisarlo antes de
«agregar» algo que quizás ya está: **funciones completas en el backend sin
ninguna UI que las llame.** Los vínculos entre tareas del Gantt, soltar una
tarea anclada y cambiar el tipo de vínculo estuvieron meses deployados y muertos.

Al 11/08/2026, en producción: **0 vínculos entre tareas y 0 horas de mano de obra
cargadas** en todos los tenants. Es decir, el planificador automático — que es de
lo mejor que tiene el producto y lo que se vende en el reel — no lo estaba usando
nadie porque la UI para cargarlo no existía. Ya está la UI; falta que los
estudios regeneren sus Gantts (`↺ Regenerar` o `⏱ Horas`) para que tome efecto,
porque deliberadamente no se hizo backfill sobre datos de nadie.

**Antes de dar algo por faltante, buscá el endpoint.** Suele estar.

---

## El material comercial que ya está hecho

| Dónde | Qué hay |
|---|---|
| `instagram/textos.md` | 32 publicaciones para 2 meses, con el eje de cada una (Dolor / Datos / Producto / Criterio) + historias |
| `instagram/orden-de-publicacion.md` | En qué orden publicarlas arrancando sin contenido educativo |
| `instagram/*.html` | Carrusel, perfil, estrategia, historias, placas y 7 guiones de reel |
| `whatsapp/README.md` | **Cómo se produce**: el pipeline de placas, reels y locución, y cómo correrlo en otra PC |
| `whatsapp/reel-venta.html` | El reel de venta de Instagram (66,7 s) |
| `whatsapp/locucion-venta.py` | La locución con edge-tts, narrada en bloques |
| `whatsapp/out/` | Los MP4 y PNG renderizados (no se versionan: se regeneran en dos comandos) |
| `src/pages/Presentacion.jsx` | La página de venta, animada |

Los cuatro ángulos que ya están probados en el guion del reel, por si hay que
escribir algo nuevo que suene igual:

1. **No sabés cuánto ganaste.** El dolor de entrada, y el más honesto.
2. **El Excel se rompe.** `#¡REF!`, el fin de semana perdido.
3. **Cotizás con precios de hace seis meses.** En Argentina esto duele solo.
4. **El cliente te llama para preguntar cómo va.** El portal se vende solo acá.

## Pendientes abiertos

- **Ctrl+Z, segunda tanda.** Ya anda en el Gantt (vínculos incluidos). Falta:
  arrastre de tareas, edición en el modal, agregar ítem y renombrar en el
  presupuesto.
- **Cargas sociales.** Se siembra un default de UOCRA que suma exactamente
  65,00%. Federico tiene que compararlo contra los valores reales de fimaestudio.
- **Ajuste cuatrimestral de precio de la suscripción.** Sin verificar: no sé si
  MercadoPago deja subir el monto de una suscripción viva sin que el usuario
  vuelva a autorizar. Hay que confirmarlo antes de prometerlo.
- **Gantts existentes.** Necesitan `↺ Regenerar` para que tomen el arreglo de
  horas. Sin backfill, a propósito.
- **`C:\obras-backend` tiene 55 scripts `fix_*.py` sueltos en la raíz.** Son
  parches de una vez, ya aplicados. Ensucian la lectura del repo y ninguno se
  vuelve a correr.

---

## Cómo se toca cada cosa

| | |
|---|---|
| **Frontend** | `npm run build` (tiene que pasar) → `git push` → Vercel deploya solo |
| **Backend** | `C:\obras-backend`, **no es repo git** → `railway up --detach` |
| **Consultar producción** | `railway ssh "python -c ..."` desde `C:\obras-backend`. `railway run` **no** sirve: `DATABASE_URL` apunta a `postgres.railway.internal` |
| **Migraciones** | Inline en el `lifespan` de FastAPI. Las de datos van marcadas en `_migraciones_datos` para que corran una sola vez y no pisen ediciones del admin |
| **Contenido** | `node whatsapp/render.mjs venta`, `py -3.12 whatsapp/locucion-venta.py`. Ver `whatsapp/README.md` |
| **FIMA** (`fimaestudio.com`) | Otro producto, otro deploy: frontend `vercel --prod` (el git está muerto), backend `railway up` en `spirited-vision`. Data crítica: solo migraciones aditivas |

**La regla que manda sobre todas**: hay cinco estudios trabajando con esto todos
los días. Ningún cambio puede tocar los datos que ya cargaron.
