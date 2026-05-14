path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix cargarAdicionales to actually load adicionales and refresh modal
old = '  const cargarAdicionales = async () => { setAdicionales([]); };'
new = '''  const cargarAdicionales = async () => {
    try {
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const adicData = adics.data || [];
      // Load full data for each adicional
      const full = await Promise.all(adicData.map(a => api.get(`/presupuestos/${a.id}`).then(r => r.data).catch(() => a)));
      setAdicionales(full);
      // Refresh modal if open
      if (modalAdicional && modalAdicional.id) {
        const updated = full.find(a => a.id === modalAdicional.id);
        if (updated) setModalAdicional(updated);
      }
    } catch(e) { console.error(e); }
  };'''

if old in content:
    content = content.replace(old, new)
    print("Fixed cargarAdicionales")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed cargarAdicionales (CRLF)")
    else:
        print("ERROR: cargarAdicionales not found")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
