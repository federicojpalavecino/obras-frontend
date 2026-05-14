import os
path = r'C:\obras-frontend\src\cotizador\pages\CurvaInversion.jsx'

with open(r'C:\Users\feder\Downloads\CurvaInversion_actual.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove supabase
content = content.replace("import { createClient } from '@supabase/supabase-js';\n", "")
content = content.replace('\nconst SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";\nconst SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";\nconst sb = createClient(SUPABASE_URL, SUPABASE_KEY);\n', '\nimport api from \'../api\';\n')

# Replace API constant with import api  
content = content.replace("const API = 'https://fima-backend-production.up.railway.app';", "")

# Replace cargar function
old_cargar = """  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch(`${API}/presupuestos/${id}`).then(r => r.json()),
        sb.from('gantt_tareas').select('*').eq('presupuesto_id', id).order('fecha_inicio'),
      ]);
      setPresupuesto(pRes);
      setTareas(tRes.data || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  };"""

new_cargar = """  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        api.get(`/presupuestos/${id}`).then(r => r.data),
        api.get(`/presupuestos/${id}/gantt/tareas`).then(r => r.data),
      ]);
      setPresupuesto(pRes);
      // Convert duracion_dias to fecha_fin for compatibility
      const tareasConFin = (tRes || []).map(t => ({
        ...t,
        fecha_fin: t.fecha_fin || (() => {
          if (!t.fecha_inicio) return t.fecha_inicio;
          const d = new Date(t.fecha_inicio + 'T12:00:00');
          d.setDate(d.getDate() + (t.duracion_dias || 1) - 1);
          return d.toISOString().split('T')[0];
        })(),
        linea_presupuesto_id: t.linea_id,
      }));
      setTareas(tareasConFin);
    } catch(e) { console.error(e); }
    setLoading(false);
  };"""

content = content.replace(old_cargar, new_cargar)

# Fix FIMA header
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
print(f"Written {len(content)} chars to CurvaInversion.jsx")
