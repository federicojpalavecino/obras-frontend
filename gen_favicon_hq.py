"""
Genera favicon.ico de alta calidad usando Pillow
Opción 4: FAIM / OBRAS bicolor verde
"""
from PIL import Image, ImageDraw, ImageFont
import os

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = size // 6
    GREEN1 = (5, 150, 105, 255)
    GREEN2 = (4, 120, 87, 255)

    # Fondo redondeado verde superior
    draw.rounded_rectangle([0, 0, size-1, size//2], radius=radius, fill=GREEN1)
    # Fondo redondeado verde oscuro inferior
    draw.rounded_rectangle([0, size//2, size-1, size-1], radius=radius, fill=GREEN2)
    # Overlap para no tener gap en el medio
    draw.rectangle([0, size//2 - 2, size-1, size//2 + 2], fill=GREEN1)
    # Re-dibujar mitad inferior encima
    draw.rectangle([0, size//2, size-1, size-1], fill=GREEN2)
    # Reparar esquinas inferiores
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=None, outline=None)

    # Hacer de nuevo más limpio
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Fondo completo verde oscuro con esquinas redondeadas
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=GREEN2)
    # Mitad superior en verde claro
    draw.rounded_rectangle([0, 0, size-1, size//2 + 2], radius=radius, fill=GREEN1)
    # Rectángulo para el borde recto en el medio de la mitad superior
    draw.rectangle([0, size//4, size-1, size//2 + 2], fill=GREEN1)

    # Línea separadora sutil
    sep_y = size // 2
    draw.rectangle([size//8, sep_y, size - size//8, sep_y + max(1, size//32)], fill=(3, 100, 70, 255))

    # Texto - usar fuente por defecto de PIL ya que no tenemos fuentes del sistema garantizadas
    try:
        # Intentar fuentes del sistema Windows
        font_bold = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", size=size//3)
        font_small = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", size=size//4)
    except:
        try:
            font_bold = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", size=size//3)
            font_small = ImageFont.truetype("C:/Windows/Fonts/calibrib.ttf", size=size//4)
        except:
            font_bold = ImageFont.load_default()
            font_small = font_bold

    # FAIM en mitad superior
    text1 = "FAIM"
    bbox1 = draw.textbbox((0, 0), text1, font=font_bold)
    tw1 = bbox1[2] - bbox1[0]
    th1 = bbox1[3] - bbox1[1]
    x1 = (size - tw1) // 2
    y1 = (size // 2 - th1) // 2 - bbox1[1] // 2
    draw.text((x1, y1), text1, fill=(255, 255, 255, 255), font=font_bold)

    # OBRAS en mitad inferior
    text2 = "OBRAS"
    bbox2 = draw.textbbox((0, 0), text2, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    th2 = bbox2[3] - bbox2[1]
    x2 = (size - tw2) // 2
    y2 = size // 2 + (size // 2 - th2) // 2 - bbox2[1] // 2
    draw.text((x2, y2), text2, fill=(167, 243, 208, 255), font=font_small)

    return img

# Generar en múltiples tamaños
sizes = [16, 32, 48, 64, 128, 256]
images = [make_icon(s) for s in sizes]

out_ico = r"C:\obras-frontend\public\favicon.ico"
images[0].save(
    out_ico,
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=images[1:]
)
print(f"OK favicon.ico generado con tamaños: {sizes}")

# También guardar PNG 512x512 para apple-touch-icon
img_512 = make_icon(512)
out_png = r"C:\obras-frontend\public\logo192.png"
img_512.resize((192, 192), Image.LANCZOS).save(out_png, "PNG")
out_png512 = r"C:\obras-frontend\public\logo512.png"
img_512.save(out_png512, "PNG")
print("OK logo192.png y logo512.png generados")
