with open(r"C:\obras-frontend\src\pages\AccesosClientes.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Agregar presupuestos_visibles al form y estado para presupuestos del cliente
old_form = 'const [form, setForm] = useState({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"] });'
new_form = '''const [form, setForm] = useState({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"], presupuestos_visibles: [] });
  const [presupuestosCliente, setPresupuestosCliente] = useState([]);'''

if old_form in c:
    c = c.replace(old_form, new_form)
    print("OK form pv")
else:
    print("FAIL form pv (puede ser estructura distinta)")
    # buscar el useState del form
    idx = c.find("secciones_visibles:")
    if idx > 0:
        print(repr(c[idx-60:idx+120]))

# 2. Cuando se elige un cliente, cargar sus presupuestos
old_select = '''<select style={inp} value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}>'''
new_select = '''<select style={inp} value={form.cliente_id} onChange={(e) => {
                  const cid = e.target.value;
                  setForm((f) => ({ ...f, cliente_id: cid, presupuestos_visibles: [] }));
                  if (cid) {
                    fetch(`${API}/clientes/${cid}/presupuestos`, { headers: authH() })
                      .then(r => r.ok ? r.json() : []).then(d => setPresupuestosCliente(Array.isArray(d) ? d : [])).catch(() => setPresupuestosCliente([]));
                  } else setPresupuestosCliente([]);
                }}>'''

if old_select in c:
    c = c.replace(old_select, new_select)
    print("OK select carga presupuestos")
else:
    print("FAIL select")

# 3. crearAcceso envía presupuestos_visibles
old_body = '''body: JSON.stringify({ email: form.email.toLowerCase().trim(), nombre: form.nombre, cliente_id: parseInt(form.cliente_id), password: form.password, secciones_visibles: form.secciones_visibles }) });'''
new_body = '''body: JSON.stringify({ email: form.email.toLowerCase().trim(), nombre: form.nombre, cliente_id: parseInt(form.cliente_id), password: form.password, secciones_visibles: form.secciones_visibles, presupuestos_visibles: form.presupuestos_visibles.length > 0 ? form.presupuestos_visibles : null }) });'''

if old_body in c:
    c = c.replace(old_body, new_body)
    print("OK body pv")
else:
    print("FAIL body pv")

# 4. Agregar selector de presupuestos en el modal, después de las secciones (antes del cierre del form fields)
# Buscar el bloque de checkboxes de secciones para agregar despues
old_secciones_end = '''                  })}
                </div>
              </div>'''
# Solo el primero (el de secciones)
new_secciones_end = '''                  })}
                </div>
              </div>
              {form.cliente_id && presupuestosCliente.length > 0 && (
                <div>
                  <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué presupuestos puede ver?</label>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Si no seleccionás ninguno, verá todos sus presupuestos.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {presupuestosCliente.map((p) => {
                      const checked = form.presupuestos_visibles.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${checked ? C.accent : C.border}`, background: checked ? "#f0fdf4" : C.surface, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={() => {
                            setForm((f) => ({ ...f, presupuestos_visibles: checked ? f.presupuestos_visibles.filter((x) => x !== p.id) : [...f.presupuestos_visibles, p.id] }));
                          }} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                          <span style={{ fontSize: 13, color: checked ? C.accent : C.text, fontWeight: checked ? 600 : 400 }}>{p.nombre_obra}</span>
                          <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>{p.estado}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>'''

# Reemplazar solo la primera ocurrencia (la de secciones)
if old_secciones_end in c:
    c = c.replace(old_secciones_end, new_secciones_end, 1)
    print("OK selector presupuestos en modal")
else:
    print("FAIL selector - patron de secciones no encontrado")

# 5. Reset form
old_reset = 'setForm({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"] });'
new_reset = 'setForm({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"], presupuestos_visibles: [] }); setPresupuestosCliente([]);'
c = c.replace(old_reset, new_reset)

with open(r"C:\obras-frontend\src\pages\AccesosClientes.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("AccesosClientes.jsx OK")
