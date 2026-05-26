import React, { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";
const getToken = () => localStorage.getItem("obras_token") || "";
const authHWithToken = (tk) => ({ Authorization: `Bearer ${tk || getToken()}` });
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const fmt = (n) => n != null ? "$ " + Math.round(n || 0).toLocaleString("es-AR") : "—";
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

function TortaAvance({ pct, size = 120, color = "#059669" }) {
  const r = 46, cx = 60, cy = 60;
  const p = Math.min(100, Math.max(0, pct));
  const rad = (p / 100) * 2 * Math.PI;
  const x = cx + r * Math.sin(rad), y = cy - r * Math.cos(rad);
  const large = p > 50 ? 1 : 0;
  const path = p >= 100
    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
    : `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="#f1f3f5" />
      {p > 0 && <path d={path} fill={color} opacity={0.85} />}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={color}>{p.toFixed(0)}%</text>
    </svg>
  );
}

function GanttReadonly({ presupuestoId }) {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/portal/gantt/${presupuestoId}`, { headers: authH() })
      .then(r => r.ok ? r.json() : []).then(d => { setTareas(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  }, [presupuestoId]);
  if (loading) return <div style={{ color: "#6b7280", fontSize: 13, padding: 20 }}>Cargando planificación...</div>;
  if (!tareas.length) return <div style={{ color: "#6b7280", fontSize: 13, padding: 20 }}>Sin planificación cargada</div>;
  const fechas = tareas.map(t => new Date(t.fecha_inicio + "T12:00:00"));
  const fechasFin = tareas.map(t => { const fi = new Date(t.fecha_inicio + "T12:00:00"); fi.setDate(fi.getDate() + (t.duracion_dias || 1)); return fi; });
  const minDate = new Date(Math.min(...fechas)), maxDate = new Date(Math.max(...fechasFin));
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000) + 1);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{minDate.toLocaleDateString("es-AR")} → {maxDate.toLocaleDateString("es-AR")}</div>
      {tareas.map((t, i) => {
        const start = new Date(t.fecha_inicio + "T12:00:00");
        const left = Math.max(0, Math.ceil((start - minDate) / 86400000) / totalDays * 100);
        const width = Math.max(1, (t.duracion_dias || 1)) / totalDays * 100;
        return (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: "#1a1a2e", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</div>
            <div style={{ height: 20, background: "#f1f3f5", borderRadius: 4, position: "relative", border: "1px solid #e0e0e8" }}>
              <div style={{ position: "absolute", left: left + "%", width: width + "%", height: "100%", borderRadius: 3, background: t.color || "#7c3aed", opacity: 0.85, minWidth: 4 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientePortal({ user, clienteId, clienteNombre, onLogout, token: tokenProp }) {
  const getH = () => ({ Authorization: `Bearer ${tokenProp || localStorage.getItem("obras_token") || ""}` });
  const [presupuestos, setPresupuestos] = useState([]);
  const [presSelec, setPresSelec] = useState(null);
  const [tab, setTab] = useState("avance");
  const [certs, setCerts] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [contrato, setContrato] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [aceptando, setAceptando] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };

  const tenantNombre = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.nombre || "FAIM OBRAS"; } catch { return "FAIM OBRAS"; } })();
  const tenantColor = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.color_primario || "#059669"; } catch { return "#059669"; } })();
  const tenantLogo = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.logo_url || null; } catch { return null; } })();

  useEffect(() => {
    let attempts = 0;
    const tryFetch = () => {
      const tk = tokenProp || localStorage.getItem("obras_token") || "";
      if (!tk && attempts < 10) {
        attempts++;
        setTimeout(tryFetch, 200);
        return;
      }
      fetch(`${API}/portal/presupuestos`, { headers: { Authorization: `Bearer ${tk}` } })
        .then(r => r.ok ? r.json() : [])
        .then(d => {
          const pres = Array.isArray(d) ? d : [];
          setPresupuestos(pres);
          if (pres.length > 0) setPresSelec(pres[0]);
          setLoading(false);
        }).catch(() => setLoading(false));
    };
    tryFetch();
  }, [tokenProp]);

  useEffect(() => {
    if (!presSelec) return;
    const id = presSelec.id;
    // Certificados
    fetch(`${API}/presupuestos/${id}/certificados`, { headers: getH() })
      .then(r => r.ok ? r.json() : { certificados: [] })
      .then(d => setCerts(d.certificados || (Array.isArray(d) ? d : [])))
      .catch(() => {});
    // Cobros
    fetch(`${API}/presupuestos/${id}/cobros`, { headers: getH() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setCobros(Array.isArray(d) ? d : []))
      .catch(() => {});
    // Contrato
    fetch(`${API}/presupuestos/${id}/contrato`, { headers: getH() })
      .then(r => r.ok ? r.json() : null)
      .then(d => setContrato(d))
      .catch(() => {});
    // Comentarios
    fetch(`${API}/portal/comentarios/${id}`, { headers: getH() })
      .then(r => r.ok ? r.json() : [])
      .then(d => setComentarios(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [presSelec]);

  const enviarComentario = async () => {
    if (!nuevoComentario.trim() || !presSelec) return;
    setEnviando(true);
    await fetch(`${API}/portal/comentarios`, { method: "POST", headers: { ...authH(), "Content-Type": "application/json" }, body: JSON.stringify({ presupuesto_id: presSelec.id, texto: nuevoComentario, nombre: clienteNombre || user?.nombre, email: user?.email }) });
    setNuevoComentario("");
    const d = await fetch(`${API}/portal/comentarios/${presSelec.id}`, { headers: getH() }).then(r => r.ok ? r.json() : []);
    setComentarios(Array.isArray(d) ? d : []);
    setEnviando(false);
    showToast("✓ Mensaje enviado");
  };

  const aceptarContrato = async () => {
    if (!contrato || !presSelec) return;
    setAceptando(true);
    const res = await fetch(`${API}/presupuestos/${presSelec.id}/contrato/aceptar`, {
      method: "POST", headers: { ...authH(), "Content-Type": "application/json" },
      body: JSON.stringify({ nombre_cliente: clienteNombre || user?.nombre, email_cliente: user?.email })
    });
    if (res.ok) {
      setContrato(prev => ({ ...prev, estado: "aceptado", aceptado_en: new Date().toISOString() }));
      showToast("✓ Contrato aceptado correctamente");
    }
    setAceptando(false);
  };

  const ultimoCert = certs.length > 0 ? certs[certs.length - 1] : null;
  const avancePct = ultimoCert ? parseFloat(ultimoCert.avance_total_pct || 0) : 0;
  const totalCobrado = cobros.reduce((s, c) => s + parseFloat(c.monto || 0), 0);
  const totalCertificado = parseFloat(ultimoCert?.monto_acumulado || 0);
  const saldoPendiente = totalCertificado - totalCobrado;

  const card = { background: "#fff", border: "1px solid #e0e0e8", borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: "#f1f3f5", border: "1px solid #e0e0e8", borderRadius: 8, color: "#1a1a2e", fontSize: 13, fontFamily: "inherit", outline: "none" };

  const TABS = [
    { id: "avance", label: "Avance" },
    { id: "contrato", label: "Contrato" },
    { id: "cobros", label: "Cuenta corriente" },
    { id: "gantt", label: "Planificación" },
    { id: "consultas", label: "Consultas" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f9fa" }}>
      <div style={{ textAlign: "center" }}>
        {tenantLogo ? <img src={tenantLogo} alt="logo" style={{ height: 48, objectFit: "contain", marginBottom: 16 }} /> : <div style={{ fontSize: 24, fontWeight: 900, color: tenantColor, marginBottom: 8 }}>{tenantNombre}</div>}
        <div style={{ color: "#6b7280", fontSize: 14 }}>Cargando...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "'Syne', sans-serif", color: "#1a1a2e" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {tenantLogo
            ? <img src={tenantLogo} alt="logo" style={{ height: 32, objectFit: "contain" }} />
            : <div style={{ fontSize: 18, fontWeight: 900, color: tenantColor }}>{tenantNombre}</div>
          }
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{clienteNombre || user?.nombre}</span>
          <button onClick={onLogout} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Selector de obra */}
      {presupuestos.length > 1 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presupuestos.map(p => (
            <button key={p.id} onClick={() => setPresSelec(p)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${presSelec?.id === p.id ? tenantColor : "#e0e0e8"}`, background: presSelec?.id === p.id ? tenantColor + "12" : "transparent", color: presSelec?.id === p.id ? tenantColor : "#6b7280", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {p.nombre_obra}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e0e8", display: "flex", padding: "0 20px", overflowX: "auto" }}>
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? tenantColor : "transparent"}`, color: tab === id ? tenantColor : "#6b7280", cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px 60px" }}>
        {!presSelec ? (
          <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 60 }}>Sin proyectos asignados</div>
        ) : (
          <>
            {/* ── AVANCE ── */}
            {tab === "avance" && (
              <>
                <div style={{ ...card, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <TortaAvance pct={avancePct} color={tenantColor} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{presSelec.nombre_obra}</div>
                    {presSelec.ubicacion && <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{presSelec.ubicacion}</div>}
                    <div style={{ fontSize: 13, marginBottom: 4 }}><span style={{ color: "#6b7280" }}>Avance: </span><span style={{ fontWeight: 700, color: tenantColor }}>{avancePct.toFixed(1)}%</span></div>
                    {presSelec.total_precio_con_iva > 0 && <div style={{ fontSize: 13 }}><span style={{ color: "#6b7280" }}>Presupuesto: </span><span style={{ fontWeight: 700 }}>{fmt(presSelec.total_precio_con_iva)}</span></div>}
                  </div>
                </div>

                {certs.length > 0 ? (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Certificados de avance</div>
                    {certs.map(cert => (
                      <div key={cert.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f3f5" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Certificado Nº {cert.numero}</div>
                          <div style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(cert.fecha)} · {parseFloat(cert.avance_total_pct || 0).toFixed(1)}% avance</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: tenantColor }}>{fmt(cert.total_periodo || cert.monto_periodo)}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>Acum: {fmt(cert.monto_acumulado)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 32 }}>Sin certificados emitidos aún</div>
                )}
              </>
            )}

            {/* ── CONTRATO ── */}
            {tab === "contrato" && (
              <div>
                {!contrato ? (
                  <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 60 }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
                    <div style={{ fontWeight: 600 }}>Sin contrato generado aún</div>
                  </div>
                ) : (
                  <div style={card}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>Contrato de obra</div>
                        <div style={{ fontSize: 13, color: "#6b7280" }}>{presSelec.nombre_obra}</div>
                      </div>
                      <div style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: contrato.estado === "aceptado" ? "#f0fdf4" : contrato.estado === "firmado" ? "#eff6ff" : "#fffbeb", color: contrato.estado === "aceptado" ? "#059669" : contrato.estado === "firmado" ? "#1d4ed8" : "#d97706" }}>
                        {contrato.estado === "aceptado" ? "✓ Aceptado" : contrato.estado === "firmado" ? "Firmado" : contrato.estado === "enviado" ? "Pendiente de aceptación" : "Borrador"}
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                      {[
                        ["Monto total", fmt(contrato.monto_total)],
                        ["Forma de pago", contrato.tipo_pago === "por_certificado" ? "Por certificado" : contrato.tipo_pago === "desembolsos" ? "Por desembolsos" : "Mixto"],
                        ["Anticipo", contrato.anticipo_pct ? `${contrato.anticipo_pct}%` : "Sin anticipo"],
                        ["Plazo", contrato.plazo_obra_dias ? `${contrato.plazo_obra_dias} días` : "—"],
                        ["Lugar", contrato.lugar_ejecucion || "—"],
                        ["Fecha de firma", fmtDate(contrato.fecha_firma)],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {contrato.clausulas_adicionales && (
                      <div style={{ marginBottom: 16, padding: "12px 14px", background: "#f8f9fa", borderRadius: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Cláusulas adicionales</div>
                        <div style={{ fontSize: 13, whiteSpace: "pre-line" }}>{contrato.clausulas_adicionales}</div>
                      </div>
                    )}

                    {(contrato.desembolsos || []).length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>Calendario de pagos</div>
                        {contrato.desembolsos.map(d => (
                          <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f3f5" }}>
                            <div>
                              <span style={{ fontSize: 13, fontWeight: 600 }}>Cuota {d.numero}</span>
                              <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 8 }}>{d.descripcion}</span>
                            </div>
                            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                              <span style={{ fontSize: 12, color: "#6b7280" }}>{fmtDate(d.fecha_vencimiento)}</span>
                              <span style={{ fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(d.monto)}</span>
                              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: d.estado === "cobrado" ? "#f0fdf4" : "#fef3c7", color: d.estado === "cobrado" ? "#059669" : "#d97706" }}>{d.estado}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botón aceptar */}
                    {(contrato.estado === "enviado" || contrato.estado === "borrador") && (
                      <div style={{ marginTop: 16, padding: "16px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, textAlign: "center" }}>
                        <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
                          Al aceptar este contrato confirmás que leíste y acordás con los términos indicados.
                        </div>
                        <button onClick={aceptarContrato} disabled={aceptando} style={{ padding: "10px 24px", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          {aceptando ? "Procesando..." : "✓ Aceptar contrato"}
                        </button>
                      </div>
                    )}
                    {contrato.estado === "aceptado" && contrato.aceptado_en && (
                      <div style={{ fontSize: 12, color: "#059669", textAlign: "center", marginTop: 8 }}>
                        Aceptado el {new Date(contrato.aceptado_en).toLocaleDateString("es-AR")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── CUENTA CORRIENTE ── */}
            {tab === "cobros" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                  {[
                    ["Certificado acumulado", fmt(totalCertificado), "#7c3aed"],
                    ["Cobrado", fmt(totalCobrado), "#059669"],
                    ["Saldo pendiente", fmt(saldoPendiente), saldoPendiente > 0 ? "#ef4444" : "#059669"],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ background: "#fff", border: "1px solid #e0e0e8", borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "'IBM Plex Mono',monospace" }}>{value}</div>
                    </div>
                  ))}
                </div>
                {cobros.length === 0 ? (
                  <div style={{ ...card, textAlign: "center", color: "#6b7280", padding: 40 }}>Sin cobros registrados</div>
                ) : (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Historial de cobros</div>
                    {cobros.map(c => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f3f5" }}>
                        <div>
                          <div style={{ fontSize: 13 }}>{c.forma_pago}</div>
                          <div style={{ fontSize: 11, color: "#6b7280" }}>{fmtDate(c.fecha)} {c.referencia ? `· ${c.referencia}` : ""} {c.nota ? `· ${c.nota}` : ""}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: "#059669", fontFamily: "'IBM Plex Mono',monospace" }}>{fmt(c.monto)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── GANTT ── */}
            {tab === "gantt" && (
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Planificación</div>
                <GanttReadonly presupuestoId={presSelec.id} />
              </div>
            )}

            {/* ── CONSULTAS ── */}
            {tab === "consultas" && (
              <div style={card}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Consultas y mensajes</div>
                {comentarios.length === 0 && <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>Sin mensajes todavía. Escribí tu consulta abajo.</div>}
                <div style={{ maxHeight: 350, overflowY: "auto", marginBottom: 16 }}>
                  {comentarios.map((com, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: com.es_admin ? "#f1f3f5" : tenantColor + "12", border: "1px solid #e0e0e8" }}>
                      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{com.nombre || com.email} · {com.created_at ? new Date(com.created_at).toLocaleDateString("es-AR") : ""}</div>
                      <div style={{ fontSize: 13 }}>{com.texto}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inp, flex: 1 }} placeholder="Escribí tu consulta..." value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} onKeyDown={e => e.key === "Enter" && enviarComentario()} />
                  <button onClick={enviarComentario} disabled={enviando || !nuevoComentario.trim()} style={{ padding: "8px 16px", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !nuevoComentario.trim() ? 0.5 : 1 }}>
                    {enviando ? "..." : "Enviar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#1a1a2e", color: "#fff", borderRadius: 20, padding: "10px 20px", fontSize: 13, zIndex: 999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
