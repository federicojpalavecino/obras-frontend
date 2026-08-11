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
1. Bloques narrados, no frases sueltas (ver el comentario largo sobre GUION).
2. Velocidad apenas por debajo de la normal: en 0% suena leyendo un cartel.
3. Los números escritos en palabras. "436" lo dice "cuatro tres seis".
4. Silencios de verdad entre bloques, no una pista continua: cada uno entra en
   su segundo exacto del video, así respira donde respira la imagen.
5. Tono distinto por bloque: las preguntas suben, el giro baja.
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

# (segundo de arranque, texto, velocidad, tono)
#
# CÓMO SE CONSIGUE QUE SUENE A NARRACIÓN Y NO A CARTELES LEÍDOS
#
# 1. Bloques, no frases sueltas. El motor planifica la entonación sobre TODA la
#    tirada que le das: si le pasás "Tercer fin de semana con el mismo Excel." y
#    aparte "Tocás una fila, se rompe una fórmula.", las lee como dos carteles,
#    las dos con la misma curva y las dos terminando para abajo. Juntas en un
#    solo bloque, la primera queda suspendida y la segunda cierra — que es como
#    habla alguien contando algo. Por eso los bloques cruzan los cambios de
#    placa a propósito: la idea termina después de que entró la imagen que
#    sigue, y eso es justamente lo que amarra una escena con la otra.
#
# 2. Puntuación de respiración, no de gramática. La coma y los puntos suspensivos
#    son las únicas herramientas de fraseo que hay: "Lo cambiás una vez, y se
#    recalculan todos" respira distinto que la misma frase sin coma.
#
# 3. Tono por bloque. Las preguntas suben un poco; el giro ("pero hay otra
#    forma") baja y afloja. Sin ese contraste todo queda en la misma nota y ahí
#    es donde suena a robot, aunque la voz sea neuronal.
GUION = [
    (0.60,  "¿Cuánto ganaste en tu última obra?",
     "-8%",  "+8Hz"),
    (5.00,  "En serio... ¿lo sabés?",
     "-16%", "-8Hz"),
    (9.00,  "Tercer fin de semana con el mismo Excel. Tocás una fila, "
            "y se te rompe una fórmula.",
     "-7%",  "-2Hz"),
    (17.40, "Y encima estás cotizando con precios que ya no existen. "
            "Así, cada obra la arrancás perdiendo.",
     "-6%",  "-4Hz"),
    (26.40, "Pero hay otra forma de hacerlo.",
     "-14%", "-6Hz"),
    (30.40, "Cuatrocientos treinta y seis ítems, con el análisis ya cargado. "
            "Elegís, computás, y el precio sale solo.",
     "-5%",  "+2Hz"),
    (40.80, "¿Subió el hierro? Lo cambiás una vez, y se te recalculan "
            "todos los presupuestos.",
     "-5%",  "+4Hz"),
    (48.80, "El plazo ya no lo estimás a ojo: sumás gente, y te da la fecha nueva.",
     "-5%",  "+0Hz"),
    (55.80, "Y tu cliente, en vez de llamarte, entra y ve el avance solo.",
     "-6%",  "-2Hz"),
    (62.20, "Cotizá tu próxima obra en minutos.",
     "-9%",  "-4Hz"),
]

def ffmpeg_exe():
    exe = shutil.which("ffmpeg")
    if exe: return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()

async def sintetizar(voz):
    import edge_tts
    VOZ.mkdir(parents=True, exist_ok=True)
    for i, (t, texto, rate, pitch) in enumerate(GUION):
        destino = VOZ / f"f{i:02d}.mp3"
        com = edge_tts.Communicate(texto, voz, rate=rate, pitch=pitch)
        await com.save(str(destino))
        print(f"  {t:5.2f}s  {rate:>5} {pitch:>5}  {texto[:62]}")
    print(f"\n{len(GUION)} frases → {VOZ}")

def duracion(mp3):
    """Segundos reales del mp3. Se decodifica a wav porque imageio-ffmpeg trae
    ffmpeg pero no ffprobe, y estimar por tamaño de archivo da cualquier cosa."""
    import wave, tempfile
    w = Path(tempfile.gettempdir()) / "_dur.wav"
    subprocess.run([ffmpeg_exe(), "-y", "-v", "quiet", "-i", str(mp3), str(w)], check=True)
    with wave.open(str(w)) as f:
        return f.getnframes() / f.getframerate()

def duracion_video():
    """Segundos del reel, leídos del propio HTML (window.DURACION).

    Se lee de ahí y no del mp4 porque imageio-ffmpeg no trae ffprobe y decodificar
    56 s de video solo para saber cuánto dura es una barbaridad.
    """
    import re
    html = (DIR / "reel-venta.html").read_text(encoding="utf-8")
    m = re.search(r"const\s+DURACION\s*=\s*([\d.]+)", html)
    if not m: sys.exit("No encontré DURACION en reel-venta.html")
    return float(m.group(1))

def plan():
    """Comprueba que ninguna frase pise a la siguiente e imprime la línea de
    tiempo que tiene que tener reel-venta.html."""
    print(f'{"inicio":>7} {"dura":>6} {"fin":>7} {"aire":>6}  frase')
    choques = 0
    for i, (t, txt, *_) in enumerate(GUION):
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
    for i, (t, *_) in enumerate(GUION):
        mp3 = VOZ / f"f{i:02d}.mp3"
        if not mp3.exists(): sys.exit(f"Falta {mp3}. Corré el modo 'voz' primero.")
        entradas += ["-i", str(mp3)]
        ms = int(round(t * 1000))
        filtros.append(f"[{i+1}:a]adelay={ms}|{ms}[a{i}]")
        etiquetas.append(f"[a{i}]")
    # normalize=0: sin esto amix baja el volumen de cada frase a 1/N y la voz
    # queda inaudible contra la música que se le agregue después en Instagram.
    # La voz termina con la última frase, antes que el video. Sin rellenar,
    # -shortest corta el video ahí y se come el cierre (quedaba en 54,1 s en vez
    # de 55,8 y se perdía la placa del contacto). apad rellena con silencio, pero
    # rellena INFINITO: hay que decirle hasta dónde con whole_dur, o ffmpeg se
    # queda generando silencio para siempre.
    filtros.append("".join(etiquetas) + f"amix=inputs={len(GUION)}:normalize=0[mix]")
    filtros.append(f"[mix]apad=whole_dur={duracion_video()}[voz]")
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
