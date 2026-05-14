path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the MODAL ADICIONAL section and replace it
old_start = "        {/* MODAL ADICIONAL */}\r\n        {modalAdicional && ("
old_end = "        )}\r\n      </div>\r\n\r\n      <PrintPresupuesto"

start_idx = content.find(old_start)
end_idx = content.find(old_end, start_idx)

if start_idx == -1:
    old_start = "        {/* MODAL ADICIONAL */}\n        {modalAdicional && ("
    old_end = "        )}\n      </div>\n\n      <PrintPresupuesto"
    start_idx = content.find(old_start)
    end_idx = content.find(old_end, start_idx)

if start_idx == -1:
    print("ERROR: modal adicional not found")
else:
    print(f"Found modal adicional at {start_idx}-{end_idx}")

    new_modal = """        {/* MODAL ADICIONAL */}
        {modalAdicional && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 200 }}
            onClick={() => { setModalAdicional(null); setLineaSeleccionadaAdic(null); setComputoAdicLinea(null); }}>
            <div style={{ width: 'min(900px, 100vw)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(167,139,250,0.08)', flexShrink: 0 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent2)' }}>📋 {modalAdicional.nombre_obra}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {modalAdicional.estado === 'cerrado' ? '🔒 Cerrado' : '● Abierto — podés agregar ítems'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    const adicData = modalAdicional;
                    const fmt2 = n => n ? '$ '+Math.round(n).toLocaleString('es-AR') : '$ 0';
                    const rubrosHTML2 = (adicData.rubros||[]).map(r => {
                      const filas = (r.lineas||[]).map(l => `<tr><td>${l.nombre_override||l.nombre_item||l.nombre_libre||''}</td><td style="text-align:center">${l.unidad_item||l.unidad_libre||''}</td><td style="text-align:right">${l.cantidad}</td><td style="text-align:right;color:#5b21b6">${fmt2(l.total_ejecucion)}</td><td style="text-align:right;color:#065f46;font-weight:700">${fmt2(l.precio_venta_con_iva)}</td></tr>`).join('');
                      return `<tr style="background:#f0f0f0"><td colspan="5" style="font-weight:700;padding:5px 8px">${r.numero} — ${r.nombre}</td></tr>${filas}`;
                    }).join('');
                    const win = window.open('','_blank');
                    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${adicData.nombre_obra}</title><style>body{font-family:Arial,sans-serif;font-size:10pt;padding:20px}table{width:100%;border-collapse:collapse}th{background:#1a1a1a;color:#fff;padding:5px 8px;text-align:left;font-size:8pt}td{padding:4px 8px;border-bottom:1px solid #eee}h2{margin-bottom:4px}h3{color:#666;font-size:9pt;margin-bottom:16px}@media print{@page{margin:1.5cm}}</style></head><body><h2>${adicData.nombre_obra}</h2><h3>Adicional de obra</h3><table><thead><tr><th>Ítem</th><th>Unid.</th><th>Cant.</th><th>Total Ejec.</th><th>Precio c/IVA</th></tr></thead><tbody>${rubrosHTML2}</tbody></table><div style="margin-top:16px;text-align:right;font-size:13pt;font-weight:700">Total: ${fmt2(adicData.totales?.total_precio_con_iva || adicData.total_precio_con_iva)}</div></body></html>`);
                    win.document.close(); setTimeout(()=>win.print(),500);
                  }}>🖨 Imprimir</button>
                  {modalAdicional.estado === 'abierto' ? (
                    <button onClick={cerrarAdicional} className="btn btn-warn btn-sm"><Lock size={12} /> Cerrar</button>
                  ) : (
                    <button onClick={reabrirAdicional} className="btn btn-secondary btn-sm"><Unlock size={12} /> Reabrir</button>
                  )}
                  <button onClick={() => { setModalAdicional(null); setLineaSeleccionadaAdic(null); setComputoAdicLinea(null); }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Coeficientes del adicional */}
              {modalAdicional.coeficientes && (
                <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface2)', flexShrink: 0, fontSize: 11 }}>
                  <span style={{ fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 10 }}>Coeficientes:</span>
                  {[['GG%', 'gg_porcentaje'], ['Ben%', 'ben_porcentaje'], ['IVA%', 'iva_porcentaje'], ['K Mat', 'k_materiales'], ['K MO', 'k_mano_obra']].map(([label, key]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: 'var(--muted)', fontSize: 10 }}>{label}:</span>
                      <input type="number" step="0.1" value={modalAdicional.coeficientes?.[key] ?? ''} style={{ width: 54, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 5px', fontSize: 11, fontFamily: 'var(--mono)', textAlign: 'right', color: 'var(--text)' }}
                        onBlur={async e => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) return;
                          await api.put(`/presupuestos/${modalAdicional.id}`, { [key]: val });
                          const res = await api.get(`/presupuestos/${modalAdicional.id}`);
                          setModalAdicional(res.data);
                        }} onChange={e => setModalAdicional(p => ({ ...p, coeficientes: { ...p.coeficientes, [key]: e.target.value } }))} />
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Catálogo */}
                {modalAdicional.estado === 'abierto' && (
                  <div style={{ width: 220, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 8 }}>Agregar ítem</div>
                      <div style={{ position: 'relative', marginBottom: 7 }}>
                        <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input className="input" style={{ paddingLeft: 24, fontSize: 11 }} placeholder="Buscar..."
                          value={busquedaAdic} onChange={e => setBusquedaAdic(e.target.value)} />
                      </div>
                      <select className="input" style={{ fontSize: 11 }} value={catAdic || ''} onChange={e => setCatAdic(e.target.value || null)}>
                        <option value="">Todos los rubros</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {itemsAdicFiltrados.slice(0, 80).map(item => (
                        <div key={item.id}
                          style={{ padding: '6px 12px', borderBottom: '1px solid rgba(46,46,56,0.5)', cursor: 'pointer', fontSize: 11 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => agregarItemAlAdicional(item)}>
                          <div style={{ lineHeight: 1.3 }}>{item.nombre}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 1 }}>{item.codigo}</div>
                        </div>
                      ))}
                      <div style={{ padding: 10 }}>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => setShowLibreAdic(true)}>
                          <Plus size={11} /> Ítem libre
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lista ítems */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {(!modalAdicional.rubros || modalAdicional.rubros.flatMap(r => r.lineas).length === 0) ? (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
                        Sin ítems aún<br />
                        <span style={{ fontSize: 11 }}>Seleccioná del catálogo a la izquierda</span>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                            <th style={th}>Ítem</th>
                            <th style={{ ...th, textAlign: 'center' }}>Unid</th>
                            <th style={{ ...th, textAlign: 'right' }}>Cant</th>
                            <th style={{ ...th, textAlign: 'right' }}>∑</th>
                            <th style={{ ...th, textAlign: 'right', color: 'var(--ejec)' }}>Ejec</th>
                            <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Precio</th>
                            <th style={{ ...th, width: 24 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalAdicional.rubros?.map(rubro => (
                            <React.Fragment key={rubro.numero}>
                              <tr>
                                <td colSpan={7} style={{ padding: '5px 12px', background: 'var(--surface2)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.8 }}>
                                  {rubro.numero} — {rubro.nombre}
                                </td>
                              </tr>
                              {rubro.lineas?.map(linea => (
                                <tr key={linea.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.4)', background: computoAdicLinea?.id === linea.id ? 'rgba(167,139,250,0.07)' : lineaSeleccionadaAdic?.id === linea.id ? 'rgba(110,231,183,0.07)' : 'transparent' }}>
                                  <td style={{ ...td, fontSize: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span style={{ cursor: 'pointer', color: lineaSeleccionadaAdic?.id === linea.id ? 'var(--accent)' : 'inherit' }}
                                        onClick={() => { if (linea.tipo === 'catalogo' && modalAdicional.estado === 'abierto') setLineaSeleccionadaAdic(lineaSeleccionadaAdic?.id === linea.id ? null : linea); setComputoAdicLinea(null); }}>
                                        {linea.nombre_override || linea.nombre_item || linea.nombre_libre}
                                      </span>
                                    </div>
                                    {linea.tipo === 'libre' && <div style={{ fontSize: 9, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>subcontrato</div>}
                                  </td>
                                  <td style={{ ...td, textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{linea.unidad_item || linea.unidad_libre}</td>
                                  <td style={{ ...td, textAlign: 'right' }}>
                                    <input type="number" min="0" step="0.01" defaultValue={linea.cantidad}
                                      disabled={modalAdicional.estado === 'cerrado'}
                                      style={{ width: 55, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 5px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right' }}
                                      onBlur={e => handleCantidadAdicional(linea.id, e.target.value)} />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right' }}>
                                    {modalAdicional.estado === 'abierto' && (
                                      <button title="Cómputo" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: computoAdicLinea?.id === linea.id ? 'var(--accent2)' : 'var(--muted)' }}
                                        onClick={() => { setComputoAdicLinea(computoAdicLinea?.id === linea.id ? null : linea); setLineaSeleccionadaAdic(null); }}>∑</button>
                                    )}
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ejec)' }}>{fmt(linea.total_ejecucion)}</td>
                                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{fmt(linea.precio_venta_con_iva)}</td>
                                  <td style={td}>
                                    {modalAdicional.estado === 'abierto' && (
                                      <button onClick={() => eliminarLineaAdicional(linea.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--border2)', fontSize: 14, cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}>×</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(167,139,250,0.05)', flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total adicional c/IVA</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{fmt(modalAdicional.totales?.total_precio_con_iva || modalAdicional.total_precio_con_iva)}</span>
                  </div>
                </div>

                {/* Panel análisis */}
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
                )}
              </div>

              {showLibreAdic && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                  onClick={() => setShowLibreAdic(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 90vw)' }}>
                    <h2>Ítem libre — Adicional</h2>
                    <div className="form-group">
                      <label>Descripción *</label>
                      <input className="input" value={itemLibreAdic.nombre_libre} onChange={e => setItemLibreAdic(p => ({ ...p, nombre_libre: e.target.value }))} placeholder="Ej: Trabajo adicional" />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unidad</label>
                        <input className="input" value={itemLibreAdic.unidad_libre} onChange={e => setItemLibreAdic(p => ({ ...p, unidad_libre: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Cantidad</label>
                        <input className="input input-mono" type="number" min="0" step="0.01" value={itemLibreAdic.cantidad} onChange={e => setItemLibreAdic(p => ({ ...p, cantidad: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Costo directo *</label>
                      <input className="input input-mono" type="number" min="0" value={itemLibreAdic.costo_directo_libre} onChange={e => setItemLibreAdic(p => ({ ...p, costo_directo_libre: e.target.value }))} placeholder="0" />
                    </div>
                    <div className="modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowLibreAdic(false)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={agregarLibreAlAdicional}>Agregar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
"""

    # Also need to add computoAdicLinea state
    old_state = '  const [lineaSeleccionadaAdic, setLineaSeleccionadaAdic] = useState(null); // para PanelAnalisis del adicional'
    new_state = '  const [lineaSeleccionadaAdic, setLineaSeleccionadaAdic] = useState(null);\n  const [computoAdicLinea, setComputoAdicLinea] = useState(null);'
    content = content.replace(old_state, new_state)
    content = content.replace(old_state.replace('\r\n','\n'), new_state)

    # Replace the modal section
    content = content[:start_idx] + new_modal + content[end_idx + len(old_end):]

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done: modal adicional rewritten")
