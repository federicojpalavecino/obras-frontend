import React, { useState, useEffect } from "react";
import api from "../api";

// Un proyecto no se mide en metros cuadrados ejecutados. Se mide en lo que se
// entrega: el anteproyecto, los planos municipales, la documentación. Esta
// pantalla es la lista de lo que el estudio se comprometió a dar, y el avance
// del encargo sale de ahí: cuánto de lo prometido ya está entregado.

const ESTADOS = [
  { v: "pendiente", l: "Falta", color: "var(--muted)" },
  { v: "en_curso",  l: "En eso", color: "var(--warn)" },
  { v: "entregado", l: "Entregado", color: "var(--accent)" },
];

export default function PanelEntregables({ presupuestoId, cerrado }) {
  const [data, setData] = useState(null);
  const [nuevoEn, setNuevoEn] = useState(null);     // etapa donde se agrega
  const [texto, setTexto] = useState("");
  const [nuevaEtapa, setNuevaEtapa] = useState("");
  const [cargando, setCargando] = useState(true);

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

  const agregar = async (etapaId) => {
    const items = texto.split("\n").map(x => x.trim()).filter(Boolean);
    if (!items.length) { setNuevoEn(null); return; }
    await api.post(`/presupuestos/${presupuestoId}/servicio/entregables`, { items, etapa_id: etapaId });
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
      <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Lo que el estudio se comprometió a dar. Es lo que ve el cliente en el presupuesto,
        y de acá sale el avance del encargo.
      </div>

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
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "5px 0",
                        borderBottom: "2px solid var(--border)", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: .6 }}>
              {e.nombre}
            </span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {e.entregados}/{e.total}
            </span>
            <span style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700,
                           color: e.avance_pct >= 100 ? "var(--accent)" : "var(--muted)" }}>
              {e.avance_pct}%
            </span>
          </div>

          {e.entregables.map(en => (
            <Fila key={en.id} en={en} cerrado={cerrado} onEstado={cambiarEstado} onBorrar={borrar} />
          ))}

          {!cerrado && (
            nuevoEn === e.id ? (
              <div style={{ marginTop: 6 }}>
                <textarea autoFocus value={texto} onChange={ev => setTexto(ev.target.value)}
                  placeholder={"Uno por renglón:\nPlanta de techos\nPlanilla de locales"}
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
            ) : (
              <button onClick={() => { setNuevoEn(e.id); setTexto(""); }}
                style={{ marginTop: 4, background: "none", border: "none", padding: "3px 0", cursor: "pointer",
                         fontFamily: "inherit", fontSize: 11.5, color: "var(--accent)" }}>
                + Sumar algo a {e.nombre}
              </button>
            )
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
            <Fila key={en.id} en={en} cerrado={cerrado} onEstado={cambiarEstado} onBorrar={borrar} />
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

function Fila({ en, cerrado, onEstado, onBorrar }) {
  const est = ESTADOS.find(x => x.v === en.estado) || ESTADOS[0];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 0",
                  borderBottom: "1px solid var(--border2)" }}>
      <button onClick={() => !cerrado && onEstado(en)} disabled={cerrado}
        title={cerrado ? "" : "Tocá para cambiar el estado"}
        style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, cursor: cerrado ? "default" : "pointer",
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
      <span style={{ flexShrink: 0, fontSize: 10.5, color: est.color }}>
        {est.l}{en.fecha_entrega ? ` · ${new Date(en.fecha_entrega + "T12:00:00").toLocaleDateString("es-AR")}` : ""}
      </span>
      {!cerrado && (
        <button onClick={() => onBorrar(en)}
          style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                   color: "var(--border2)", fontSize: 14, padding: "0 2px" }}>×</button>
      )}
    </div>
  );
}
