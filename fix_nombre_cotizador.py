import re

# Menu.js
with open(r"C:\obras-frontend\src\cotizador\pages\Menu.js", "r", encoding="utf-8") as f:
    c = f.read()

c = c.replace(
    "<div style={{ fontSize: 13, color: 'var(--muted)' }}>Cotizador</div>",
    "<div style={{ fontSize: 13, color: 'var(--muted)' }}>Presupuestos y obras</div>"
)
print("Menu.js OK" if "Presupuestos y obras" in c else "Menu.js FAIL")

with open(r"C:\obras-frontend\src\cotizador\pages\Menu.js", "w", encoding="utf-8") as f:
    f.write(c)

# App.js - menu principal y header
with open(r"C:\obras-frontend\src\App.js", "r", encoding="utf-8") as f:
    c = f.read()

changes = [
    ('label:"Cotizador"', 'label:"Presupuestos y obras"'),
    ('label: "Cotizador"', 'label: "Presupuestos y obras"'),
    ('"Cotizador"', '"Presupuestos y obras"'),
    ("'Cotizador'", "'Presupuestos y obras'"),
    ('desc:"Presupuestos, analisis de costos y certificados"', 'desc:"Presupuestos, obras, certificados y análisis de costos"'),
    ('desc: "Presupuestos, analisis de costos y certificados"', 'desc: "Presupuestos, obras, certificados y análisis de costos"'),
]

found = False
for old, new in changes:
    if old in c:
        c = c.replace(old, new)
        print(f"App.js OK: {old[:50]}")
        found = True

if not found:
    # buscar con regex
    import re
    matches = [(m.start(), m.group()) for m in re.finditer(r'Cotizador', c)]
    print(f"App.js - encontradas {len(matches)} ocurrencias de 'Cotizador':")
    for pos, m in matches:
        print(f"  pos {pos}: {repr(c[pos-20:pos+40])}")

with open(r"C:\obras-frontend\src\App.js", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
