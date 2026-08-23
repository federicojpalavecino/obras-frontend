// ── Circuito del asistente ───────────────────────────────────────────────────
//
// Se pega entero en la consola del navegador, logueado y parado en la obra que
// dice cada bloque. Corre las preguntas de a una, espera la respuesta y la
// compara contra lo que TIENE que decir y lo que NO.
//
// Lo de "no" es la mitad importante: el asistente casi siempre contesta algo.
// Lo que hay que detectar es que conteste de la obra equivocada, o que devuelva
// el instructivo cuando le pidieron un número. Una prueba que solo mira si
// contestó, pasa siempre y no sirve.
//
// Uso:
//     __correr(CASOS.obra)      // parado en /cotizador/presupuesto/164/obra
//     __ver()                   // cuando termina
//
// Los casos apuntan al tenant Simulación (obra 164, Casa Quiroga — Ampliación
// quincho). Si se corre contra otro tenant hay que cambiar los nombres.

const CASOS = {

  // ── A. AYUDA DEL SISTEMA ─────────────────────────────────────────────────
  //    Tiene que explicar el paso a paso. Si aparece un importe, se equivocó
  //    de capa: le preguntaron cómo se hace, no cuánto hay.
  ayuda: [
    { q: "como creo un presupuesto",                 debe: "presupuesto",              no: "te deben|jornadas" },
    { q: "como cargo un adicional",                  debe: "adicional",                no: "te deben|jornadas" },
    { q: "como marco dias de lluvia",                debe: "lluvia|perdid",            no: "te deben" },
    { q: "como le doy acceso al portal a un cliente", debe: "portal|acceso|clave",     no: "te deben" },
    { q: "para que sirve el control financiero",     debe: "control financiero|caja",  no: null },
    { q: "como cierro un presupuesto",               debe: "cerr|cierr",               no: "te deben" },
    { q: "no me recalcula el plazo con la lluvia",   debe: "lluvia|perdid|holgura",    no: "te deben" },
  ],

  // ── B. LA OBRA DONDE ESTÁS PARADO ────────────────────────────────────────
  //    Ninguna pregunta nombra la obra: la señala con "acá" o directamente no
  //    la menciona. Es como se pregunta en la vida real cuando la tenés en
  //    pantalla. El "no" descarta que conteste de otra obra o del estudio.
  obra: [
    { q: "cuanto me deben aca",          debe: "Casa Quiroga",        no: "Muro perimetral|Ba[nñ]o nuevo" },
    { q: "quien trabaja aca",            debe: "Luis|Ariel",          no: "Muro perimetral" },
    { q: "cuando termina esta obra",     debe: "septiembre|termina",  no: "obras pasadas de fecha" },
    { q: "cuando arranco",               debe: "agosto|arranc",       no: "obras pasadas de fecha" },
    { q: "que materiales lleva esta obra", debe: "materiales",        no: "obras pasadas de fecha" },
    { q: "hay adicionales aca",          debe: "Casa Quiroga",        no: "Muro perimetral|Cierre perimetral" },
    { q: "cual es el ultimo certificado", debe: "certificado",        no: "Muro perimetral" },
    { q: "y el contrato",                debe: "contrato",            no: "Muro perimetral" },
    { q: "como viene el avance",         debe: "60|avance de",        no: "Tocá|Abrilo" },
    { q: "cuanto falta pagar aca",       debe: "Casa Quiroga|pagar",  no: "Muro perimetral" },
    { q: "el plan de obra",              debe: "plan|tarea",          no: "Muro perimetral" },
  ],

  // ── C. NOMBRANDO LA COSA, DESDE CUALQUIER PANTALLA ───────────────────────
  //    Acá se prueba que distinga entre obras que comparten palabras. El
  //    estudio tiene cinco "Muro perimetral" y dos "Casa Quiroga".
  nombrando: [
    { q: "cuanto me deben en casa quiroga vivienda", debe: "Vivienda 96",  no: "Ampliaci" },
    { q: "materiales de muro cierre",                debe: "uro cierre",   no: null },
    { q: "que obras tiene marta quiroga",            debe: "Quiroga",      no: null },
    { q: "quien es matias gonzalez",                 debe: "Matias|Gonzalez", no: null },
    { q: "cuando termina casa matias",               debe: "Casa Matias",  no: "Muro perimetral" },
  ],

  // ── D. EL ESTUDIO ENTERO ─────────────────────────────────────────────────
  //    Sin obra en pantalla ni nombrada, la respuesta es del estudio.
  estudio: [
    { q: "cuanto me deben en total",   debe: "\\$ ?[\\d.]{6,}",                 no: null },
    { q: "cuanto tengo que pagar",     debe: "\\$ ?[\\d.]{4,}|no hay|nada pend", no: null },
    { q: "que obras tengo atrasadas",  debe: "atrasad|pasadas de fecha|al d",   no: null },
    { q: "que hay en el panol",        debe: "pa[nñ]ol|herramient|no hay",      no: null },
  ],
};

