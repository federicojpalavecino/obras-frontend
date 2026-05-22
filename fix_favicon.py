"""
Genera un favicon SVG para FAIM OBRAS y actualiza el index.html
"""
import os

# ── Favicon SVG ───────────────────────────────────────────────────────────────
favicon_svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#059669"/>
  <text x="16" y="22" font-family="Arial,sans-serif" font-size="13" font-weight="900"
        fill="white" text-anchor="middle" letter-spacing="-0.5">FO</text>
</svg>'''

svg_path = r"C:\obras-frontend\public\favicon.svg"
with open(svg_path, "w") as f:
    f.write(favicon_svg)
print("✓ favicon.svg creado")

# ── Actualizar index.html para usar SVG como favicon ─────────────────────────
index_path = r"C:\obras-frontend\public\index.html"
with open(index_path, "r", encoding="utf-8") as f:
    content = f.read()

# Reemplazar favicon.ico con favicon.svg
content = content.replace(
    '<link rel="icon" href="%PUBLIC_URL%/favicon.ico" />',
    '<link rel="icon" href="%PUBLIC_URL%/favicon.svg" type="image/svg+xml" />\n    <link rel="alternate icon" href="%PUBLIC_URL%/favicon.ico" />'
)

with open(index_path, "w", encoding="utf-8") as f:
    f.write(content)
print("✓ index.html actualizado con favicon SVG")

# ── manifest.json ────────────────────────────────────────────────────────────
manifest_path = r"C:\obras-frontend\public\manifest.json"
manifest = '''{
  "short_name": "FAIM OBRAS",
  "name": "FAIM OBRAS — Gestión para estudios",
  "icons": [
    { "src": "favicon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "logo192.png", "type": "image/png", "sizes": "192x192" },
    { "src": "logo512.png", "type": "image/png", "sizes": "512x512" }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#059669",
  "background_color": "#f8f9fa"
}
'''
with open(manifest_path, "w") as f:
    f.write(manifest)
print("✓ manifest.json actualizado")

print("\nDone — ahora ejecutá:")
print("cd C:\\obras-frontend && npm run build && git add . && git commit -m \"fix: favicon y titulo FAIM OBRAS\" && git push")
