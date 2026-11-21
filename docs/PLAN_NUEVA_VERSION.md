# FAIM OBRAS — Plan para la próxima versión

Encargado por Federico el 2026-11-21: analizar todo el sistema (lo que hay y lo
que falta) y dejar un plan para que **Codex** lo ejecute. Objetivo declarado:
que FAIM sea **el sistema número uno para presupuestar y gestionar obras** —
más intuitivo, más fácil de usar, más óptimo que lo que es hoy.

Este documento es un plan de trabajo, no una decisión cerrada. Antes de
arrancar una fase, confirmar con Federico — en particular las fases 3 y 4,
que son features nuevas con costo de mantenimiento futuro, no fixes.

---

## 0. Lo que no se toca (leer antes que nada)

Esto viene de `CLAUDE.md` y de memoria del proyecto, y aplica igual acá:

- **Hay cinco estudios reales usando el sistema todos los días con datos
  reales.** Ningún cambio de esta lista puede tocar, migrar ni recalcular datos
  que ya cargaron. Migraciones siempre aditivas. Nada de backfills sobre datos
  de tenant sin pedirlo explícitamente.
- Todo filtra por `tenant_id`, siempre. Un endpoint nuevo que no filtre por
  tenant es una fuga de datos entre estudios, no un bug menor.
- El **presupuesto es la columna vertebral** (ver `docs/MAPA.md`): certificados,
  Gantt, curva de inversión, listado de materiales y gestión de obra cuelgan
  de un único presupuesto cargado una vez. Esa arquitectura es la ventaja real
  contra un Excel y contra varios competidores que mantienen presupuesto y
  programación en herramientas separadas que se desincronizan solas — **no
  diluirla** agregando features que vuelvan a partir la fuente de verdad.
- El análisis de costo real (materiales + mano de obra + maquinaria por ítem,
  no precio a ojo) es el segundo diferenciador. Cualquier feature nueva de
  presupuestación tiene que seguir saliendo de ahí, no de un número tipeado.
- Antes de dar algo por faltante, **buscar el endpoint** — el patrón más común
  en este código es backend completo sin UI que lo llame (ver "Lo que existe
  pero nadie usa" en `docs/MAPA.md`: los vínculos del Gantt estuvieron
  deployados y muertos meses porque la UI para cargarlos no existía).
