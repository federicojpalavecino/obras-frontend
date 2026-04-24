import { useState, useEffect } from "react";
const API = "https://fima-backend-production.up.railway.app";
const SB_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SB_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sbH = { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY };

// Torta SVG de avance
function TortaAvance({ pct, size = 120, color = "#059669" }) {
  const r = 46; const cx = 60; const cy = 60;
  const p = Math.min(100, Math.max(0, pct));
  const rad = (p / 100) * 2 * Math.PI;
  const x = cx + r * Math.sin(rad); const y = cy - r * Math.cos(rad);
  const large = p > 50 ? 1 : 0;
  const path = p >= 100
    ? `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy-r} Z`
    : `M ${cx} ${cy} L ${cx} ${cy-r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <circle cx={cx} cy={cy} r={r} fill="#f1f3f5" />
      {p > 0 && <path d={path} fill={color} opacity={0.85} />}
      <circle cx={cx} cy={cy} r={r * 0.6} fill="white" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fill={color}>{p.toFixed(0)}%</text>
    </svg>
  );
}

const fmt = (n) => n != null ? "$ " + Math.round(n).toLocaleString("es-AR") : "—";
const fmtDate = (d) => d ? new Date(d + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

const C = {
  bg: "#f8f9fa", surface: "#ffffff", surface2: "#f1f3f5",
  border: "#e0e0e8", text: "#1a1a2e", muted: "#6b7280",
  accent: "#059669", accent2: "#7c3aed", warn: "#d97706",
  green: "#059669", red: "#ef4444",
};


// Componente separado para evitar hooks en .map()
function AvanceCard({ p, fmt, card, C, API, SB_URL, sbH }) {
  const [avanceLocal, setAvanceLocal] = useState(null);
  const [ganttLocal, setGanttLocal] = useState([]);
  const [open, setOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState("rubros");

  useEffect(() => {
    let mounted = true;
    setLoadingData(true);
    Promise.all([
      fetch(`${API}/cliente/avance/${p.id}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(SB_URL + `/rest/v1/gantt_tareas?presupuesto_id=eq.${p.id}&order=orden`, { headers: sbH }).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([avance, gantt]) => {
      if (!mounted) return;
      if (avance) setAvanceLocal(avance);
      setGanttLocal(Array.isArray(gantt) ? gantt : []);
      setLoadingData(false);
    });
    return () => { mounted = false; };
  }, [p.id]);

  const pct = avanceLocal?.pct_avance || 0;
  const fechas = ganttLocal.flatMap(t => [t.fecha_inicio, t.fecha_fin]).filter(Boolean).map(f => new Date(f));
  const minDate = fechas.length ? new Date(Math.min(...fechas)) : null;
  const maxDate = fechas.length ? new Date(Math.max(...fechas)) : null;
  const totalDays = minDate && maxDate ? Math.max(1, Math.ceil((maxDate - minDate) / 86400000) + 1) : 1;

  // Curva de inversión: distribuir montos por rubro por semanas del gantt
  const curvaDatos = (() => {
    if (!ganttLocal.length || !avanceLocal) return [];
    const presTotal = avanceLocal.total_presupuesto;
    if (!presTotal || !minDate) return [];
    // Semanas desde inicio hasta fin
    const weeks = Math.max(1, Math.ceil(totalDays / 7));
    const porSemana = new Array(weeks).fill(0);
    ganttLocal.forEach(t => {
      const tStart = t.fecha_inicio ? new Date(t.fecha_inicio) : minDate;
      const tEnd = t.fecha_fin ? new Date(t.fecha_fin) : tStart;
      const tDays = Math.max(1, Math.ceil((tEnd - tStart) / 86400000) + 1);
      const tTotal = (tDays / totalDays) * presTotal;
      const startWeek = Math.floor((tStart - minDate) / (86400000 * 7));
      const endWeek = Math.floor((tEnd - minDate) / (86400000 * 7));
      for (let w = startWeek; w <= endWeek; w++) {
        if (w < weeks) porSemana[w] += tTotal / (endWeek - startWeek + 1);
      }
    });
    let acum = 0;
    return porSemana.map((v, i) => { acum += v; return { semana: i + 1, valor: v, acumulado: acum }; });
  })();

  const curvaPctMax = curvaDatos.length ? Math.max(...curvaDatos.map(d => d.valor)) : 1;
  // activeTab already defined above

  return (
    <div key={p.id} style={{ ...card, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
        <TortaAvance pct={pct} size={80} color={pct >= 75 ? C.accent : pct >= 40 ? C.warn : C.accent2} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{p.nombre_obra}</div>
          {p.ubicacion && <div style={{ fontSize: 12, color: C.muted }}>{p.ubicacion}</div>}
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            {avanceLocal ? `Certificado: ${fmt(avanceLocal.total_certificado)} / ${fmt(avanceLocal.total_presupuesto)}` : "Cargando..."}
          </div>
        </div>
        <span style={{ fontSize: 12, color: C.muted }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          {/* Tabs: Rubros / Gantt / Curva */}
          <div style={{ display: "flex", gap: 0, marginBottom: 14, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {[["rubros", "Avance"], ["gantt", "Planificación"], ["curva", "Curva inversión"]].map(([id, label]) => (
              <button key={id} onClick={e => { e.stopPropagation(); setActiveTab(id); }}
                style={{ flex: 1, padding: "7px 0", fontSize: 11, border: "none", cursor: "pointer", fontFamily: "inherit",
                  fontWeight: activeTab === id ? 700 : 400,
                  background: activeTab === id ? C.accent + "18" : C.surface2,
                  color: activeTab === id ? C.accent : C.muted }}>
                {label}
              </button>
            ))}
          </div>

          {/* Avance por rubro */}
          {activeTab === "rubros" && avanceLocal && (
            <div>
              {avanceLocal.rubros.map((r, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span>{r.nombre}</span><span style={{ color: C.accent, fontWeight: 600 }}>{r.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: r.pct + "%", background: r.pct >= 75 ? C.accent : r.pct >= 40 ? C.warn : C.accent2, borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Gantt readonly */}
          {activeTab === "gantt" && (
            <div style={{ overflowX: "auto" }}>
              {ganttLocal.length === 0
                ? <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>Sin planificación cargada</div>
                : <>
                  {ganttLocal.map((t, i) => {
                    const start = t.fecha_inicio ? new Date(t.fecha_inicio) : minDate;
                    const end = t.fecha_fin ? new Date(t.fecha_fin) : start;
                    const left = minDate ? Math.max(0, Math.ceil((start - minDate) / 86400000) / totalDays * 100) : 0;
                    const width = Math.max(1, Math.ceil((end - start) / 86400000) + 1) / totalDays * 100;
                    return (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: C.text, marginBottom: 2 }}>{t.nombre}</div>
                        <div style={{ height: 18, background: C.surface2, borderRadius: 3, position: "relative" }}>
                          <div style={{ position: "absolute", left: left + "%", width: width + "%", height: "100%", borderRadius: 3, background: t.color || C.accent2, opacity: 0.8, minWidth: 4 }} />
                        </div>
                      </div>
                    );
                  })}
                  {minDate && <div style={{ fontSize: 10, color: C.muted, marginTop: 6 }}>{minDate.toLocaleDateString("es-AR")} → {maxDate.toLocaleDateString("es-AR")}</div>}
                </>
              }
            </div>
          )}

          {/* Curva de inversión */}
          {activeTab === "curva" && (
            <div>
              {curvaDatos.length === 0
                ? <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>Sin planificación — generá el Gantt primero</div>
                : <>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Distribución estimada de inversión por semana</div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 120, overflowX: "auto" }}>
                    {curvaDatos.map((d, i) => (
                      <div key={i} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 28 }}>
                        <div title={`Sem ${d.semana}: ${fmt(d.valor)}`}
                          style={{ width: "100%", height: Math.max(4, (d.valor / curvaPctMax) * 90), background: C.accent2, borderRadius: "3px 3px 0 0", opacity: 0.85 }} />
                        <div style={{ fontSize: 9, color: C.muted }}>{d.semana}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Curva acumulada</div>
                    <svg width="100%" height="60" viewBox={`0 0 ${curvaDatos.length * 20} 60`} preserveAspectRatio="none">
                      <polyline
                        points={curvaDatos.map((d, i) => `${i * 20 + 10},${60 - (d.acumulado / avanceLocal.total_presupuesto) * 55}`).join(" ")}
                        fill="none" stroke={C.accent} strokeWidth="2" />
                    </svg>
                  </div>
                </>
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientePortal({ user, clienteId, clienteNombre, onLogout }) {
  const [tab, setTab] = useState("presupuestos");
  const [presupuestos, setPresupuestos] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presSelec, setPresSelec] = useState(null);
  const [certSelec, setCertSelec] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [presDetalle, setPresDetalle] = useState(null);
  const [avance, setAvance] = useState(null);
  const [ganttTareas, setGanttTareas] = useState([]);
  const [clienteTab, setClienteTab] = useState('presupuestos'); // top-level nav
  const [loadingDet, setLoadingDet] = useState(false);
  const [certDetalle, setCertDetalle] = useState(null);
  const [loadingCert, setLoadingCert] = useState(false);

  useEffect(() => {
    cargar();
  }, [clienteId]);

  useEffect(() => {
    if (presSelec) {
      cargarComentarios(presSelec.id);
      cargarPresDetalle(presSelec.id);
      cargarAvance(presSelec.id);
      cargarGantt(presSelec.id);
    }
  }, [presSelec]);

  useEffect(() => {
    if (certSelec) cargarCertDetalle(certSelec.presupuesto_id, certSelec.numero);
  }, [certSelec]);

  const cargarAvance = async (pid) => {
    const res = await fetch(`${API}/cliente/avance/${pid}`);
    if (res.ok) setAvance(await res.json());
  };

  const cargarGantt = async (pid) => {
    const res = await fetch(SB_URL + `/rest/v1/gantt_tareas?presupuesto_id=eq.${pid}&order=orden`, { headers: sbH });
    if (res.ok) setGanttTareas(await res.json());
  };

  const cargar = async () => {
    setLoading(true);
    const [pRes, cRes] = await Promise.all([
      fetch(`${API}/cliente/presupuestos?cliente_id=${clienteId}`),
      fetch(`${API}/cliente/certificados?cliente_id=${clienteId}`),
    ]);
    if (pRes.ok) setPresupuestos(await pRes.json());
    if (cRes.ok) setCertificados(await cRes.json());
    setLoading(false);
  };

  const cargarPresDetalle = async (pid) => {
    setLoadingDet(true);
    try {
      const res = await fetch(`${API}/presupuestos/${pid}`);
      if (res.ok) setPresDetalle(await res.json());
    } catch {}
    setLoadingDet(false);
  };

  const cargarCertDetalle = async (pid, num) => {
    setLoadingCert(true);
    try {
      const res = await fetch(`${API}/presupuestos/${pid}/certificados/${num}`);
      if (res.ok) setCertDetalle(await res.json());
    } catch {}
    setLoadingCert(false);
  };

  const cargarComentarios = async (presupuestoId) => {
    const res = await fetch(`${API}/cliente/comentarios/${presupuestoId}`);
    if (res.ok) setComentarios(await res.json());
  };

  const enviarComentario = async () => {
    if (!nuevoComentario.trim() || !presSelec) return;
    setEnviando(true);
    await fetch(`${API}/cliente/comentarios`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        presupuesto_id: presSelec.id,
        email: user.email,
        nombre: clienteNombre,
        texto: nuevoComentario.trim(),
        es_admin: false,
      }),
    });
    setNuevoComentario("");
    await cargarComentarios(presSelec.id);
    setEnviando(false);
  };

  const card = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: 10, padding: 16, marginBottom: 8,
  };

  const badge = (estado) => {
    const color = estado === "cerrado" ? C.green : C.warn;
    return (
      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: color + "18", color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {estado}
      </span>
    );
  };

  if (loading) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.accent, fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800 }}>
      FIMA
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.5px" }}>FIMA</div>
          <div style={{ fontSize: 12, color: C.muted }}>/ Portal del cliente</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: C.muted }}>{clienteNombre}</div>
          <button onClick={onLogout} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 20px" }}>
        {[["presupuestos", "📋 Presupuestos"], ["certificados", "📄 Certificados"], ["avance", "📊 Avance"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setPresSelec(null); setCertSelec(null); setPresDetalle(null); setCertDetalle(null); }}
            style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`, color: tab === id ? C.accent : C.muted, cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "20px 16px" }}>

        {/* ── PRESUPUESTOS ── */}
        {tab === "presupuestos" && !presSelec && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>
              Mis presupuestos
            </div>
            {presupuestos.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: C.muted, padding: 40 }}>No hay presupuestos disponibles aún</div>
            )}
            {presupuestos.map(p => (
              <div key={p.id} style={{ ...card, cursor: "pointer" }}
                onClick={() => { setPresSelec(p); setComentarios([]); }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{p.nombre_obra}</div>
                    {p.ubicacion && <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{p.ubicacion}</div>}
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {badge(p.estado)}
                      <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(p.fecha)}</span>
                      {p.cant_certificados > 0 && (
                        <span style={{ fontSize: 11, color: C.accent2 }}>📄 {p.cant_certificados} cert.</span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: C.accent }}>{fmt(p.total_precio_con_iva)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Total c/IVA</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DETALLE PRESUPUESTO ── */}
        {tab === "presupuestos" && presSelec && (
          <div>
            <button onClick={() => { setPresSelec(null); setPresDetalle(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
              ← Volver
            </button>

            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "'Syne', sans-serif" }}>{presSelec.nombre_obra}</div>
                  {presSelec.ubicacion && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{presSelec.ubicacion}</div>}
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>{badge(presSelec.estado)}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, color: C.accent }}>{fmt(presSelec.total_precio_con_iva)}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Total c/IVA</div>
                </div>
              </div>
            </div>

            {/* Ítems del presupuesto */}
            {loadingDet ? (
              <div style={{ ...card, textAlign: "center", color: C.muted, padding: 30 }}>Cargando detalle...</div>
            ) : presDetalle?.rubros?.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5, color: C.muted, fontSize: 10 }}>Detalle del presupuesto</div>
                {presDetalle.rubros.map(rubro => (
                  <div key={rubro.numero} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.muted, padding: "4px 0", borderBottom: `1px solid ${C.border}`, marginBottom: 6 }}>
                      {rubro.numero} — {rubro.nombre}
                    </div>
                    {rubro.lineas.map((linea, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                        <div style={{ flex: 1 }}>
                          <span>{linea.nombre_item || linea.nombre_libre}</span>
                          <span style={{ fontSize: 11, color: C.muted, marginLeft: 8 }}>{linea.cant} {linea.unidad_item || linea.unidad_libre}</span>
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 13, color: C.accent, flexShrink: 0 }}>{fmt(linea.precio_venta_con_iva)}</div>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "flex-end", padding: "6px 0", fontSize: 12, color: C.muted }}>
                      Subtotal: <span style={{ fontFamily: "monospace", marginLeft: 8, fontWeight: 600, color: C.accent }}>{fmt(rubro.subtotal_precio)}</span>
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                  <span>Total c/IVA</span>
                  <span style={{ fontFamily: "monospace", fontSize: 16, color: C.accent }}>{fmt(presDetalle.totales?.total_precio_con_iva)}</span>
                </div>
              </div>
            )}

            {/* Sección de comentarios / consultas */}
            <div style={card}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>💬 Consultas y observaciones</div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>
                Podés dejar consultas, observaciones o pedidos de aclaración sobre este presupuesto. El equipo de Fima te responderá a la brevedad.
              </div>

              {/* Lista de comentarios */}
              {comentarios.length === 0 && (
                <div style={{ textAlign: "center", color: C.muted, padding: "20px 0", fontSize: 13 }}>
                  No hay consultas aún. Escribí tu primera consulta abajo.
                </div>
              )}
              <div style={{ marginBottom: 16, maxHeight: 300, overflowY: "auto" }}>
                {comentarios.map((c, i) => (
                  <div key={i} style={{
                    marginBottom: 10, padding: "10px 14px", borderRadius: 8,
                    background: c.es_admin ? "rgba(5,150,105,0.06)" : "rgba(124,58,237,0.06)",
                    border: `1px solid ${c.es_admin ? "rgba(5,150,105,0.2)" : "rgba(124,58,237,0.2)"}`,
                    marginLeft: c.es_admin ? 0 : 20,
                    marginRight: c.es_admin ? 20 : 0,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.es_admin ? C.accent : C.accent2 }}>
                        {c.es_admin ? "Fima Arquitectura" : (c.nombre || c.email)}
                      </span>
                      <span style={{ fontSize: 10, color: C.muted }}>
                        {new Date(c.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ fontSize: 13 }}>{c.texto}</div>
                  </div>
                ))}
              </div>

              {/* Input para nuevo comentario */}
              <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
                <textarea
                  value={nuevoComentario}
                  onChange={e => setNuevoComentario(e.target.value)}
                  placeholder="Escribí tu consulta u observación..."
                  rows={3}
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={enviarComentario} disabled={enviando || !nuevoComentario.trim()}
                    style={{ padding: "8px 20px", background: C.accent, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", opacity: enviando || !nuevoComentario.trim() ? 0.5 : 1 }}>
                    {enviando ? "Enviando..." : "Enviar consulta"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CERTIFICADOS ── */}
        {tab === "certificados" && !certSelec && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>
              Mis certificados
            </div>
            {certificados.length === 0 && (
              <div style={{ ...card, textAlign: "center", color: C.muted, padding: 40 }}>No hay certificados emitidos aún</div>
            )}
            {certificados.map(c => (
              <div key={c.id} style={{ ...card, cursor: "pointer" }}
                onClick={() => setCertSelec(c)}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent2}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      Certificado Nº {c.numero}
                    </div>
                    <div style={{ fontSize: 13, color: C.accent2, marginBottom: 4 }}>{c.obra}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{fmtDate(c.fecha)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: C.accent2 }}>{fmt(c.total_periodo)}</div>
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Este período</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DETALLE CERTIFICADO ── */}
        {tab === "certificados" && certSelec && (
          <div>
            <button onClick={() => { setCertSelec(null); setCertDetalle(null); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
              ← Volver
            </button>

            <div style={{ ...card, marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, fontFamily: "'Syne', sans-serif", marginBottom: 4 }}>
                Certificado Nº {certSelec.numero}
              </div>
              <div style={{ fontSize: 14, color: C.accent2, marginBottom: 8 }}>{certSelec.obra}</div>
              <div style={{ fontSize: 12, color: C.muted }}>Fecha: {fmtDate(certSelec.fecha)}</div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Total período</span>
                <span style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: C.accent2 }}>{fmt(certSelec.total_periodo)}</span>
              </div>
            </div>

            {loadingCert ? (
              <div style={{ ...card, textAlign: "center", color: C.muted, padding: 30 }}>Cargando detalle...</div>
            ) : certDetalle?.avances?.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: C.muted, marginBottom: 12 }}>Detalle del certificado</div>
                {certDetalle.avances.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <div style={{ flex: 1 }}>
                      <div>{a.nombre_item || a.nombre_libre}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        Avance acum.: {(a.pct_avance_acumulado || 0).toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 13, color: C.accent2, flexShrink: 0 }}>{fmt(a.monto_periodo)}</div>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: `2px solid ${C.border}`, fontWeight: 700 }}>
                  <span>Total período</span>
                  <span style={{ fontFamily: "monospace", fontSize: 16, color: C.accent2 }}>{fmt(certSelec.total_periodo)}</span>
                </div>
              </div>
            )}
          </div>
        )}
        {/* ── AVANCE GENERAL ── */}
        {tab === "avance" && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, fontFamily: "'Syne', sans-serif" }}>Panel de avance</div>
            {presupuestos.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, padding: 40 }}>No hay presupuestos</div>}
            {presupuestos.map(p => (
              <AvanceCard key={p.id} p={p} fmt={fmt} card={card} C={C} API={API} SB_URL={SB_URL} sbH={sbH} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
