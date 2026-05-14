path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken /div> - needs to be </div> and add missing outer div close
content = content.replace(
    '        )}\r\n/div>\r\n\r\n      <PrintPresupuesto',
    '        )}\r\n      </div>\r\n\r\n      <PrintPresupuesto'
)
content = content.replace(
    '        )}\n/div>\n\n      <PrintPresupuesto',
    '        )}\n      </div>\n\n      <PrintPresupuesto'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    check = f.read()
if '/div>' in check and '</div>' not in check[check.find('/div>')-5:check.find('/div>')+1]:
    print("WARNING: still broken")
else:
    print("Fixed")
