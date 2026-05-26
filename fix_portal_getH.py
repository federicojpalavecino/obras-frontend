with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# El problema raiz: authH() se define globalmente usando getToken() que lee localStorage
# pero el token aun no esta en localStorage cuando el componente monta
# Solucion: reemplazar toda referencia a authH() dentro del componente
# con una funcion que usa tokenProp directamente

# 1. Cambiar la funcion getToken global para que sea un fallback
old_gettoken = "const getToken = () => localStorage.getItem(\"obras_token\") || \"\";"
new_gettoken = "const getToken = () => localStorage.getItem(\"obras_token\") || \"\";\nconst authHWithToken = (tk) => ({ Authorization: `Bearer ${tk || getToken()}` });"

if old_gettoken in c:
    c = c.replace(old_gettoken, new_gettoken)
    print("OK authHWithToken agregado")

# 2. En el componente, crear una funcion local que usa el prop
old_comp = """export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {
  // Asegurar que el token prop esté en localStorage antes de cualquier fetch
  if (tokenProp) { localStorage.setItem("obras_token", tokenProp); }"""

new_comp = """export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {
  const getH = () => ({ Authorization: `Bearer ${tokenProp || localStorage.getItem("obras_token") || ""}` });"""

if old_comp in c:
    c = c.replace(old_comp, new_comp)
    print("OK getH local")
else:
    # Intentar sin el if tokenProp
    old_comp2 = "export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {"
    new_comp2 = """export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {
  const getH = () => ({ Authorization: `Bearer ${tokenProp || localStorage.getItem("obras_token") || ""}` });"""
    if old_comp2 in c:
        c = c.replace(old_comp2, new_comp2)
        print("OK getH local (alt)")
    else:
        print("FAIL comp signature")

# 3. Reemplazar authH() con getH() en todos los fetches dentro del componente
# Solo despues de la definicion del componente
comp_start = c.find("const getH = () =>")
if comp_start > 0:
    before = c[:comp_start]
    after = c[comp_start:]
    # Reemplazar authH() por getH() en la parte del componente
    after = after.replace("{ headers: authH() }", "{ headers: getH() }")
    after = after.replace("{ headers: { ...authH(),", "{ headers: { ...getH(),")
    after = after.replace("headers: authH()", "headers: getH()")
    c = before + after
    print("OK reemplazado authH() por getH() en componente")

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
