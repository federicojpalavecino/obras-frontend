import os, re

# Fix Maquinaria.js - just replace FIMA with tenant name
path = r'C:\obras-frontend\src\cotizador\pages\Maquinaria.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = """          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer' }}
            onClick={() => navigate('/')}>FIMA</span>"""

new = """          <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, color: (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.color_primario)return s.tenant.color_primario;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.color_primario)return t.color_primario;}catch(e){}return 'var(--accent)'})(), cursor: 'pointer' }}
            onClick={() => navigate('/')}>{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>"""

if 'FIMA</span>' in content:
    content = content.replace(">FIMA</span>", ">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>")
    content = content.replace("color: 'var(--accent)', cursor: 'pointer' }}\n            onClick={() => navigate('/')}", "color: (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.color_primario)return s.tenant.color_primario;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.color_primario)return t.color_primario;}catch(e){}return 'var(--accent)'})(), cursor: 'pointer' }}\n            onClick={() => navigate('/')}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Maquinaria.js fixed: {len(content)} chars")

# Also fix ManoObra if it has FIMA
path2 = r'C:\obras-frontend\src\cotizador\pages\ManoObra.js'
with open(path2, 'r', encoding='utf-8') as f:
    content2 = f.read()
if '>FIMA<' in content2 or ">FIMA<" in content2:
    content2 = content2.replace(">FIMA</span>", ">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>")
    with open(path2, 'w', encoding='utf-8') as f:
        f.write(content2)
    print("ManoObra.js fixed")
else:
    print("ManoObra.js: no FIMA found, OK")

# Fix AnalisisCostos if it has FIMA
path3 = r'C:\obras-frontend\src\cotizador\pages\AnalisisCostos.js'
with open(path3, 'r', encoding='utf-8') as f:
    content3 = f.read()
if '>FIMA<' in content3 or ">FIMA<" in content3:
    content3 = content3.replace(">FIMA</span>", ">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>")
    with open(path3, 'w', encoding='utf-8') as f:
        f.write(content3)
    print("AnalisisCostos.js fixed")
else:
    print("AnalisisCostos.js: no FIMA found, OK")
