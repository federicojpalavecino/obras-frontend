path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix addDias to handle invalid dates
old = """const addDias = (fecha, dias) => {
  const d = new Date(fecha + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
};"""

new = """const addDias = (fecha, dias) => {
  if (!fecha) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(fecha + 'T12:00:00');
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  } catch(e) { return new Date().toISOString().split('T')[0]; }
};"""

if old in content:
    content = content.replace(old, new)
    print("Fixed addDias")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed addDias (CRLF)")
    else:
        print("ERROR: addDias not found")

# Also fix diasEntre to handle invalid dates
old2 = """const diasEntre = (a, b) => {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / 86400000);
};"""
new2 = """const diasEntre = (a, b) => {
  if (!a || !b) return 30;
  try {
    const da = new Date(a + 'T12:00:00');
    const db = new Date(b + 'T12:00:00');
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return 30;
    return Math.round((db - da) / 86400000);
  } catch(e) { return 30; }
};"""

content = content.replace(old2, new2)
content = content.replace(old2.replace('\n','\r\n'), new2.replace('\n','\r\n'))

# Fix default config to always have a valid date
today = "new Date().toISOString().split('T')[0]"
content = content.replace(
    "const [config, setConfig] = useState({ horas_dia: 8, dias_semana: 5, fecha_inicio_obra: '' });",
    f"const [config, setConfig] = useState({{ horas_dia: 8, dias_semana: 5, fecha_inicio_obra: {today} }});"
)
content = content.replace(
    "const [config, setConfig] = useState({ horas_dia: 8, dias_semana: 5, fecha_inicio_obra: new Date().toISOString().split('T')[0] });",
    f"const [config, setConfig] = useState({{ horas_dia: 8, dias_semana: 5, fecha_inicio_obra: {today} }});"
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
