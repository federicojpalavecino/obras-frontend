path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix line 1370: add missing </div> before the MODAL ADICIONAL comment
old = '            </div>        {/* MODAL ADICIONAL */}'
new = '            </div>\r\n        )}\r\n\r\n        {/* MODAL ADICIONAL */}'

if old in content:
    content = content.replace(old, new)
    print("Fixed: added missing closing div and )} for crear rubro modal")
else:
    old_lf = old.replace('\r\n', '\n')
    new_lf = new.replace('\r\n', '\n')
    if old_lf in content:
        content = content.replace(old_lf, new_lf)
        print("Fixed (LF)")
    else:
        print("ERROR: not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

opens = content.count('<div')
closes = content.count('</div>')
print(f"Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
