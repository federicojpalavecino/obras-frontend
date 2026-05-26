"""
Agrega en el CF el botón 'Importar desde obra' que trae
cobros, pagos a subcontratistas y compras pagadas pendientes.
"""

with open(r"C:\obras-frontend\src\pages\ControlFinanciero.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Agregar estado para el modal de importar obra
old_state = "  const [obras, setObras] = useState([]);"
new_state = """  const [obras, setObras] = useState([]);
  const [showImportarObra, setShowImportarObra] = useState(false);
  const [obraPendientes, setObraPendientes] = useState({ cobros: [], pagos_subcontrato: [], compras: [] });
  const [obraSeleccionados, setObraSeleccionados] = useState([]);
  const [loadingObra, setLoadingObra] = useState(false);"""

if old_state in c:
    c = c.replace(old_state, new_state)
    print("OK estado modal obra")
else:
    print("FAIL estado")

# 2. Agregar función cargarObraPendientes y importarDesdeObra
old_import_cert = "  const importarCert = (cert) => {"
new_import_cert = """  const cargarObraPendientes = async () => {
    setLoadingObra(true);
    try {
      const res = await fetch(`${API}/cf/obra-pendientes`, { headers: authH() });
      if (res.ok) setObraPendientes(await res.json());
    } catch(e) {}
    setLoadingObra(false);
  };

  const importarDesdeObra = async () => {
    if (obraSeleccionados.length === 0) return;
    try {
      const res = await fetch(`${API}/cf/importar-obra`, {
        method: "POST", headers: authH(),
        body: JSON.stringify({ items: obraSeleccionados })
      });
      if (res.ok) {
        showToast("✓ Importado al CF correctamente");
        setShowImportarObra(false);
        setObraSeleccionados([]);
        await cargar();
      }
    } catch(e) { showToast("Error al importar"); }
  };

  const toggleSeleccionObra = (tipo, id) => {
    const key = `${tipo}-${id}`;
    setObraSeleccionados(prev => {
      const exists = prev.find(i => i.tipo === tipo && i.id === id);
      if (exists) return prev.filter(i => !(i.tipo === tipo && i.id === id));
      return [...prev, { tipo, id }];
    });
  };

  const importarCert = (cert) => {"""

if old_import_cert in c:
    c = c.replace(old_import_cert, new_import_cert)
    print("OK funciones importar obra")
else:
    print("FAIL funciones")

# 3. Agregar botón "Importar desde obra" junto al botón "Importar cert."
old_btn = '"Importar cert."'
new_btn = '"Importar cert."'

# Buscar el botón importar cert en el JSX
old_btn_jsx = '<button onClick={() => setShowImportCert(true)}'
new_btn_jsx = '''<button onClick={() => { cargarObraPendientes(); setShowImportarObra(true); }} style={{ marginRight: 6, padding: "7px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", color: "#059669", fontFamily: "inherit" }}>
              🏗️ Desde obra
            </button>
            <button onClick={() => setShowImportCert(true)}'''

if old_btn_jsx in c:
    c = c.replace(old_btn_jsx, new_btn_jsx)
    print("OK botón desde obra")
else:
    # try alternate
    old2 = "onClick={() => setShowImportCert(true)}"
    if old2 in c:
        c = c.replace(old2, """onClick={() => setShowImportCert(true)} data-cf-cert="1" """, 1)
        print("⚠ Botón alternate - puede necesitar ajuste manual")
    else:
        print("FAIL botón - buscar manualmente")

# 4. Agregar modal de importar desde obra antes del cierre del return
# Buscar el último modal existente (showImportCert)
modal_obra = '''
      {/* ── MODAL IMPORTAR DESDE OBRA ── */}
      {showImportarObra && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 560, border: "1px solid #e0e0e8", maxHeight: "85vh", overflow: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>Importar movimientos desde obra</div>
              <button onClick={() => setShowImportarObra(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: "#6b7280" }}>×</button>
            </div>

            {loadingObra ? (
              <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>Cargando...</div>
            ) : (
              <>
                {/* Cobros */}
                {obraPendientes.cobros?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>💰 Cobros de clientes</div>
                    {obraPendientes.cobros.map(cb => {
                      const sel = obraSeleccionados.some(i => i.tipo === "cobro" && i.id === cb.id);
                      return (
                        <div key={cb.id} onClick={() => toggleSeleccionObra("cobro", cb.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#059669" : "#e0e0e8"}`, background: sel ? "#f0fdf4" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{cb.nombre_obra || "Sin obra"}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{cb.fecha} · {cb.forma_pago} {cb.referencia ? `· ${cb.referencia}` : ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#059669", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(cb.monto || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pagos subcontrato */}
                {obraPendientes.pagos_subcontrato?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>👷 Pagos a subcontratistas</div>
                    {obraPendientes.pagos_subcontrato.map(ps => {
                      const sel = obraSeleccionados.some(i => i.tipo === "pago_sub" && i.id === ps.id);
                      return (
                        <div key={ps.id} onClick={() => toggleSeleccionObra("pago_sub", ps.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#d97706" : "#e0e0e8"}`, background: sel ? "#fffbeb" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{ps.nombre_contratista}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{ps.fecha} · {ps.concepto} · {ps.nombre_obra || ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#d97706", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(ps.monto || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Compras */}
                {obraPendientes.compras?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>🧱 Compras de materiales</div>
                    {obraPendientes.compras.map(cm => {
                      const sel = obraSeleccionados.some(i => i.tipo === "compra" && i.id === cm.id);
                      return (
                        <div key={cm.id} onClick={() => toggleSeleccionObra("compra", cm.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: 8, border: `1px solid ${sel ? "#7c3aed" : "#e0e0e8"}`, background: sel ? "#f5f3ff" : "#fff", cursor: "pointer", marginBottom: 6 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{cm.proveedor_nombre}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{cm.fecha_pedido} · {cm.nombre_obra || ""}</div>
                          </div>
                          <div style={{ fontWeight: 700, color: "#7c3aed", fontFamily: "'IBM Plex Mono',monospace" }}>
                            ${Math.round(cm.monto_pagado || 0).toLocaleString("es-AR")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {obraPendientes.cobros?.length === 0 && obraPendientes.pagos_subcontrato?.length === 0 && obraPendientes.compras?.length === 0 && (
                  <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
                    No hay movimientos pendientes de importar
                  </div>
                )}

                {obraSeleccionados.length > 0 && (
                  <button onClick={importarDesdeObra} style={{ width: "100%", padding: 12, background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                    Importar {obraSeleccionados.length} movimiento{obraSeleccionados.length !== 1 ? "s" : ""} al CF
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
'''

# Insertar antes del último cierre del return
if "showImportarObra" not in c or "{showImportarObra &&" not in c:
    # Buscar el último </div> antes del return final
    last_return = c.rfind("  );\n}")
    if last_return > 0:
        c = c[:last_return] + modal_obra + c[last_return:]
        print("OK modal obra agregado")
    else:
        print("FAIL modal - no encontró cierre del return")
else:
    print("Modal ya existe")

with open(r"C:\obras-frontend\src\pages\ControlFinanciero.jsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
