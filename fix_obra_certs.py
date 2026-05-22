with open(r"C:\obras-frontend\src\pages\Obra.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# 1. Agregar estado de certificados junto a los otros estados
old_state = '  const [showContrato, setShowContrato] = useState(false);'
new_state = '''  const [showContrato, setShowContrato] = useState(false);
  const [certificados, setCertificados] = useState([]);
  const [showVincularCobro, setShowVincularCobro] = useState(null); // cert id'''

if old_state in c:
    c = c.replace(old_state, new_state)
    print("OK estados certificados")
else:
    print("FAIL estados")

# 2. Cargar certificados en cargar()
old_cargar = "        fetch(`${API}/presupuestos/${id}/compras`, { headers: authH() }).then(r => r.json()),\n      ]);"
new_cargar = """        fetch(`${API}/presupuestos/${id}/compras`, { headers: authH() }).then(r => r.json()),
        fetch(`${API}/presupuestos/${id}/certificados`, { headers: authH() }).then(r => r.ok ? r.json() : {certificados:[]}).catch(() => ({certificados:[]})),
      ]);"""

if old_cargar in c:
    c = c.replace(old_cargar, new_cargar)
    print("OK cargar compras+certs")
else:
    print("FAIL cargar")

# 3. Usar el r6 de certificados
old_set = "      setCompras(Array.isArray(r5) ? r5 : []);"
new_set = """      setCompras(Array.isArray(r5) ? r5 : []);
      const certsData = r6?.certificados || (Array.isArray(r6) ? r6 : []);
      setCertificados(certsData);"""

if old_set in c:
    c = c.replace(old_set, new_set)
    print("OK set certificados")
else:
    print("FAIL set certs")

# 4. Agregar tab Certificados en la barra de tabs
old_tabs = '          <TabBtn id="compras" label="🧱 Compras" />'
new_tabs = '''          <TabBtn id="compras" label="🧱 Compras" />
          <TabBtn id="certificados" label="📜 Certificados" />'''

if old_tabs in c:
    c = c.replace(old_tabs, new_tabs)
    print("OK tab certificados")
else:
    print("FAIL tabs")

# 5. Quitar el botón separado de certificados del header (ya no lo necesita)
old_cert_btn = '''          <button onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)}
            style={{ marginLeft: "auto", ...btn(C.accent2), fontSize: 12 }}>
            📜 Certificados
          </button>'''
new_cert_btn = '''          <button onClick={() => setTab("certificados")}
            style={{ marginLeft: "auto", ...btn(C.accent2), fontSize: 12 }}>
            📜 Certificados
          </button>'''

if old_cert_btn in c:
    c = c.replace(old_cert_btn, new_cert_btn)
    print("OK reemplazar boton header")
else:
    print("⚠ boton header no encontrado (no critico)")

# 6. Agregar el tab content de certificados antes del cierre del div principal
old_compras_end = "        )}\n\n      </div>\n\n      {/* ── MODAL COBRO ── */}"
new_compras_end = """        )}

        {/* ── TAB CERTIFICADOS ── */}
        {tab === "certificados" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>Certificados de avance</div>
                <div style={{ fontSize: 12, color: C.muted }}>
                  {certificados.length} certificado{certificados.length !== 1 ? "s" : ""} emitido{certificados.length !== 1 ? "s" : ""}
                  {certificados.length > 0 && ` · Acumulado: ${fmt(certificados[certificados.length-1]?.monto_acumulado || 0)}`}
                </div>
              </div>
              <button onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)} style={btn(C.accent2)}>
                + Emitir certificado
              </button>
            </div>

            {certificados.length === 0 ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📜</div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Sin certificados emitidos</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Emití el primer certificado de avance</div>
                <button onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)} style={btn(C.accent2)}>
                  Emitir certificado →
                </button>
              </div>
            ) : (
              <div>
                {certificados.map((cert, i) => {
                  const cobrosVinculados = cobros.filter(cb => cb.certificado_id === cert.id);
                  const montoCobrado = cobrosVinculados.reduce((s, cb) => s + parseFloat(cb.monto || 0), 0);
                  const pendiente = parseFloat(cert.monto_periodo || 0) - montoCobrado;
                  return (
                    <div key={cert.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>Certificado Nº {cert.numero}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>
                            {cert.fecha}
                            {cert.periodo_desde && ` · ${cert.periodo_desde} → ${cert.periodo_hasta}`}
                          </div>
                          <div style={{ fontSize: 12, color: C.accent2, marginTop: 2 }}>
                            Avance acumulado: {parseFloat(cert.avance_total_pct || 0).toFixed(1)}%
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>
                            {fmt(cert.monto_periodo)}
                          </div>
                          <div style={{ fontSize: 11, color: C.muted }}>período · acum: {fmt(cert.monto_acumulado)}</div>
                        </div>
                      </div>

                      {/* Cobros vinculados a este certificado */}
                      <div style={{ background: C.surface2, borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: cobrosVinculados.length > 0 ? 8 : 0 }}>
                          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Cobros vinculados
                          </div>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            {pendiente > 0 && (
                              <span style={{ fontSize: 12, color: C.red, fontWeight: 700 }}>Pendiente: {fmt(pendiente)}</span>
                            )}
                            {pendiente <= 0 && montoCobrado > 0 && (
                              <span style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>✓ Cobrado completo</span>
                            )}
                            <button
                              onClick={() => {
                                setShowCobro(true);
                                setCobForm({ monto: String(Math.round(pendiente > 0 ? pendiente : cert.monto_periodo)), fecha: today(), forma_pago: "transferencia", referencia: "", nota: `Cert. Nº ${cert.numero}`, certificado_id: cert.id });
                              }}
                              style={{ ...btn(C.green), padding: "4px 10px", fontSize: 11 }}>
                              + Cobro
                            </button>
                          </div>
                        </div>
                        {cobrosVinculados.length === 0 ? (
                          <div style={{ fontSize: 12, color: C.muted }}>Sin cobros registrados para este certificado</div>
                        ) : cobrosVinculados.map(cb => (
                          <div key={cb.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: `1px solid ${C.border}` }}>
                            <div style={{ fontSize: 12 }}>{cb.fecha} · {cb.forma_pago} {cb.referencia ? `· ${cb.referencia}` : ""}</div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(cb.monto)}</span>
                              <button onClick={() => eliminarCobro(cb.id)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 14 }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {/* Resumen total */}
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 13, color: C.muted }}>Total certificado / Total cobrado</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <span style={{ fontWeight: 700, color: C.accent2, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(certificados[certificados.length-1]?.monto_acumulado || 0)}</span>
                    <span style={{ color: C.muted }}>/</span>
                    <span style={{ fontWeight: 700, color: C.green, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(cobros.reduce((s,cb) => s + parseFloat(cb.monto||0), 0))}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* ── MODAL COBRO ── */}"""

if "        )}\n\n      </div>\n\n      {/* ── MODAL COBRO ── */}" in c:
    c = c.replace("        )}\n\n      </div>\n\n      {/* ── MODAL COBRO ── */}", new_compras_end)
    print("OK tab certificados agregado")
else:
    # Try alternate
    alt = "        )}\n\n      </div>\n\n      {/* \u2500\u2500 MODAL COBRO \u2500\u2500 */}"
    if alt in c:
        c = c.replace(alt, new_compras_end)
        print("OK tab certificados (alt)")
    else:
        print("FAIL tab content - buscando patron...")
        idx = c.find("MODAL COBRO")
        if idx > 0:
            print(repr(c[idx-100:idx+50]))

# 7. Fix el modal de cobro para aceptar certificado_id en el form
old_cobform_init = 'const [cobForm, setCobForm] = useState({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "" });'
new_cobform_init = 'const [cobForm, setCobForm] = useState({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null });'

if old_cobform_init in c:
    c = c.replace(old_cobform_init, new_cobform_init)
    print("OK cobForm init")

# 8. Fix crearCobro para limpiar certificado_id
old_reset_cob = 'setShowCobro(false); setCobForm({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "" });'
new_reset_cob = 'setShowCobro(false); setCobForm({ monto: "", fecha: today(), forma_pago: "transferencia", referencia: "", nota: "", certificado_id: null });'
if old_reset_cob in c:
    c = c.replace(old_reset_cob, new_reset_cob)
    print("OK reset cobForm")

with open(r"C:\obras-frontend\src\pages\Obra.jsx", "w", encoding="utf-8") as f:
    f.write(c)

print("\nDone")
