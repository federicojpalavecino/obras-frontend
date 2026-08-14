# Campaña de captación — llegar a estudios nuevos

A quién le hablamos: **el arquitecto o ingeniero que hoy cotiza en Excel** y
todavía no nos conoce. No es el que ya usa el sistema — para ese está el mail de
novedades en `mails/`.

## La idea que sostiene todo

Un estudio no cambia de herramienta porque le muestren funciones. Cambia cuando
alguien **le nombra un dolor que tiene y no sabía que era evitable**. Por eso
cada pieza de producto va precedida por la pieza del dolor que resuelve, y nunca
hay dos de producto seguidas.

| Dolor | Lo que responde |
|---|---|
| Cotizar bien lleva días | El catálogo con 436 análisis ya cargados |
| El plazo se estima a ojo | El plazo sale de las horas del propio análisis |
| Al corralón vas de memoria | El listado de materiales, en bolsas |
| No sabés cuándo va a faltar plata | La curva de inversión |
| No sabés cuánto ganaste | El control financiero por obra |
| El cliente llama para preguntar | El portal donde ve el avance solo |

## Qué se produce

| Formato | Cuántas | Medida | Archivo |
|---|---|---|---|
| Publicaciones de feed | 11 | 1080×1350 | `posts.html` |
| Historias | 6 | 1080×1920 | `historias.html` |
| Reels | 5 | 1080×1920 · video | `reels.html` |

Todo con **`node whatsapp/render.mjs campania`** → `whatsapp/out/campania/`.

**El peso está puesto en video a propósito.** Instagram distribuye los reels
mucho más que las imágenes fijas, así que las cinco piezas de mayor alcance
esperado son las animadas. Las fijas sostienen el perfil entre reel y reel.

| Reel | Dura | Qué muestra |
|---|---|---|
| `reel-cadena` | 12,0 s | Un token baja por los cinco módulos, encendiéndolos |
| `reel-catalogo` | 8,0 s | El contador corre a 436 con los nombres pasando |
| `reel-materiales` | 9,5 s | Los kilos se tachan y aparecen las bolsas |
| `reel-curva` | 10,0 s | Las barras crecen y el acumulado se dibuja |
| `reel-ganancia` | 9,5 s | Los movimientos entran y sale el resultado |

## Calendario — 6 semanas, 3 publicaciones por semana

Ritmo lunes, miércoles y viernes. Las historias van los días del medio para que
la cuenta no quede muda entre publicación y publicación.

| Semana | Lunes | Miércoles | Viernes | Historias |
|---|---|---|---|---|
| **1 — cotizar** | `post-01` Te lleva dos días | `post-02` 436 ítems | `reel-cadena` | `h-01` mar · `h-02` jue |
| **2 — el plazo** | `post-03` ¿A ojo? | `post-04` De tus propias horas | `post-05` Sumás gente | `h-03` mar |
| **3 — comprar** | `post-09` Al corralón de memoria | `reel-materiales` | `post-10` En bolsas, no en kilos | — |
| **4 — la caja** | `reel-curva` | `post-06` ¿Cuánto ganaste? | `reel-ganancia` | `h-04` mar |
| **5 — el cliente** | `post-07` Cada peso imputado | `post-11` Ve el avance solo | `reel-catalogo` | `h-05` jue |
| **6 — la invitación** | `post-08` Veámoslo con una obra tuya | Repetir `reel-cadena` | `h-06` con sticker de link | — |

**Por qué la curva abre la semana 4.** «Cuándo te va a faltar plata» es una
pregunta que el estudio se hace antes que «cuánto gané»: una es de supervivencia
y la otra es de balance. Primero la angustia, después la cuenta.

**Por qué el catálogo va tan tarde.** Es la pieza más de producto de todas. En la
semana 5 ya hay contexto suficiente para que el número impresione en vez de
sonar a folleto.

## Reglas para no arruinarlo

**Nada de datos de un estudio real.** Todas las obras, clientes y montos que
aparecen son inventados. Las capturas del sistema con datos de un tenant no se
publican, ni tapadas.

**Si hay que pautar una sola pieza, es `reel-cadena`.** Muestra el producto
entero sin pedirle al que mira que imagine nada.

**La historia con sticker de link va sola.** El link se agrega desde la app de
Instagram, no viene en la imagen.

## Foto de perfil

`node whatsapp/render.mjs perfil 1` exporta la variante recomendada a 1080×1080
desde `instagram/perfil.html`. Las cuatro variantes se comparan ahí.
