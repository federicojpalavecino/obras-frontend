# -*- coding: utf-8 -*-
"""
Locución del reel de venta, con voces neuronales de Microsoft (edge-tts).

    py -3.12 whatsapp/locucion-venta.py            → voz + reel con audio
    py -3.12 whatsapp/locucion-venta.py voz        → solo los mp3
    py -3.12 whatsapp/locucion-venta.py --voz es-AR-TomasNeural

POR QUÉ EDGE-TTS Y NO KOKORO
El reel anterior usaba Kokoro. En inglés está bien, pero en español rioplatense
le sale un timbre metálico y una prosodia plana: entona todas las frases igual y
no respeta las preguntas, que es justo lo que hace este guion. edge-tts usa las
voces neuronales de Microsoft, que tienen es-AR de verdad — Elena y Tomás — con
acento argentino y entonación de pregunta. Es gratis y no necesita clave.

CÓMO SUENA MÁS HUMANO
1. Frases cortas, de una idea. Una frase larga la lee de corrido y se nota.
2. Velocidad apenas por debajo de la normal: en 0% suena leyendo un cartel.
3. Los números escritos en palabras. "436" lo dice "cuatro tres seis".
4. Silencios de verdad entre frases, no una pista continua: cada frase entra en
   su segundo exacto del video, así respira donde respira la imagen.
"""
import sys, asyncio, subprocess, shutil
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DIR   = Path(__file__).parent
OUT   = DIR / "out"
VOZ   = OUT / "voz-venta"
REEL  = OUT / "faim-obras-venta.mp4"
FINAL = OUT / "faim-obras-venta-voz.mp4"

VOZ_DEF = "es-AR-ElenaNeural"   # la otra: es-AR-TomasNeural

# (segundo de arranque, texto, velocidad)
# Los tiempos siguen la línea de tiempo de reel-venta.html.
#
# El primer guion tenía 54 segundos de voz metidos en 33 de video: catorce de
# quince frases se pisaban con la siguiente. Se acortó a una idea por placa. La
# duración del video sale de acá, no al revés — `py locucion-venta.py plan`
# imprime la línea de tiempo que tiene que tener el HTML.
GUION = [
    (0.60,  "¿Cuánto ganaste en tu última obra?",                "-6%"),
    (4.50,  "¿Seguro?",                                          "-12%"),
    (8.20,  "Tercer fin de semana con el mismo Excel.",          "-6%"),
    (14.80, "Y cotizás con precios que ya no existen.",          "-4%"),
    (20.70, "Hay otra forma.",                                   "-10%"),
    (25.20, "Cuatrocientos treinta y seis ítems ya analizados.", "-3%"),
    (32.60, "Cambiás un precio y se recalcula todo.",            "-4%"),
    (39.20, "Sumás gente y te da la fecha nueva.",               "-4%"),
    (45.50, "Tu cliente ve el avance solo.",                     "-5%"),
    (50.60, "Cotizá tu próxima obra en minutos.",                "-6%"),
]

def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe: return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

async def sintetizar(voz):
    import edge_tts
    VOZ.mkdir(parents=True, exist_ok=True)
    for i, (t, texto, rate) in enumerate(GUION):
        destino = VOZ / f"f{i:02d}.mp3"
        com = edge_tts.Communicate(texto, voz, rate=rate)
        await com.save(str(destino))
        print(f"  {t:5.2f}s  {rate:>5}  {texto}")
    print(f"\n{len(GUION)} frases → {VOZ}")

def duracion(mp3):
    """Segundos reales del mp3. Se decodifica a wav porque imageio-ffmpeg trae
    ffmpeg pero no ffprobe, y estimar por tamaño de archivo da cualquier cosa."""
    import wave, tempfile
    w = Path(tempfile.gettempdir()) / "_dur.wav"
    subprocess.run([ffmpeg_exe(), "-y", "-v", "quiet", "-i", str(mp3), str(w)], check=True)
    with wave.open(str(w)) as f:
        return f.getnframes() / f.getframerate()

def plan():
    """Comprueba que ninguna frase pise a la siguiente e imprime la línea de
    tiempo que tiene que tener reel-venta.html."""
    print(f'{"inicio":>7} {"dura":>6} {"fin":>7} {"aire":>6}  frase')
    choques = 0
    for i, (t, txt, _) in enumerate(GUION):
        d = duracion(VOZ / f"f{i:02d}.mp3")
        fin = t + d
        sig = GUION[i + 1][0] if i + 1 < len(GUION) else fin + 0.9
        aire = sig - fin
        if aire < 0.15: choques += 1
        print(f'{t:7.2f} {d:6.2f} {fin:7.2f} {aire:6.2f}  {txt[:44]}'
              f'{"   <-- SE PISA" if aire < 0.15 else ""}')
    total = GUION[-1][0] + duracion(VOZ / f"f{len(GUION)-1:02d}.mp3") + 0.9
    print(f"\nfrases que se pisan: {choques}")
    print(f"DURACION que tiene que tener el reel: {total:.1f}s")

def montar():
    """Pega cada frase en su segundo exacto y la mezcla con el video."""
    if not REEL.exists():
        sys.exit(f"Falta el video: {REEL}\nCorré primero: node whatsapp/render.mjs venta")
    entradas, filtros, etiquetas = [], [], []
    for i, (t, _, _) in enumerate(GUION):
        mp3 = VOZ / f"f{i:02d}.mp3"
        if not mp3.exists(): sys.exit(f"Falta {mp3}. Corré el modo 'voz' primero.")
        entradas += ["-i", str(mp3)]
        ms = int(round(t * 1000))
        filtros.append(f"[{i+1}:a]adelay={ms}|{ms}[a{i}]")
        etiquetas.append(f"[a{i}]")
    # normalize=0: sin esto amix baja el volumen de cada frase a 1/N y la voz
    # queda inaudible contra la música que se le agregue después en Instagram.
    filtros.append("".join(etiquetas) + f"amix=inputs={len(GUION)}:normalize=0[voz]")
    cmd = [ffmpeg_exe(), "-y", "-i", str(REEL), *entradas,
           "-filter_complex", ";".join(filtros),
           "-map", "0:v", "-map", "[voz]",
           "-c:v", "copy", "-c:a", "aac", "-b:a", "160k",
           "-shortest", str(FINAL)]
    r = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    if r.returncode != 0:
        print(r.stderr[-2500:]); sys.exit("ffmpeg falló")
    print(f"\nReel con voz → {FINAL}")

if __name__ == "__main__":
    args = sys.argv[1:]
    voz = VOZ_DEF
    if "--voz" in args:
        voz = args[args.index("--voz") + 1]
        args = [a for a in args if a != "--voz" and a != voz]
    modo = (args[0] if args else "todo").lower()
    print(f"Voz: {voz}\n")
    if modo in ("todo", "voz"):
        asyncio.run(sintetizar(voz))
    if modo in ("todo", "voz", "plan"):
        plan()
    if modo in ("todo", "montar"):
        montar()
