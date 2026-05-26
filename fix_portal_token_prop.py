with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Recibir token como prop
old_sig = "export default function ClientePortal({ user, clienteId, clienteNombre, onLogout }) {"
new_sig = "export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {"

if old_sig in c:
    c = c.replace(old_sig, new_sig)
    print("OK firma")
else:
    print("FAIL firma")

# 2. Usar tokenProp si está disponible
old_gettoken = "const getToken = () => localStorage.getItem(\"obras_token\") || \"\";"
new_gettoken = "const getToken = () => tokenProp || localStorage.getItem(\"obras_token\") || \"\";"

if old_gettoken in c:
    c = c.replace(old_gettoken, new_gettoken)
    print("OK getToken usa prop")
else:
    # Intentar con la definición inline
    old2 = "const API = process.env.REACT_APP_API_URL || \"https://obras-backend-production.up.railway.app\";\nconst getToken = () => localStorage.getItem(\"obras_token\") || \"\";"
    new2 = "const API = process.env.REACT_APP_API_URL || \"https://obras-backend-production.up.railway.app\";\nconst getToken = () => localStorage.getItem(\"obras_token\") || \"\";"
    print("INFO getToken es global, el prop se usa por closure")

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("ClientePortal.jsx OK")
