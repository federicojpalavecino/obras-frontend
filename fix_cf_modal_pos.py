with open(r"C:\obras-frontend\src\pages\ControlFinanciero.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# El modal está después del cierre del return. Hay que moverlo adentro.
# Encontrar el patrón: </div>\n\n      {/* ── MODAL IMPORTAR
old = '    </div>\r\n\r\n      {/* \u2500\u2500 MODAL IMPORTAR DESDE OBRA \u2500\u2500 */}'
if old not in c:
    old = '    </div>\n\n      {/* \u2500\u2500 MODAL IMPORTAR DESDE OBRA \u2500\u2500 */}'

# Extraer el modal completo
modal_start = c.find('{/* \u2500\u2500 MODAL IMPORTAR DESDE OBRA \u2500\u2500 */')
if modal_start < 0:
    modal_start = c.find('{/* ── MODAL IMPORTAR DESDE OBRA ── */')
    
if modal_start < 0:
    print("No encontré el modal")
else:
    # Encontrar el fin del modal (último )} antes del return closing)
    modal_end = c.find('\n    </div>', modal_start)
    if modal_end < 0:
        modal_end = len(c)
    
    modal_text = c[modal_start:modal_end].strip()
    
    # Eliminar el modal de donde está (incluyendo la línea vacía antes)
    # Buscar desde antes del comentario
    remove_start = c.rfind('\n', 0, modal_start)  
    c = c[:remove_start] + c[modal_end:]
    
    # Insertar el modal ANTES del toast (que está dentro del return)
    toast_marker = '      {toast && ('
    toast_pos = c.rfind(toast_marker)
    if toast_pos > 0:
        c = c[:toast_pos] + '\n      ' + modal_text + '\n\n      ' + c[toast_pos:]
        print("OK modal movido adentro del return")
    else:
        print("FAIL no encontré toast marker")

with open(r"C:\obras-frontend\src\pages\ControlFinanciero.jsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
