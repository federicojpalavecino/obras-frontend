path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The issue is that in the print window HTML string, the JS expression is written as literal text
# We need to evaluate it before inserting into the HTML

# Fix 1: In imprimirCert function - the empresa div in the win.document.write
old1 = """win.document.write("<div class=\\"empresa\\">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})()}</div>");"""
new1 = """const __tenantNombre = (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})();
    win.document.write("<div class=\\"empresa\\">" + __tenantNombre + "</div>");"""

if old1 in content:
    content = content.replace(old1, new1)
    print("Fixed empresa div in imprimirCert")

# Fix 2: Footer in imprimirCert - Fima Arquitectura
content = content.replace(
    '"<footer><span>Fima Arquitectura — Certificado Nº ${d.certificado?.numero} — ${hoyStr}</span>',
    '"<footer><span>" + __tenantNombre + " — Certificado Nº ${d.certificado?.numero} — ${hoyStr}</span>'
)

# Fix 3: Footer in imprimirCertEgresos
content = content.replace(
    '"<footer><span>Fima Arquitectura — Cert. Egresos " + certNumLabel + " — " + now + "</span><span>" + obraNombre + "</span></footer>"',
    '"<footer><span>" + __tenantNombre2 + " — Cert. Egresos " + certNumLabel + " — " + now + "</span><span>" + obraNombre + "</span></footer>"'
)

# Add __tenantNombre2 before imprimirCertEgresos uses it
content = content.replace(
    '  const imprimirCertEgresos = (sel, total, vinculadoNum) => {',
    '  const imprimirCertEgresos = (sel, total, vinculadoNum) => {\n    const __tenantNombre2 = (()=>{try{const s=JSON.parse(localStorage.getItem(\'obras_session\')||\'{}\')||{};if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem(\'obras_tenant\')||\'null\');if(t?.nombre)return t.nombre;}catch(e){}return \'FAIM OBRAS\';})();'
)

# Fix 4: JSX print area - Fima Arquitectura
content = content.replace(
    '<span>Fima Arquitectura — Certificado Nº {certDetalle.certificado?.numero} — {hoy}</span>',
    '<span>{(()=>{try{const s=JSON.parse(localStorage.getItem(\'obras_session\')||\'{}\')||{};if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem(\'obras_tenant\')||\'null\');if(t?.nombre)return t.nombre;}catch(e){}return \'FAIM OBRAS\';})()}{" — Certificado Nº "}{certDetalle.certificado?.numero}{" — "}{hoy}</span>'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Check remaining Fima references
with open(path, 'r', encoding='utf-8') as f:
    check = f.read()
fima_count = check.count('Fima Arquitectura')
print(f"Remaining 'Fima Arquitectura' occurrences: {fima_count}")
print("Done")
