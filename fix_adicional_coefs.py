path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add missing coeficients (K Maq and Cargas Sociales)
old_coefs = "  {[['GG%', 'gg_porcentaje'], ['Ben%', 'ben_porcentaje'], ['IVA%', 'iva_porcentaje'], ['K Mat', 'k_materiales'], ['K MO', 'k_mano_obra']].map(([label, key]) => ("
new_coefs = "  {[['GG%', 'gg_porcentaje'], ['Ben%', 'ben_porcentaje'], ['IVA%', 'iva_porcentaje'], ['K Mat', 'k_materiales'], ['K MO', 'k_mano_obra'], ['K Maq', 'k_maquinaria'], ['CS%', 'cargas_sociales_factor']].map(([label, key]) => ("

content = content.replace(old_coefs, new_coefs)
content = content.replace(old_coefs.replace('\n','\r\n'), new_coefs.replace('\n','\r\n'))
print("Added K Maq and CS coeficients")

# Fix 2: Make analysis panel overlay instead of side-by-side
# Change the panel analysis from side panel to overlay position
old_panel = '''                {/* Panel análisis */}
                {lineaSeleccionadaAdic && !computoAdicLinea && (
                  <div style={{ width: 'min(360px, 45vw)', borderLeft: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                    <PanelAnalisis
                      presupuestoId={modalAdicional.id}
                      linea={lineaSeleccionadaAdic}
                      onClose={() => setLineaSeleccionadaAdic(null)}
                      onCostoChange={async () => { const res = await api.get(`/presupuestos/${modalAdicional.id}`); setModalAdicional(res.data); }}
                    />
                  </div>
                )}

                {/* Panel cómputo */}
                {computoAdicLinea && (
                  <div style={{ width: 'min(380px, 45vw)', borderLeft: '1px solid var(--border)', overflow: 'hidden', flexShrink: 0 }}>
                    <PanelComputo
                      presupuestoId={modalAdicional.id}
                      linea={computoAdicLinea}
                      onClose={() => setComputoAdicLinea(null)}
                      onCantidadChange={async (lid, cant) => {
                        await handleCantidadAdicional(lid, cant);
                        setComputoAdicLinea(null);
                      }}
                    />
                  </div>
                )}'''

new_panel = '''                {/* Panel análisis - overlay */}
                {lineaSeleccionadaAdic && !computoAdicLinea && (
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(420px, 60vw)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 10, overflow: 'hidden', boxShadow: '-4px 0 16px rgba(0,0,0,0.2)' }}>
                    <PanelAnalisis
                      presupuestoId={modalAdicional.id}
                      linea={lineaSeleccionadaAdic}
                      onClose={() => setLineaSeleccionadaAdic(null)}
                      onCostoChange={async () => { const res = await api.get(`/presupuestos/${modalAdicional.id}`); setModalAdicional(res.data); }}
                    />
                  </div>
                )}

                {/* Panel cómputo - overlay */}
                {computoAdicLinea && (
                  <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(420px, 60vw)', background: 'var(--surface)', borderLeft: '1px solid var(--border)', zIndex: 10, overflow: 'hidden', boxShadow: '-4px 0 16px rgba(0,0,0,0.2)' }}>
                    <PanelComputo
                      presupuestoId={modalAdicional.id}
                      linea={computoAdicLinea}
                      onClose={() => setComputoAdicLinea(null)}
                      onCantidadChange={async (lid, cant) => {
                        await handleCantidadAdicional(lid, cant);
                        setComputoAdicLinea(null);
                      }}
                    />
                  </div>
                )}'''

if old_panel in content:
    content = content.replace(old_panel, new_panel)
    print("Fixed panel overlay")
else:
    old_w = old_panel.replace('\n', '\r\n')
    new_w = new_panel.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed panel overlay (CRLF)")
    else:
        print("Panel pattern not found")

# Also make the outer modal div position:relative so absolute children work
old_outer = "style={{ width: 'min(900px, 100vw)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.4)' }}"
new_outer = "style={{ width: 'min(900px, 100vw)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.4)', position: 'relative' }}"
content = content.replace(old_outer, new_outer)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
