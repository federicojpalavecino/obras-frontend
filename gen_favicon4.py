"""
Genera favicon.ico opción 4: FAIM / OBRAS bicolor verde
"""
import struct
import os

def make_pixel(r, g, b, a=255):
    return bytes([b, g, r, a])

def in_rounded_rect(x, y, w, h, radius):
    if x < 0 or x >= w or y < 0 or y >= h:
        return False
    corners = [
        (radius, radius),
        (w - radius - 1, radius),
        (radius, h - radius - 1),
        (w - radius - 1, h - radius - 1),
    ]
    for cx, cy in corners:
        if abs(x - cx) >= radius and abs(y - cy) >= radius:
            if (x < radius or x >= w - radius) and (y < radius or y >= h - radius):
                dx = x - cx
                dy = y - cy
                if dx * dx + dy * dy > radius * radius:
                    return False
    return True

def draw_text_F(pixels, size, ox, oy, char_w, char_h, color, bg):
    """Dibuja letras simples como bitmaps"""
    pass

def make_favicon(size=32):
    # Colores
    GREEN1 = (5, 150, 105)    # #059669
    GREEN2 = (4, 120, 87)     # #047857
    WHITE  = (255, 255, 255)
    MINT   = (167, 243, 208)  # #a7f3d0
    TRANS  = (0, 0, 0, 0)
    radius = 5

    # Crear grid de pixels BGRA
    img = []
    for y in range(size):
        row = []
        for x in range(size):
            if not in_rounded_rect(x, y, size, size, radius):
                row.append(make_pixel(0, 0, 0, 0))
            elif y >= size // 2:
                row.append(make_pixel(*GREEN2))
            else:
                row.append(make_pixel(*GREEN1))
        img.append(row)

    # Dibujar "F" en mitad superior (bitmap manual 5x8 en tamaño 32)
    # Posición: mitad superior = y 2..14, centrado
    # Letra "F" pattern (6 cols x 9 rows)
    F = [
        [1,1,1,1,1,0],
        [1,0,0,0,0,0],
        [1,0,0,0,0,0],
        [1,1,1,1,0,0],
        [1,0,0,0,0,0],
        [1,0,0,0,0,0],
        [1,0,0,0,0,0],
        [1,0,0,0,0,0],
        [1,0,0,0,0,0],
    ]
    # Letra "O" pattern (6 cols x 9 rows)
    O = [
        [0,1,1,1,1,0],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [1,0,0,0,0,1],
        [0,1,1,1,1,0],
    ]

    # Dibujar "FA" arriba (simplificado como F y A)
    # Para 32x32, usamos pixel art 3x5 para cada letra
    # Bitmap letters 3x5
    letters = {
        'F': [[1,1,1],[1,0,0],[1,1,0],[1,0,0],[1,0,0]],
        'A': [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
        'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
        'M': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1]],
        'O': [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
        'B': [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
        'R': [[1,1,0],[1,0,1],[1,1,0],[1,1,0],[1,0,1]],
        'S': [[0,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0]],
    }

    def draw_word(word, start_x, start_y, color):
        x = start_x
        for ch in word:
            if ch not in letters:
                x += 4
                continue
            bm = letters[ch]
            for row_i, row in enumerate(bm):
                for col_i, px in enumerate(row):
                    if px:
                        px2 = x + col_i
                        py2 = start_y + row_i
                        if 0 <= py2 < size and 0 <= px2 < size:
                            img[py2][px2] = make_pixel(*color)
            x += 4  # letter width + 1 gap

    # FAIM en parte superior (y=4..9), centrado
    word_w_faim = len("FAIM") * 4 - 1  # 15px
    start_x_faim = (size - word_w_faim) // 2
    draw_word("FAIM", start_x_faim, 4, WHITE)

    # OBRAS en parte inferior (y=18..23), centrado en verde oscuro
    word_w_obras = len("OBRAS") * 4 - 1  # 19px
    start_x_obras = (size - word_w_obras) // 2
    draw_word("OBRAS", start_x_obras, 18, MINT)

    # Línea separadora
    for x in range(2, size - 2):
        if in_rounded_rect(x, 15, size, size, radius):
            img[15][x] = make_pixel(3, 100, 70, 255)

    # Convertir a bytes BMP (bottom-to-top, BGRA)
    pixel_data = bytearray()
    for row in reversed(img):
        for px in row:
            pixel_data += px

    # AND mask (1bpp, 0=opaque, 1=transparent) — 4 bytes per row
    and_mask = bytearray()
    for y in range(size - 1, -1, -1):
        row_bits = 0
        for x in range(size):
            bit = 0 if img[y][x][3] > 0 else 1
            row_bits = (row_bits << 1) | bit
        # Pad to 4 bytes
        row_bytes = size // 8
        if size % 8: row_bytes += 1
        while row_bytes % 4: row_bytes += 1
        and_mask += row_bits.to_bytes(row_bytes, 'big')

    # BITMAPINFOHEADER
    bpp = 32
    dib = struct.pack('<IIIHHIIIIII',
        40, size, size * 2, 1, bpp, 0, 0, 0, 0, 0, 0)

    image_data = dib + bytes(pixel_data) + bytes(and_mask)

    # ICO header + entry
    ico_header = struct.pack('<HHH', 0, 1, 1)
    data_offset = 6 + 16
    ico_entry = struct.pack('<BBBBHHII',
        size, size, 0, 0, 1, bpp, len(image_data), data_offset)

    return ico_header + ico_entry + image_data

ico = make_favicon(32)
out = r"C:\obras-frontend\public\favicon.ico"
with open(out, 'wb') as f:
    f.write(ico)
print(f"OK favicon.ico ({len(ico)} bytes)")
