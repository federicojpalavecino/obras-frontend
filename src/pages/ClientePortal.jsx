import { useState, useEffect } from "react";

const API = process.env.REACT_APP_API_URL || "https://obras-backend-production.up.railway.app";

function TortaAvance({ pct, size = 120, color = "#059669" }) {
  const r = 46; const cx = 60; const cy = 60;
  const p = Math.min(100, Math.max(0, pct));
  const rad = (p / 100) * 2 * Math.PI;
  const x = cx + r * Math.sin(rad); const y = cy - r * Math.cos(rad);
  const large = p > 50 ? 1 : 0;
  const path = p >= 100 ? `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy-r} Z` : `M ${cx} ${cy} L ${cx} ${cy-r} A ${r} ${r} 0 ${large} 1 ${x} ${y} Z`;
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

function GanttReadonly({ presupuestoId }) {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem("obras_token") || "";

  useEffect(() => {
    fetch(`${API}/portal/gantt/${presupuestoId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => { setTareas(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [presupuestoId]);

  if (loading) return <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Cargando planificación...</div>;
  if (!tareas.length) return <div style={{ color: C.muted, fontSize: 13, padding: 20 }}>Sin planificación cargada</div>;

  // Calcular rango de fechas
  const fechas = tareas.map((t) => new Date(t.fecha_inicio + "T12:00:00"));
  const fechasFin = tareas.map((t) => { const fi = new Date(t.fecha_inicio + "T12:00:00"); fi.setDate(fi.getDate() + (t.duracion_dias || 1)); return fi; });
  const minDate = new Date(Math.min(...fechas));
  const maxDate = new Date(Math.max(...fechasFin));
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / 86400000) + 1);

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
        {minDate.toLocaleDateString("es-AR")} → {maxDate.toLocaleDateString("es-AR")}
      </div>
      {tareas.map((t, i) => {
        const start = new Date(t.fecha_inicio + "T12:00:00");
        const left = Math.max(0, Math.ceil((start - minDate) / 86400000) / totalDays * 100);
        const width = Math.max(1, (t.duracion_dias || 1)) / totalDays * 100;
        return (
          <div key={i} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: C.text, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</div>
            <div style={{ height: 20, background: C.surface2, borderRadius: 4, position: "relative", border: `1px solid ${C.border}` }}>
              <div style={{ position: "absolute", left: left + "%", width: width + "%", height: "100%", borderRadius: 3, background: t.color || C.accent2, opacity: 0.85, minWidth: 4 }} title={`${t.fecha_inicio} · ${t.duracion_dias} días`} />
              {t.progreso > 0 && <div style={{ position: "absolute", left: left + "%", width: (width * t.progreso / 100) + "%", height: "100%", borderRadius: 3, background: C.green, opacity: 0.4 }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ClientePortal({ user, clienteId, clienteNombre, onLogout }) {
  const [presupuestos, setPresupuestos] = useState([]);
  const [presSelec, setPresSelec] = useState(null);
  const [tab, setTab] = useState("avance");
  const [avance, setAvance] = useState(null);
  const [comentarios, setComentarios] = useState([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const token = localStorage.getItem("obras_token") || "";
  const authH = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetch(`${API}/portal/presupuestos`, { headers: authH })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => {
        const pres = Array.isArray(d) ? d : [];
        setPresupuestos(pres);
        if (pres.length > 0) setPresSelec(pres[0]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!presSelec) return;
    // Load avance/certificados
    fetch(`${API}/presupuestos/${presSelec.id}/certificados`, { headers: authH })
      .then((r) => r.ok ? r.json() : { certificados: [] })
      .then((d) => setAvance(d))
      .catch(() => {});
    // Load comentarios
    fetch(`${API}/portal/comentarios/${presSelec.id}`, { headers: authH })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setComentarios(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [presSelec]);

  const enviarComentario = async () => {
    if (!nuevoComentario.trim() || !presSelec) return;
    setEnviando(true);
    await fetch(`${API}/portal/comentarios`, { method: "POST", headers: { ...authH, "Content-Type": "application/json" }, body: JSON.stringify({ presupuesto_id: presSelec.id, texto: nuevoComentario }) });
    setNuevoComentario("");
    const d = await fetch(`${API}/portal/comentarios/${presSelec.id}`, { headers: authH }).then((r) => r.ok ? r.json() : []);
    setComentarios(Array.isArray(d) ? d : []);
    setEnviando(false);
  };

  // Get tenant branding from token claims or storage
  const tenantNombre = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.nombre || "FAIM OBRAS"; } catch { return "FAIM OBRAS"; } })();
  const tenantColor = (() => { try { const t = JSON.parse(localStorage.getItem("obras_tenant") || "null"); return t?.color_primario || C.accent; } catch { return C.accent; } })();

  const certs = avance?.certificados || [];
  const ultimoCert = certs.length > 0 ? certs[certs.length - 1] : null;
  const avancePct = ultimoCert ? parseFloat(ultimoCert.avance_total_pct || 0) : 0;

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 10 };
  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 12px", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit" };

  if (loading) return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.accent, fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800 }}>{tenantNombre}</div>;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Syne', sans-serif", color: C.text }}>
      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: tenantColor }}>{tenantNombre}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: C.muted }}>{clienteNombre || user?.nombre}</span>
          <button onClick={onLogout} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Obra selector */}
      {presupuestos.length > 1 && (
        <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "8px 20px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presupuestos.map((p) => (
            <button key={p.id} onClick={() => setPresSelec(p)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${presSelec?.id === p.id ? tenantColor : C.border}`, background: presSelec?.id === p.id ? tenantColor + "12" : "transparent", color: presSelec?.id === p.id ? tenantColor : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {p.nombre_obra}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, display: "flex", padding: "0 20px" }}>
        {[["avance", "📊 Avance"], ["gantt", "📅 Planificación"], ["consultas", "💬 Consultas"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: "12px 14px", background: "none", border: "none", borderBottom: `2px solid ${tab === id ? tenantColor : "transparent"}`, color: tab === id ? tenantColor : C.muted, cursor: "pointer", fontSize: 13, fontWeight: tab === id ? 700 : 400, fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {!presSelec ? (
          <div style={{ ...card, textAlign: "center", color: C.muted, padding: 60 }}>Sin proyectos asignados</div>
        ) : (
          <>
            {/* ── AVANCE ── */}
            {tab === "avance" && (
              <>
                <div style={{ ...card, display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                  <TortaAvance pct={avancePct} color={tenantColor} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{presSelec.nombre_obra}</div>
                    <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{presSelec.ubicacion}</div>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ color: C.muted }}>Avance: </span>
                      <span style={{ fontWeight: 700, color: tenantColor }}>{avancePct.toFixed(1)}%</span>
                    </div>
                    {presSelec.total_precio_con_iva > 0 && (
                      <div style={{ fontSize: 13 }}>
                        <span style={{ color: C.muted }}>Presupuesto: </span>
                        <span style={{ fontWeight: 700 }}>{fmt(presSelec.total_precio_con_iva)}</span>
                      </div>
                    )}
                  </div>
                </div>
                {certs.length > 0 && (
                  <div style={card}>
                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Certificados emitidos</div>
                    {certs.map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Certificado Nº {c.numero}</div>
                          <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(c.fecha)} · Avance: {parseFloat(c.avance_total_pct || 0).toFixed(1)}%</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: tenantColor }}>{fmt(c.monto_periodo)}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>Acum: {fmt(c.monto_acumulado)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {certs.length === 0 && <div style={{ ...card, textAlign: "center", color: C.muted, padding: 32 }}>Sin certificados emitidos aún</div>}
              </>
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
                {comentarios.length === 0 && <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>Sin mensajes todavía. Escribí tu consulta abajo.</div>}
                <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
                  {comentarios.map((c, i) => (
                    <div key={i} style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: c.es_admin ? C.surface2 : tenantColor + "12", border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{c.nombre || c.email} · {c.created_at ? new Date(c.created_at).toLocaleDateString("es-AR") : ""}</div>
                      <div style={{ fontSize: 13 }}>{c.texto}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...inp, flex: 1 }} placeholder="Escribí tu consulta..." value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviarComentario()} />
                  <button onClick={enviarComentario} disabled={enviando || !nuevoComentario.trim()} style={{ padding: "8px 16px", background: tenantColor, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: !nuevoComentario.trim() ? 0.5 : 1 }}>
                    {enviando ? "..." : "Enviar"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
