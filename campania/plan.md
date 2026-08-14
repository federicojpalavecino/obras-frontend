# Campaña de captación — llegar a estudios nuevos

A quién le hablamos: **el arquitecto o ingeniero que hoy cotiza en Excel** y
todavía no nos conoce. No es el que ya usa el sistema — para ese está el mail de
novedades en `mails/`.

## La idea que sostiene todo

Un estudio no cambia de herramienta porque le muestren funciones. Cambia cuando
alguien **le nombra un dolor que tiene y no sabía que era evitable**. Por eso
cada pieza de producto va precedida por la pieza del dolor que resuelve, y nunca
hay dos de producto seguidas.

Los cuatro dolores que elegimos son los que un estudio chico siente todas las
semanas:

| Dolor | Lo que responde |
|---|---|
| Cotizar bien lleva días | El catálogo con 436 análisis ya cargados |
| El plazo se estima a ojo | El plazo sale de las horas del propio análisis |
| No sabés cuánto ganaste | El control financiero por obra |
| El cliente llama para preguntar | El portal donde ve el avance solo |

## Qué se produce

| Formato | Cuántas | Medida | Archivo |
|---|---|---|---|
| Publicaciones de feed | 8 | 1080×1350 | `posts.html` |
| Historias | 6 | 1080×1920 | `historias.html` |
| Reels | 2 | 1080×1920 · video | `reels.html` |

Todo se rinde con **`node whatsapp/render.mjs campania`** y sale en
`whatsapp/out/campania/`.

## Calendario — 4 semanas, 3 publicaciones por semana

El ritmo es lunes, miércoles y viernes. Las historias van sueltas los días de por
medio, para que la cuenta no quede muda entre publicación y publicación.

### Semana 1 — el dolor de cotizar

| Día | Pieza | Por qué acá |
|---|---|---|
| Lunes | `post-01` Cotizar bien te lleva dos días | Abre nombrando el dolor más universal. Sin producto todavía. |
| Miércoles | `post-02` 436 ítems ya vienen con su análisis | La respuesta concreta, con dato duro. |
| Viernes | `reel-cadena` De la cotización al certificado | El reel muestra el sistema entero en 12 segundos. |

Historias esta semana: `h-01` (encuesta: ¿cuánto tardás en cotizar?) el martes,
`h-02` (la respuesta + el dato) el jueves.

### Semana 2 — el plazo

| Día | Pieza | Por qué acá |
|---|---|---|
| Lunes | `post-03` El plazo lo estimás a ojo | Segundo dolor, más específico que el primero. |
| Miércoles | `post-04` El plazo sale de tus propias horas | La respuesta. |
| Viernes | `post-05` Sumás gente y la fecha se mueve sola | El detalle que sorprende en las demos. |

Historias: `h-03` (el Gantt) el martes.

### Semana 3 — la plata

| Día | Pieza | Por qué acá |
|---|---|---|
| Lunes | `post-06` ¿Cuánto ganaste en tu última obra? | El dolor más incómodo. Va acá, cuando ya hay confianza. |
| Miércoles | `reel-ganancia` La plata de la obra entra sola | El reel responde la pregunta del lunes. |
| Viernes | `post-07` Tu cliente entra y ve el avance solo | Cuarto dolor y su respuesta, juntos. |

Historias: `h-04` (control financiero) el martes, `h-05` (portal del cliente) el jueves.

### Semana 4 — la invitación

| Día | Pieza | Por qué acá |
|---|---|---|
| Lunes | `post-08` Veámoslo con una obra tuya | Recién ahora pedir la demo no suena a frío. |
| Miércoles | Repetir `reel-cadena` | El de mejor alcance, a audiencia ya calentada. |
| Viernes | Historia `h-06` con sticker de link | Cierre con el WhatsApp. |

## Reglas para no arruinarlo

**Nada de datos de un estudio real.** Todas las obras, clientes y montos que
aparecen son inventados. Las capturas de pantalla del sistema con datos de un
tenant no se publican, ni tapadas.

**El reel de la cadena es el que más rinde.** Si hay que elegir una sola pieza
para pautar, es esa: muestra el producto entero sin pedirle al que mira que
imagine nada.

**La historia con sticker de link va sola.** El link se agrega desde la app de
Instagram, no viene en la imagen.
