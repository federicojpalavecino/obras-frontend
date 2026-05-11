import os

path = r'C:\obras-frontend\src\cotizador\pages\ListadoMateriales.jsx'

with open(r'C:\Users\feder\Downloads\ListadoMateriales_fima.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace FIMA API with OBRAS api
content = content.replace(
    "const API = 'https://fima-backend-production.up.railway.app';",
    "import api from '../api';"
)

# Replace fetch calls with api calls
content = content.replace(
    "      const res = await fetch(`${API}/presupuestos/${id}/materiales-listado`);\n      const json = await res.json();",
    "      const res = await api.get(`/presupuestos/${id}/materiales-listado`);\n      const json = res.data;"
)
content = content.replace(
    "      const res = await fetch(`${API}/maestros/materiales`);\n      const data = await res.json();\n      setCatalogoCompleto(data);",
    "      const res = await api.get('/maestros/materiales');\n      setCatalogoCompleto(res.data || []);"
)

# Replace FIMA with tenant name
content = content.replace(
    ">FIMA</span>",
    ">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>"
)
content = content.replace(
    "color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>FIMA",
    "color: (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.color_primario)return s.tenant.color_primario;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.color_primario)return t.color_primario;}catch(e){}return 'var(--accent)'})(), cursor: 'pointer' }} onClick={() => navigate('/')}>FAIM OBRAS"
)

# Replace "Fima Arquitectura" in print HTML
content = content.replace(
    "    <h1>Fima Arquitectura — Listado de Materiales</h1>",
    "    <h1>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</h1>"
)
content = content.replace(
    "    <h1>Fima Arquitectura — Pedido / Cotización de Materiales</h1>",
    "    <h1>${(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</h1>"
)

# Fix remaining "Fima Arquitectura" in footer strings
content = content.replace('Fima Arquitectura — ${data?.obra}', '${(()=>{try{const s=JSON.parse(localStorage.getItem(\'obras_session\')||\'{}\')||{};if(s?.tenant?.nombre)return s.tenant.nombre;}catch(e){}return \'FAIM OBRAS\'})()}  — ${data?.obra}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to ListadoMateriales.jsx")
