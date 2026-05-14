path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The modal ends without closing the outer div
# Find the area and add the missing closing div
old = '''      )}
      </div>

      <PrintPresupuesto data={data} modo={printMode} />'''

new = '''      )}
      </div>
      </div>

      <PrintPresupuesto data={data} modo={printMode} />'''

if old in content:
    content = content.replace(old, new)
    print("Added missing closing div")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Added missing closing div (CRLF)")
    else:
        # Count divs to find the issue
        print("Pattern not found - checking structure")
        idx = content.find('<PrintPresupuesto')
        print(f"Context around PrintPresupuesto:\n{content[idx-200:idx+50]}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
