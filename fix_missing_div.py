path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Need to add 2 closing divs before PrintPresupuesto (187 open, 185 close = 2 missing, but one was /div> = 186 closed now, need 1 more)
# After the fix, we have 186 closed divs but need 187. Add one more.
old = '      </div>\r\n\r\n      <PrintPresupuesto'
new = '      </div>\r\n      </div>\r\n\r\n      <PrintPresupuesto'

if old in content:
    content = content.replace(old, new)
    print("Added missing closing div")
else:
    old_lf = old.replace('\r\n', '\n')
    new_lf = new.replace('\r\n', '\n')
    if old_lf in content:
        content = content.replace(old_lf, new_lf)
        print("Added missing closing div (LF)")
    else:
        print("ERROR: pattern not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Recount
opens = content.count('<div')
closes = content.count('</div>')
print(f"Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
