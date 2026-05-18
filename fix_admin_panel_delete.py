"""
fix_admin_panel_delete.py
Agrega boton Eliminar en AdminSuperPanel.jsx con confirmacion doble
"""

path = r'C:\obras-frontend\src\pages\AdminSuperPanel.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add eliminarTenant function after toggleActivo
old_fn = '''  const logout = () => {'''

new_fn = '''  const eliminarTenant = async (tid, nombre) => {
    if (!window.confirm(`¿Eliminar "${nombre}"?\n\nEsto borrará TODOS los datos del estudio permanentemente.`)) return;
    if (!window.confirm(`⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Estás seguro de eliminar "${nombre}" y todos sus datos?\nEsta acción NO se puede deshacer.`)) return;
    try {
      const res = await fetch(`${API}/admin/tenants/${tid}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) { cargar(token); }
      else { const d = await res.json(); alert("Error: " + (d.detail || "No se pudo eliminar")); }
    } catch { alert("Error de conexión"); }
  };

  const logout = () => {'''

content = content.replace(old_fn, new_fn, 1)

# Add Eliminar button next to Activar/Vencer buttons
old_btns = '''                  <div style={{ display:"flex", gap:6 }}>
                    {t.plan_estado !== "activo" && (
                      <button onClick={()=>cambiarPlan(t.id,"activo")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#f0fdf4", border:"1px solid #bbf7d0", color:C.green, borderRadius:6, cursor:"pointer" }}>
                        Activar
                      </button>
                    )}
                    {t.plan_estado !== "vencido" && (
                      <button onClick={()=>cambiarPlan(t.id,"vencido")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fef2f2", border:"1px solid #fecaca", color:C.red, borderRadius:6, cursor:"pointer" }}>
                        Vencer
                      </button>
                    )}
                  </div>'''

new_btns = '''                  <div style={{ display:"flex", gap:6 }}>
                    {t.plan_estado !== "activo" && (
                      <button onClick={()=>cambiarPlan(t.id,"activo")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#f0fdf4", border:"1px solid #bbf7d0", color:C.green, borderRadius:6, cursor:"pointer" }}>
                        Activar
                      </button>
                    )}
                    {t.plan_estado !== "vencido" && (
                      <button onClick={()=>cambiarPlan(t.id,"vencido")}
                        style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fef2f2", border:"1px solid #fecaca", color:C.red, borderRadius:6, cursor:"pointer" }}>
                        Vencer
                      </button>
                    )}
                    <button onClick={()=>eliminarTenant(t.id, t.nombre)}
                      style={{ padding:"4px 10px", fontSize:11, fontWeight:700, background:"#fef2f2", border:"1px solid #fecaca", color:C.red, borderRadius:6, cursor:"pointer" }}>
                      🗑 Eliminar
                    </button>
                  </div>'''

if old_btns in content:
    content = content.replace(old_btns, new_btns, 1)
    print("Added Eliminar button to AdminSuperPanel")
else:
    print("Button pattern not found - checking...")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"AdminSuperPanel.jsx updated")
