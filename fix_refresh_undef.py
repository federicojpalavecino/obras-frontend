path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check if refreshModalAdicional is declared
if 'const refreshModalAdicional' not in content:
    # Add it before agregarLibreAlAdicional
    old = '  const agregarLibreAlAdicional = async () => {'
    new = '''  const refreshModalAdicional = async (adicId) => {
    const targetId = adicId || modalAdicional?.id;
    if (!targetId) return;
    try {
      const res = await api.get(`/presupuestos/${targetId}`);
      setModalAdicional(res.data);
    } catch(e) { console.error(e); }
  };

  const agregarLibreAlAdicional = async () => {'''
    if old in content:
        content = content.replace(old, new)
        print("Added refreshModalAdicional declaration")
    else:
        old_w = old.replace('\n', '\r\n')
        new_w = new.replace('\n', '\r\n')
        if old_w in content:
            content = content.replace(old_w, new_w)
            print("Added (CRLF)")
        else:
            print("ERROR: anchor not found")
else:
    print("refreshModalAdicional already declared")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
