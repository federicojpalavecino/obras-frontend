# Contenido: placas, reels y locución

Todo lo que se publica sale de acá. Las fuentes son HTML y se renderizan a PNG y
MP4: no hay proyecto de edición ni archivo binario que mantener, así que cambiar
un texto es editar el HTML y volver a renderizar.

## Cómo correrlo en una máquina nueva

```bash
git clone https://github.com/federicojpalavecino/obras-frontend
cd obras-frontend
npm install                      # trae playwright
npx playwright install chromium  # el navegador que dibuja los cuadros
py -3.12 -m pip install edge-tts imageio-ffmpeg
```

`imageio-ffmpeg` trae el ffmpeg que usan los scripts, así que no hace falta
instalar ffmpeg aparte. Ojo: trae ffmpeg pero **no** ffprobe — por eso las
duraciones de audio se miden decodificando a wav y no con ffprobe.

## Qué corre qué

| Comando | Qué hace | Sale en |
|---|---|---|
| `node whatsapp/render.mjs placas` | Las placas de WhatsApp | `out/placa-*.png` |
| `node whatsapp/render.mjs reel` | Reel de WhatsApp (44 s) | `out/faim-obras-reel.mp4` |
| `node whatsapp/render.mjs venta` | Reel de venta de Instagram (55,8 s) | `out/faim-obras-venta.mp4` |
| `py -3.12 whatsapp/locucion-venta.py voz` | Los mp3 de cada frase | `out/voz-venta/` |
| `py -3.12 whatsapp/locucion-venta.py plan` | Mide los mp3 y avisa si dos frases se pisan | consola |
| `py -3.12 whatsapp/locucion-venta.py montar` | Pega la voz al video | `out/faim-obras-venta-voz.mp4` |

`out/` no se versiona: son megas de video que se regeneran en dos comandos.

## Cómo está armado un reel

El HTML dibuja un lienzo fijo de 1080×1920 y expone dos cosas:

- `window.DURACION` — segundos que dura.
- `window.setT(t)` — pinta el cuadro del segundo `t`.

`render.mjs` llama a `setT` cuadro por cuadro a 30 fps y le pasa cada captura a
ffmpeg. **Nada puede depender del reloj real ni de `requestAnimationFrame`**: si
una animación usa el tiempo del navegador, en el render sale congelada o
saltando. Todo se calcula a partir de `t`.

Para previsualizar, abrí el HTML en el navegador y tocá «Reproducir».

## La regla de oro del guion

**La duración del video sale de la locución, no al revés.** El primer guion del
reel de venta tenía 54 segundos de voz metidos en 33 de video: catorce de quince
frases se pisaban con la siguiente. El orden correcto es:

1. Escribir el `GUION` en `locucion-venta.py`.
2. `py -3.12 whatsapp/locucion-venta.py voz` — genera y mide.
3. Leer la línea que dice `DURACION que tiene que tener el reel`.
4. Ajustar `DURACION` y el array `ESC` del HTML a esos tiempos.
5. Renderizar y montar.

Cada placa tiene que quedar en pantalla **después** de que su frase terminó. Sin
ese aire el texto no se llega a leer, aunque la voz haya entrado justa.

## La voz

Se usa **edge-tts** (voces neuronales de Microsoft, gratis y sin clave). Las
argentinas son `es-AR-ElenaNeural` y `es-AR-TomasNeural`.

El reel viejo (`locucion.py`) usa Kokoro, que en español rioplatense sale
metálico y con todas las frases entonadas igual. Para contenido nuevo, edge-tts.

Lo que hace que suene humano y no a lector de carteles:

- Frases cortas, una idea cada una.
- Velocidad entre −3% y −12%; en 0% suena leyendo.
- Números escritos en palabras: «436» lo pronuncia «cuatro tres seis».
- Silencios reales entre frases: cada una entra en su segundo exacto del video,
  no es una pista continua.

## Regla de contenido

**Nunca datos de un tenant en material público.** Ni nombres de obras, ni de
clientes, ni montos reales de un estudio. Los rendimientos y precios del
catálogo global sí se pueden publicar: son del sistema, no de nadie en
particular. Está escrito también en `instagram/textos.md`.
