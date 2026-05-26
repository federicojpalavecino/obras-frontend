with open(r"C:\obras-frontend\src\App.js", "r", encoding="utf-8") as f:
    c = f.read()

# Buscar el bloque exacto del cliente login
old = '''        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
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

if old in c:
    print("OK - fix ya aplicado correctamente")
else:
    # Buscar version sin fix
    old2 = '''        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''
    
    new2 = '''        const ci = { cliente_id: data.cliente_id, nombre: data.nombre, email: data.email };
        localStorage.setItem("obras_cliente", JSON.stringify(ci));
        if (data.token) { localStorage.setItem("obras_token", data.token); }
        if (data.tenant) { setTenant(data.tenant); localStorage.setItem("obras_tenant", JSON.stringify(data.tenant)); }
        setClienteInfo(ci); setUser({ email: data.email, nombre: data.nombre }); return;'''
    
    if old2 in c:
        c = c.replace(old2, new2)
        print("OK - fix aplicado")
    else:
        print("FAIL - buscando patron...")
        idx = c.find("cliente_id: data.cliente_id")
        if idx > 0:
            print(repr(c[idx-20:idx+200]))

with open(r"C:\obras-frontend\src\App.js", "w", encoding="utf-8") as f:
    f.write(c)
print("Done")
