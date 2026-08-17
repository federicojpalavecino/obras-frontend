import React, { useState, useEffect } from "react";
import api from "../api";

// Un proyecto no se mide en metros cuadrados ejecutados. Se mide en lo que se
// entrega: el anteproyecto, los planos municipales, la documentación. Esta
// pantalla es la lista de lo que el estudio se comprometió a dar, y el avance
// del encargo sale de ahí: cuánto de lo prometido ya está entregado.

const plata = (n) => "$ " + Math.round(n || 0).toLocaleString("es-AR");

const ESTADOS = [
  { v: "pendiente", l: "Falta", color: "var(--muted)" },
  { v: "en_curso",  l: "En eso", color: "var(--warn)" },
  { v: "entregado", l: "Entregado", color: "var(--accent)" },
];

// Cerrar un presupuesto congela el COMPROMISO, no la EJECUCION. Es al reves
// de como estaba: el encargo se cierra cuando el cliente lo acepta, y recien
// ahi empieza el trabajo de entregar. Bloquear el avance al cerrar dejaba la
// pantalla mirando sin poder tocar nada, justo cuando hace falta usarla.
//
//   se puede siempre   → marcar entregado, cobrar la etapa
//   solo con el abierto → el % de cada etapa, qué entra y qué no, borrar
//   con el cerrado      → sumar cosas, pero entran como extra fuera del
//                         encargo, que es lo que son
export default function PanelEntregables({ presupuestoId, cerrado }) {
  const [data, setData] = useState(null);
  const [nuevoEn, setNuevoEn] = useState(null);     // etapa donde se agrega
  const [texto, setTexto] = useState("");
  const [nuevaEtapa, setNuevaEtapa] = useState("");
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState("");

  const cargar = async () => {
    try {
      const r = await api.get(`/presupuestos/${presupuestoId}/servicio`);
      setData(r.data);
    } catch (e) { setData(null); }
    setCargando(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [presupuestoId]);

  const cambiarEstado = async (en) => {
    // Un toque avanza al estado siguiente y vuelve a empezar. Marcar entregado
    // pone la fecha solo: nadie la carga a mano.
    const orden = ["pendiente", "en_curso", "entregado"];
    const sig = orden[(orden.indexOf(en.estado) + 1) % orden.length];
    await api.patch(`/presupuestos/${presupuestoId}/servicio/entregables/${en.id}`, { estado: sig });
    cargar();
  };

  const guardarPeso = async (etapaId, v) => {
    const n = parseFloat(String(v).replace(",", "."));
    if (isNaN(n) || n < 0 || n > 100) return;
    await api.patch(`/presupuestos/${presupuestoId}/servicio/etapas/${etapaId}`, { peso_pct: n });
    cargar();
  };

  // Lo que queda afuera del encargo no cuenta para el avance y sale impreso
  // como "no incluye", que es lo que evita la discusión de después.
  const alternarIncluido = async (en) => {
    await api.patch(`/presupuestos/${presupuestoId}/servicio/entregables/${en.id}`,
      { incluido: !en.incluido });
    cargar();
  };

  const cobrar = async (e) => {
    try {
      const r = await api.post(`/presupuestos/${presupuestoId}/servicio/etapas/${e.id}/cobrar`, {});
      cargar();
      setAviso(r.data?.en_control_financiero
        ? `✓ Cobrado ${plata(r.data.monto)} · ya está en el control financiero`
        : `✓ Cobrado ${plata(r.data.monto)}`);
      setTimeout(() => setAviso(""), 4000);
    } catch (err) {
      setAviso("⚠ " + (err.response?.data?.detail || "No se pudo cobrar"));
      setTimeout(() => setAviso(""), 4000);
    }
  };

  // El catálogo de lo que se entrega en un encargo. Se elige de una lista en
  // vez de escribir cada cosa: son siempre las mismas.
  const [catalogo, setCatalogo] = useState(null);
  const [eligiendoEn, setEligiendoEn] = useState(null);
  const abrirCatalogo = async (etapaId) => {
    setEligiendoEn(etapaId);
    if (!catalogo) {
      try { const r = await api.get("/servicio/catalogo"); setCatalogo(r.data.etapas || []); }
      catch (e) { setCatalogo([]); }
    }
  };
  const sumarDelCatalogo = async (etapaId, nombre) => {
    const r = await api.post(`/presupuestos/${presupuestoId}/servicio/entregables`,
      { items: [nombre], etapa_id: etapaId });
    // Con el encargo cerrado, lo que se suma no estaba pactado: entra afuera.
    if (cerrado && r.data?.ids) {
      for (const id of r.data.ids) {
        await api.patch(`/presupuestos/${presupuestoId}/servicio/entregables/${id}`, { incluido: false });
      }
    }
    cargar();
  };

  const agregar = async (etapaId) => {
    const items = texto.split("\n").map(x => x.trim()).filter(Boolean);
    if (!items.length) { setNuevoEn(null); return; }
    const r = await api.post(`/presupuestos/${presupuestoId}/servicio/entregables`, { items, etapa_id: etapaId });
    if (cerrado && r.data?.ids) {
      for (const id of r.data.ids) {
        await api.patch(`/presupuestos/${presupuestoId}/servicio/entregables/${id}`, { incluido: false });
      }
    }
    setTexto(""); setNuevoEn(null); cargar();
  };

  const crearEtapa = async () => {
    if (!nuevaEtapa.trim()) return;
    await api.post(`/presupuestos/${presupuestoId}/servicio/etapas`, { nombre: nuevaEtapa.trim() });
    setNuevaEtapa(""); cargar();
  };

  const borrar = async (en) => {
    await api.delete(`/presupuestos/${presupuestoId}/servicio/entregables/${en.id}`);
    cargar();
  };

  if (cargando) return <div style={{ fontSize: 12, color: "var(--muted)", padding: 12 }}>Cargando…</div>;
  if (!data) return null;

  const vacio = data.total === 0;

  return (
    <div style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>Qué se entrega</div>
        {!vacio && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>
              {data.avance_pct}%
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)" }}>
              {data.entregados} de {data.total} entregados
            </div>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Lo que el estudio se comprometió a dar. El tilde violeta de la izquierda dice si
        entra en el presupuesto; lo que dejes afuera se imprime como «no incluye».
        Cada etapa se lleva un porcentaje del honorario y se cobra cuando está entregada.
      </div>
      {cerrado && (
        <div style={{ padding: "9px 12px", borderRadius: 9, fontSize: 12, marginBottom: 12, lineHeight: 1.55,
                      background: "rgba(217,119,6,.08)", border: "1px solid rgba(217,119,6,.3)", color: "var(--warn)" }}>
          <b>El encargo está cerrado.</b> Lo pactado no se toca —los porcentajes de cada etapa y
          qué entra y qué no—, pero acá seguís marcando lo que entregás y cobrando las etapas.
          Lo que sumes ahora entra como <b>extra fuera del encargo</b>.
        </div>
      )}
      {aviso && (
        <div style={{ padding: "8px 11px", borderRadius: 8, fontSize: 12.5, marginBottom: 12,
                      background: "rgba(16,185,129,.10)", color: "var(--accent)" }}>{aviso}</div>
      )}
      {data.pesos_suman > 0 && data.pesos_suman !== 100 && !cerrado && (
        <div style={{ padding: "8px 11px", borderRadius: 8, fontSize: 12, marginBottom: 12,
                      background: "rgba(217,119,6,.10)", color: "var(--warn)" }}>
          Los porcentajes de las etapas suman {data.pesos_suman}%. Tendrían que sumar 100.
        </div>
      )}

      {vacio && (
        <div style={{ background: "var(--surface2)", border: "1px dashed var(--border)", borderRadius: 10,
                      padding: "18px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>Todavía no cargaste qué entregás.</div>
          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55, marginBottom: 13 }}>
            Podés arrancar de las etapas típicas de un encargo de arquitectura y después
            borrar lo que no hacés y sumar lo tuyo.
          </div>
          <button onClick={async () => {
              await api.post(`/presupuestos/${presupuestoId}/servicio/sugeridos`, {});
              cargar();
            }}
            style={{ padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
                     fontSize: 13, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff" }}>
            Traer las etapas típicas
          </button>
          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 9 }}>
            {(data.sugeridos || []).map(g => g.etapa).join(" · ")}
          </div>
        </div>
      )}

      {data.etapas.map(e => (
        <div key={e.id} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0",
                        borderBottom: "2px solid var(--border)", marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6 }}>
              {e.nombre}
            </span>
            {/* La etapa es a la vez el hito de entrega y el de cobro: se lleva
                un porcentaje del honorario y se cobra cuando se entregó. */}
            {!cerrado ? (
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <input type="number" min="0" max="100" defaultValue={e.peso_pct || ""} key={e.peso_pct}
                  onBlur={ev => guardarPeso(e.id, ev.target.value)}
                  title="Qué parte del honorario se cobra con esta etapa"
                  style={{ width: 42, padding: "1px 4px", borderRadius: 4, fontSize: 11,
                           border: "1px solid var(--border)", background: "var(--surface2)",
                           color: "var(--text)", fontFamily: "var(--mono)", textAlign: "right" }} />
                <span style={{ fontSize: 10.5, color: "var(--muted)" }}>% del honorario</span>
              </span>
            ) : e.peso_pct > 0 && (
              <span style={{ fontSize: 10.5, color: "var(--muted)" }}>{e.peso_pct}% del honorario</span>
            )}
            {e.monto > 0 && (
              <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--precio)" }}>
                {plata(e.monto)}
              </span>
            )}
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
              {e.entregados}/{e.total}
            </span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700,
                           color: e.avance_pct >= 100 ? "var(--accent)" : "var(--muted)" }}>
              {e.avance_pct}%
            </span>
            {e.monto > 0 && (
              e.cobrado ? (
                <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 12,
                               background: "rgba(16,185,129,.14)", color: "var(--accent)" }}>✓ cobrado</span>
              ) : e.avance_pct >= 100 ? (
                <button onClick={() => cobrar(e)}
                  style={{ padding: "3px 11px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
                           fontSize: 11, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff" }}>
                  Cobrar
                </button>
              ) : null
            )}
          </div>

          {e.entregables.map(en => (
            <Fila key={en.id} en={en} cerrado={cerrado} onEstado={cambiarEstado} onBorrar={borrar} onIncluido={alternarIncluido} />
          ))}

          {(
            nuevoEn === e.id ? (
              <div style={{ marginTop: 6 }}>
                <textarea autoFocus value={texto} onChange={ev => setTexto(ev.target.value)}
                  placeholder={cerrado
                    ? "Se suma como extra, fuera de lo pactado:\nPlano de detalle del hall"
                    : "Uno por renglón:\nPlanta de techos\nPlanilla de locales"}
                  rows={3}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
                           border: "1px solid var(--accent)", background: "var(--surface2)",
                           color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
                <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
                  <button onClick={() => { setNuevoEn(null); setTexto(""); }}
                    style={{ padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                             fontSize: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}>
                    Cancelar
                  </button>
                  <button onClick={() => agregar(e.id)}
                    style={{ padding: "6px 14px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
                             fontSize: 12, fontWeight: 700, background: "var(--accent)", border: "none", color: "#fff" }}>
                    Agregar
                  </button>
                </div>
              </div>
            ) : (<>
              <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                <button onClick={() => abrirCatalogo(eligiendoEn === e.id ? null : e.id)}
                  style={{ background: "none", border: "none", padding: "3px 0", cursor: "pointer",
                           fontFamily: "inherit", fontSize: 11.5, color: "var(--accent)" }}>
                  {eligiendoEn === e.id ? "▴ Cerrar la lista" : "+ Elegir de la lista"}
                </button>
                <button onClick={() => { setNuevoEn(e.id); setTexto(""); }}
                  style={{ background: "none", border: "none", padding: "3px 0", cursor: "pointer",
                           fontFamily: "inherit", fontSize: 11.5, color: "var(--muted)" }}>
                  + Escribir uno nuevo
                </button>
              </div>
              {eligiendoEn === e.id && (
                <div style={{ marginTop: 6, padding: "9px 11px", borderRadius: 9,
                              background: "var(--surface2)", border: "1px solid var(--border)" }}>
                  {!catalogo && <div style={{ fontSize: 12, color: "var(--muted)" }}>Cargando…</div>}
                  {(catalogo || []).map(g => {
                    const yaEstan = new Set(data.etapas.flatMap(x => x.entregables.map(y => y.nombre))
                      .concat(data.sueltos.map(y => y.nombre)));
                    const libres = g.items.filter(x => !yaEstan.has(x));
                    if (!libres.length) return null;
                    return (
                      <div key={g.etapa} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase",
                                      letterSpacing: .5, marginBottom: 4 }}>{g.etapa}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {libres.map(x => (
                            <button key={x} onClick={() => sumarDelCatalogo(e.id, x)}
                              style={{ padding: "3px 9px", borderRadius: 12, cursor: "pointer",
                                       fontFamily: "inherit", fontSize: 11, background: "var(--surface)",
                                       border: "1px solid var(--border)", color: "var(--text)" }}>
                              + {x}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>)
          )}
        </div>
      ))}

      {data.sueltos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6,
                        padding: "5px 0", borderBottom: "2px solid var(--border)", marginBottom: 6 }}>
            Sin etapa
          </div>
          {data.sueltos.map(en => (
            <Fila key={en.id} en={en} cerrado={cerrado} onEstado={cambiarEstado} onBorrar={borrar} onIncluido={alternarIncluido} />
          ))}
        </div>
      )}

      {!cerrado && !vacio && (
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          <input value={nuevaEtapa} onChange={e => setNuevaEtapa(e.target.value)}
            placeholder="Nombre de una etapa nueva"
            onKeyDown={e => { if (e.key === "Enter") crearEtapa(); }}
            style={{ flex: 1, padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
                     border: "1px solid var(--border)", background: "var(--surface2)",
                     color: "var(--text)", fontFamily: "inherit", boxSizing: "border-box" }} />
          <button onClick={crearEtapa}
            style={{ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                     fontSize: 12.5, background: "transparent", border: "1px solid var(--border)", color: "var(--text)" }}>
            + Etapa
          </button>
        </div>
      )}
    </div>
  );
}

function Fila({ en, cerrado, onEstado, onBorrar, onIncluido }) {
  const est = ESTADOS.find(x => x.v === en.estado) || ESTADOS[0];
  const fuera = en.incluido === false;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0",
                  borderBottom: "1px solid var(--border2)", opacity: fuera ? .55 : 1 }}>
      {/* Elegir si esto entra en el encargo o no. Lo que queda afuera se
          imprime igual, en la lista de "no incluye". */}
      {!cerrado && onIncluido && (
        <button onClick={() => onIncluido(en)}
          title={fuera ? "No entra en el presupuesto — tocá para incluirlo"
                       : "Entra en el presupuesto — tocá para dejarlo afuera"}
          style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, cursor: "pointer",
                   border: `1px solid ${fuera ? "var(--border2)" : "var(--accent2)"}`,
                   background: fuera ? "transparent" : "var(--accent2)",
                   color: "#fff", fontSize: 10, lineHeight: 1, padding: 0 }}>
          {fuera ? "" : "✓"}
        </button>
      )}
      <button onClick={() => !fuera && onEstado(en)} disabled={fuera}
        title={fuera ? "No entra en el encargo" : "Tocá para cambiar el estado"}
        style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: fuera ? "default" : "pointer",
                 border: `1px solid ${en.estado === "pendiente" ? "var(--border2)" : est.color}`,
                 background: en.estado === "entregado" ? est.color
                           : en.estado === "en_curso" ? "rgba(217,119,6,.25)" : "transparent",
                 color: "#fff", fontSize: 11, lineHeight: 1, padding: 0 }}>
        {en.estado === "entregado" ? "✓" : en.estado === "en_curso" ? "·" : ""}
      </button>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5,
                     color: en.estado === "entregado" ? "var(--muted)" : "var(--text)",
                     textDecoration: en.estado === "entregado" ? "line-through" : "none" }}>
        {en.nombre}
      </span>
      <span style={{ flexShrink: 0, fontSize: 10.5, color: fuera ? "var(--muted)" : est.color }}>
        {fuera ? "no incluido" : est.l}
        {!fuera && en.fecha_entrega ? ` · ${new Date(en.fecha_entrega + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
      </span>
      {!cerrado && (
        <button onClick={() => onBorrar(en)}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                   color: "var(--border2)", fontSize: 14, padding: "0 2px" }}>×</button>
      )}
    </div>
  );
}
