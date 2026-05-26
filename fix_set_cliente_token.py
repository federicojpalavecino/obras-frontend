with open(r"C:\obras-frontend\src\App.js", "r", encoding="utf-8") as f:
    c = f.read()

old = '''        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        // CRITICAL: guardar el token para que el portal pueda llamar a la API
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
        }
        // Guardar tenant del cliente para branding
        if (data.tenant) {
          setTenant(data.tenant);
          localStorage.setItem("obras_tenant", JSON.stringify(data.tenant));
        }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''

new = '''        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        if (data.token) {
          localStorage.setItem("obras_token", data.token);
          setClienteToken(data.token);
        }
        if (data.tenant) {
          setTenant(data.tenant);
          localStorage.setItem("obras_tenant", JSON.stringify(data.tenant));
        }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''

if old in c:
    c = c.replace(old, new)
    print("OK setClienteToken en login")
else:
    print("FAIL - buscando patron...")
    idx = c.find("obras_cliente")
    print(repr(c[idx:idx+400]))

with open(r"C:\obras-frontend\src\App.js", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
