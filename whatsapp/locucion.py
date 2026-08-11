# -*- coding: utf-8 -*-
"""
Locución del reel de WhatsApp, con Kokoro.

    py -3.12 whatsapp/locucion.py            → voz + reel con audio
    py -3.12 whatsapp/locucion.py voz        → solo los wav
    py -3.12 whatsapp/locucion.py --voz em_alex

El guion está partido en frases, no en escenas. Una frase por placa hace que la
voz arranque y frene siete veces, y en cada corte queda un silencio que se nota
más que el corte mismo. Partido en frases, la narración cruza los cambios de
placa: una idea termina medio segundo después de que entró la placa siguiente,
que es como habla alguien explicando algo.

Cada frase tiene su segundo de arranque y llega hasta donde arranca la que sigue.
Kokoro deja aire al principio y al final de cada síntesis; ese aire se recorta,
si no las frases entran siempre tarde.
"""
import sys, subprocess, warnings
from pathlib import Path

warnings.filterwarnings("ignore")
# La consola de Windows arranca en cp1252 y se cuelga con cualquier acento.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DIR   = Path(__file__).parent
OUT   = DIR / "out"
VOZ   = OUT / "voz"
REEL  = OUT / "faim-obras-reel.mp4"
FINAL = OUT / "faim-obras-reel-voz.mp4"
DUR   = 44.0
SR    = 24000

# Voces en español de Kokoro: ef_dora (femenina), em_alex y em_santa (masculinas).
VOZ_DEF = "ef_dora"

# Por debajo de 1 suena explicando; en 1,0 suena leyendo. La variación por frase
# es mínima a propósito: alcanza para que el pulso no quede de metrónomo.
BASE  = 0.92
VARIA = [0.0, -0.03, 0.02, -0.01, 0.03, -0.02]

HUECO = 0.06     # aire mínimo entre frases
TOPE  = 1.04     # una frase acelerada suena apurada: mejor que avise y acortarla

# ── guion ────────────────────────────────────────────────────────────
# (id, escena, t_inicio, texto)
# Los tiempos salen de ESC en reel-wsp.html y de cuándo entra cada elemento.
FRASES = [
    ("f01", "E1 · dos días",      0.30, "Armar un presupuesto te lleva dos días."),
    ("f02", "E1 · catorce min",   2.95, "Acá lo tenés en catorce minutos, con el mismo detalle."),

    ("f03", "E2 · buscador",      6.75, "Buscás el ítem y el precio ya está."),
    ("f04", "E2 · composición",   9.20, "Cada uno trae sus materiales, su mano de obra y sus equipos."),
    ("f05", "E2 · coeficientes", 13.15, "Gastos generales, beneficio e iva: el total sale solo."),

    ("f06", "E3 · vinculado",    16.60, "Y eso lo cargás una sola vez: el mismo dato alimenta "
                                        "el cómputo, el gantt y los certificados."),

    ("f07", "E4 · el plazo",     23.20, "El plazo sale de tus propios rendimientos, "
                                        "con el camino crítico en rojo."),

    ("f08", "E5 · asistente",    27.90, "Y le preguntás al sistema: qué rinde una cuadrilla, "
                                        "cuánto te falta cobrar de tu obra."),

    ("f09", "E6 · comparativa",  34.05, "Lo mismo que hacías en excel, "
                                        "en una décima parte del tiempo."),

    ("f10", "E7 · cierre",       38.55, "Faim Obras: gestión integral para estudios. "
                                        "Cargamos tu próxima obra juntos."),
]


def ffmpeg_exe():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def recorta(audio, umbral=2e-3, aire=0.04):
    """Saca el silencio de los bordes y deja 40 ms de aire. Sin esto cada frase
    entra unos 250 ms tarde y el conjunto se siente arrastrado."""
    import numpy as np
    fuerte = np.abs(audio) > umbral
    if not fuerte.any():
        return audio
    i, j = np.argmax(fuerte), len(fuerte) - np.argmax(fuerte[::-1])
    pad = int(aire * SR)
    return audio[max(0, i - pad): min(len(audio), j + pad)]


def sintetiza(pipeline, texto, voz, speed):
    import numpy as np
    trozos = [g.audio.numpy() for g in pipeline(texto, voice=voz, speed=speed)]
    audio = np.concatenate(trozos) if len(trozos) > 1 else trozos[0]
    return recorta(audio)


