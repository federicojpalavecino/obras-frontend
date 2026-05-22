"""
Genera un favicon.ico real de 32x32 para FAIM OBRAS
usando solo la librería estándar de Python (sin Pillow)
"""
import struct
import zlib
import os

def make_ico():
    # Crear un PNG 32x32 manualmente con fondo verde #059669 y texto "FO"
    # Como no tenemos Pillow, creamos el ICO con un bitmap BMP simple
    
    size = 32
    # Color verde FAIM: #059669 = RGB(5, 150, 105)
    R, G, B = 5, 150, 105
    
    # Crear imagen BMP 32x32 de 32bpp para el ICO
    # ICO header
    ico_header = struct.pack('<HHH', 0, 1, 1)  # reserved, type=1 (ICO), count=1
    
    # ICONDIRENTRY
    width = 32
    height = 32
    bpp = 32
    
    # Crear el bitmap XOR (imagen) - BMP sin header de archivo
    # BITMAPINFOHEADER
    dib_header = struct.pack('<IIIHHIIIIII',
        40,          # biSize
        width,       # biWidth
        height * 2,  # biHeight (double for ICO: XOR + AND masks)
        1,           # biPlanes
        bpp,         # biBitCount
        0,           # biCompression (BI_RGB)
        0,           # biSizeImage
        0,           # biXPelsPerMeter
        0,           # biYPelsPerMeter
        0,           # biClrUsed
        0,           # biClrImportant
    )
    
    # Pixel data (BGRA) - bottom to top
    pixels = bytearray()
    for y in range(height - 1, -1, -1):
        for x in range(width):
            # Fondo verde redondeado
            # Esquinas redondeadas (radio 6)
            r = 6
            in_corner = False
            if x < r and y < r and (x-r)**2 + (y-r)**2 > r**2: in_corner = True
            if x >= width-r and y < r and (x-(width-r-1))**2 + (y-r)**2 > r**2: in_corner = True
            if x < r and y >= height-r and (x-r)**2 + (y-(height-r-1))**2 > r**2: in_corner = True
            if x >= width-r and y >= height-r and (x-(width-r-1))**2 + (y-(height-r-1))**2 > r**2: in_corner = True
            
            if in_corner:
                pixels += bytes([0, 0, 0, 0])  # transparente
            else:
                # Letra F (x: 6-14, y: 8-24) y O (x: 16-26, y: 8-24)
                px, py = x, height - 1 - y  # convertir a coords normales
                is_letter = False
                
                # Letra F
                if 6 <= px <= 13 and 8 <= py <= 23:
                    if px <= 7:  # barra vertical
                        is_letter = True
                    elif py <= 9:  # barra top
                        is_letter = True
                    elif 14 <= py <= 15:  # barra middle
                        is_letter = True
                
                # Letra O
                if 16 <= px <= 25 and 8 <= py <= 23:
                    cx, cy = 20.5, 15.5
                    outer = (px - cx)**2 / 25 + (py - cy)**2 / 36
                    inner = (px - cx)**2 / 16 + (py - cy)**2 / 25
                    if outer <= 1 and inner >= 1:
                        is_letter = True
                
                if is_letter:
                    pixels += bytes([255, 255, 255, 255])  # blanco
                else:
                    pixels += bytes([B, G, R, 255])  # verde FAIM
    
    # AND mask (1 bit per pixel, 0 = opaque) - 4 bytes per row aligned
    and_mask = bytes([0] * (height * 4))
    
    image_data = dib_header + bytes(pixels) + and_mask
    image_size = len(image_data)
    
    # ICONDIRENTRY: width, height, colorcount, reserved, planes, bitcount, size, offset
    header_size = 6  # ICO header
    entry_size = 16  # ICONDIRENTRY
    data_offset = header_size + entry_size
    
    ico_entry = struct.pack('<BBBBHHII',
        width,       # width
        height,      # height
        0,           # colorcount (0 = >256 colors)
        0,           # reserved
        1,           # planes
        bpp,         # bitcount
        image_size,  # size of image data
        data_offset, # offset to image data
    )
    
    ico_data = ico_header + ico_entry + image_data
    
    out_path = r"C:\obras-frontend\public\favicon.ico"
    with open(out_path, 'wb') as f:
        f.write(ico_data)
    print(f"✓ favicon.ico generado ({len(ico_data)} bytes) en {out_path}")

make_ico()

# Actualizar index.html para priorizar .ico
index_path = r"C:\obras-frontend\public\index.html"
with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Asegurarse que .ico va primero
if 'favicon.svg' in content:
    content = content.replace(
        '<link rel="icon" href="%PUBLIC_URL%/favicon.svg" type="image/svg+xml" />\n    <link rel="alternate icon" href="%PUBLIC_URL%/favicon.ico" />',
        '<link rel="icon" href="%PUBLIC_URL%/favicon.ico" sizes="32x32" />'
    )
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✓ index.html actualizado - favicon.ico primero")
else:
    print("✓ index.html ya tiene favicon.ico")
