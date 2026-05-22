with open(r"C:\obras-frontend\src\App.js", "r", encoding="utf-8") as f:
    c = f.read()

changes = [
    ('placeholder="Ej: FIMA Arquitectura"', 'placeholder="Ej: MRA+Asociados"'),
    ('"Comenzar prueba gratuita 30 días"', '"Comenzar prueba gratuita 15 días"'),
    ('<div style={{fontSize:12,color:"#6b7280",textAlign:"center",marginTop:12}}>Sin tarjeta requerida</div>', ''),
]

for old, new in changes:
    if old in c:
        c = c.replace(old, new)
        print(f"OK: {old[:40]}")
    else:
        print(f"FAIL: {old[:40]}")

with open(r"C:\obras-frontend\src\App.js", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
