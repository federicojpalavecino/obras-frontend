"""
Deploy completo de todos los fixes:
1. App.js — cliente login guarda token + tenant
2. ConfigCuenta.jsx — logo actualiza localStorage
3. ClientePortal.jsx — reescrito con contrato, cobros, branding
4. Backend — contrato/aceptar, cobros accesible por cliente
"""
import os, shutil

FRONTEND = r"C:\obras-frontend"
BACKEND = r"C:\obras-backend"
DL = r"C:\Users\feder\Downloads"

print("=== DEPLOY COMPLETO FAIM OBRAS ===\n")

# 1. Backend fixes
print("[1/4] Backend fixes...")
os.chdir(BACKEND)
ret = os.system(f"python {os.path.join(DL, 'fix_pt2_backend.py')}")
if ret == 0:
    os.system("railway up --detach")
    print("  ✓ Backend en deploy")
else:
    print("  ⚠ Error en backend fix")

# 2. Frontend fixes
print("\n[2/4] Frontend fixes...")
os.chdir(FRONTEND)
ret = os.system(f"python {os.path.join(DL, 'fix_pt1_login_logo.py')}")
print("  ✓ App.js + ConfigCuenta fix" if ret == 0 else "  ⚠ Error")

# 3. ClientePortal nuevo
print("\n[3/4] ClientePortal nuevo...")
src = os.path.join(DL, "ClientePortal_new.jsx")
dst = os.path.join(FRONTEND, "src", "pages", "ClientePortal.jsx")
if os.path.exists(src):
    shutil.copy2(src, dst)
    print("  ✓ ClientePortal.jsx reemplazado")
else:
    print("  ⚠ ClientePortal_new.jsx no encontrado en Downloads")

# 4. Build y deploy
print("\n[4/4] Build y deploy frontend...")
ret = os.system("npm run build")
if ret == 0:
    os.system('git add . && git commit -m "fix: logo, cliente login token, portal contrato y cobros" && git push')
    print("  ✓ Frontend deployado")
else:
    print("  ⚠ Build falló")

print("\n=== DONE ===")
print("Pendiente: SQL en Railway → Postgres (ya ejecutado anteriormente)")
print("Esperar 3-4 min para backend, refrescar app y probar login cliente")