- Estilo ya establecido: estilos inline, sin CSS modules ni TypeScript, Syne +
  IBM Plex Mono, paleta `C` repetida en cada archivo, iconos de `lucide-react`
  (nunca emojis en la UI — ver `feedback-iconos-sin-emojis` en memoria, el
  usuario lo pidió explícitamente porque emojis en botones "se ven infantiles
  y poco profesional").

---

## 1. Qué tiene FAIM hoy (resumen para quien no leyó `docs/MAPA.md`)

Un estudio carga un presupuesto con ítems de un catálogo de análisis de costo
real (materiales + mano de obra + maquinaria, editable por tenant). De ese
mismo presupuesto salen: certificados de avance, el plazo de obra (Gantt
automático: horas de mano de obra ÷ horas-día × personas), la curva de
inversión, el listado de materiales a comprar, la gestión de obra completa
(contrato, cobros, subcontratos, compras, pañol, personal) y un portal donde
el cliente ve su avance sin llamar. Multi-tenant, con catálogo global y
override por estudio. Expansión a México en curso (ver `PLAN_MEXICO.md` en
`C:\obras-mexico`), con Paddle como medio de pago internacional.

Esto funciona y hay que preservarlo. Lo que sigue es dónde se puede mejorar.

---

## 2. Diagnóstico — problemas concretos ya encontrados

No son hipótesis: son cosas verificadas en el código o resueltas hoy mismo en
esta sesión, que sirven de síntoma de un patrón más amplio.

### 2.1 Archivos monolíticos — la causa raíz de la mayoría de los bugs

```
Obra.jsx               3120 líneas
Gantt.jsx              2960 líneas
Presupuesto.js         2628 líneas
AdminSuperPanel.jsx    1652 líneas
ControlFinanciero.jsx  1455 líneas
Certificado.js         1201 líneas
```

Cada uno mezcla fetch de datos, lógica de negocio y JSX con estilos inline en
un solo archivo. `CLAUDE.md` ya lo marca como la trampa conocida número uno
("el balance de tags JSX es la causa número uno de errores de compilación").
Consecuencias prácticas, no teóricas:

- Cambios chicos (como el de hoy: mover un ítem dentro de un rubro) requieren
  tocar un archivo de 2600 líneas y verificar que no se rompió nada alrededor.
- Bugs de UX se esconden fácil: hoy mismo apareció que la tabla de cuentas del
  admin se cortaba en el celu porque el layout nunca se pensó para pantallas
  chicas — típico de un archivo tan largo que nadie lo revisa entero de nuevo.
- Nuevas personas (incluido Codex en sesiones futuras) tardan más en entender
  el archivo completo antes de poder tocar una parte con confianza.

**No es una reescritura.** Es dividir cada pantalla grande en subcomponentes
por sección (ej. `Obra.jsx` → `ObraResumen.jsx`, `ObraContrato.jsx`,
`ObraCobros.jsx`, `ObraSubcontratos.jsx`, `ObraCompras.jsx`, cada uno con su
propio estado local y props claras), sin cambiar comportamiento. Rehacer uno
por vez, verificar contra Simulación antes de cada deploy.

### 2.2 Errores crudos de base de datos llegando al usuario

Encontrado y arreglado hoy: borrar un ítem de presupuesto que ya estaba en un
certificado tiraba un `psycopg2.errors.ForeignKeyViolation` crudo en vez de un
mensaje entendible (ver el `@app.exception_handler(Exception)` genérico en
`main.py`, que buenamente evita que la app se caiga pero no reemplaza una
validación específica). Si pasó ahí, es razonable sospechar que hay más
lugares con el mismo patrón: una operación de borrado/edición que no revisó
todas las FKs que la bloquean.

**Tarea para Codex:** barrer los `DELETE`/`PATCH` de `main.py` buscando
`db.delete(`/`setattr` directos sin una verificación previa de FKs
dependientes, y agregar el mismo patrón que ya existe para certificados
(mensaje claro + opción de "forzar" cuando tiene sentido). Candidatos
probables: borrar un cliente con presupuestos asociados, borrar una obra con
cobros/compras cargadas, borrar un ítem de catálogo propio referenciado en
análisis existentes.

### 2.3 Responsividad mobile reactiva, no diseñada

El fix de hoy (tabla de cuentas del admin) reveló el patrón: hay reglas
`@media (max-width: 768px)` puntuales agregadas cuando algo se rompió, no un
diseño mobile-first. Dado que la gestión de obra y el portal del cliente son
justamente las pantallas que más se usan **desde el celu, en el sitio de
obra**, esto importa más que en un SaaS de escritorio típico.

**Tarea para Codex:** auditar las pantallas de uso más probable en el celu
(Obra.jsx, Gantt.jsx, Certificado.js, el portal del cliente, el portal del
personal) con el viewport achicado a 375px de ancho real (no solo revisar el
código) y arreglar lo que se corte o quede inalcanzable — mismo patrón que la
vista de tarjetas que se armó hoy para el admin.

### 2.4 Código muerto con un riesgo de seguridad menor

`src/pages/GestorProyectos.jsx` no está importado en ningún lado (no hay
ninguna ruta ni componente que lo use) y tiene un cliente de **Supabase
hardcodeado con su URL y su key pública**, de un proyecto que no es el actual
(FAIM migró a Railway/Postgres hace tiempo — ver `fima-fin-de-supabase` en
memoria, que documenta la migración del producto hermano). Es casi seguro un
resto de un prototipo viejo. No es una fuga crítica (es una key pública,
sujeta a las reglas RLS de ese proyecto Supabase, no una key privada), pero:

- Si ese proyecto Supabase sigue vivo y sus reglas de acceso son laxas, cualquiera
  que lea el bundle de producción puede leer/escribir esa tabla.
- Es ruido: confunde a quien lea el código pensando que FAIM todavía depende
  de Supabase en algún lado.

**Tarea para Codex:** confirmar con Federico que no se usa, borrar el archivo.
Si por alguna razón se usa fuera de este repo, al menos sacar las credenciales
hardcodeadas a una variable de entorno.

### 2.5 Terminología y defaults asumen Argentina en varios lugares más allá de México

La expansión a México (ver `PLAN_MEXICO.md`) ya destapó: IVA fijo en 21% por
default, "certificado" vs. "estimación", el modelo de honorarios atado al
"Valor K por colegio provincial" sin alternativa manual. Si mañana se suma un
tercer país, **el patrón ya está** (`PAISES_SOPORTADOS` en `main.py`,
`utils/pais.js` en el frontend) — nuevos países se agregan ahí, no reinventando
la rueda. Vale la pena, mientras se tocan pantallas por otras razones,
revisar si asumen Argentina en algo más (fechas en `es-AR` fijo que no pasan
por `localeDelTenant()`, términos de catálogo, etc.).

---

## 3. Lo que falta — comparado contra el resto del mercado

Investigado contra Procore, Fieldwire, Buildertrend/CoConstruct (más
orientados a constructoras residenciales, el segmento más parecido a los
estudios que usan FAIM) y lo disponible sobre DataObra/OPUS/Neodata en
Argentina y México. Ninguna fuente es 100% confiable (son blogs y
comparativas, varias de proveedores con interés propio) pero el patrón que
se repite en todas alcanza para confiar en la lista.

Ordenado por qué tan directamente compite con el "número uno" que se busca —
no por orden de implementación, eso está en la sección 5.

### 3.1 Bitácora de obra / diario de obra — **no existe hoy**

Es el registro cronológico del día a día de una obra: clima, personal
presente, avance cualitativo, incidentes, decisiones tomadas en el sitio.
Prácticamente todo competidor serio lo tiene (es el "daily log" de Procore,
el equivalente de Fieldwire). FAIM tiene Personal (asistencia) y Planner
(tareas), pero no un registro narrativo del día que quede como respaldo si
hay un reclamo del cliente o una discusión de plazos. Es, además, la fuente
natural de datos para alimentar fotos de avance y, eventualmente, reportes
automáticos de avance semanal para el cliente.

### 3.2 Fotos de avance estructuradas — **hoy es un cajón genérico**

`Archivos` (ver `docs/MAPA.md`) es upload/lista/borrado genérico por
presupuesto, planos y fotos mezclados sin estructura. Falta:
- Asociar una foto a una fecha, un ítem o rubro del presupuesto, y
  opcionalmente a una entrada de bitácora.
- Una vista tipo galería/timeline, no una lista de archivos.
- Comparación antes/después del mismo lugar.

Esto es además lo que hace del portal del cliente algo que se vende solo: hoy
el cliente ve avance en número (%) y certificados; ver fotos reales del
progreso es el salto de calidad que más impacto visual tiene para marketing
("tu cliente entra y ve fotos de su obra, no solo un porcentaje").

### 3.3 Punch list / lista de observaciones de cierre — **no existe**

El checklist de observaciones antes de la entrega final (qué falta terminar,
quién lo arregla, cuándo se vuelve a revisar). Estándar en todo competidor
investigado. Encaja naturalmente como una pantalla más dentro de `Obra.jsx`
(ya tiene "Planos" como tab — ver `TabBtn id="planos"` — un buen lugar
para una pestaña "Observaciones" al lado).

### 3.4 RFI / consultas técnicas formales — **parcialmente cubierto**

El portal del cliente ya tiene "consultas" (ver `docs/MAPA.md`: "...y dejar
consultas"), que cubre la comunicación cliente↔estudio. Lo que no existe es
el equivalente para contratista↔estudio (una duda técnica de un subcontratista
sobre un plano o una especificación, con respuesta y trazabilidad). Es menos
urgente que 3.1–3.3 porque el estudio ya tiene WhatsApp/llamada para esto en
la práctica — pero es justamente lo que un sistema "número uno" reemplaza:
la trazabilidad de "quién preguntó qué y cuándo se respondió" como
documento, no como un chat que se pierde.

### 3.5 Comparación de cotizaciones de subcontratistas — **no existe**

`Subcontratos` (dentro de `Obra.jsx`) controla lo que ya se le asignó y pagó
a un contratista, pero no hay una pantalla para cargar 2-3 cotizaciones de
distintos contratistas para el mismo trabajo y compararlas antes de elegir.
Esto conecta directo con el catálogo de análisis de costo que FAIM ya tiene:
la comparación podría mostrar automáticamente cuánto costaría ese ítem según
el análisis propio del estudio, al lado de lo que cada contratista cotizó —
algo que ningún competidor genérico puede ofrecer porque no tienen ese
catálogo de referencia.

### 3.6 Dashboard de cartera — **no existe, solo hay vista por obra**

`Menu.js` es un listado de presupuestos. No hay una vista consolidada de
"todas mis obras activas": cuáles están atrasadas según su Gantt, cuánto
falta cobrar en total, cuál tiene margen más bajo de lo esperado. El estudio
hoy tiene que entrar obra por obra para armarse ese panorama a mano.
`ControlFinanciero.jsx` ya agrega por semana/quincena/mes a nivel estudio —
es la base natural para sumarle una vista de riesgo/estado por obra, no
solo plata.

### 3.7 App / experiencia offline-first para el sitio de obra

FAIM es una web React normal. En el sitio de obra la conectividad es mala o
inexistente en muchos casos — es el motivo por el que Fieldwire y similares
invierten tanto en funcionar offline y sincronizar después. No hace falta una
app nativa para empezar: un PWA con cache de lo mínimo imprescindible (cargar
avance, sacar una foto, anotar en la bitácora) que sincroniza cuando vuelve la
señal ya cubriría el caso de uso real. Ver sección 5, Fase 3 — es una
inversión grande, no un quick win.

### 3.8 Importación de comprobantes/gastos por foto (OCR)

Cargar un gasto hoy es tipear monto, fecha y concepto a mano (`Control
Financiero`, `Compras`). Sacarle una foto a un ticket/factura y que cargue el
monto solo es un ahorro de fricción real y muy valorado en este tipo de
producto (es de las features que más se repiten en reviews de usuarios de
competidores). Candidato para Fase 3, atado a un proveedor de OCR (no hay que
construirlo desde cero).

### 3.9 Asistente: pasar de reglas fijas a routing inteligente, sin perder la garantía de datos reales

`Asistente.jsx` (ver `docs/MAPA.md`) es 100% determinístico: ~50 entradas de
conocimiento con keywords, y para preguntas de datos reales (cuánto me deben,
último certificado) pega contra los mismos endpoints que la UI, sin
inventar nada — es una decisión de diseño correcta y **no hay que perderla**:
un asistente que alucina un monto de plata es peor que no tener asistente.
El límite real es que solo entiende la pregunta si cae en alguna de sus
keywords armadas a mano; una pregunta formulada distinto no la encuentra.

**Propuesta, no decisión:** sumar una capa de routing por LLM **solo para
decidir qué intención tiene la pregunta** (cuál de los ~50 handlers
determinísticos corresponde, o si hay que mostrar las keywords más
parecidas), nunca para generar la respuesta final con datos de plata o de
obra — eso sigue saliendo de los mismos endpoints de siempre. Mismo patrón
que ya usa el bot comercial de WhatsApp (ahí sí llama a Claude, pero para
vender, no para citar números de una obra real).

### 3.10 Historial de precios y alertas de variación

El catálogo de materiales/mano de obra/maquinaria tiene el precio vigente,
pero no parece guardarse un historial (`backend-deploy` y las memorias de
catálogo no mencionan una tabla de histórico). Sin eso no se puede alertar
"este material subió 15% en el último mes" ni mostrar cómo evolucionó el
costo de una obra en el tiempo — algo que encaja perfecto con el eje de
marketing ya probado "cotizás con precios de hace seis meses, en Argentina
esto duele solo" (`docs/MAPA.md`). Es una tabla aditiva simple
(`precio_material_historico` con fecha, sin tocar lo existente) con mucho
potencial de reporte después.

### 3.11 Reportes PDF con marca propia más ricos

Certificados, presupuestos y recibos ya se imprimen con un estilo prolijo
(ver `faim-pagos-recibos` en memoria), pero son plantillas fijas. Un reporte
de avance mensual para el cliente con fotos, gráfico de curva de inversión y
resumen — armado automáticamente, no copiado a mano a un Word — es otro salto
de percepción de calidad para el cliente final, y reusa datos que el sistema
ya tiene (curva de inversión, certificados, fotos si se suma 3.2).

---

## 4. Principios de diseño para la nueva versión

No son features, son criterios para decidir cómo construir lo de arriba:

1. **Todo nace del presupuesto.** Ninguna feature nueva (bitácora, fotos,
   punch list, comparación de cotizaciones) puede vivir desconectada del
   presupuesto/obra al que pertenece. Si una feature nueva no puede
   responder "¿de qué obra es esto?", está mal diseñada para este producto.
2. **Mobile-first para todo lo que se usa en el sitio.** Bitácora, fotos,
   punch list y avance se cargan parado en una obra, no sentado en un
   escritorio. Diseñar esas pantallas para el celu primero, no adaptar
   después.
3. **Aditivo siempre, sobre datos de tenant.** Ninguna migración destructiva,
   ningún recalculo retroactivo de un presupuesto ya cerrado o un certificado
   ya emitido sin que el estudio lo pida explícitamente (ver el caso de la
   curva de inversión en FIMA, `faim-curva-inversion-bug-fechas`: un número
   ya entregado al cliente no cambia solo aunque el cálculo mejore).
4. **No reinventar lo que el catálogo de costos ya resuelve.** Comparación de
   cotizaciones, reportes de rentabilidad, alertas de precio: todo debería
   apoyarse en el análisis de costo real que FAIM ya tiene, que es la ventaja
   que un competidor genérico no tiene.
5. **El asistente nunca inventa un número.** Cualquier mejora de IA en el
   asistente mantiene la regla actual: los datos de plata/obra salen de los
   mismos endpoints que la UI, nunca de una generación libre del modelo.
6. **Archivos chicos, responsabilidad única.** Ninguna pantalla nueva arranca
   con la ambición de ser un archivo de 1500 líneas. Si una pantalla tiene
   más de 3-4 secciones claramente separables, son subcomponentes desde el
   día uno.

---

## 5. Plan por fases

### Fase 1 — Higiene y UX base (bajo riesgo, alto impacto, primero)

Sin features nuevas: arreglar lo que ya está construido para que la base sea
sólida antes de construir arriba.

1. Barrido de `DELETE`/`PATCH` sin validación de FKs (2.2).
2. Auditoría mobile de las pantallas de campo (2.3).
3. Borrar `GestorProyectos.jsx` (2.4), confirmando antes con Federico.
4. Partir `Obra.jsx` y `Gantt.jsx` en subcomponentes, uno por vez, sin cambiar
   comportamiento, verificando contra Simulación en cada paso (2.1).
5. Revisar defaults Argentina-céntricos restantes ahora que existe el patrón
   de `PAISES_SOPORTADOS` (2.5).

### Fase 2 — Las tres features que más faltan (impacto directo en "número uno")

En este orden, porque cada una habilita mejor a la siguiente:

1. **Bitácora de obra** (3.1) — tabla nueva `t_bitacora` (obra, fecha, autor,
   texto, clima opcional), pantalla dentro de `Obra.jsx`.
2. **Fotos de avance estructuradas** (3.2) — reusa `Archivos` pero le suma
   asociación a fecha/ítem/bitácora y una vista galería. El portal del
   cliente las muestra.
3. **Punch list** (3.3) — pestaña nueva en `Obra.jsx`, tabla simple
   (observación, responsable, estado, fecha límite, fecha resuelta).

### Fase 3 — Diferenciación (más costo, evaluar con Federico antes de arrancar)

1. Comparación de cotizaciones de subcontratistas contra el análisis propio
   (3.5).
2. Dashboard de cartera multi-obra (3.6).
3. Historial de precios + alertas de variación (3.10).
4. Reportes PDF enriquecidos con fotos y curva (3.11).

### Fase 4 — Apuestas grandes (evaluar costo/beneficio real antes de comprometerse)

1. PWA offline-first para bitácora/fotos/avance en el sitio (3.7).
2. OCR de comprobantes (3.8).
3. Routing por LLM en el asistente, sin tocar cómo responde con datos reales
   (3.9).
4. RFI formal contratista↔estudio (3.4) — queda último porque hoy se resuelve
   igual, aunque informalmente, por WhatsApp/llamada.

---

## 6. Cómo saber si funcionó

No "se ve más lindo" — medible:

- **Adopción real de lo nuevo**, no solo que esté deployado. El caso del
  Gantt (meses con 0 vínculos cargados pese a tener la función lista, ver
  `docs/MAPA.md`) es la advertencia: una feature sin que el estudio la use de
  verdad no sirve de nada. Medir uso real en producción a las 2-4 semanas de
  cada entrega de la Fase 2, no asumir que "ya está hecho" alcanza.
- **Menos reportes de "no se puede hacer X"** sobre los puntos de la Fase 1
  (errores crudos, mobile roto).
- **Tamaño de los archivos grandes bajando**, no creciendo, en cada PR que
  toque `Obra.jsx`/`Gantt.jsx`/`Presupuesto.js`.
- Para las features de cara al cliente (fotos, reportes): si se puede, pedirle
  a algún estudio piloto una devolución directa después de que su cliente las
  vea, no asumir que gustan.
