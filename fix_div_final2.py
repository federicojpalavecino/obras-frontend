path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The issue: we have extra </div> at line 1605 that doesn't belong
# The structure should be: modal ends -> one </div> for outer container -> PrintPresupuesto
# Remove the extra </div> we added
old = '        )}\n      </div>\n      </div>\n\n      <PrintPresupuesto'
new = '        )}\n      </div>\n\n      <PrintPresupuesto'
if old in content:
    content = content.replace(old, new)
    print("Removed extra div")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')  
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Removed extra div (CRLF)")
    else:
        print("Not found, checking...")
        idx = content.find('<PrintPresupuesto')
        print(repr(content[idx-150:idx+30]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

opens = content.count('<div')
closes = content.count('</div>')
print(f"Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
