import re

# ── AccesosClientes: agregar checkboxes de secciones ──────────────────────────
with open(r"C:\obras-frontend\src\pages\AccesosClientes.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Agregar secciones al form state
old_form = 'const [form, setForm] = useState({ email: "", nombre: "", cliente_id: "", password: "" });'
new_form = '''const SECCIONES = [
    { id: "avance", label: "Avance de obra" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];
  const [form, setForm] = useState({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"] });'''

if old_form in c:
    c = c.replace(old_form, new_form)
    print("OK form state")
else:
    print("FAIL form state")

# 2. crearAcceso envía secciones
old_create = '''body: JSON.stringify({ email: form.email.toLowerCase().trim(), nombre: form.nombre, cliente_id: parseInt(form.cliente_id), password: form.password }) });'''
new_create = '''body: JSON.stringify({ email: form.email.toLowerCase().trim(), nombre: form.nombre, cliente_id: parseInt(form.cliente_id), password: form.password, secciones_visibles: form.secciones_visibles }) });'''

if old_create in c:
    c = c.replace(old_create, new_create)
    print("OK crear envia secciones")
else:
    print("FAIL crear")

# 3. Reset form incluye secciones
old_reset = 'setForm({ email: "", nombre: "", cliente_id: "", password: "" });'
new_reset = 'setForm({ email: "", nombre: "", cliente_id: "", password: "", secciones_visibles: ["avance","contrato","cobros","gantt","consultas"] });'
c = c.replace(old_reset, new_reset)

# 4. Agregar UI de checkboxes en el modal, después del campo password
old_pass_field = '''              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Contraseña *</label>
                <input style={inp} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Contraseña para el portal" />
              </div>'''

new_pass_field = '''              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Contraseña *</label>
                <input style={inp} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Contraseña para el portal" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>¿Qué puede ver el cliente?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {SECCIONES.map((s) => {
                    const checked = form.secciones_visibles.includes(s.id);
                    return (
                      <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, border: `1px solid ${checked ? C.accent : C.border}`, background: checked ? "#f0fdf4" : C.surface, cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => {
                          setForm((f) => ({ ...f, secciones_visibles: checked ? f.secciones_visibles.filter((x) => x !== s.id) : [...f.secciones_visibles, s.id] }));
                        }} style={{ accentColor: C.accent, width: 16, height: 16 }} />
                        <span style={{ fontSize: 13, color: checked ? C.accent : C.text, fontWeight: checked ? 600 : 400 }}>{s.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>'''

if old_pass_field in c:
    c = c.replace(old_pass_field, new_pass_field)
    print("OK checkboxes UI")
else:
    print("FAIL checkboxes UI")

# 5. Mostrar las secciones en cada acceso de la lista
old_cliente_label = '''                    {cliente && <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>Cliente: {cliente.nombre}</div>}'''
new_cliente_label = '''                    {cliente && <div style={{ fontSize: 12, color: C.accent, marginTop: 2 }}>Cliente: {cliente.nombre}</div>}
                    {a.secciones_visibles && a.secciones_visibles.length < 5 && (
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Ve: {a.secciones_visibles.join(", ")}</div>
                    )}'''

if old_cliente_label in c:
    c = c.replace(old_cliente_label, new_cliente_label)
    print("OK label secciones en lista")
else:
    print("FAIL label")

with open(r"C:\obras-frontend\src\pages\AccesosClientes.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("AccesosClientes.jsx OK\n")

# ── ClientePortal: filtrar tabs según config ──────────────────────────────────
with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# Agregar estado de secciones visibles
old_state = "  const [toast, setToast] = useState(\"\");"
new_state = '''  const [toast, setToast] = useState("");
  const [seccionesVisibles, setSeccionesVisibles] = useState(["avance","contrato","cobros","gantt","consultas"]);'''

if old_state in c:
    c = c.replace(old_state, new_state)
    print("OK estado secciones portal")
else:
    print("FAIL estado portal")

# Cargar config al montar (dentro del useEffect que hace doFetch)
old_dofetch = '''    if (tokenProp) {
      // Token llegó como prop - usarlo directo
      localStorage.setItem("obras_token", tokenProp);
      doFetch(tokenProp);
    } else {'''
new_dofetch = '''    const loadConfig = (tk) => {
      fetch(`${API}/portal/mi-config`, { headers: { Authorization: `Bearer ${tk}` } })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d?.secciones_visibles) setSeccionesVisibles(d.secciones_visibles); })
        .catch(() => {});
    };
    if (tokenProp) {
      localStorage.setItem("obras_token", tokenProp);
      loadConfig(tokenProp);
      doFetch(tokenProp);
    } else {'''

if old_dofetch in c:
    c = c.replace(old_dofetch, new_dofetch)
    print("OK loadConfig portal")
else:
    print("FAIL loadConfig - buscar manual")

# Filtrar TABS según seccionesVisibles
old_tabs = '''  const TABS = [
    { id: "avance", label: "Avance" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];'''
new_tabs = '''  const ALL_TABS = [
    { id: "avance", label: "Avance" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];
  const TABS = ALL_TABS.filter(t => seccionesVisibles.includes(t.id));'''

if old_tabs in c:
    c = c.replace(old_tabs, new_tabs)
    print("OK filtrar tabs")
else:
    print("FAIL filtrar tabs")

# Asegurar que el tab activo sea visible
old_loading_check = "  if (loading) return ("
new_loading_check = '''  // Si el tab activo no está visible, cambiar al primero disponible
  useEffect(() => {
    if (TABS.length > 0 && !TABS.some(t => t.id === tab)) {
      setTab(TABS[0].id);
    }
  }, [seccionesVisibles]);

  if (loading) return ('''

if old_loading_check in c:
    c = c.replace(old_loading_check, new_loading_check, 1)
    print("OK auto-select tab")
else:
    print("FAIL auto-select")

with open(r"C:\obras-frontend\src\pages\ClientePortal.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("ClientePortal.jsx OK")
