with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "r", encoding="utf-8") as f:
    c = f.read()

# Desktop: agregar botón Obra al grupo de gestión (después de Mat.)
old = """                  <button className=\"btn btn-secondary btn-sm\" style={{ borderRadius: 0 }} onClick={() => navigate(`/cotizador/presupuesto/${id}/materiales`)}>
                    \u{1F4E6} Mat.
                  </button>
                </div>"""

# Buscar el patrón exacto con los caracteres reales
old1 = "navigate(`/cotizador/presupuesto/${id}/materiales`)}"
old_block = old1 + """>
                    📦 Mat.
                  </button>
                </div>"""

new_block = old1 + """>
                    📦 Mat.
                  </button>
                  <button className=\"btn btn-secondary btn-sm\" style={{ borderRadius: 0, borderLeft: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)}>
                    🏗️ Obra
                  </button>
                </div>"""

if old_block in c:
    c = c.replace(old_block, new_block)
    print("✓ Botón Obra agregado (desktop)")
else:
    print("⚠ Patrón desktop no encontrado")
    # Debug: mostrar contexto
    idx = c.find("materiales`)}")
    if idx >= 0:
        print("Contexto alrededor de materiales:")
        print(repr(c[idx:idx+200]))

# Mobile: agregar en la lista de acciones
old_mobile = "{ label: 'Listado de materiales', icon: '📦', onClick: () => navigate(`/cotizador/presupuesto/${id}/materiales`) },"
new_mobile = old_mobile + "\n                { label: 'Gestión de obra', icon: '🏗️', onClick: () => navigate(`/cotizador/presupuesto/${id}/obra`) },"

if old_mobile in c:
    c = c.replace(old_mobile, new_mobile)
    print("✓ Botón Obra agregado (mobile)")
else:
    print("⚠ Patrón mobile no encontrado")

with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
