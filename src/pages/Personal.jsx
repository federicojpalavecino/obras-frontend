import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../cotizador/api";

// La pregunta del viernes es siempre la misma: a quién le tengo que pagar y
// cuánto. La respuesta depende de CÓMO cobra cada uno, y no todos cobran
// igual. Por eso el resumen viene agrupado por forma de pago: cada grupo se
// calcula distinto.

const C = { bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5", border:"#e0e0e8",
            text:"#1a1a2e", muted:"#6b7280", accent:"#059669", accent2:"#7c3aed",
            warn:"#d97706", green:"#10b981", red:"#ef4444" };

const fmt = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");
const iso = (d) => d.toISOString().split("T")[0];
const hoy = () => iso(new Date());

const inp = { width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14,
              border: `1px solid ${C.border}`, background: C.surface2, color: C.text,
              fontFamily: "inherit", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4 };

// Lunes de la semana de una fecha
function lunesDe(f) {
  const d = new Date(f + "T12:00:00");
  const dif = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dif);
  return iso(d);
}
function sumarDias(f, n) {
  const d = new Date(f + "T12:00:00");
  d.setDate(d.getDate() + n);
  return iso(d);
}

export default function Personal() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("asistencia");
  const [gente, setGente] = useState([]);
  const [modalidades, setModalidades] = useState({});
  const [obras, setObras] = useState([]);
  const [subcontratos, setSubcontratos] = useState([]);
  const [semana, setSemana] = useState(() => lunesDe(hoy()));
  const [asist, setAsist] = useState([]);
  const [pagar, setPagar] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [ficha, setFicha] = useState(null);      // alta o edición
  const [obraDelDia, setObraDelDia] = useState("");

  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 3500); };
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(semana, i));
  const finSemana = dias[6];

  const cargar = async () => {
    setCargando(true);
    try {
      const [p, o] = await Promise.all([
        api.get("/personal").then(r => r.data).catch(() => ({ personal: [] })),
        api.get("/presupuestos").then(r => r.data).catch(() => []),
      ]);
      setGente(p.personal || []);
      setModalidades(p.modalidades || {});
      setObras((o || []).filter(x => !x.es_adicional));
    } catch (e) { avisar("No se pudo cargar"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  useEffect(() => {
    api.get(`/personal/asistencia?desde=${semana}&hasta=${finSemana}`)
      .then(r => setAsist(r.data || [])).catch(() => setAsist([]));
    api.get(`/personal/a-pagar?desde=${semana}&hasta=${finSemana}`)
      .then(r => setPagar(r.data)).catch(() => setPagar(null));
  }, [semana, finSemana, gente.length]);

  const marcado = (pid, f) => asist.find(a => a.personal_id === pid && a.fecha === f);

  // Un toque marca el día entero, el segundo lo pone en medio, el tercero lo
  // borra. Es más rápido que abrir un formulario por cada jornal.
  const tocarDia = async (persona, f) => {
    const act = marcado(persona.id, f);
    const j = !act ? 1 : (act.jornadas === 1 ? 0.5 : 0);
    try {
      await api.post("/personal/asistencia", {
        personal_id: persona.id, fecha: f, jornadas: j,
        horas: persona.modalidad === "hora" ? (j === 1 ? 8 : j === 0.5 ? 4 : 0) : 0,
        presupuesto_id: obraDelDia || null,
      });
      const r = await api.get(`/personal/asistencia?desde=${semana}&hasta=${finSemana}`);
      setAsist(r.data || []);
      api.get(`/personal/a-pagar?desde=${semana}&hasta=${finSemana}`)
        .then(x => setPagar(x.data)).catch(() => {});
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo marcar")); }
  };

  const guardarFicha = async () => {
    if (!ficha.nombre?.trim()) { avisar("Ponele el nombre"); return; }
    try {
      if (ficha.id) await api.patch(`/personal/${ficha.id}`, ficha);
      else await api.post("/personal", ficha);
      setFicha(null); cargar(); avisar("✓ Guardado");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo guardar")); }
  };

  const abrirFicha = async (p) => {
    setFicha(p ? { ...p } : { nombre: "", modalidad: "jornal", valor: "", funcion: "" });
    if (!subcontratos.length) {
      // Solo hace falta para quien cobra por certificado de subcontrato.
      try {
        const todos = [];
        for (const o of obras.slice(0, 40)) {
          const r = await api.get(`/presupuestos/${o.id}/subcontratos`).catch(() => ({ data: [] }));
          (r.data || []).forEach(sc => todos.push({ ...sc, obra: o.nombre_obra }));
        }
        setSubcontratos(todos);
      } catch (e) { /* sin subcontratos se puede igual */ }
    }
  };

  if (cargando) {
    return <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", alignItems: "center",
                         justifyContent: "center", color: C.accent, fontFamily: "'Syne',sans-serif" }}>Cargando…</div>;
  }

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", color: C.text, fontFamily: "'Syne',sans-serif", paddingBottom: 60 }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/")}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px",
                   cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.muted }}>← Volver</button>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Personal</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[["asistencia", "Asistencia"], ["pagar", "A pagar"], ["gente", "La gente"]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)}
              style={{ padding: "6px 13px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                       fontSize: 13, fontWeight: tab === v ? 700 : 400,
                       border: `1px solid ${tab === v ? C.accent : C.border}`,
                       background: tab === v ? "rgba(5,150,105,.10)" : "transparent",
                       color: tab === v ? C.accent : C.muted }}>{l}</button>
          ))}
        </div>
      </div>

      {aviso && <div style={{ padding: "9px 16px", background: "rgba(5,150,105,.10)", color: C.accent, fontSize: 13 }}>{aviso}</div>}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 12px" }}>

        {gente.length === 0 && (
          <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12,
                        padding: "26px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Todavía no cargaste a nadie.</div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, maxWidth: 440, margin: "0 auto 16px" }}>
              Cargá a cada persona con la forma en que cobra. Después marcás los días que vino
              y el sistema te dice cuánto pagarle a cada uno.
            </div>
            <button onClick={() => abrirFicha(null)}
              style={{ padding: "10px 20px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                       fontSize: 13.5, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
              + Cargar a alguien
            </button>
          </div>
        )}

        {/* ══════════ ASISTENCIA ══════════ */}
        {tab === "asistencia" && gente.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button onClick={() => setSemana(sumarDias(semana, -7))}
                style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                         background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>←</button>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {new Date(semana + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
                {" al "}
                {new Date(finSemana + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              </div>
              <button onClick={() => setSemana(sumarDias(semana, 7))}
                style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                         background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>→</button>
              <button onClick={() => setSemana(lunesDe(hoy()))}
                style={{ padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 12, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                Esta semana
              </button>
              <select value={obraDelDia} onChange={e => setObraDelDia(e.target.value)}
                title="Los días que marques se imputan a esta obra"
                style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, fontSize: 12.5,
                         border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontFamily: "inherit" }}>
                <option value="">Sin imputar a una obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Un toque marca el día entero, otro lo deja en medio día, y otro lo borra.
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 10.5, color: C.muted, padding: "0 6px 6px",
                                 textTransform: "uppercase", letterSpacing: .5 }}>Quién</th>
                    {dias.map(f => {
                      const d = new Date(f + "T12:00:00");
                      const esHoy = f === hoy();
                      return (
                        <th key={f} style={{ width: 40, padding: "0 2px 6px", fontSize: 10,
                                             color: esHoy ? C.accent : C.muted, fontWeight: esHoy ? 800 : 600 }}>
                          {["D", "L", "M", "M", "J", "V", "S"][d.getDay()]}<br />{d.getDate()}
                        </th>
                      );
                    })}
                    <th style={{ width: 44, padding: "0 2px 6px", fontSize: 10, color: C.muted }}>Días</th>
                  </tr>
                </thead>
                <tbody>
                  {gente.filter(p => p.modalidad !== "subcontrato").map(p => {
                    const total = dias.reduce((a, f) => a + (marcado(p.id, f)?.jornadas || 0), 0);
                    return (
                      <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "7px 6px", fontSize: 13 }}>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>
                            {p.funcion ? p.funcion + " · " : ""}{p.modalidad_nombre}
                          </div>
                        </td>
                        {dias.map(f => {
                          const m = marcado(p.id, f);
                          const j = m?.jornadas || 0;
                          return (
                            <td key={f} style={{ textAlign: "center", padding: "5px 2px" }}>
                              <button onClick={() => tocarDia(p, f)}
                                title={m?.obra ? `En ${m.obra}` : "Sin obra"}
                                style={{ width: 30, height: 30, borderRadius: 8, cursor: "pointer",
                                         fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: 700,
                                         border: `1px solid ${j ? C.accent : C.border}`,
                                         background: j === 1 ? C.accent : j ? "rgba(5,150,105,.18)" : C.surface,
                                         color: j === 1 ? "#fff" : j ? C.accent : C.border }}>
                                {j === 1 ? "●" : j ? "½" : ""}
                              </button>
                            </td>
                          );
                        })}
                        <td style={{ textAlign: "center", fontFamily: "'IBM Plex Mono',monospace",
                                     fontWeight: 700, fontSize: 13 }}>{total || ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {gente.some(p => p.modalidad === "subcontrato") && (
              <div style={{ marginTop: 14, padding: "11px 13px", borderRadius: 10, fontSize: 12.5,
                            background: C.surface2, border: `1px solid ${C.border}`, color: C.muted, lineHeight: 1.5 }}>
                A quien cobra por certificado de subcontrato no se le marca asistencia: no cobra por
                venir, cobra por lo que certifica. Está en <b>A pagar</b>.
              </div>
            )}
          </>
        )}

        {/* ══════════ A PAGAR ══════════ */}
        {tab === "pagar" && gente.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.muted }}>
                Del {new Date(semana + "T12:00:00").toLocaleDateString("es-AR")} al{" "}
                {new Date(finSemana + "T12:00:00").toLocaleDateString("es-AR")}
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>Total a pagar</div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 22, fontWeight: 800, color: C.accent }}>
                  {fmt(pagar?.total)}
                </div>
              </div>
            </div>

            {(pagar?.grupos || []).map(g => (
              <div key={g.modalidad} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                              padding: "6px 2px", borderBottom: `2px solid ${C.border}`, marginBottom: 7 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6 }}>{g.nombre}</span>
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{fmt(g.total)}</span>
                </div>
                {g.personas.map(x => (
                  <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px",
                                           marginBottom: 5, borderRadius: 9, background: C.surface,
                                           border: `1px solid ${C.border}` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{x.nombre}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{x.detalle}</div>
                    </div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 14,
                                  flexShrink: 0, color: x.monto > 0 ? C.text : C.muted }}>{fmt(x.monto)}</div>
                  </div>
                ))}
              </div>
            ))}

            {(!pagar?.grupos || pagar.grupos.length === 0) && (
              <div style={{ fontSize: 13, color: C.muted }}>Nada que pagar en este período.</div>
            )}
          </>
        )}

        {/* ══════════ LA GENTE ══════════ */}
        {tab === "gente" && gente.length > 0 && (
          <>
            <button onClick={() => abrirFicha(null)}
              style={{ marginBottom: 12, padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                       fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: C.accent,
                       border: "none", color: "#fff" }}>+ Cargar a alguien</button>
            {gente.map(p => (
              <div key={p.id} onClick={() => abrirFicha(p)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px", marginBottom: 7,
                         borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, cursor: "pointer" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{p.nombre}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                    {p.funcion ? p.funcion + " · " : ""}{p.modalidad_nombre}
                    {p.modalidad === "subcontrato" && p.contratista ? ` · ${p.contratista}` : ""}
                  </div>
                </div>
                {p.modalidad !== "subcontrato" && (
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700 }}>{fmt(p.valor)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {p.modalidad === "hora" ? "por hora" : p.modalidad === "mensual" ? "por mes" : "por día"}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Ficha */}
      {ficha && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400,
                      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setFicha(null)}>
          <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                        width: "min(520px,100%)", maxHeight: "90dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
              {ficha.id ? ficha.nombre : "Alguien nuevo"}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Nombre</label>
              <input style={inp} value={ficha.nombre || ""} autoFocus
                onChange={e => setFicha(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Qué hace</label>
              <input style={inp} value={ficha.funcion || ""} placeholder="Oficial, ayudante, capataz…"
                onChange={e => setFicha(f => ({ ...f, funcion: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Cómo cobra</label>
              <select style={inp} value={ficha.modalidad || "jornal"}
                onChange={e => setFicha(f => ({ ...f, modalidad: e.target.value }))}>
                {Object.entries(modalidades).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {ficha.modalidad === "subcontrato" ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>De qué subcontrato</label>
                  <select style={inp} value={ficha.subcontrato_id || ""}
                    onChange={e => setFicha(f => ({ ...f, subcontrato_id: e.target.value || null }))}>
                    <option value="">Elegí uno…</option>
                    {subcontratos.map(sc => (
                      <option key={sc.id} value={sc.id}>
                        {sc.nombre_contratista || sc.contratista} — {sc.obra}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
                  A esta persona no se le marca asistencia: lo que se le debe sale de lo que
                  certificó el subcontrato menos lo que ya se le pagó.
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>
                  {ficha.modalidad === "hora" ? "Cuánto la hora"
                    : ficha.modalidad === "mensual" ? "Sueldo del mes" : "Cuánto el día"}
                </label>
                <input style={inp} type="number" inputMode="decimal" value={ficha.valor ?? ""}
                  onChange={e => setFicha(f => ({ ...f, valor: e.target.value }))} />
              </div>
            )}

            <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
              {ficha.id && (
                <button onClick={async () => {
                    try { await api.delete(`/personal/${ficha.id}`); setFicha(null); cargar(); avisar("✓ Dado de baja"); }
                    catch (e) { avisar("⚠ No se pudo"); }
                  }}
                  style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                           fontSize: 13, background: "transparent", border: `1px solid ${C.red}44`, color: C.red }}>
                  Dar de baja
                </button>
              )}
              <button onClick={() => setFicha(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                Cancelar
              </button>
              <button onClick={guardarFicha}
                style={{ flex: 1.4, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
