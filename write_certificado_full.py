import os

path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'

# Read the FIMA file and adapt it
with open(r'C:\Users\feder\Downloads\Certificado_fima.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove supabase import and init
content = content.replace("import { createClient } from '@supabase/supabase-js';\n", "")
content = content.replace("const sb = createClient('https://bomxksdisszrhhsctowd.supabase.co','sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2');\n", "")

# Replace FIMA with tenant name in header
content = content.replace(
    ">FIMA</span>",
    ">{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>"
)
# Fix color too
content = content.replace(
    "color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>FIMA",
    "color: (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.color_primario)return s.tenant.color_primario;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.color_primario)return t.color_primario;}catch(e){}return 'var(--accent)'})(), cursor: 'pointer' }} onClick={() => navigate('/')}>FAIM OBRAS"
)

# Replace sb.from('cert_egresos') calls with api calls
content = content.replace(
    "  const cargarCertEgresos = async () => {\n    const { data } = await sb.from('cert_egresos').select('*').eq('presupuesto_id', id).order('created_at', { ascending: false });\n    if (data) setCertEgresosGuardados(data);\n  };",
    """  const cargarCertEgresos = async () => {
    try {
      const res = await api.get(`/presupuestos/${id}/cert-egresos`);
      if (res.data) setCertEgresosGuardados(res.data);
    } catch(e) { console.error(e); }
  };"""
)

# Replace guardarCertEgresos
content = content.replace(
    "  const guardarCertEgresos = async (sel, total, vinculadoNum) => {\n    await sb.from('cert_egresos').insert({\n      presupuesto_id: parseInt(id),\n      certificado_num: vinculadoNum ? parseInt(vinculadoNum) : null,\n      fecha: new Date().toISOString().split('T')[0],\n      obra: presupuesto?.nombre_obra,\n      egresos: sel,\n      total: total,\n    });\n    await cargarCertEgresos();\n  };",
    """  const guardarCertEgresos = async (sel, total, vinculadoNum) => {
    try {
      await api.post(`/presupuestos/${id}/cert-egresos`, {
        certificado_num: vinculadoNum ? parseInt(vinculadoNum) : null,
        egresos: sel,
        total: total,
      });
      await cargarCertEgresos();
    } catch(e) { alert('Error al guardar egresos: ' + e.message); }
  };"""
)

# Replace cert_egresos delete in button
content = content.replace(
    "await sb.from('cert_egresos').delete().eq('id', certEgVinculado.id);",
    "await api.delete(`/presupuestos/${id}/cert-egresos/${certEgVinculado.id}`);"
)

# Replace cargarAjustes (cert_ajustes) — store ajustes locally in state, not in DB
content = content.replace(
    "  const cargarAjustes = async () => {\n    try {\n      const { data } = await sb.from('cert_ajustes').select('*').eq('presupuesto_id', id);\n      if (data) {\n        const map = {};\n        data.forEach(a => { map[a.certificado_num] = a; });\n        setAjustesPorCert(map);\n      }\n    } catch(e) { console.error('Error cargando ajustes:', e); }\n  };",
    """  const cargarAjustes = async () => {
    // Ajustes stored locally for now
  };"""
)

# Replace cert_ajustes upsert in handleCrearCertificado
content = content.replace(
    "      if (tieneAjustes) {\n        await sb.from('cert_ajustes').upsert({\n          presupuesto_id: parseInt(id),\n          certificado_num: numNuevo,\n          mayores_costos_pct: parseFloat(certMayoresCostosPct) || 0,\n          fondo_reparo_pct: parseFloat(certFondoReparoPct) || 0,\n          multas: parseFloat(certMultas) || 0,\n          nota: certNota || null,\n        }, { onConflict: 'presupuesto_id,certificado_num' });\n      }",
    """      if (tieneAjustes) {
        // Store ajustes in local state
        setAjustesPorCert(prev => ({...prev, [numNuevo]: {
          mayores_costos_pct: parseFloat(certMayoresCostosPct) || 0,
          fondo_reparo_pct: parseFloat(certFondoReparoPct) || 0,
          multas: parseFloat(certMultas) || 0,
          nota: certNota || null,
        }}));
      }"""
)

# Replace cert_ajustes upsert in handleEditCert
content = content.replace(
    "      await sb.from('cert_ajustes').upsert({\n        presupuesto_id: parseInt(id),\n        certificado_num: modalEditCert.numero,\n        mayores_costos_pct: parseFloat(editMayoresCostosPct) || 0,\n        fondo_reparo_pct: parseFloat(editFondoReparoPct) || 0,\n        multas: parseFloat(editMultas) || 0,\n        nota: editNota || null,\n      }, { onConflict: 'presupuesto_id,certificado_num' });",
    """      setAjustesPorCert(prev => ({...prev, [modalEditCert.numero]: {
        mayores_costos_pct: parseFloat(editMayoresCostosPct) || 0,
        fondo_reparo_pct: parseFloat(editFondoReparoPct) || 0,
        multas: parseFloat(editMultas) || 0,
        nota: editNota || null,
      }});"""
)

# Replace cargarEgresos — remove supabase, use empty for now (egresos comes from control financiero)
content = content.replace(
    "  const cargarEgresos = async () => {\n    try {\n      const [semanasRes, certEgRes] = await Promise.all([\n        sb.from('semanas').select('*').order('fecha', { ascending: false }),\n        sb.from('cert_egresos').select('*').order('created_at', { ascending: false }),\n      ]);",
    """  const cargarEgresos = async () => {
    try {
      // Cargar egresos del control financiero de OBRAS
      const [semanasRes, certEgRes] = await Promise.all([
        api.get('/finanzas/semanas').then(r => ({data: r.data || []})).catch(() => ({data: []})),
        api.get(`/presupuestos/${id}/cert-egresos`).then(r => ({data: r.data || []})).catch(() => ({data: []})),
      ]);"""
)

# Fix semanas data access (api returns array directly, not {data: ...})  
content = content.replace(
    "      const data = semanasRes.data || [];\n      const certEgData = certEgRes.data || [];",
    """      const data = Array.isArray(semanasRes.data) ? semanasRes.data : [];
      const certEgData = Array.isArray(certEgRes.data) ? certEgRes.data : [];"""
)

# Fix cert_egresos egresos field (stored as array in json)
content = content.replace(
    "      certEgData.forEach(ce => {\n        (ce.egresos || []).forEach(e => {",
    """      certEgData.forEach(ce => {
        (ce.egresos || []).forEach(e => {"""
)

# Fix print - replace "Fima Arquitectura" with tenant name
tenant_name_js = "(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS';})()"
content = content.replace("'Fima Arquitectura'", f"'{tenant_name_js}'")
content = content.replace('"Fima Arquitectura"', f'({tenant_name_js})')
content = content.replace('>Fima Arquitectura<', f'>{{{tenant_name_js}}}<')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Written {len(content)} chars to Certificado.js")
