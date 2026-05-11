import os

path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'

with open(r'C:\Users\feder\Downloads\Gantt_fima.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove supabase imports and init
content = content.replace("import { createClient } from '@supabase/supabase-js';\n", "")
content = content.replace('\nconst SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";\nconst SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";\nconst sb = createClient(SUPABASE_URL, SUPABASE_KEY);\n', "\n")

# Replace API with import api
content = content.replace(
    "const API = 'https://fima-backend-production.up.railway.app';",
    "import api from '../api';"
)

# Replace fetch(${API}/presupuestos/${id}) with api.get
content = content.replace(
    "        fetch(`${API}/presupuestos/${id}`).then(r => r.json()),",
    "        api.get(`/presupuestos/${id}`).then(r => r.data),"
)

# Replace sb.from gantt_tareas select
content = content.replace(
    "        sb.from('gantt_tareas').select('*').eq('presupuesto_id', id).order('orden'),",
    "        api.get(`/presupuestos/${id}/gantt/tareas`).then(r => ({data: r.data})),"
)

# Replace sb.from gantt_config_proyecto select
content = content.replace(
    "        sb.from('gantt_config_proyecto').select('*').eq('presupuesto_id', id).single(),",
    "        api.get(`/presupuestos/${id}/gantt/config`).catch(() => ({data: {}})),"
)

# Fix data access after Promise.all
content = content.replace(
    "      setPresupuesto(pRes);",
    "      setPresupuesto(pRes);"
)
content = content.replace(
    "      setTareas(tRes.data || []);",
    "      setTareas(Array.isArray(tRes.data) ? tRes.data : []);"
)
content = content.replace(
    "      if (cRes.data) setConfig(cRes.data);",
    "      if (cRes.data && Object.keys(cRes.data).length) setConfig(c => ({...c, ...cRes.data}));"
)

# Replace guardarConfig supabase calls
content = content.replace(
    "    const { data: existing } = await sb.from('gantt_config_proyecto').select('id').eq('presupuesto_id', id).single();\n    if (existing) await sb.from('gantt_config_proyecto').update(data).eq('presupuesto_id', id);\n    else await sb.from('gantt_config_proyecto').insert(data);",
    "    await api.put(`/presupuestos/${id}/gantt/config`, data);"
)

# Replace horas-mo fetch
content = content.replace(
    "      const res = await fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/horas-mo`);\n      const horasMO = await res.json();",
    "      const horasMO = {}; // calculado desde lineas"
)

# Replace gantt_tareas delete all
content = content.replace(
    "    await sb.from('gantt_tareas').delete().eq('presupuesto_id', id);",
    "    // tareas se borran via generar endpoint"
)

# Replace gantt_tareas insert nuevasTareas - use api endpoint
content = content.replace(
    "      await sb.from('gantt_tareas').insert(nuevasTareas);",
    """      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('Tareas generadas');
      setGenerando(false);
      return;"""
)

# Replace individual tarea save
content = content.replace(
    "      await sb.from('gantt_tareas').update(data).eq('id', tarea.id);",
    "      await api.put(`/presupuestos/${id}/gantt/tareas/${tarea.id}`, data);"
)
content = content.replace(
    "      await sb.from('gantt_tareas').insert({ ...data, presupuesto_id: parseInt(id) });",
    "      const res = await api.post(`/presupuestos/${id}/gantt/tareas`, { ...data, presupuesto_id: parseInt(id) }); tarea.id = res.data.id;"
)

# Replace tarea delete
content = content.replace(
    "    await sb.from('gantt_tareas').delete().eq('id', tid);",
    "    await api.delete(`/presupuestos/${id}/gantt/tareas/${tid}`);"
)

# Remove planner export (uses sb)
content = content.replace(
    "    const { data: proyectos } = await sb.from('planner_proyectos').select('*');",
    "    // planner export not available"
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

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to Gantt.jsx")
