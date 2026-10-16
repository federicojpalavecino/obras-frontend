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
  const desbloqueoMobilRef = useRef(null); // MutationObserver que neutraliza el bloqueo de interacción de driver.js en el celular (ver más abajo)
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
      desbloqueoMobilRef.current?.disconnect();
      setMostrarBoton(false);
      if (location.pathname !== rutaPresu) navigate(rutaPresu, { replace: true });
      return;
    }
    if (segmento === "resumen") {
      driverActivoRef.current?.destroy();
      desbloqueoMobilRef.current?.disconnect();
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
        desbloqueoMobilRef.current?.disconnect();
        desbloqueoMobilRef.current = null;
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

        // Algunos botones (Cerrar, Generar, Horas, Nuevo certificado) solo
        // existen en la barra de escritorio: en el celular esa barra tiene
        // display:none y la acción real está adentro del menú "⋯"
        // (MobileMenu), que ni siquiera renderiza sus botones hasta que se
        // abre. Esta función devuelve, en orden: el botón de escritorio si
        // está visible, el de mobile si el menú ya está abierto, o el
        // trigger "⋯" como último recurso — para que el tour señale "abrí
        // el menú" en vez de quedarse esperando un elemento que no existe.
        const enMobilOEscritorio = (selDesktop, selMovil, selTrigger) => () => {
          const d = document.querySelector(selDesktop);
          if (d && d.offsetParent !== null) return d;
          const m = document.querySelector(selMovil);
          if (m && m.offsetParent !== null) return m;
          return document.querySelector(selTrigger);
        };
        // Misma lógica pero SIN el trigger de último recurso: para detectar
        // el click real hay que distinguir "tocó el ⋯" (no cuenta) de "tocó
        // la acción de adentro" (sí cuenta).
        const accionMobilOEscritorio = (selDesktop, selMovil) => () => {
          const d = document.querySelector(selDesktop);
          if (d && d.offsetParent !== null) return d;
          const m = document.querySelector(selMovil);
          if (m && m.offsetParent !== null) return m;
          return null;
        };

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
          // "Generar" el cronograma es la operación más pesada de todo el
          // tour (arma TODAS las tareas de la obra de una). Con 1500ms, en
          // una conexión lenta o un Railway recién despertando, el paso
          // informativo siguiente ("Cada barra es una tarea") se llega a
          // saltear solo porque el elemento todavía no existía — no por
          // haberse saltado la acción, que es el caso real que esto cubre.
          waitForElement: 4000,
          // Si el elemento de un paso no aparece (por ejemplo, porque la
          // persona se salteó el paso anterior sin hacer la acción), el
          // tour no se queda esperando para siempre: pasa solo al siguiente.
          skipMissingElement: true,
          onCloseClick: () => { tourDriver.destroy(); },
        };

        // Varios pasos necesitan saber si están en el breakpoint mobile
        // (mismo que usa el CSS, 900px) para elegir de qué lado poner el
        // cartel: en desktop hay una columna lateral angosta con lugar de
        // sobra a los costados, pero en mobile ese mismo panel pasa a ser
        // una hoja que ocupa casi todo el ancho — un cartel "left"/"right"
        // ahí no tiene dónde ir y termina tapando la lista o la tabla de
        // adentro, bloqueando el scroll y los clicks.
        const esMobil = window.matchMedia("(max-width: 900px)").matches;

        const segmentos = {
          presupuesto: [
            {
              popover: {
                title: "Bienvenido a FAIM Obras",
                description: "Armamos una obra de ejemplo para mostrarte, en vivo, cómo se arma un presupuesto completo: desde el primer ítem hasta la planificación y los certificados.",
              },
            },
            {
              // Solo existe (visible) en el celular: el panel de agregar
              // ítems ahí es un drawer que arranca cerrado, con este botón
              // aparte para abrirlo. En desktop el botón sigue en el DOM
              // pero con display:none inline — y skipMissingElement de
              // driver.js solo mira si el selector devuelve un nodo, no si
              // está visible, así que un selector de texto plano NO alcanza
              // para saltarlo ahí (se vio en producción: el tour se quedaba
              // esperando un click imposible en desktop). Por eso el
              // elemento es una función que devuelve null si no está
              // realmente visible.
              element: () => {
                const el = document.querySelector('[data-tour="agregar-item-trigger-mobile"]');
                return el && el.offsetParent !== null ? el : null;
              },
              onHighlighted: avanzarAlClickEn('[data-tour="agregar-item-trigger-mobile"]'),
              popover: {
                title: "Agregar un ítem al presupuesto",
                description: 'Tocá "+ Agregar ítem" para abrir el buscador del catálogo.',
                side: "bottom",
                showButtons: ["previous", "close"],
              },
            },
            {
              // El resaltado (y el agujero que deja clickear/scrollear a
              // través del overlay oscuro) tiene que ser el PANEL ENTERO
              // en los dos casos — buscador y lista — porque el agujero de
              // driver.js solo cubre el elemento resaltado: si antes se
              // apuntaba solo al buscador para que el cartel no tapara la
              // lista, el agujero también quedaba chico y los clicks sobre
              // los resultados caían afuera (bloqueados por el overlay) —
              // eso fue lo que se reportó en producción ("deja buscar pero
              // no deja clickear"). El panel entero resuelve eso.
              element: '[data-tour="agregar-item-panel"]',
              onHighlighted: () => { capturarFilasExistentes(); avanzarAlClickEn('[data-tour="lista-items"]')(); },
              popover: {
                title: "Agregar un ítem al presupuesto",
                description: esMobil
                  ? 'Buscá y tocá un ítem de la lista para agregarlo.'
                  : 'Buscá, por ejemplo, "contrapiso" o "revoque interior", o elegí cualquier ítem de la lista. Hacé click sobre uno para agregarlo.',
                side: esMobil ? "bottom" : "right",
                showButtons: ["previous", "close"],
                // En mobile el panel ocupa toda la pantalla: no hay dónde
                // poner el cartel sin tapar algo de la lista, sea cual sea
                // el lado. En vez de perseguir una posición exacta (que no
                // se pudo verificar bien ni en desktop simulando mobile por
                // CSS — el propio overlay de driver.js queda desalineado),
                // "demo-tour-passthrough" (ver DemoTour.css) deja que los
                // clicks lo atraviesen: tape lo que tape el cartel, el tap
                // llega igual a la fila real de abajo. Solo sus botones
                // (Atrás/cerrar) seguimos pudiendo tocarlos.
                popoverClass: esMobil ? "demo-tour-passthrough" : undefined,
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
                // En mobile este panel es una hoja que sube desde abajo
                // (hasta 82dvh): "left" no tiene dónde ir y tapa las filas.
                // Arriba del todo queda libre, por eso "top" ahí.
                side: esMobil ? "top" : "left",
                popoverClass: esMobil ? "demo-tour-passthrough" : undefined,
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
                // Mismo panel-lateral que "panel-computo": en mobile es
                // una hoja casi de ancho completo, "left" tapa el contenido.
                side: esMobil ? "top" : "left",
                popoverClass: esMobil ? "demo-tour-passthrough" : undefined,
              },
            },
            {
              element: '[data-tour="analisis-secciones"]',
              popover: {
                title: "Editable línea por línea",
                description: "Podés agregar, sacar o cambiar cualquier material, hora de mano de obra o uso de equipo — el costo del ítem (y el del presupuesto entero) se actualiza al toque.",
                side: esMobil ? "top" : "left",
                popoverClass: esMobil ? "demo-tour-passthrough" : undefined,
                // El análisis de costos (igual que el panel de cómputo) se
                // queda abierto hasta que lo cerrás a mano — bien para el
                // uso normal, pero acá el tour sigue de largo hacia otros
                // paneles (el resumen, después "Cerrar el presupuesto" con
                // su propio menú en el celular) y dejarlo abierto de fondo
                // apila paneles encima de paneles: en mobile cada uno ocupa
                // casi toda la pantalla, así que el de más arriba termina
                // tapando el contenido real que el paso siguiente pide
                // tocar. Se cierra solo al avanzar, como ya se hace con el
                // panel de cómputo.
                onNextClick: (el, step, { driver }) => {
                  document.querySelector('[data-tour="cerrar-analisis"]')?.click();
                  driver.moveNext();
                },
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
              element: enMobilOEscritorio('[data-tour="boton-cerrar"]', '[data-tour="boton-cerrar-mobile"]', '[data-tour="presupuesto-menu-mobile"]'),
              onHighlighted: avanzarAlClickEn(accionMobilOEscritorio('[data-tour="boton-cerrar"]', '[data-tour="boton-cerrar-mobile"]')),
              popover: {
                title: "Cerrar el presupuesto",
                description: 'Al cerrarlo, los precios quedan congelados y se habilitan la planificación y la certificación de la obra. Hacé click en "Cerrar" (en el celular, abrí el menú "⋯" y elegí "Cerrar presupuesto").',
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
              element: enMobilOEscritorio('[data-tour="generar-gantt"]', '[data-tour="generar-gantt-mobile"]', '[data-tour="gantt-menu-mobile"]'),
              onHighlighted: avanzarAlClickEn(accionMobilOEscritorio('[data-tour="generar-gantt"]', '[data-tour="generar-gantt-mobile"]')),
              popover: {
                title: "Generar el cronograma",
                description: 'Hacé click en "Generar" (en el celular, en el menú "⋯"): arma las tareas y las fechas automáticamente, a partir de los ítems del presupuesto.',
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
              element: enMobilOEscritorio('[data-tour="gantt-horas"]', '[data-tour="gantt-horas-mobile"]', '[data-tour="gantt-menu-mobile"]'),
              onHighlighted: avanzarAlClickEn(accionMobilOEscritorio('[data-tour="gantt-horas"]', '[data-tour="gantt-horas-mobile"]'), 800),
              popover: {
                title: "Traé las horas de mano de obra",
                description: 'Sin esto el plazo queda fijo. Hacé click en "Horas" (en el celular, en el menú "⋯"): trae la mano de obra del análisis de costos de cada ítem, para que sumar o sacar gente de la cuadrilla sí mueva las fechas.',
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
              // Antes era un paso informativo ("leé y apretá Siguiente"). El
              // momento más convincente de todo el sistema —sumar gente y ver
              // la fecha moverse sola— se explicaba en vez de vivirse. Ahora
              // hay que apretar el "+" de verdad para avanzar.
              element: '[data-tour="cuadrilla-mas"]',
              onHighlighted: () => {
                const indice = tourDriver.getActiveIndex();
                const handler = (e) => {
                  if (tourDriver.getActiveIndex() !== indice) {
                    document.removeEventListener("click", handler, true);
                    return;
                  }
                  const el = resolver('[data-tour="cuadrilla-mas"]');
                  if (el && (el === e.target || el.contains(e.target))) {
                    document.removeEventListener("click", handler, true);
                    // Una pausa antes de cerrar el modal: que la fecha nueva
                    // se alcance a ver un momento, que es todo el punto.
                    setTimeout(() => {
                      document.querySelector('[data-tour="cerrar-tarea-detalle"]')?.click();
                      tourDriver.moveNext();
                    }, 900);
                  }
                };
                document.addEventListener("click", handler, true);
              },
              popover: {
                title: "Mirá la fecha moverse",
                description: 'Apretá "+" para sumar una persona a la cuadrilla — mirá arriba: el plazo de esta tarea se acorta solo, al toque.',
                showButtons: ["previous", "close"],
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
              element: enMobilOEscritorio('[data-tour="nuevo-certificado"]', '[data-tour="nuevo-certificado-mobile"]', '[data-tour="certificado-menu-mobile"]'),
              onHighlighted: avanzarAlClickEn(accionMobilOEscritorio('[data-tour="nuevo-certificado"]', '[data-tour="nuevo-certificado-mobile"]')),
              popover: {
                title: "Certificar el avance de obra",
                description: 'Cada cierto tiempo se certifica cuánto se avanzó, y eso define cuánto corresponde cobrarle al cliente. Hacé click en "Nuevo certificado" (en el celular, en el menú "⋯") para ver cómo se arma uno.',
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

        // driver.js (la librería, no este código) le pone a <body> la
        // clase "driver-active" mientras el tour corre, y su propio CSS
        // (driver.css) apaga pointer-events en TODA la página con esa
        // clase puesta — solo lo reactiva para el elemento resaltado
        // puntual y el cartel. En desktop nunca se nota (ahí no hace
        // falta tocar nada fuera de lo resaltado), pero en el celular eso
        // bloqueaba el scroll y el toque sobre la lista real, reportado
        // en producción. Pelear esto con especificidad de CSS (intentado
        // antes) no se pudo verificar bien sin un celular real a mano, así
        // que se resuelve con JS directo, sin ambigüedad de cascada: un
        // observer que, apenas <body> gana esa clase, se la saca de nuevo
        // — y de paso apaga a mano el pointer-events inline (puesto por
        // driver.js, no por CSS, así que una regla de hoja de estilos no
        // alcanza para pisarlo) del `<path>` del fondo oscuro. El cartel
        // sigue andando igual: su propia regla de interacción no depende
        // de esta clase.
        if (esMobil) {
          const desbloquear = () => {
            if (document.body.classList.contains("driver-active")) {
              document.body.classList.remove("driver-active");
            }
            // El <svg> en sí (no solo el <path> de adentro) también hay
            // que apagarlo: confirmado a mano que un <svg> de pantalla
            // completa sigue recibiendo el click aunque su <path> interno
            // ya esté en "none" — el contenedor cuenta como "pintado" para
            // el hit-test por su cuenta. La opacidad va junto con los
            // clicks (ver DemoTour.css): el menú "⋯" se abre por fuera
            // del agujero recortado, así que sin esto queda tapado por
            // el fondo oscuro aunque ya se pueda tocar.
            document.querySelectorAll(".driver-overlay, .driver-overlay path").forEach(p => {
              p.style.setProperty("pointer-events", "none");
              p.style.setProperty("opacity", "0");
            });
          };
          desbloquear();
          const observer = new MutationObserver(desbloquear);
          observer.observe(document.body, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
          desbloqueoMobilRef.current = observer;
        }
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
