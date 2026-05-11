import os

path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken setAjustesPorCert call in handleEditCert
old = """      setAjustesPorCert(prev => ({...prev, [modalEditCert.numero]: {
        mayores_costos_pct: parseFloat(editMayoresCostosPct) || 0,
        fondo_reparo_pct: parseFloat(editFondoReparoPct) || 0,
        multas: parseFloat(editMultas) || 0,
        nota: editNota || null,
      }});"""

new = """      setAjustesPorCert(prev => ({...prev, [modalEditCert.numero]: {
        mayores_costos_pct: parseFloat(editMayoresCostosPct) || 0,
        fondo_reparo_pct: parseFloat(editFondoReparoPct) || 0,
        multas: parseFloat(editMultas) || 0,
        nota: editNota || null,
      }}));"""

if old in content:
    content = content.replace(old, new)
    print("Fixed setAjustesPorCert syntax")
else:
    # Try to find and fix it differently
    content = content.replace('}});', '})));', 1)
    print("Applied generic fix")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
