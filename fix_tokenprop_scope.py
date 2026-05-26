with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# El problema: getToken es global y usa tokenProp que no existe en ese scope
# Fix: hacer que authH use localStorage directamente y dentro del componente usemos el prop

# 1. Revertir getToken a solo localStorage (es global, no puede acceder al prop)
old_gettoken = "const getToken = () => tokenProp || localStorage.getItem(\"obras_token\") || \"\";"
new_gettoken = "const getToken = () => localStorage.getItem(\"obras_token\") || \"\";"
if old_gettoken in c:
    c = c.replace(old_gettoken, new_gettoken)
    print("OK revertir getToken global")

# 2. Dentro del componente, al montar, guardar el token prop en localStorage
old_sig = "export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {"
new_sig = """export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {
  // Asegurar que el token prop esté en localStorage antes de cualquier fetch
  if (tokenProp) { localStorage.setItem("obras_token", tokenProp); }"""

if old_sig in c:
    c = c.replace(old_sig, new_sig)
    print("OK token prop → localStorage al montar")
else:
    print("FAIL sig")

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
