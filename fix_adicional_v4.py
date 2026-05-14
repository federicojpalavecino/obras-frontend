path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix refreshModalAdicional to use captured id, not state
old = '''  const refreshModalAdicional = async () => {
    if (!modalAdicional?.id) return;
    try {
      const res = await api.get(`/presupuestos/${modalAdicional.id}`);
      setModalAdicional(res.data);
    } catch(e) { console.error(e); }
  };'''

new = '''  const refreshModalAdicional = async (adicId) => {
    const targetId = adicId || modalAdicional?.id;
    if (!targetId) return;
    try {
      const res = await api.get(`/presupuestos/${targetId}`);
      setModalAdicional(res.data);
    } catch(e) { console.error(e); }
  };'''

if old in content:
    content = content.replace(old, new)
    print("Fixed refreshModalAdicional")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed (CRLF)")
    else:
        print("Not found")

# Fix agregarItemAlAdicional to pass id explicitly
old2 = '''      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await refreshModalAdicional();'''
new2 = '''      const adicId = modalAdicional.id;
      await api.post(`/presupuestos/${adicId}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await refreshModalAdicional(adicId);'''

content = content.replace(old2, new2)
content = content.replace(old2.replace('\n','\r\n'), new2.replace('\n','\r\n'))

# Also fix crearAdicional - after creating, open the modal with full data
old3 = '''      await cargarAdicionales();
      // Open the new adicional modal
      const nuevoId = res.data?.id;
      if (nuevoId) {
        const adics = await api.get(`/presupuestos/${id}/adicionales`);
        const nuevo = (adics.data || []).find(a => a.id === nuevoId);
        if (nuevo) setModalAdicional(nuevo);
      }'''
new3 = '''      const nuevoId = res.data?.id;
      if (nuevoId) {
        const fullRes = await api.get(`/presupuestos/${nuevoId}`);
        setModalAdicional(fullRes.data);
      }
      await cargarAdicionales();'''

content = content.replace(old3, new3)
content = content.replace(old3.replace('\n','\r\n'), new3.replace('\n','\r\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
