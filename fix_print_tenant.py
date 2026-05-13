path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

tenant_js = "(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})()"

# Add tenantNombre variable at the start of imprimirCertItems
old_start = "  const imprimirCertItems = (d) => {\n    const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});"
new_start = f"  const imprimirCertItems = (d) => {{\n    const _tn = {tenant_js};\n    const hoyStr = new Date().toLocaleDateString('es-AR',{{day:'2-digit',month:'long',year:'numeric'}});"

# Use string replacement without format to avoid issues
old_start = "  const imprimirCertItems = (d) => {\r\n    const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});"
new_start = "  const imprimirCertItems = (d) => {\r\n    const _tn = " + tenant_js + ";\r\n    const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});"

if old_start in content:
    content = content.replace(old_start, new_start)
    print("Added _tn to imprimirCertItems")
else:
    # try LF
    old_start_lf = old_start.replace('\r\n', '\n')
    new_start_lf = new_start.replace('\r\n', '\n')
    if old_start_lf in content:
        content = content.replace(old_start_lf, new_start_lf)
        print("Added _tn to imprimirCertItems (LF)")
    else:
        print("ERROR: could not find imprimirCertItems start")

# Replace the JSX expression in the print HTML with _tn variable
bad_expr = "{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})()}"
content = content.replace(
    f'<div class="empresa">{bad_expr}</div>',
    '<div class="empresa">${_tn}</div>'
)
print(f"Replaced empresa div: {content.count('${_tn}>')} occurrences")

# Fix footer - Fima Arquitectura remaining
content = content.replace('Fima Arquitectura', '${_tn}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    check = f.read()
fima = check.count('Fima Arquitectura')
tn = check.count('${_tn}')
bad = check.count(bad_expr)
print(f"Fima Arquitectura remaining: {fima}")
print(f"${{_tn}} occurrences: {tn}")
print(f"Bad JSX expr remaining: {bad}")
print("Done")