def genera_voz(voz):
    import soundfile as sf
    from kokoro import KPipeline
    from misaki.espeak import EspeakG2P

    VOZ.mkdir(parents=True, exist_ok=True)
    pipeline = KPipeline(lang_code="e")   # 'e' = español
    # Kokoro fonemiza con el español de España: "beneficio" sale con la zeta
    # castellana. Con es-419 hay seseo, que es lo que espera el que escucha acá.
    pipeline.g2p = EspeakG2P(language="es-419")

    hechos, aviso_total = [], 0
    for n, (fid, escena, t0, texto) in enumerate(FRASES):
        # Cada frase tiene hasta que arranca la siguiente.
        fin = FRASES[n + 1][2] if n + 1 < len(FRASES) else DUR - 0.2
        ventana = fin - t0 - HUECO
        speed = round(BASE + VARIA[n % len(VARIA)], 3)

        audio = sintetiza(pipeline, texto, voz, speed)
        while len(audio) / SR > ventana and speed < TOPE:
            speed = round(speed + 0.04, 3)
            audio = sintetiza(pipeline, texto, voz, speed)

        dur = len(audio) / SR
        sf.write(VOZ / f"{fid}.wav", audio, SR)
        extra = "" if dur <= ventana else f"  ⚠ pisa {dur - ventana:.2f}s"
        aviso_total += dur > ventana
        print(f"  ✓ {fid}  {escena:<20} {t0:>5.2f}s  {dur:4.2f}s / {ventana:4.2f}s"
              f"  ×{speed}{extra}")
        hechos.append((VOZ / f"{fid}.wav", t0))

    if aviso_total:
        print(f"  {aviso_total} frase(s) se pisan con la siguiente: acortá el texto.")
    return hechos


def mezcla(hechos, voz):
    """Cada frase entra con adelay en su segundo exacto. La cadena de after
    existe para que no suene a sintetizador: se le saca el retumbe de los 300 Hz,
    se le levanta la presencia, se empareja con compresión y se le agrega una
    reflexión de 14 ms —el eco de una habitación chica— antes de normalizar."""
    ff = ffmpeg_exe()
    pista = OUT / "locucion.wav"

    entradas, filtros, etiquetas = [], [], []
    for i, (wav, t0) in enumerate(hechos):
        entradas += ["-i", str(wav)]
        ms = int(round(t0 * 1000))
        filtros.append(f"[{i}:a]adelay={ms}|{ms}[a{i}]")
        etiquetas.append(f"[a{i}]")

    cuerpo = (
        f"amix=inputs={len(hechos)}:normalize=0,"
        "highpass=f=85,"
        "equalizer=f=300:t=q:w=1.2:g=-2,"
        "equalizer=f=3500:t=q:w=1.5:g=2.5,"
        "acompressor=threshold=-18dB:ratio=3:attack=8:release=180:makeup=2,"
        "aecho=0.85:0.9:14:0.08,"
        "loudnorm=I=-16:TP=-1.5:LRA=11,"
        f"apad,atrim=0:{DUR}[out]"
    )
    filtro = ";".join(filtros) + ";" + "".join(etiquetas) + cuerpo

    subprocess.run([ff, "-y", *entradas, "-filter_complex", filtro,
                    "-map", "[out]", "-ar", "44100", "-ac", "2", str(pista)],
                   check=True, capture_output=True)
    print(f"Pista de voz → {pista}")

    if not REEL.exists():
        print(f"No está {REEL.name}: corré `node whatsapp/render.mjs reel` primero.")
        return

    subprocess.run([ff, "-y", "-i", str(REEL), "-i", str(pista),
                    "-map", "0:v:0", "-map", "1:a:0",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                    "-movflags", "+faststart", str(FINAL)],
                   check=True, capture_output=True)
    print(f"Reel con locución ({voz}) → {FINAL}")


if __name__ == "__main__":
    args = sys.argv[1:]
    voz = args[args.index("--voz") + 1] if "--voz" in args else VOZ_DEF

    print(f"Sintetizando con Kokoro · voz {voz}")
    hechos = genera_voz(voz)
    if "voz" not in args:
        mezcla(hechos, voz)
