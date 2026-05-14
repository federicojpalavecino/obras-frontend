path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken /div> tag
content = content.replace(
    '        )}\n/div>\n      <PrintPresupuesto',
    '        )}\n      </div>\n      <PrintPresupuesto'
)
content = content.replace(
    '        )}\r\n/div>\r\n      <PrintPresupuesto',
    '        )}\r\n      </div>\r\n      <PrintPresupuesto'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed")
