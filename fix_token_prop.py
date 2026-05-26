with open(r"C:\obras-frontend\src\App.js", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Agregar estado para el token del cliente
old_state = "  const [clienteInfo, setClienteInfo] = useState(null);"
new_state = "  const [clienteInfo, setClienteInfo] = useState(null);\n  const [clienteToken, setClienteToken] = useState(null);"

if old_state in c:
    c = c.replace(old_state, new_state)
    print("OK estado clienteToken")
else:
    print("FAIL estado")

# 2. Al cargar desde localStorage, restaurar el token
old_restore = '''          if (ci?.email && ci?.cliente_id) { setClienteInfo(ci); setUser({ email: ci.email, nombre: ci.nombre }); setLoading(false); return; }'''
new_restore = '''          if (ci?.email && ci?.cliente_id) {
            const savedToken = localStorage.getItem("obras_token");
            if (savedToken) setClienteToken(savedToken);
            setClienteInfo(ci); setUser({ email: ci.email, nombre: ci.nombre }); setLoading(false); return;
          }'''

if old_restore in c:
    c = c.replace(old_restore, new_restore)
    print("OK restore token")
else:
    print("FAIL restore")

# 3. Al login, guardar token en estado ANTES de setClienteInfo
old_login = '''        if (data.token) { localStorage.setItem("obras_token", data.token); }
        if (data.tenant) { setTenant(data.tenant); localStorage.setItem("obras_tenant", JSON.stringify(data.tenant)); }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''
new_login = '''        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          setClienteToken(data.token);
        }
        if (data.tenant) { setTenant(data.tenant); localStorage.setItem("obras_tenant", JSON.stringify(data.tenant)); }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''

if old_login in c:
    c = c.replace(old_login, new_login)
    print("OK login token state")
else:
    print("FAIL login")

# 4. Pasar token como prop al ClientePortal
old_portal = '    return <ClientePortal user={user} clienteId={clienteInfo.cliente_id} clienteNombre={clienteInfo.nombre} onLogout={handleLogout} />;'
new_portal = '    return <ClientePortal user={user} clienteId={clienteInfo.cliente_id} clienteNombre={clienteInfo.nombre} onLogout={handleLogout} token={clienteToken || localStorage.getItem("obras_token")} />;'

if old_portal in c:
    c = c.replace(old_portal, new_portal)
    print("OK token prop")
else:
    print("FAIL portal prop")

with open(r"C:\obras-frontend\src\App.js", "w", encoding="utf-8") as f:
    f.write(c)
print("App.js OK")
