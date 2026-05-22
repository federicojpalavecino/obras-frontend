"""
Script de deploy completo para FAIM OBRAS SaaS.
Ejecutar desde C:\\obras-frontend:
  python deploy_saas.py
"""
import os
import shutil
import sys

FRONTEND = r"C:\obras-frontend"
BACKEND = r"C:\obras-backend"
DOWNLOADS = r"C:\Users\feder\Downloads"

def cp(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copy2(src, dst)
    print(f"  ✓ {os.path.basename(dst)}")

print("=" * 60)
print("FAIM OBRAS — Deploy SaaS completo")
print("=" * 60)

# ── Backend ──────────────────────────────────────────────────────────────────
print("\n[1/3] Aplicando fix al backend...")
fix_py = os.path.join(DOWNLOADS, "fix_backend_saas.py")
if os.path.exists(fix_py):
    os.chdir(BACKEND)
    ret = os.system(f"python {fix_py}")
    print("  ✓ fix_backend_saas.py ejecutado" if ret == 0 else "  ⚠ Error en fix_backend_saas.py")
else:
    print("  ⚠ fix_backend_saas.py no encontrado en Downloads")

# ── Frontend: Obra.jsx ────────────────────────────────────────────────────────
print("\n[2/3] Copiando páginas al frontend...")
pages_dir = os.path.join(FRONTEND, "src", "pages")
cotizador_dir = os.path.join(FRONTEND, "src", "cotizador", "pages")

obra_jsx = os.path.join(DOWNLOADS, "Obra.jsx")
if os.path.exists(obra_jsx):
    cp(obra_jsx, os.path.join(pages_dir, "Obra.jsx"))
else:
    print("  ⚠ Obra.jsx no encontrado")

# ── App.js update: agregar ruta /obra/:id ────────────────────────────────────
print("\n[2b/3] Actualizando App.js con ruta de obra...")
app_js_path = os.path.join(FRONTEND, "src", "App.js")

with open(app_js_path, "r", encoding="utf-8") as f:
    app_content = f.read()

# 1. Agregar import de Obra si no existe
obra_import = 'import Obra from "./pages/Obra";'
if obra_import not in app_content:
    # Insertar después del último import
    app_content = app_content.replace(
        'import Landing from "./pages/Landing";',
        'import Landing from "./pages/Landing";\n' + obra_import
    )
    print("  ✓ Import de Obra agregado")
else:
    print("  ✓ Import de Obra ya existe")

# 2. Agregar ruta /cotizador/presupuesto/:id/obra si no existe
obra_route = '<Route path="/cotizador/presupuesto/:id/obra" element={<Obra />}/>'
if obra_route not in app_content:
    # Insertar después de la ruta del certificado
    app_content = app_content.replace(
        '<Route path="/cotizador/presupuesto/:id/certificado" element={<Certificado />}/>',
        '<Route path="/cotizador/presupuesto/:id/certificado" element={<Certificado />}/>\n        ' + obra_route
    )
    print("  ✓ Ruta /obra/:id agregada")
else:
    print("  ✓ Ruta de Obra ya existe")

# 3. Fix: estudio login debe guardar tenant en obras_session y obras_tenant
# El App.js ya hace esto en el bloque try estudio/login, pero necesitamos
# que también guarde el token en obras_session para que /tenant funcione
old_estudio_save = '''        const ei = { nombre: data.nombre, rol: data.rol, presupuestos_asignados: data.presupuestos_asignados, email: data.email };
        localStorage.setItem("obras_estudio", JSON.stringify(ei));
        // Check subscription using the token from estudio login
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          await checkSuscripcion(data.token);
          try {
            const tr = await fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${data.token}` } });
            if (tr.ok) { const td = await tr.json(); setTenant(td); }
          } catch(e) {}
        }
        setEstudioInfo(ei); setUser({ email: data.email, nombre: data.nombre, rol: data.rol }); return;'''

new_estudio_save = '''        const ei = { nombre: data.nombre, rol: data.rol, presupuestos_asignados: data.presupuestos_asignados, email: data.email };
        localStorage.setItem("obras_estudio", JSON.stringify(ei));
        // Check subscription using the token from estudio login
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          await checkSuscripcion(data.token);
          // Fetch tenant data (also returned by estudio/login now)
          let tenantData = data.tenant || null;
          if (!tenantData) {
            try {
              const tr = await fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${data.token}` } });
              if (tr.ok) tenantData = await tr.json();
            } catch(e) {}
          }
          if (tenantData) {
            setTenant(tenantData);
            localStorage.setItem("obras_tenant", JSON.stringify(tenantData));
            // Also save in obras_session for compatibility
            localStorage.setItem("obras_session", JSON.stringify({ user: { email: data.email, nombre: data.nombre, rol: data.rol }, tenant: tenantData, token: data.token }));
          }
        }
        setEstudioInfo(ei); setUser({ email: data.email, nombre: data.nombre, rol: data.rol }); return;'''

if old_estudio_save in app_content:
    app_content = app_content.replace(old_estudio_save, new_estudio_save)
    print("  ✓ Fix estudio login tenant en App.js")
else:
    print("  ⚠ Patron estudio login no encontrado (puede que ya esté actualizado)")

with open(app_js_path, "w", encoding="utf-8") as f:
    f.write(app_content)
print("  ✓ App.js actualizado")

# ── Fix Presupuesto.js: agregar botón "Gestión de obra" ─────────────────────
print("\n[2c/3] Agregando botón Gestión de obra en Presupuesto.js...")
pres_path = os.path.join(cotizador_dir, "Presupuesto.js")

with open(pres_path, "r", encoding="utf-8") as f:
    pres_content = f.read()

# Agregar import useNavigate si no lo tiene
if "useNavigate" not in pres_content:
    pres_content = pres_content.replace(
        "import { useState, useEffect",
        "import { useState, useEffect, useCallback"
    )

# Buscar el botón de certificados y agregar uno de obra al lado
obra_btn = '''<button onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)} style={{ padding:"8px 14px", background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", color:"#059669", fontFamily:"inherit" }}>🏗️ Gestión obra</button>'''

if "Gestión obra" not in pres_content and "🏗️" not in pres_content:
    # Buscar el botón de certificados para agregar el de obra cerca
    cert_btn_old = '📜 Certificados'
    if cert_btn_old in pres_content:
        # Encontrar la línea del botón de certificados y agregar uno antes
        pres_content = pres_content.replace(
            cert_btn_old,
            '🏗️ Obra</button> <button onClick={()=>navigate(`/cotizador/presupuesto/${id}/obra`)} style={{padding:"8px 14px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",color:"#059669",fontFamily:"inherit"}} >📊 Gestión obra'
        )
        print("  ✓ Botón Gestión obra agregado junto a Certificados")
    else:
        print("  ⚠ No se encontró botón de certificados para agregar botón obra")
else:
    print("  ✓ Botón ya existe")

with open(pres_path, "w", encoding="utf-8") as f:
    f.write(pres_content)

# ── Build & deploy ────────────────────────────────────────────────────────────
print("\n[3/3] Build y deploy...")
os.chdir(FRONTEND)
ret = os.system("npm run build")
if ret != 0:
    print("\n⚠ Build falló. Revisá los errores arriba.")
    sys.exit(1)

os.system('git add . && git commit -m "feat: SaaS completo - Obra, contratos, cobros, subcontratos, compras" && git push')
print("\n✓ Deploy frontend completado")

# ── Deploy backend ────────────────────────────────────────────────────────────
print("\nDeployando backend...")
os.chdir(BACKEND)
os.system("railway up --detach")
print("✓ Backend en deploy (esperar 3-4 min)")

print("\n" + "=" * 60)
print("LISTO. Próximos pasos:")
print("1. Ejecutar SQL en Railway → Postgres (ver fix_backend_saas.py output)")
print("2. Esperar 3-4 min para que el backend se reinicie")
print("3. Probar la app")
print("=" * 60)
