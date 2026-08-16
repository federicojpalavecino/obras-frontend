import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../cotizador/api";

// El pañol y el depósito son la misma pregunta hecha de dos formas: ¿dónde
// está lo que tengo? Con las herramientas, dónde está cada andamio y desde
// cuándo. Con los materiales, cuánto compré, cuánto se llevó cada obra y
// cuánto me queda para retirar.

const C = { bg:"#f8f9fa", surface:"#ffffff", surface2:"#f1f3f5", border:"#e0e0e8",
            text:"#1a1a2e", muted:"#6b7280", accent:"#059669", accent2:"#7c3aed",
            warn:"#d97706", green:"#10b981", red:"#ef4444" };

const fmtNum = (n) => Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const hoy = () => new Date().toISOString().split("T")[0];

const inp = { width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14,
              border: `1px solid ${C.border}`, background: C.surface2, color: C.text,
              fontFamily: "inherit", boxSizing: "border-box" };
const lbl = { fontSize: 11, color: C.muted, display: "block", marginBottom: 4 };

export default function Panol() {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => localStorage.getItem("obras_panol_tab") || "herramientas");
  const [herr, setHerr] = useState(null);
  const [stock, setStock] = useState(null);
  const [obras, setObras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");

  const [nuevaHerr, setNuevaHerr] = useState(null);   // formulario
  const [nuevoMat, setNuevoMat] = useState(null);
  const [asignar, setAsignar] = useState(null);       // herramienta a mandar
  const [mover, setMover] = useState(null);           // { item, tipo }
  const [abierta, setAbierta] = useState(null);       // fila desplegada

  const irA = (t) => { setTab(t); localStorage.setItem("obras_panol_tab", t); };
  const avisar = (m) => { setAviso(m); setTimeout(() => setAviso(""), 4000); };

  const cargar = async () => {
    setCargando(true);
    try {
      const [h, s, o] = await Promise.all([
        api.get("/panol/herramientas").then(r => r.data).catch(() => ({ herramientas: [] })),
        api.get("/stock").then(r => r.data).catch(() => ({ items: [] })),
        api.get("/presupuestos").then(r => r.data).catch(() => []),
      ]);
      setHerr(h); setStock(s);
      setObras((o || []).filter(p => !p.es_adicional));
    } catch (e) { avisar("No se pudo cargar el pañol"); }
    setCargando(false);
  };
  useEffect(() => { cargar(); }, []);

  // ── acciones ──────────────────────────────────────────────────────────
  const guardarHerr = async () => {
    if (!nuevaHerr?.nombre?.trim()) { avisar("Ponele un nombre"); return; }
    try {
      await api.post("/panol/herramientas", nuevaHerr);
      setNuevaHerr(null); cargar(); avisar("✓ Cargada al pañol");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo guardar")); }
  };

  const mandarAObra = async () => {
    try {
      await api.post(`/panol/herramientas/${asignar.h.id}/asignar`, {
        presupuesto_id: asignar.presupuesto_id || null,
        cantidad: parseFloat(asignar.cantidad) || 1,
        desde: asignar.desde, nota: asignar.nota,
      });
      setAsignar(null); cargar(); avisar("✓ Anotado: la herramienta está en la obra");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo asignar")); }
  };

  const devolver = async (aid) => {
    try {
      await api.post(`/panol/asignaciones/${aid}/devolver`, { hasta: hoy() });
      cargar(); avisar("✓ Volvió al pañol");
    } catch (e) { avisar("⚠ No se pudo"); }
  };

  const guardarMat = async () => {
    if (!nuevoMat?.nombre?.trim()) { avisar("Ponele un nombre"); return; }
    try {
      await api.post("/stock", nuevoMat);
      setNuevoMat(null); cargar(); avisar("✓ Cargado al depósito");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo guardar")); }
  };

  const guardarMovimiento = async () => {
    try {
      await api.post(`/stock/${mover.item.id}/movimientos`, {
        tipo: mover.tipo,
        cantidad: parseFloat(mover.cantidad) || 0,
        presupuesto_id: mover.tipo === "retiro" ? (mover.presupuesto_id || null) : null,
        fecha: mover.fecha, nota: mover.nota,
      });
      setMover(null); cargar();
      avisar(mover.tipo === "ingreso" ? "✓ Entró al depósito"
            : mover.tipo === "retiro" ? "✓ Salió del depósito" : "✓ Ajustado");
    } catch (e) { avisar("⚠ " + (e.response?.data?.detail || "No se pudo guardar")); }
  };

  if (cargando) {
    return <div style={{ background: C.bg, minHeight: "100dvh", display: "flex", alignItems: "center",
                         justifyContent: "center", color: C.accent, fontFamily: "'Syne',sans-serif" }}>Cargando…</div>;
  }

  const H = herr?.herramientas || [];
  const M = stock?.items || [];

  return (
    <div style={{ background: C.bg, minHeight: "100dvh", color: C.text, fontFamily: "'Syne',sans-serif", paddingBottom: 60 }}>
      {/* Encabezado */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px",
                    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={() => navigate("/")}
          style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 12px",
                   cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: C.muted }}>← Volver</button>
        <div style={{ fontSize: 17, fontWeight: 800 }}>Pañol y depósito</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {[["herramientas", "Herramientas"], ["materiales", "Materiales"]].map(([v, l]) => (
            <button key={v} onClick={() => irA(v)}
              style={{ padding: "6px 14px", borderRadius: 18, cursor: "pointer", fontFamily: "inherit",
                       fontSize: 13, fontWeight: tab === v ? 700 : 400,
                       border: `1px solid ${tab === v ? C.accent : C.border}`,
                       background: tab === v ? "rgba(5,150,105,.10)" : "transparent",
                       color: tab === v ? C.accent : C.muted }}>{l}</button>
          ))}
        </div>
      </div>

      {aviso && (
        <div style={{ padding: "9px 16px", background: "rgba(5,150,105,.10)", color: C.accent, fontSize: 13 }}>
          {aviso}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 12px" }}>

        {/* ══════════ HERRAMIENTAS ══════════ */}
        {tab === "herramientas" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <Tarjeta titulo="En el pañol" valor={fmtNum(herr?.disponibles)} color={C.accent} />
              <Tarjeta titulo="En obra" valor={fmtNum(herr?.en_obra)} color={C.warn} />
              <Tarjeta titulo="Tipos cargados" valor={H.length} color={C.muted} />
              <button onClick={() => setNuevaHerr({ nombre: "", cantidad: 1, unidad: "un", categoria: "" })}
                style={{ marginLeft: "auto", padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                         fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: C.accent,
                         border: "none", color: "#fff" }}>+ Herramienta</button>
            </div>

            {H.length === 0 && (
              <Vacio texto="Todavía no cargaste ninguna herramienta."
                     detalle="Cargá andamios, palas, amoladoras, con la cantidad que tenés. Después las mandás a una obra y sabés dónde está cada una." />
            )}

            {H.map(h => (
              <div key={h.id} style={{ background: C.surface, border: `1px solid ${C.border}`,
                                       borderRadius: 11, padding: "11px 13px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{h.nombre}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                      {h.categoria ? h.categoria + " · " : ""}{fmtNum(h.cantidad)} {h.unidad} en total
                      {h.codigo ? ` · ${h.codigo}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, fontWeight: 800,
                                  color: h.disponible > 0 ? C.accent : C.muted }}>{fmtNum(h.disponible)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>en el pañol</div>
                  </div>
                </div>

                {h.en_obra > 0 && (
                  <button onClick={() => setAbierta(abierta === "h" + h.id ? null : "h" + h.id)}
                    style={{ marginTop: 7, background: "none", border: "none", padding: 0, cursor: "pointer",
                             fontFamily: "inherit", fontSize: 12, color: C.warn }}>
                    {fmtNum(h.en_obra)} en obra {abierta === "h" + h.id ? "▴" : "▾"}
                  </button>
                )}
                {abierta === "h" + h.id && h.donde.map(d => (
                  <div key={d.asignacion_id}
                    style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, padding: "7px 10px",
                             borderRadius: 8, background: C.surface2, fontSize: 12 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <b>{fmtNum(d.cantidad)}</b> en {d.obra}
                      <span style={{ color: C.muted }}>
                        {d.desde ? ` · desde el ${new Date(d.desde + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
                        {d.quien ? ` · ${d.quien}` : ""}
                      </span>
                    </span>
                    <button onClick={() => devolver(d.asignacion_id)}
                      style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 7, cursor: "pointer",
                               fontFamily: "inherit", fontSize: 11.5, background: "transparent",
                               border: `1px solid ${C.border}`, color: C.text }}>Volvió</button>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                  <button disabled={h.disponible <= 0}
                    onClick={() => setAsignar({ h, cantidad: 1, desde: hoy(), presupuesto_id: "", nota: "" })}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, cursor: h.disponible > 0 ? "pointer" : "default",
                             fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
                             background: h.disponible > 0 ? C.accent : C.surface2,
                             border: "none", color: h.disponible > 0 ? "#fff" : C.muted }}>
                    Mandar a una obra
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ══════════ MATERIALES ══════════ */}
        {tab === "materiales" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <Tarjeta titulo="Materiales" valor={M.length} color={C.muted} />
              {stock?.hay_faltantes && <Tarjeta titulo="Bajo el mínimo" valor={M.filter(x => x.falta).length} color={C.red} />}
              <button onClick={() => setNuevoMat({ nombre: "", unidad: "un", cantidad: "", minimo: 0 })}
                style={{ marginLeft: "auto", padding: "10px 16px", borderRadius: 10, cursor: "pointer",
                         fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: C.accent,
                         border: "none", color: "#fff" }}>+ Material</button>
            </div>

            {M.length === 0 && (
              <Vacio texto="El depósito está vacío."
                     detalle="Cargá lo que comprás —cemento, hierro, ladrillos— y después anotá lo que retira cada obra. El sistema te dice cuánto queda." />
            )}

            {M.map(m => (
              <div key={m.id} style={{ background: C.surface, borderRadius: 11, marginBottom: 8,
                                       border: `1px solid ${m.falta ? C.red : C.border}`, padding: "11px 13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{m.nombre}</div>
                    <div style={{ fontSize: 11.5, color: C.muted, marginTop: 2 }}>
                      compré {fmtNum(m.comprado)} · retiré {fmtNum(m.retirado)}
                      {m.ajuste ? ` · ajuste ${fmtNum(m.ajuste)}` : ""}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 17, fontWeight: 800,
                                  color: m.falta ? C.red : C.accent }}>{fmtNum(m.disponible)}</div>
                    <div style={{ fontSize: 10, color: C.muted }}>{m.unidad} en depósito</div>
                  </div>
                </div>

                {m.falta && (
                  <div style={{ marginTop: 7, fontSize: 12, color: C.red }}>
                    Quedan menos de {fmtNum(m.minimo)} {m.unidad} — hay que pedir más.
                  </div>
                )}

                {m.obras.length > 0 && (
                  <button onClick={() => setAbierta(abierta === "m" + m.id ? null : "m" + m.id)}
                    style={{ marginTop: 7, background: "none", border: "none", padding: 0, cursor: "pointer",
                             fontFamily: "inherit", fontSize: 12, color: C.accent2 }}>
                    Se llevaron {m.obras.length} obra{m.obras.length !== 1 ? "s" : ""} {abierta === "m" + m.id ? "▴" : "▾"}
                  </button>
                )}
                {abierta === "m" + m.id && m.obras.map(o => (
                  <div key={o.presupuesto_id}
                    style={{ display: "flex", justifyContent: "space-between", marginTop: 5, padding: "6px 10px",
                             borderRadius: 8, background: C.surface2, fontSize: 12 }}>
                    <span>{o.obra}</span>
                    <b style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{fmtNum(o.cantidad)} {m.unidad}</b>
                  </div>
                ))}

                <div style={{ display: "flex", gap: 7, marginTop: 9 }}>
                  <button onClick={() => setMover({ item: m, tipo: "ingreso", cantidad: "", fecha: hoy(), nota: "" })}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                             fontSize: 12.5, fontWeight: 700, background: "transparent",
                             border: `1px solid ${C.border}`, color: C.text }}>Compré más</button>
                  <button onClick={() => setMover({ item: m, tipo: "retiro", cantidad: "", fecha: hoy(), presupuesto_id: "", nota: "" })}
                    style={{ flex: 1.3, padding: "8px 0", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                             fontSize: 12.5, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
                    Retirar para una obra
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Formularios ─────────────────────────────────────────────── */}
      {nuevaHerr && (
        <Hoja titulo="Herramienta nueva" onCerrar={() => setNuevaHerr(null)} onGuardar={guardarHerr}>
          <Campo label="Qué es" valor={nuevaHerr.nombre} placeholder="Andamio, pala, amoladora…"
            onChange={v => setNuevaHerr(f => ({ ...f, nombre: v }))} autoFocus />
          <div style={{ display: "flex", gap: 9 }}>
            <div style={{ flex: 1 }}>
              <Campo label="Cuántas tenés" tipo="number" valor={nuevaHerr.cantidad}
                onChange={v => setNuevaHerr(f => ({ ...f, cantidad: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Campo label="Unidad" valor={nuevaHerr.unidad} placeholder="un, m2"
                onChange={v => setNuevaHerr(f => ({ ...f, unidad: v }))} />
            </div>
          </div>
          <Campo label="Categoría (opcional)" valor={nuevaHerr.categoria} placeholder="Andamios, eléctricas, manuales"
            onChange={v => setNuevaHerr(f => ({ ...f, categoria: v }))} />
        </Hoja>
      )}

      {asignar && (
        <Hoja titulo={`Mandar ${asignar.h.nombre} a una obra`} onCerrar={() => setAsignar(null)} onGuardar={mandarAObra}
          pie={`En el pañol quedan ${fmtNum(asignar.h.disponible)} ${asignar.h.unidad}`}>
          <Campo label="Cuántas" tipo="number" valor={asignar.cantidad} autoFocus
            onChange={v => setAsignar(f => ({ ...f, cantidad: v }))} />
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>A qué obra</label>
            <select style={inp} value={asignar.presupuesto_id}
              onChange={e => setAsignar(f => ({ ...f, presupuesto_id: e.target.value }))}>
              <option value="">Elegí una obra…</option>
              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
            </select>
          </div>
          <Campo label="Desde cuándo" tipo="date" valor={asignar.desde}
            onChange={v => setAsignar(f => ({ ...f, desde: v }))} />
          <Campo label="Nota (opcional)" valor={asignar.nota} placeholder="Quién la llevó, en qué camión…"
            onChange={v => setAsignar(f => ({ ...f, nota: v }))} />
        </Hoja>
      )}

      {nuevoMat && (
        <Hoja titulo="Material nuevo en el depósito" onCerrar={() => setNuevoMat(null)} onGuardar={guardarMat}>
          <Campo label="Qué es" valor={nuevoMat.nombre} placeholder="Cemento, hierro del 8, ladrillo hueco…"
            onChange={v => setNuevoMat(f => ({ ...f, nombre: v }))} autoFocus />
          <div style={{ display: "flex", gap: 9 }}>
            <div style={{ flex: 1.2 }}>
              <Campo label="Cuánto entró ahora" tipo="number" valor={nuevoMat.cantidad}
                onChange={v => setNuevoMat(f => ({ ...f, cantidad: v }))} />
            </div>
            <div style={{ flex: 1 }}>
              <Campo label="Unidad" valor={nuevoMat.unidad} placeholder="bolsa, m3, kg"
                onChange={v => setNuevoMat(f => ({ ...f, unidad: v }))} />
            </div>
          </div>
          <Campo label="Avisame cuando queden menos de" tipo="number" valor={nuevoMat.minimo}
            onChange={v => setNuevoMat(f => ({ ...f, minimo: v }))} />
        </Hoja>
      )}

      {mover && (
        <Hoja
          titulo={mover.tipo === "ingreso" ? `Entró ${mover.item.nombre}`
                : mover.tipo === "retiro" ? `Retirar ${mover.item.nombre}` : `Ajustar ${mover.item.nombre}`}
          onCerrar={() => setMover(null)} onGuardar={guardarMovimiento}
          pie={`Hoy hay ${fmtNum(mover.item.disponible)} ${mover.item.unidad} en el depósito`}>
          <Campo label="Cuánto" tipo="number" valor={mover.cantidad} autoFocus
            onChange={v => setMover(f => ({ ...f, cantidad: v }))} />
          {mover.tipo === "retiro" && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Para qué obra</label>
              <select style={inp} value={mover.presupuesto_id}
                onChange={e => setMover(f => ({ ...f, presupuesto_id: e.target.value }))}>
                <option value="">Sin obra (uso interno)</option>
                {obras.map(o => <option key={o.id} value={o.id}>{o.nombre_obra}</option>)}
              </select>
            </div>
          )}
          <Campo label="Fecha" tipo="date" valor={mover.fecha}
            onChange={v => setMover(f => ({ ...f, fecha: v }))} />
          <Campo label="Nota (opcional)" valor={mover.nota}
            onChange={v => setMover(f => ({ ...f, nota: v }))} />
        </Hoja>
      )}
    </div>
  );
}

// ── piezas ───────────────────────────────────────────────────────────────
function Tarjeta({ titulo, valor, color }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                  padding: "8px 14px", minWidth: 96 }}>
      <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: .6 }}>{titulo}</div>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 18, fontWeight: 800, color }}>{valor}</div>
    </div>
  );
}

function Vacio({ texto, detalle }) {
  return (
    <div style={{ background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 12,
                  padding: "26px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{texto}</div>
      <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.55, maxWidth: 420, margin: "0 auto" }}>{detalle}</div>
    </div>
  );
}

function Campo({ label, valor, onChange, tipo = "text", placeholder, autoFocus }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      <input style={inp} type={tipo} value={valor ?? ""} placeholder={placeholder} autoFocus={autoFocus}
        inputMode={tipo === "number" ? "decimal" : undefined}
        onChange={e => onChange(e.target.value)} />
    </div>
  );
}

// Hoja que sube desde abajo: en obra se usa con una mano.
function Hoja({ titulo, children, onCerrar, onGuardar, pie }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 400,
                  display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onCerrar}>
      <div style={{ background: C.surface, borderRadius: "16px 16px 0 0", padding: "20px 18px 26px",
                    width: "min(520px,100%)", maxHeight: "90dvh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: pie ? 3 : 14 }}>{titulo}</div>
        {pie && <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>{pie}</div>}
        {children}
        <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
          <button onClick={onCerrar}
            style={{ flex: 1, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                     fontSize: 14, background: "transparent", border: `1px solid ${C.border}`, color: C.muted }}>
            Cancelar
          </button>
          <button onClick={onGuardar}
            style={{ flex: 1.6, padding: "12px 0", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
                     fontSize: 14, fontWeight: 700, background: C.accent, border: "none", color: "#fff" }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
