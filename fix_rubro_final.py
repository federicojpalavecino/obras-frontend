path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The crear rubro modal ends incorrectly - missing </div> and )}
# Current: </div>\n            </div>        {/* MODAL ADICIONAL */}
# Need: </div>\n            </div>\n          </div>\n        )}\n\n        {/* MODAL ADICIONAL */}
old = '            </div>        {/* MODAL ADICIONAL */}'
new = '            </div>\n          </div>\n        )}\n\n        {/* MODAL ADICIONAL */}'
if old in content:
    content = content.replace(old, new)
    print("Fixed crear rubro modal closure")
else:
    print("Not found - checking variants")
    # Try with \r\n
    for sep in ['\r\n', '\n']:
        variant = '            </div>        {/* MODAL ADICIONAL */}'.replace('\n', sep)
        if variant in content:
            replacement = f'            </div>{sep}          </div>{sep}        )}{sep}{sep}        {{/* MODAL ADICIONAL */}}'
            content = content.replace(variant, replacement)
            print(f"Fixed with {repr(sep)}")
            break

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

opens = content.count('<div')
closes = content.count('</div>')
print(f"Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
