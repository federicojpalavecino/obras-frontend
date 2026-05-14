path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = '''      await cargarAdicionales();
      // Open the new adicional modal
      const nuevoId = res.data?.id;
      if (nuevoId) {
        const adics = await api.get(`/presupuestos/${id}/adicionales`);
        const nuevo = (adics.data || []).find(a => a.id === nuevoId);
        if (nuevo) setModalAdicional(nuevo);
      }'''

new = '''      const nuevoId = res.data?.id;
      if (nuevoId) {
        const fullRes = await api.get(`/presupuestos/${nuevoId}`);
        setModalAdicional(fullRes.data);
      }
      await cargarAdicionales();'''

if old in content:
    content = content.replace(old, new)
    print("Fixed crearAdicional")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed crearAdicional (CRLF)")
    else:
        print("ERROR: not found")

# Also fix abrirAdicional to load full data
old2 = '''  const abrirAdicional = (adic) => {
    setBusquedaAdic('');
    setCatAdic(null);
    setShowLibreAdic(false);'''
new2 = '''  const abrirAdicional = async (adic) => {
    setBusquedaAdic('');
    setCatAdic(null);
    setShowLibreAdic(false);
    // Load full presupuesto data
    try {
      const fullRes = await api.get(`/presupuestos/${adic.id}`);
      adic = fullRes.data;
    } catch(e) { console.error(e); }'''

content = content.replace(old2, new2)
content = content.replace(old2.replace('\n','\r\n'), new2.replace('\n','\r\n'))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
