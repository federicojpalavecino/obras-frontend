path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the duplicate - keep only the first occurrence in the function
# The function now has two identical const __tenantNombre2 lines
old = """  const imprimirCertEgresos = (sel, total, vinculadoNum) => {
    const __tenantNombre2 = (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}')||{};if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})();
    const __tenantNombre2 = (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}')||{};if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})();"""

new = """  const imprimirCertEgresos = (sel, total, vinculadoNum) => {
    const __tenantNombre2 = (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}')||{};if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})();"""

if old in content:
    content = content.replace(old, new)
    print("Fixed duplicate declaration")
else:
    print("Pattern not found exactly, trying line-by-line")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
