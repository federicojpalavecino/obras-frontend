path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the MODAL ADICIONAL comment position
idx = content.find('{/* MODAL ADICIONAL */}')
if idx == -1:
    print("ERROR: MODAL ADICIONAL not found")
else:
    # Find what's right before it - the broken crear rubro ending
    before = content[:idx]
    # The before section ends with the broken crear rubro modal
    # It should end with: </div>\n          </div>\n        )}\n\n
    # But currently ends with: </div>        
    # Find the last complete </div> before idx
    last_div = before.rfind('</div>')
    print(f"Last </div> before modal adicional at: {last_div}")
    print(f"Content from last_div: {repr(before[last_div:])}")
    
    # The content after last </div> should just be whitespace/newlines
    after_last = before[last_div + 6:]  # 6 = len('</div>')
    print(f"Content after last </div>: {repr(after_last)}")
    
    # Replace everything from last_div to idx with correct closing
    correct_end = '</div>\n          </div>\n        )}\n\n        '
    new_content = before[:last_div] + correct_end + content[idx:]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    opens = new_content.count('<div')
    closes = new_content.count('</div>')
    print(f"After fix - Opens: {opens}, Closes: {closes}, Diff: {opens-closes}")
