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
      setMostrarBoton(false);
      if (location.pathname !== rutaPresu) navigate(rutaPresu, { replace: true });
      return;
    }
    if (segmento === "resumen") {
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

        // La obra de ejemplo ya trae un par de ítems cargados (para que la
        // tabla y la barra de totales no arranquen vacías) — por eso varios
        // selectores tienen más de un match (uno por fila). El último es
        // siempre el que la persona acaba de agregar con sus propias manos,
        // que es al que se refiere el tour en estos pasos.
        const ultimo = (selector) => {
          const els = document.querySelectorAll(selector);
          return els[els.length - 1] || null;
        };

        // Avanza el tour solo cuando se hace la acción real (click o blur en
        // el selector indicado) — pero SOLO si todavía estamos en el paso
        // que armó este listener. Sin este chequeo, si la persona salta el
        // paso con "Siguiente" y más tarde clickea ese elemento por su
        // cuenta, el listener viejo seguía ahí y hacía saltar el tour para
        // adelante de golpe, en cualquier paso en el que estuviera parado.
        //
        // Se llama a moveNext() de forma SINCRÓNICA, no con un setTimeout:
        // este listener se agrega directo sobre el botón, así que corre
        // antes que el onClick de React (que está delegado más arriba, en
        // la raíz). Eso importa en los pasos donde el click hace que el
        // propio botón desaparezca del DOM (generar el Gantt, emitir un
        // certificado): si esperábamos aunque sea un instante, React ya
        // había sacado el botón y el tour se quedaba sin elemento activo y
        // se cerraba solo en vez de pasar al siguiente paso.
        const avanzarAlClickEn = (selector, soloUltimo = false) => () => {
          const el = soloUltimo ? ultimo(selector) : document.querySelector(selector);
          if (!el) return;
          const indice = tourDriver.getActiveIndex();
          el.addEventListener("click", () => {
            if (tourDriver.getActiveIndex() !== indice) return;
            tourDriver.moveNext();
          }, { once: true });
        };
        const avanzarAlCambiarEn = (selector, demora = 80) => () => {
          const el = ultimo(selector);
          if (!el) return;
          const indice = tourDriver.getActiveIndex();
          const avanzar = () => {
            if (tourDriver.getActiveIndex() !== indice) return;
            setTimeout(() => tourDriver.moveNext(), demora);
          };
          el.addEventListener("blur", avanzar, { once: true });
          // El overlay del tour solo deja clickear el elemento resaltado,
          // así que "hacer click afuera" para confirmar no es posible acá:
          // Enter dispara el blur de verdad (el que guarda el valor).
          el.addEventListener("keydown", (e) => { if (e.key === "Enter") el.blur(); }, { once: true });
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
              onHighlighted: avanzarAlClickEn('[data-tour="lista-items"]'),
              popover: {
                title: "Agregar un ítem al presupuesto",
                description: 'Buscá, por ejemplo, "mampostería", o elegí cualquier ítem de la lista. Hacé click sobre uno para agregarlo.',
                side: "right",
              },
            },
            {
              element: () => ultimo('[data-tour="cantidad-item"]'),
              onHighlighted: avanzarAlCambiarEn('[data-tour="cantidad-item"]'),
              popover: {
                title: "Cargar la cantidad",
                description: "Escribí un número y apretá Enter. El costo y el precio de ese ítem se recalculan solos.",
                side: "left",
              },
            },
            {
              element: () => ultimo('[data-tour="boton-computo"]'),
              onHighlighted: avanzarAlClickEn('[data-tour="boton-computo"]', true),
              popover: {
                title: "La calculadora de cómputos",
                description: 'Si la cantidad sale de medir distintos sectores (frente, patio, cisterna), hacé click en "cómputo": sumás cada medida por separado y el total se carga solo.',
                side: "left",
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
              element: () => ultimo('[data-tour="nombre-item"]'),
              onHighlighted: avanzarAlClickEn('[data-tour="nombre-item"]', true),
              popover: {
                title: "El análisis de costos de un ítem",
                description: "Hacé click en el nombre del ítem para ver exactamente de qué está hecho: qué materiales lleva, cuánta mano de obra y qué equipo.",
                side: "right",
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
              },
            },
            {
              element: '[data-tour="cerrar-metodologia"]',
              onHighlighted: avanzarAlClickEn('[data-tour="cerrar-metodologia"]'),
              popover: {
                title: "¿Cómo se va a cobrar esta obra?",
                description: '"Por avance de obra" es la forma más común: se mide el avance y se emiten certificados. Esto se puede cambiar más adelante desde la gestión de obra.',
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
              },
            },
            {
              popover: {
                title: "La obra, planificada",
                description: "Las tareas, las fechas y las dependencias salieron solas del presupuesto. Las barras se pueden arrastrar para ajustar fechas a mano. De acá sale, también, la curva de inversión.",
                doneBtnText: "Ver la curva de inversión",
                onDoneClick: () => navigate(rutaCurva),
              },
            },
          ],
          curva: [
            {
              popover: {
                title: "La curva de inversión",
                description: "Muestra cuánto dinero hace falta cada mes para sostener la obra, calculado automáticamente a partir del cronograma y el presupuesto.",
                doneBtnText: "Ver el listado de materiales",
                onDoneClick: () => navigate(rutaMateriales),
              },
            },
          ],
          materiales: [
            {
              popover: {
                title: "El listado de materiales",
                description: "Es la suma de todos los materiales del presupuesto, agrupados y con cantidades — listo para pedirle cotizaciones a los proveedores.",
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
              },
            },
            {
              element: '[data-tour="emitir-certificado"]',
              onHighlighted: avanzarAlClickEn('[data-tour="emitir-certificado"]'),
              popover: {
                title: "Un certificado por ítem",
                description: "Acá se carga el % de avance de cada ítem en este período; el sistema calcula el acumulado solo. Emitilo para ver el resultado.",
              },
            },
            {
              popover: {
                title: "Así quedan los entregables de la obra",
                description: "Presupuesto, planificación, curva de inversión, materiales y certificados — todo en un solo lugar, conectado. Vamos a verlo junto.",
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
