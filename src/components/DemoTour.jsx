// Tour guiado del demo público (ver App.js: ruta /demo y botón "Probar demo
// guiada"). Entra directo al presupuesto de ejemplo y recorre, a mano, armar
// un presupuesto de punta a punta: agregar un ítem, cargar su cantidad (y la
// calculadora de cómputos), ver el análisis de costos completo, la barra de
// totales, cerrar el presupuesto, planificar la obra (Gantt), la curva de
// inversión, el listado de materiales y un certificado — y termina en una
// pantalla con todos los entregables, invitando a registrarse.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { HelpCircle } from "lucide-react";

export default function DemoTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const segmentoActivo = useRef(null);
  const arrancarRef = useRef(null); // arranca (o re-arranca) el tour del segmento actual
  const driverActivoRef = useRef(null); // instancia en pantalla, para no duplicar si se aprieta "Retomar"
  const [mostrarBoton, setMostrarBoton] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("obras_tour_demo") !== "1") { setMostrarBoton(false); return; }
    const presuId = sessionStorage.getItem("obras_tour_presupuesto_id");
    if (!presuId) { setMostrarBoton(false); return; }

    const rutaPresu = `/cotizador/presupuesto/${presuId}`;
    const rutaGantt = `/cotizador/gantt/${presuId}`;
    const rutaCurva = `/cotizador/presupuesto/${presuId}/curva`;
    const rutaMateriales = `/cotizador/presupuesto/${presuId}/materiales`;
    const rutaCertificado = `/cotizador/presupuesto/${presuId}/certificado`;
    const rutaResumen = `/cotizador/presupuesto/${presuId}/resumen-demo`;

    const segmentoDeRuta = (path) => {
      if (path === rutaPresu) return "presupuesto";
      if (path === rutaGantt) return "gantt";
      if (path === rutaCurva) return "curva";
      if (path === rutaMateriales) return "materiales";
      if (path === rutaCertificado) return "certificado";
      if (path === rutaResumen) return "resumen"; // pantalla final: nada que guiar, tiene su propio CTA
      return null;
    };

    const segmento = segmentoDeRuta(location.pathname);
    if (!segmento) {
      driverActivoRef.current?.destroy();
      setMostrarBoton(false);
      if (location.pathname !== rutaPresu) navigate(rutaPresu, { replace: true });
      return;
    }
    if (segmento === "resumen") {
      driverActivoRef.current?.destroy();
      setMostrarBoton(false);
      sessionStorage.removeItem("obras_tour_demo");
      sessionStorage.removeItem("obras_tour_presupuesto_id");
      return;
    }
    setMostrarBoton(true);

    (async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
        import("./DemoTour.css"),
      ]);

      const arrancarTour = () => {
        driverActivoRef.current?.destroy();
        let tourDriver; // los hooks de abajo lo referencian por closure

        // La obra de ejemplo ya trae ítems cargados de varios rubros (para
        // que la tabla y la barra de totales no arranquen vacías), así que
        // "la última fila del DOM" no es confiable como "la que la persona
        // acaba de agregar": el orden de las filas depende del rubro, no de
        // cuándo se cargaron. En cambio, se guarda una foto de qué filas
        // (por su data-linea-id) existían antes de agregar, y después se
        // busca la que no estaba — esa sí es, sin importar en qué rubro
        // haya caído.
        let idsFilasAntes = null;
        const capturarFilasExistentes = () => {
          idsFilasAntes = new Set([...document.querySelectorAll('tr[data-linea-id]')].map(tr => tr.dataset.lineaId));
        };
        const filaNueva = () => {
          if (!idsFilasAntes) return null;
          return [...document.querySelectorAll('tr[data-linea-id]')].find(tr => !idsFilasAntes.has(tr.dataset.lineaId)) || null;
        };
        const enFilaNueva = (selector) => () => filaNueva()?.querySelector(selector) || null;

        const resolver = (sel) => typeof sel === "function" ? sel() : document.querySelector(sel);

        // Avanza el tour solo cuando se hace la acción real (click o blur en
        // el selector indicado) — pero SOLO si todavía estamos en el paso
        // que armó este listener. Sin este chequeo, si la persona salta el
        // paso con "Siguiente" y más tarde clickea ese elemento por su
        // cuenta, el listener viejo seguía ahí y hacía saltar el tour para
        // adelante de golpe, en cualquier paso en el que estuviera parado.
        //
        // Se escucha en fase de CAPTURA sobre `document` — no sobre el botón
        // directo — por dos razones. Primero, captura corre antes que el
        // onClick de React (delegado más arriba, en la raíz): importa en los
        // pasos donde el click hace que el propio botón desaparezca del DOM
        // (generar el Gantt, emitir un certificado), porque moveNext() tiene
        // que llamarse ANTES de que React lo saque, o el tour se queda sin
        // elemento activo y se cierra solo. Segundo, y es el motivo de que
        // esto viva en `document` y no en el nodo: si entre que se arma este
        // listener y el click real del usuario pasa un fetch que re-renderiza
        // esa parte del árbol (p. ej. "traer horas" recalculando las filas
        // del Gantt), React puede reemplazar el nodo del botón por uno
        // nuevo — y un listener puesto directo en el viejo nodo se pierde
        // con él. Resolviendo `sel` de nuevo en cada click (no una sola vez
        // al armar el listener) el paso sigue funcionando aunque el nodo
        // real haya cambiado.
        const avanzarAlClickEn = (sel, demora = 0) => () => {
          const indice = tourDriver.getActiveIndex();
          const handler = (e) => {
            if (tourDriver.getActiveIndex() !== indice) {
              document.removeEventListener("click", handler, true);
              return;
            }
            const el = resolver(sel);
            if (el && (el === e.target || el.contains(e.target))) {
              document.removeEventListener("click", handler, true);
              // Algunos clicks (p. ej. "Horas") disparan un fetch que
              // reacomoda el Gantt (las filas cambian de alto) recién
              // después de que la respuesta llega. Si avanzamos al toque,
              // driver.js calcula el recuadro del paso siguiente contra un
              // layout que todavía se va a mover debajo — y el recuadro
              // termina apuntando a otro lado. `demora` le da tiempo a la
              // pantalla para asentarse antes de calcular nada.
              if (demora > 0) setTimeout(() => tourDriver.moveNext(), demora);
              else tourDriver.moveNext();
            }
          };
          document.addEventListener("click", handler, true);
        };
        const avanzarAlCambiarEn = (sel, demora = 80) => () => {
          const el = resolver(sel);
          if (!el) return;
          const indice = tourDriver.getActiveIndex();
          const onEnter = (e) => { if (e.key === "Enter") el.blur(); };
          const avanzar = () => {
            el.removeEventListener("keydown", onEnter);
            if (tourDriver.getActiveIndex() !== indice) return;
            setTimeout(() => tourDriver.moveNext(), demora);
          };
          el.addEventListener("blur", avanzar, { once: true });
          // El overlay del tour solo deja clickear el elemento resaltado,
          // así que "hacer click afuera" para confirmar no es posible acá:
          // Enter dispara el blur de verdad (el que guarda el valor). OJO:
          // este listener NO puede ir con {once:true} — eso lo mata en la
          // primera tecla que se aprieta, sea la que sea (no en el primer
          // Enter), así que alcanza con escribir un dígito del porcentaje
          // para que Enter deje de hacer cualquier cosa. Se limpia solo en
          // `avanzar()`, cuando el blur real ya se disparó.
          el.addEventListener("keydown", onEnter);
        };

        const baseConfig = {
          showProgress: true,
          nextBtnText: "Siguiente",
          prevBtnText: "Atrás",
          doneBtnText: "Listo",
          allowClose: true,
          overlayOpacity: 0.65,
          stagePadding: 6,
          stageRadius: 10,
          overlayClickBehavior: "none",
          allowKeyboardControl: false,
          waitForElement: 1500,
          // Si el elemento de un paso no aparece (por ejemplo, porque la
          // persona se salteó el paso anterior sin hacer la acción), el
          // tour no se queda esperando para siempre: pasa solo al siguiente.
          skipMissingElement: true,
          onCloseClick: () => { tourDriver.destroy(); },
        };

        const segmentos = {
          presupuesto: [
            {
              popover: {
                title: "Bienvenido a FAIM Obras",
                description: "Armamos una obra de ejemplo para mostrarte, en vivo, cómo se arma un presupuesto completo: desde el primer ítem hasta la planificación y los certificados.",
              },
            },
            {
              element: '[data-tour="agregar-item-panel"]',
              onHighlighted: () => { capturarFilasExistentes(); avanzarAlClickEn('[data-tour="lista-items"]')(); },
              popover: {
                title: "Agregar un ítem al presupuesto",
                description: 'Buscá, por ejemplo, "contrapiso" o "revoque interior", o elegí cualquier ítem de la lista. Hacé click sobre uno para agregarlo.',
                side: "right",
                showButtons: ["previous", "close"],
              },
            },
            {
              // Solo aparece si el ítem elegido es de un rubro que todavía
              // no está en este presupuesto (como la obra ya trae ítems
              // cargados, esto pasa casi siempre). Si no aparece,
              // skipMissingElement salta directo al paso siguiente.
              element: '[data-tour="rubro-original"]',
              onHighlighted: avanzarAlClickEn('[data-tour="rubro-original"]'),
              popover: {
                title: "¿En qué rubro va?",
                description: "El sistema propone agruparlo en su rubro de catálogo. Hacé click para confirmarlo — después se puede mover a otro rubro cuando quieras.",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: enFilaNueva('[data-tour="cantidad-item"]'),
              onHighlighted: avanzarAlCambiarEn(enFilaNueva('[data-tour="cantidad-item"]')),
              popover: {
                title: "Cargar la cantidad",
                description: "Escribí un número y apretá Enter. El costo y el precio de ese ítem se recalculan solos.",
                side: "left",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: enFilaNueva('[data-tour="boton-computo"]'),
              onHighlighted: avanzarAlClickEn(enFilaNueva('[data-tour="boton-computo"]')),
              popover: {
                title: "La calculadora de cómputos",
                description: 'Si la cantidad sale de medir distintos sectores (frente, patio, cisterna), hacé click en "cómputo": sumás cada medida por separado y el total se carga solo.',
                side: "left",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="panel-computo"]',
              popover: {
                title: "Un total por cada sector",
                description: "Cada fila es una medición — alto, ancho, largo, lo que corresponda según la unidad — y el sistema las suma todas. Cerramos este panel y seguimos.",
                side: "left",
                onNextClick: (el, step, { driver }) => {
                  document.querySelector('[data-tour="cerrar-computo"]')?.click();
                  driver.moveNext();
                },
              },
            },
            {
              popover: {
                title: "¿De dónde salen los precios?",
                description: "Los materiales tienen precios de referencia que se actualizan solos, y la mano de obra toma como referencia los valores de UOCRA. Si trabajás con tus propios proveedores o costos, podés cargar tus propios valores y esos pisan a los de referencia.",
              },
            },
            {
              element: enFilaNueva('[data-tour="nombre-item"]'),
              onHighlighted: avanzarAlClickEn(enFilaNueva('[data-tour="nombre-item"]')),
              popover: {
                title: "El análisis de costos de un ítem",
                description: "Hacé click en el nombre del ítem para ver exactamente de qué está hecho: qué materiales lleva, cuánta mano de obra y qué equipo.",
                side: "right",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="analisis-totales"]',
              popover: {
                title: "Material, mano de obra y equipo",
                description: "Estos tres números, sumados, dan el costo del ítem. Más abajo está el detalle línea por línea.",
                side: "left",
              },
            },
            {
              element: '[data-tour="analisis-secciones"]',
              popover: {
                title: "Editable línea por línea",
                description: "Podés agregar, sacar o cambiar cualquier material, hora de mano de obra o uso de equipo — el costo del ítem (y el del presupuesto entero) se actualiza al toque.",
                side: "left",
              },
            },
            {
              // Toda la barra, no solo el Total: así se ven los siete
              // números a la vez, no uno aislado del resto.
              element: '.totales-bar',
              popover: {
                title: "El resumen de todo el presupuesto",
                description: "Material, mano de obra, costo de ejecución, precio sin IVA, el IVA, el total con IVA y el margen — los siete, a la vista y recalculados solos con cada ítem que agregás.",
                side: "top",
              },
            },
            {
              element: '[data-tour="boton-cerrar"]',
              onHighlighted: avanzarAlClickEn('[data-tour="boton-cerrar"]'),
              popover: {
                title: "Cerrar el presupuesto",
                description: 'Al cerrarlo, los precios quedan congelados y se habilitan la planificación y la certificación de la obra. Hacé click en "Cerrar".',
                side: "bottom",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="cerrar-metodologia"]',
              onHighlighted: avanzarAlClickEn('[data-tour="cerrar-metodologia"]'),
              popover: {
                title: "¿Cómo se va a cobrar esta obra?",
                description: '"Por avance de obra" es la forma más común: se mide el avance y se emiten certificados. Esto se puede cambiar más adelante desde la gestión de obra.',
                showButtons: ["previous", "close"],
              },
            },
            {
              popover: {
                title: "Presupuesto cerrado",
                description: "A partir de ahora están disponibles la planificación de la obra, la curva de inversión, el listado de materiales y la certificación. Vamos a recorrerlas.",
                doneBtnText: "Ver la planificación",
                onDoneClick: () => navigate(rutaGantt),
              },
            },
          ],
          gantt: [
            {
              element: '[data-tour="generar-gantt"]',
              onHighlighted: avanzarAlClickEn('[data-tour="generar-gantt"]'),
              popover: {
                title: "Generar el cronograma",
                description: 'Hacé click en "Generar": arma las tareas y las fechas automáticamente, a partir de los ítems del presupuesto.',
                side: "bottom",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="gantt-barras"]',
              popover: {
                title: "Cada barra es una tarea",
                description: "Su duración no es un número inventado: sale de la cantidad de ese ítem en el presupuesto y del rendimiento de la cuadrilla que lo hace — por eso un ítem con más cantidad tarda más días. Se pueden arrastrar para ajustar a mano, y encadenar una con otra para armar dependencias.",
                side: "right",
              },
            },
            {
              element: '[data-tour="gantt-horas"]',
              onHighlighted: avanzarAlClickEn('[data-tour="gantt-horas"]', 800),
              popover: {
                title: "Traé las horas de mano de obra",
                description: 'Sin esto el plazo queda fijo. Hacé click en "Horas": trae la mano de obra del análisis de costos de cada ítem, para que sumar o sacar gente de la cuadrilla sí mueva las fechas.',
                side: "bottom",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="tarea-detalle"]',
              onHighlighted: avanzarAlClickEn('[data-tour="tarea-detalle"]'),
              popover: {
                title: "El detalle de una tarea",
                description: "Hacé click sobre esta tarea para ver sus fechas, quién la hace y cuánto se avanzó.",
                side: "right",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="cuadrilla"]',
              popover: {
                title: "Cuántos trabajan",
                description: 'Sumá o sacá gente con los botones — como ya trajiste las horas, el plazo de esta tarea se acorta o se alarga solo, al toque.',
                onNextClick: (el, step, { driver }) => {
                  document.querySelector('[data-tour="cerrar-tarea-detalle"]')?.click();
                  driver.moveNext();
                },
              },
            },
            {
              element: '[data-tour="gantt-herramientas"]',
              popover: {
                title: "Más herramientas de planificación",
                description: '"Vincular" encadena una tarea con otra para que una dependa de la anterior, "Días perdidos" carga lluvia o feriados, y "Obra real" compara lo planificado contra lo que pasó de verdad.',
                side: "bottom",
              },
            },
            {
              element: '[data-tour="gantt-config"]',
              popover: {
                title: "Los parámetros del cálculo",
                description: "Desde cuándo arranca la obra, cuántas horas se trabaja por día y si se trabaja sábados o domingos — estos tres valores son los que alimentan el cálculo de todas las fechas de arriba.",
                side: "bottom",
                doneBtnText: "Ver la curva de inversión",
                onDoneClick: () => navigate(rutaCurva),
              },
            },
          ],
          curva: [
            {
              element: '[data-tour="curva-resumen"]',
              popover: {
                title: "La curva de inversión",
                description: "El total de la obra, repartido mes a mes según cuándo transcurre cada tarea del cronograma — así sabés cuánto vas a necesitar en cada etapa, no solo el total.",
                side: "right",
              },
            },
            {
              popover: {
                title: "Barra por barra",
                description: "Cada barra morada es lo que se desembolsa ese período; la línea es el acumulado. El total de cada ítem del presupuesto se reparte en los días que dura su tarea en el Gantt.",
              },
            },
            {
              element: '[data-tour="curva-periodicidad"]',
              popover: {
                title: "Semanal, quincenal o mensual",
                description: "El mismo cálculo, agrupado distinto — elegí la periodicidad que más te sirva para pedirle plata al cliente o planear tu caja.",
                side: "bottom",
              },
            },
            {
              element: '[data-tour="curva-tabla"]',
              popover: {
                title: "El detalle, período por período",
                description: "Cuánto se desembolsa en cada período, el acumulado, el % de avance de la obra a esa altura y una barra de distribución — todo lo que necesitás para una reunión de obra.",
                side: "top",
                doneBtnText: "Ver el listado de materiales",
                onDoneClick: () => navigate(rutaMateriales),
              },
            },
          ],
          materiales: [
            {
              element: '[data-tour="materiales-resumen"]',
              popover: {
                title: "El listado de materiales",
                description: "Es la suma de todos los materiales de todos los ítems del presupuesto, agrupados por rubro y con sus cantidades — listo para pedirle cotizaciones a los proveedores.",
                side: "bottom",
              },
            },
            {
              element: '[data-tour="rubro-materiales-header"]',
              onHighlighted: avanzarAlClickEn('[data-tour="rubro-materiales-header"]'),
              popover: {
                title: "Cada rubro se puede abrir",
                description: "Hacé click para ver el detalle completo de ese rubro: material por material.",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="materiales-tabla"]',
              popover: {
                title: "Todo lo que necesitás para comprar",
                description: "Código, cantidad ya con el desperdicio sumado, unidad, precio unitario, subtotal, la presentación comercial (bolsa, barra, rollo) y en qué ítems del presupuesto se usa cada material.",
                side: "top",
              },
            },
            {
              popover: {
                title: "Con o sin precios",
                description: '"Copiar todo" te lo pasa al portapapeles, y "Con precios" o "Pedido/Cotizar" lo imprimen en formatos distintos — uno para vos, otro para mandarle al proveedor.',
                doneBtnText: "Ver un certificado",
                onDoneClick: () => navigate(rutaCertificado),
              },
            },
          ],
          certificado: [
            {
              element: '[data-tour="nuevo-certificado"]',
              onHighlighted: avanzarAlClickEn('[data-tour="nuevo-certificado"]'),
              popover: {
                title: "Certificar el avance de obra",
                description: 'Cada cierto tiempo se certifica cuánto se avanzó, y eso define cuánto corresponde cobrarle al cliente. Hacé click en "Nuevo certificado" para ver cómo se arma uno.',
                side: "bottom",
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="pct-avance-item"]',
              onHighlighted: avanzarAlCambiarEn('[data-tour="pct-avance-item"]'),
              popover: {
                title: "Cargá cuánto avanzó",
                description: 'Escribí cuánto se avanzó este ítem en este período — por ejemplo 30 — y apretá Enter para confirmarlo. El acumulado se suma solo.',
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="emitir-certificado"]',
              // "Emitir" crea el certificado (fetch) y recién al resolver
              // cierra el modal (.modal-overlay, z-index 1000). Si el tour
              // avanza antes de eso, el overlay oscuro del paso siguiente
              // (z-index 10000) se dibuja ARRIBA del modal todavía abierto
              // y lo deja completamente intratable hasta que cierre solo.
              onHighlighted: avanzarAlClickEn('[data-tour="emitir-certificado"]', 700),
              popover: {
                title: "Un certificado por ítem",
                description: 'El resto de los ítems quedan en 0% si no les cargaste nada — está bien para la demo. Hacé click en "Emitir certificado" para ver el resultado.',
                showButtons: ["previous", "close"],
              },
            },
            {
              element: '[data-tour="certificado-titulo"]',
              popover: {
                title: "Así quedan los entregables de la obra",
                description: "Presupuesto, planificación, curva de inversión, materiales y certificados — todo en un solo lugar, conectado. Vamos a verlo junto.",
                side: "right",
                doneBtnText: "Ver el resumen",
                onDoneClick: () => navigate(`/cotizador/presupuesto/${presuId}/resumen-demo`),
              },
            },
          ],
        };

        tourDriver = driver({ ...baseConfig, steps: segmentos[segmento] });
        driverActivoRef.current = tourDriver;
        tourDriver.drive();
      };

      arrancarRef.current = arrancarTour;
      if (segmentoActivo.current !== segmento) {
        segmentoActivo.current = segmento;
        arrancarTour();
      }
    })();
  }, [location.pathname, navigate]);

  if (!mostrarBoton) return null;
  return (
    <button
      onClick={() => arrancarRef.current?.()}
      title="Retomar la guía"
      style={{
        position: "fixed", left: 18, bottom: 18, zIndex: 999999,
        display: "flex", alignItems: "center", gap: 7,
        background: "#059669", color: "#fff", border: "none", borderRadius: 24,
        padding: "10px 16px", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 13,
        cursor: "pointer", boxShadow: "0 6px 18px rgba(5,150,105,0.35)",
      }}
    >
      <HelpCircle size={16} strokeWidth={2.25} /> Retomar la guía
    </button>
  );
}
