path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the broken code around horas-mo
# The issue is that we replaced the fetch but left `if (res.ok)` code
bad_patterns = [
    '      // horas-mo not available in OBRAS backend\n      if (res.ok) {\n        const data = await res.json();\n        data.forEach(d => { horasPorLinea[d.linea_id] = d.horas_mo; });\n      }',
    '      // horas-mo not available in OBRAS backend\r\n      if (res.ok) {\r\n        const data = await res.json();\r\n        data.forEach(d => { horasPorLinea[d.linea_id] = d.horas_mo; });\r\n      }',
]
for bad in bad_patterns:
    if bad in content:
        content = content.replace(bad, '      // horas-mo not available in OBRAS backend')
        print("Fixed res.ok reference")
        break

# Also remove the let horasPorLinea and try/catch if still there
content = content.replace(
    '    let horasPorLinea = {};\n    try {\n      // horas-mo not available in OBRAS backend\n    } catch (e) { console.error(\'horas-mo:\', e); }',
    '    // horas-mo not needed - using backend generar'
)
content = content.replace(
    '    let horasPorLinea = {};\r\n    try {\r\n      // horas-mo not available in OBRAS backend\r\n    } catch (e) { console.error(\'horas-mo:\', e); }',
    '    // horas-mo not needed'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
