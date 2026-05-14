path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix agregarItemAlAdicional
old = r"""  const agregarItemAlAdicional = async (item) => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await cargarAdicionales();
      // refresh modal data
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { console.error(e); }
  };"""

new = r"""  const agregarItemAlAdicional = async (item) => {
    if (!modalAdicional) return;
    const adicId = modalAdicional.id;
    try {
      await api.post(`/presupuestos/${adicId}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      const fullRes = await api.get(`/presupuestos/${adicId}`);
      setModalAdicional(fullRes.data);
    } catch(e) { console.error(e); }
  };"""

# Also fix handleCantidadAdicional
old2 = r"""    await api.patch(`/presupuestos/${modalAdicional.id}/lineas/${lineaId}`, { cantidad: parseFloat(cant) });
    await cargarAdicionales();
    const adics = await api.get(`/presupuestos/${id}/adicionales`);
    const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
    if (updated) setModalAdicional(updated);"""

new2 = r"""    const adicId = modalAdicional.id;
    await api.patch(`/presupuestos/${adicId}/lineas/${lineaId}`, { cantidad: parseFloat(cant) });
    const fullRes = await api.get(`/presupuestos/${adicId}`);
    setModalAdicional(fullRes.data);"""

for o, n in [(old, new), (old2, new2)]:
    if o in content:
        content = content.replace(o, n)
        print(f"Fixed pattern")
    else:
        ow = o.replace('\n', '\r\n')
        nw = n.replace('\n', '\r\n')
        if ow in content:
            content = content.replace(ow, nw)
            print(f"Fixed pattern (CRLF)")
        else:
            print(f"Pattern not found, trying simpler...")
            # Just replace the problematic lines
            content = content.replace(
                '      await cargarAdicionales();\r\n      // refresh modal data\r\n      const adics = await api.get(`/presupuestos/${id}/adicionales`);\r\n      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);\r\n      if (updated) setModalAdicional(updated);',
                '      const _aid = modalAdicional.id; const _fr = await api.get(`/presupuestos/${_aid}`); setModalAdicional(_fr.data);'
            )

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
