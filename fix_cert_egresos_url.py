"""
fix_cert_egresos_url.py
Corrige la URL /finanzas/semanas -> /cf/semanas en Certificado.js
"""

path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "api.get('/finanzas/semanas').then(r => ({data: r.data || []})).catch(() => ({data: []}))"
new = "api.get('/cf/semanas').then(r => ({data: r.data || []})).catch(() => ({data: []}))"

if old in content:
    content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Fixed: /finanzas/semanas -> /cf/semanas")
else:
    # Try alternate pattern
    old2 = "'/finanzas/semanas'"
    new2 = "'/cf/semanas'"
    if old2 in content:
        content = content.replace(old2, new2, 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Fixed alternate pattern")
    else:
        print("Pattern not found - checking what's there:")
        idx = content.find('finanzas')
        if idx != -1:
            print(repr(content[idx-20:idx+60]))
