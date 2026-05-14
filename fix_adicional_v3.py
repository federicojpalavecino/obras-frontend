path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix agregarItemAlAdicional to refresh modalAdicional directly
old = '''  const agregarItemAlAdicional = async (item) => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await cargarAdicionales();
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);'''

new = '''  const refreshModalAdicional = async () => {
    if (!modalAdicional?.id) return;
    try {
      const res = await api.get(`/presupuestos/${modalAdicional.id}`);
      setModalAdicional(res.data);
    } catch(e) { console.error(e); }
  };

  const agregarItemAlAdicional = async (item) => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await refreshModalAdicional();'''

if old in content:
    content = content.replace(old, new)
    print("Fixed agregarItemAlAdicional v1")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed agregarItemAlAdicional v1 (CRLF)")
    else:
        print("Pattern not found, applying targeted fix")

# Fix all other places that do: await cargarAdicionales(); const adics = ...; const updated = ...
import re
# Replace the pattern: await cargarAdicionales();\n      const adics = await api.get...\n      const updated = (adics.data || []).find...;\n      if (updated) setModalAdicional(updated);
pattern = r'await cargarAdicionales\(\);\r?\n      const adics = await api\.get\(`/presupuestos/\$\{id\}/adicionales`\);\r?\n      const updated = \(adics\.data \|\| \[\]\)\.find\(a => a\.id === modalAdicional\.id\);\r?\n      if \(updated\) setModalAdicional\(updated\);'
replacement = 'await refreshModalAdicional();'
new_content = re.sub(pattern, replacement, content)
if new_content != content:
    content = new_content
    print("Fixed all cargarAdicionales+adics patterns via regex")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
