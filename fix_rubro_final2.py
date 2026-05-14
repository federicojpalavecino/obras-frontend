path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '            </div>        {/* MODAL ADICIONAL */}'
new1 = '            </div>\r\n          </div>\r\n        )}\r\n\r\n        {/* MODAL ADICIONAL */}'
new2 = '            </div>\n          </div>\n        )}\n\n        {/* MODAL ADICIONAL */}'

if old in content:
    content = content.replace(old, new1)
    print("Fixed CRLF")
elif old.replace('\n','\r\n') in content:
    content = content.replace(old.replace('\n','\r\n'), new1)
    print("Fixed CRLF2")
else:
    print("Not found trying LF")
    content = content.replace(old, new2)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

opens = content.count('<div')
closes = content.count('</div>')
print("Opens:", opens, "Closes:", closes, "Diff:", opens-closes)
