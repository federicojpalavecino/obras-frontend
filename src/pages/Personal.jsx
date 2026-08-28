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
  const [pagando, setPagando] = useState(null);   // { persona, monto }
  // Detalle de la semana de una persona: jornada, horas y obra, día por día.
  // El tap del calendario resuelve el caso rápido; esto resuelve el resto.
  const [detalleSemana, setDetalleSemana] = useState(null);
  const [guardandoDet, setGuardandoDet] = useState(false);
  // Selección de gente para mandar a una obra de una sola vez.
  const [elegidos, setElegidos] = useState({});
  const [asignando, setAsignando] = useState(null);   // { obra, tambienSemana }
  const [ocupado, setOcupado] = useState(false);

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

  const refrescar = async () => {
    const r = await api.get(`/personal/asistencia?desde=${semana}&hasta=${finSemana}`);
    setAsist(r.data || []);
    api.get(`/personal/a-pagar?desde=${semana}&hasta=${finSemana}`)
      .then(x => setPagar(x.data)).catch(() => {});
  };

  // Marcar de a uno es tocar 35 casilleros por semana. Estas tres cubren lo que
  // se hace de verdad: "Ramón vino toda la semana", "hoy vinieron todos", y
  // "estos tres están en la obra de Pérez".
  const marcarLote = async (personal_ids, fechas, jornadas) => {
    if (!personal_ids.length || !fechas.length) return;
    setOcupado(true);
    try {
      const cuerpo = { personal_ids, fechas, jornadas };
      // Con obra elegida arriba manda esa; si no, cada uno cae en la suya.
      if (obraDelDia) cuerpo.presupuesto_id = parseInt(obraDelDia);
      await api.post("/personal/asistencia/lote", cuerpo);
      await refrescar();
    } catch (e) { avisar("⚠ " + ((e.response && e.response.data && e.response.data.detail) || "No se pudo")); }
    setOcupado(false);
  };

  const diasHabiles = () => dias.filter(f => {
    const d = new Date(f + "T12:00:00").getDay();
    return d !== 0;   // el domingo no se marca solo
  });

  const laSemanaDe = (p) => {
    const yaTiene = dias.some(f => (marcado(p.id, f)?.jornadas || 0) > 0);
    return marcarLote([p.id], yaTiene ? dias : diasHabiles(), yaTiene ? 0 : 1);
  };

  const elDia = (f) => {
    const gente_ = gente.filter(x => x.modalidad !== "subcontrato");
    const yaTodos = gente_.every(x => (marcado(x.id, f)?.jornadas || 0) > 0);
    return marcarLote(gente_.map(x => x.id), [f], yaTodos ? 0 : 1);
  };

  const nElegidos = Object.values(elegidos).filter(Boolean).length;

  const guardarAsignacion = async () => {
    const ids = Object.keys(elegidos).filter(k => elegidos[k]).map(Number);
    if (!ids.length) return;
    setOcupado(true);
    try {
      const cuerpo = { personal_ids: ids, presupuesto_id: asignando.obra ? parseInt(asignando.obra) : null };
      if (asignando.tambienSemana) { cuerpo.desde = semana; cuerpo.hasta = finSemana; }
      const r = await api.post("/personal/obra", cuerpo);
      setAsignando(null); setElegidos({});
      await cargar(); await refrescar();
      avisar(`✓ ${r.data.cuantos} persona${r.data.cuantos !== 1 ? "s" : ""} a la obra`
        + (r.data.reimputados ? ` · ${r.data.reimputados} día(s) reimputados` : ""));
    } catch (e) { avisar("⚠ " + ((e.response && e.response.data && e.response.data.detail) || "No se pudo")); }
    setOcupado(false);
  };

  // Abre el detalle con lo que ya hay cargado de esa persona en la semana.
  const abrirDetalle = (persona) => {
    setDetalleSemana({
      persona,
      filas: dias.map(f => {
        const m = marcado(persona.id, f);
        return { fecha: f,
                 jornadas: m ? Number(m.jornadas) || 0 : 0,
                 horas: m && m.horas ? String(m.horas) : "",
                 presupuesto_id: m && m.presupuesto_id ? String(m.presupuesto_id) : "" };
      }),
    });
  };

  const guardarDetalle = async () => {
    setGuardandoDet(true);
    try {
      for (const f of detalleSemana.filas) {
        const previo = marcado(detalleSemana.persona.id, f.fecha);
        const antes = { j: previo ? Number(previo.jornadas) || 0 : 0,
                        h: previo && previo.horas ? Number(previo.horas) : 0,
                        o: previo && previo.presupuesto_id ? String(previo.presupuesto_id) : "" };
        const ahora = { j: Number(f.jornadas) || 0,
                        h: f.horas === "" ? 0 : Number(String(f.horas).replace(",", ".")) || 0,
                        o: f.presupuesto_id || "" };
        // Solo se manda lo que cambió: así un guardado no reescribe la semana
        // entera ni pisa lo que cargó otro.
        if (antes.j === ahora.j && antes.h === ahora.h && antes.o === ahora.o) continue;
        await api.post("/personal/asistencia", {
          personal_id: detalleSemana.persona.id,
          fecha: f.fecha,
          jornadas: ahora.j,
          horas: ahora.h,
          presupuesto_id: ahora.o ? parseInt(ahora.o) : null,
        });
      }
      const r = await api.get(`/personal/asistencia?desde=${semana}&hasta=${finSemana}`);
      setAsist(r.data || []);
      api.get(`/personal/a-pagar?desde=${semana}&hasta=${finSemana}`)
        .then(x => setPagar(x.data)).catch(() => {});
      setDetalleSemana(null);
      avisar("✓ Asistencia guardada");
    } catch (e) {
      avisar("⚠ " + ((e.response && e.response.data && e.response.data.detail) || "No se pudo guardar"));
    }
    setGuardandoDet(false);
  };

  // Registrar el pago cierra el circuito: hasta acá el resumen decía cuánto,
  // ahora queda anotado y entra como egreso del control financiero, en el
  // período en que se paga.
  const registrarPago = async () => {
    const m = parseFloat(String(pagando.monto).replace(",", "."));
    if (!(m > 0)) { avisar("⚠ Poné el monto"); return; }
    try {
      const r = await api.post("/personal/pagar", {
        personal_id: pagando.persona.id,
        monto: m,
        desde: semana, hasta: finSemana,
        fecha_pago: hoy(),
        detalle: pagando.persona.detalle,
      });
      setPagando(null);
      const x = await api.get(`/personal/a-pagar?desde=${semana}&hasta=${finSemana}`);
      setPagar(x.data);
      avisar(r.data?.en_control_financiero
        ? `✓ Pagado · ya está en el control financiero`
        : "✓ Pago registrado");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo registrar")); }
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
          {[["asistencia", "Asistencia"], ["pagar", "A pagar"], ["gente", "Personal"]].map(([v, l]) => (
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
                title="Los días que marques se imputan a esta obra. Sin elegir ninguna, cada persona va a la obra que tiene asignada."
                style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, fontSize: 12.5,
                         maxWidth: "100%", minWidth: 0,
                         border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontFamily: "inherit" }}>
                <option value="">Cada uno a su obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
              </select>
            </div>

            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 10, lineHeight: 1.5 }}>
              Un toque marca el día entero, otro lo deja en medio día, y otro lo borra. Tocá el
              <b> día</b> arriba para marcar a todos, o <b>▸</b> al lado del nombre para toda la
              semana. Para <b>horas exactas</b> o cambiar la obra de un día suelto, tocá <b>✎</b>.
            </div>

            {nElegidos > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                            padding: "9px 13px", borderRadius: 10, marginBottom: 10,
                            background: "rgba(5,150,105,.09)", border: `1px solid ${C.accent}55` }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {nElegidos} seleccionado{nElegidos !== 1 ? "s" : ""}
                </span>
                <button onClick={() => setAsignando({ obra: obraDelDia || "", tambienSemana: false })}
                  style={{ padding: "6px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                           fontSize: 12.5, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
                  Mandar a una obra
                </button>
                <button disabled={ocupado}
                  onClick={() => marcarLote(Object.keys(elegidos).filter(k => elegidos[k]).map(Number), diasHabiles(), 1)}
                  style={{ padding: "6px 13px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                           fontSize: 12.5, background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>
                  Marcar toda la semana
                </button>
                <button onClick={() => setElegidos({})}
                  style={{ marginLeft: "auto", padding: "6px 10px", borderRadius: 8, cursor: "pointer",
                           fontFamily: "inherit", fontSize: 12, background: "transparent",
                           border: "none", color: C.muted }}>Deseleccionar</button>
              </div>
            )}

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", fontSize: 10.5, color: C.muted, padding: "0 6px 6px",
                                 textTransform: "uppercase", letterSpacing: .5 }}>Quién</th>
                    <th style={{ width: 22, padding: "0 0 6px" }} />
                    {dias.map(f => {
                      const d = new Date(f + "T12:00:00");
                      const esHoy = f === hoy();
                      return (
                        <th key={f} style={{ width: 40, padding: "0 2px 6px" }}>
                          <button onClick={() => elDia(f)} disabled={ocupado}
                            title="Marcar o desmarcar a todos este día"
                            style={{ background: "none", border: "none", cursor: "pointer",
                                     fontFamily: "inherit", fontSize: 10, padding: "2px 3px", borderRadius: 5,
                                     color: esHoy ? C.accent : C.muted, fontWeight: esHoy ? 800 : 600 }}>
                            {["D", "L", "M", "M", "J", "V", "S"][d.getDay()]}<br />{d.getDate()}
                          </button>
                        </th>
                      );
                    })}
                    <th style={{ width: 40, padding: "0 2px 6px", fontSize: 10, color: C.muted }}>Días</th>
                    <th style={{ width: 44, padding: "0 2px 6px", fontSize: 10, color: C.muted }}>Horas</th>
                    <th style={{ width: 34, padding: "0 2px 6px" }} />
                  </tr>
                </thead>
                <tbody>
                  {gente.filter(p => p.modalidad !== "subcontrato").map(p => {
                    const total = dias.reduce((a, f) => a + (marcado(p.id, f)?.jornadas || 0), 0);
                    const totalHs = dias.reduce((a, f) => a + (marcado(p.id, f)?.horas || 0), 0);
                    // Las obras de la semana: se muestran abajo del nombre para
                    // que se vea dónde estuvo sin tener que abrir nada.
                    const obrasSemana = [...new Set(dias.map(f => marcado(p.id, f)?.obra).filter(Boolean))];
                    return (
                      <tr key={p.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: "7px 6px", fontSize: 13 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <input type="checkbox" checked={!!elegidos[p.id]}
                              onChange={e => setElegidos(x => ({ ...x, [p.id]: e.target.checked }))}
                              style={{ width: 14, height: 14, accentColor: C.accent, cursor: "pointer" }} />
                            <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                          </div>
                          <div style={{ fontSize: 10.5, color: C.muted }}>
                            {p.funcion ? p.funcion + " · " : ""}{p.modalidad_nombre}
                          </div>
                          {obrasSemana.length > 0 ? (
                            <div style={{ fontSize: 10.5, color: C.accent, marginTop: 2 }}>
                              {obrasSemana.join(" · ")}
                            </div>
                          ) : p.obra ? (
                            <div style={{ fontSize: 10.5, color: C.muted, marginTop: 2 }}>
                              {p.obra}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: 0, textAlign: "center" }}>
                          <button onClick={() => laSemanaDe(p)} disabled={ocupado}
                            title="Marcar o borrar toda la semana"
                            style={{ background: "none", border: "none", cursor: "pointer",
                                     color: C.border, fontSize: 12, padding: "0 2px" }}>▸</button>
                        </td>
                        {dias.map(f => {
                          const m = marcado(p.id, f);
                          const j = m?.jornadas || 0;
                          return (
                            <td key={f} style={{ textAlign: "center", padding: "5px 2px" }}>
                              <button onClick={() => tocarDia(p, f)}
                                title={[m?.obra ? `En ${m.obra}` : "Sin obra imputada",
                                        m?.horas ? `${m.horas} h` : null].filter(Boolean).join(" · ")}
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
                        <td style={{ textAlign: "center", fontFamily: "'IBM Plex Mono',monospace",
                                     fontWeight: 700, fontSize: 13, color: totalHs ? C.text : C.border }}>
                          {totalHs ? totalHs + " h" : "—"}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button onClick={() => abrirDetalle(p)} title="Horas y obra, día por día"
                            style={{ width: 26, height: 26, borderRadius: 7, cursor: "pointer",
                                     background: "transparent", border: `1px solid ${C.border}`,
                                     color: C.muted, fontSize: 12, fontFamily: "inherit" }}>✎</button>
                        </td>
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
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: 14,
                                    color: x.queda > 0 ? C.text : C.muted }}>{fmt(x.queda ?? x.monto)}</div>
                      {x.ya_pagado > 0 && (
                        <div style={{ fontSize: 10, color: C.accent }}>ya cobró {fmt(x.ya_pagado)}</div>
                      )}
                    </div>
                    {(x.queda ?? x.monto) > 0 && (
                      <button onClick={() => setPagando({ persona: x, monto: String(Math.round(x.queda ?? x.monto)) })}
                        style={{ flexShrink: 0, padding: "7px 13px", borderRadius: 8, cursor: "pointer",
                                 fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                                 background: C.accent, border: "none", color: "#fff" }}>Pagar</button>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {(!pagar?.grupos || pagar.grupos.length === 0) && (
              <div style={{ fontSize: 13, color: C.muted }}>Nada que pagar en este período.</div>
            )}
          </>
        )}

        {/* ══════════ PERSONAL ══════════ */}
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

      {pagando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 420,
                      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setPagando(null)}>
          <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                        width: "min(500px,100%)", maxHeight: "90dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pagarle a {pagando.persona.nombre}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3, marginBottom: 16, lineHeight: 1.5 }}>
              {pagando.persona.detalle} · entra hoy al control financiero.
            </div>
            <label style={lbl}>Cuánto le pagás</label>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 13, top: 13, fontSize: 18, color: C.muted }}>$</span>
              <input type="number" inputMode="decimal" autoFocus value={pagando.monto}
                onChange={e => setPagando(p => ({ ...p, monto: e.target.value }))}
                style={{ ...inp, padding: "12px 12px 12px 30px", fontSize: 20,
                         fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" }} />
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16 }}>
              Si le pagás menos, la diferencia sigue apareciendo como pendiente.
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setPagando(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                Cancelar
              </button>
              <button onClick={registrarPago}
                style={{ flex: 1.6, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
                Registrar el pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandar a una obra */}
      {asignando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400,
                      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setAsignando(null)}>
          <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                        width: "min(520px,100%)" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
              Mandar {nElegidos} persona{nElegidos !== 1 ? "s" : ""} a una obra
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 16, lineHeight: 1.5 }}>
              Queda como su obra habitual: de acá en más, cuando marques asistencia sin elegir
              obra arriba, los días les caen ahí solos.
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Obra</label>
              <select style={inp} value={asignando.obra}
                onChange={e => setAsignando(a => ({ ...a, obra: e.target.value }))}>
                <option value="">Sin obra</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
              </select>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
                            padding: "10px 12px", borderRadius: 9, background: C.surface2,
                            fontSize: 13, marginBottom: 16 }}>
              <input type="checkbox" checked={asignando.tambienSemana}
                onChange={e => setAsignando(a => ({ ...a, tambienSemana: e.target.checked }))}
                style={{ width: 15, height: 15, accentColor: C.accent }} />
              <span>
                Reimputar también los días <b>ya marcados</b> de esta semana
                <span style={{ display: "block", fontSize: 11, color: C.muted }}>
                  Para cuando te diste cuenta el viernes de que fueron a otra obra
                </span>
              </span>
            </label>

            <div style={{ display: "flex", gap: 9 }}>
              <button onClick={() => setAsignando(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                Cancelar
              </button>
              <button onClick={guardarAsignacion} disabled={ocupado}
                style={{ flex: 1.4, padding: "12px 0", borderRadius: 10, fontFamily: "inherit",
                         cursor: ocupado ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 700,
                         background: ocupado ? C.border : C.accent, border: "none", color: "#fff" }}>
                {ocupado ? "Guardando…" : "Mandar a la obra"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle de la semana: jornada, horas y obra, día por día */}
      {detalleSemana && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400,
                      display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setDetalleSemana(null)}>
          <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                        width: "min(560px,100%)", maxHeight: "90dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{detalleSemana.persona.nombre}</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
              {new Date(semana + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
              {" al "}
              {new Date(finSemana + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 14, lineHeight: 1.5 }}>
              {detalleSemana.persona.modalidad === "hora"
                ? "Cobra por hora: lo que le toca sale de las horas que cargues acá."
                : "Las horas son información de la obra; lo que cobra sale de las jornadas."}
            </div>

            {detalleSemana.filas.map((f, i) => {
              const d = new Date(f.fecha + "T12:00:00");
              const set = (campo, valor) => setDetalleSemana(prev => ({
                ...prev,
                filas: prev.filas.map((x, j) => j === i ? { ...x, [campo]: valor } : x),
              }));
              return (
                <div key={f.fecha} style={{ display: "flex", alignItems: "center", gap: 7,
                                            padding: "7px 0", borderTop: `1px solid ${C.border}` }}>
                  <div style={{ width: 54, fontSize: 12, fontWeight: 600 }}>
                    {["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"][d.getDay()]} {d.getDate()}
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[[0, "—"], [0.5, "½"], [1, "1"]].map(([v, txt]) => (
                      <button key={v} onClick={() => {
                          set("jornadas", v);
                          // Sin jornada no hay horas ni obra que imputar.
                          if (!v) { set("horas", ""); set("presupuesto_id", ""); }
                        }}
                        style={{ width: 30, height: 28, borderRadius: 7, cursor: "pointer",
                                 fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, fontWeight: 700,
                                 border: `1px solid ${f.jornadas === v ? C.accent : C.border}`,
                                 background: f.jornadas === v ? C.accent : C.surface,
                                 color: f.jornadas === v ? "#fff" : C.muted }}>{txt}</button>
                    ))}
                  </div>
                  <input type="number" inputMode="decimal" step="0.5" min="0" max="24"
                    value={f.horas} disabled={!f.jornadas} placeholder="hs"
                    onChange={e => set("horas", e.target.value)}
                    style={{ width: 58, padding: "6px 7px", borderRadius: 7, fontSize: 12.5,
                             textAlign: "right", fontFamily: "'IBM Plex Mono',monospace",
                             border: `1px solid ${C.border}`, color: C.text,
                             background: f.jornadas ? C.surface2 : C.bg, boxSizing: "border-box" }} />
                  <select value={f.presupuesto_id} disabled={!f.jornadas}
                    onChange={e => set("presupuesto_id", e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: "6px 7px", borderRadius: 7, fontSize: 12,
                             border: `1px solid ${C.border}`, fontFamily: "inherit", color: C.text,
                             background: f.jornadas ? C.surface2 : C.bg, boxSizing: "border-box" }}>
                    <option value="">Sin obra</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
                  </select>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
              <button onClick={() => setDetalleSemana(null)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                         fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
                Cancelar
              </button>
              <button onClick={guardarDetalle} disabled={guardandoDet}
                style={{ flex: 1.4, padding: "12px 0", borderRadius: 10, fontFamily: "inherit",
                         cursor: guardandoDet ? "not-allowed" : "pointer",
                         fontSize: 14, fontWeight: 700, background: guardandoDet ? C.border : C.accent,
                         border: "none", color: "#fff" }}>
                {guardandoDet ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <label style={lbl}>En qué obra trabaja</label>
              <select style={inp} value={ficha.presupuesto_id || ""}
                onChange={e => setFicha(f => ({ ...f, presupuesto_id: e.target.value || null }))}>
                <option value="">Sin obra fija</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
              </select>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.45 }}>
                Los días que le marques van a imputarse acá, sin tener que elegirla cada vez.
              </div>
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
