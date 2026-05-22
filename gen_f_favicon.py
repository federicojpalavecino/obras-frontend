from PIL import Image, ImageDraw, ImageFont

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    radius = size // 6
    draw.rounded_rectangle([0, 0, size-1, size-1], radius=radius, fill=(5, 150, 105, 255))

    # Fuente bold
    font_size = int(size * 0.62)
    font = None
    for path in [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/calibrib.ttf",
        "C:/Windows/Fonts/trebucbd.ttf",
        "C:/Windows/Fonts/verdanab.ttf",
    ]:
        try:
            font = ImageFont.truetype(path, font_size)
            break
        except: pass
    if font is None:
        font = ImageFont.load_default()

    text = "F"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), text, fill=(255, 255, 255, 255), font=font)

    return img

sizes = [16, 32, 48, 64, 128, 256]
images = [make_icon(s) for s in sizes]

images[0].save(
    r"C:\obras-frontend\public\favicon.ico",
    format="ICO",
    sizes=[(s, s) for s in sizes],
    append_images=images[1:]
)

img512 = make_icon(512)
img512.resize((192, 192)).save(r"C:\obras-frontend\public\logo192.png")
img512.save(r"C:\obras-frontend\public\logo512.png")

print("OK favicon.ico generado")