// ── Motor ────────────────────────────────────────────────────────────────────

async function __pre(q, tope) {
  const inp = document.querySelector('input[placeholder="Escribí tu duda…"]');
  if (!inp) return "(sin panel)";
  const cont = inp.closest("div").parentElement.parentElement;
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  set.call(inp, q);
  inp.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 150));
  inp.dispatchEvent(new KeyboardEvent("keydown",
    { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
  const f = inp.closest("form");
  if (f) f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

  // Espera a que la respuesta llegue Y deje de crecer. Sin lo segundo se lee
  // media respuesta y el caso siguiente arranca encima del anterior.
  const t0 = Date.now();
  let txt = "", estable = 0;
  while (Date.now() - t0 < (tope || 20000)) {
    await new Promise((r) => setTimeout(r, 400));
    const l = cont.innerText.split("\n").map((s) => s.trim()).filter(Boolean);
    const i = l.lastIndexOf(q);
    const nu = (i >= 0 ? l.slice(i + 1) : [])
      .filter((x) => !/^Preguntame|^Abrir |^Ir a|^Ver |^¿Cómo /.test(x)).join(" | ");
    if (nu && !/Un segundo/i.test(nu)) {
      if (nu === txt) { if (++estable >= 2) break; } else estable = 0;
      txt = nu;
    }
  }
  return txt || "(sin respuesta)";
}

function __correr(casos) {
  // Sin este candado, dos corridas encimadas escriben en el mismo input y los
  // resultados salen mezclados. Pasó, y cuesta un rato darse cuenta.
  if (window.__corriendo) return "YA HAY UNA CORRIDA EN CURSO";
  window.__corriendo = true;
  const res = { estado: "corriendo", filas: [] };
  window.__res = res;
  (async () => {
    if (!document.querySelector('input[placeholder="Escribí tu duda…"]')) {
      const bs = [...document.querySelectorAll("button")];
      bs[bs.length - 1].click();
      await new Promise((r) => setTimeout(r, 1600));
    }
    for (const c of casos) {
      const r = await __pre(c.q);
      const a = c.debe ? new RegExp(c.debe, "i").test(r) : true;
      const n = c.no ? !new RegExp(c.no, "i").test(r) : true;
      res.filas.push({
        q: c.q, ok: a && n,
        falla: !a ? "no contesta lo que se le pide" : !n ? "contesta de otra cosa" : "",
        r: r.slice(0, 180),
      });
      console.log((a && n ? "OK   " : "MAL  ") + c.q + "\n     " + r.slice(0, 160));
    }
    res.estado = "listo";
    window.__corriendo = false;
    console.log("── " + res.filas.filter((x) => x.ok).length + "/" + res.filas.length + " ──");
  })();
  return "arrancado";
}

function __ver() {
  const f = window.__res.filas;
  return window.__res.estado + "  " + f.filter((x) => x.ok).length + "/" + f.length + "\n" +
    f.map((x) => (x.ok ? "OK   " : "MAL  ") + x.q + (x.ok ? "" : "   << " + x.falla) +
                 "\n      " + x.r).join("\n");
}
