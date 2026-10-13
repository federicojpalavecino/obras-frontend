// Tour guiado del demo público (ver App.js: ruta /demo y botón "Probar demo
// guiada"). Entra directo al presupuesto de ejemplo y recorre, a mano, armar
// un presupuesto de punta a punta: agregar un ítem, cargar su cantidad, ver
// el análisis de costos, el total, cerrar el presupuesto, planificar la obra
// (Gantt), ver la curva de inversión y el listado de materiales — y termina
// invitando a registrarse con la promo vigente.
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function DemoTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const segmentoActivo = useRef(null);

  useEffect(() => {
    if (sessionStorage.getItem("obras_tour_demo") !== "1") return;
    const presuId = sessionStorage.getItem("obras_tour_presupuesto_id");
    if (!presuId) return;

    const rutaPresu = `/cotizador/presupuesto/${presuId}`;
    const rutaGantt = `/cotizador/gantt/${presuId}`;
    const rutaCurva = `/cotizador/presupuesto/${presuId}/curva`;
    const rutaMateriales = `/cotizador/presupuesto/${presuId}/materiales`;

    const segmentoDeRuta = (path) => {
      if (path === rutaPresu) return "presupuesto";
      if (path === rutaGantt) return "gantt";
      if (path === rutaCurva) return "curva";
      if (path === rutaMateriales) return "materiales";
      return null;
    };

    const segmento = segmentoDeRuta(location.pathname);
    if (!segmento) {
      if (location.pathname !== rutaPresu) navigate(rutaPresu, { replace: true });
      return;
    }
    if (segmentoActivo.current === segmento) return;
    segmentoActivo.current = segmento;

    (async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
        import("./DemoTour.css"),
      ]);

      const terminarTour = () => {
        sessionStorage.removeItem("obras_tour_demo");
        sessionStorage.removeItem("obras_tour_presupuesto_id");
      };
      const irARegistro = () => {
        terminarTour();
        // Sale de la sesión demo para que "/" muestre el login/registro, no
        // el dashboard del tenant demo (el token todavía estaría guardado).
        localStorage.removeItem("obras_token");
        localStorage.removeItem("obras_session");
        window.location.href = "/?registro=1";
      };

      let tourDriver; // los hooks de abajo lo referencian por closure

      // Avanza el tour solo cuando se hace la acción real (click o blur en el
      // selector indicado), en vez de depender de un botón "Siguiente" — así
      // el tour se siente parte del uso real del sistema, no un slideshow.
      const avanzarAlClickEn = (selector, demora = 80) => () => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.addEventListener("click", () => setTimeout(() => tourDriver.moveNext(), demora), { once: true });
      };
      const avanzarAlCambiarEn = (selector, demora = 80) => () => {
        const el = document.querySelector(selector);
        if (!el) return;
        el.addEventListener("blur", () => setTimeout(() => tourDriver.moveNext(), demora), { once: true });
        // El overlay del tour bloquea el click afuera del input (es lo único
        // clickeable mientras está resaltado), así que Enter es la forma real
        // de confirmar acá: dispara el blur de verdad (guarda el valor).
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
        // Un click afuera del elemento resaltado no cierra el tour de golpe:
        // solo se avanza con la acción real o el botón.
        overlayClickBehavior: "none",
        // driver.js usa Enter para su propio botón "Siguiente" — eso se come
        // el Enter que el paso de cantidad necesita para confirmar el valor
        // (dispara el blur real, que es lo que guarda y avanza). Lo apagamos.
        allowKeyboardControl: false,
        waitForElement: 1500,
        onCloseClick: () => { terminarTour(); tourDriver.destroy(); },
      };

      const segmentos = {
        presupuesto: [
          {
            popover: {
              title: "¡Bienvenido a FAIM Obras!",
              description: "Te armamos una obra de ejemplo. Te mostramos cómo se arma un presupuesto de punta a punta, en vivo.",
            },
          },
          {
            element: '[data-tour="agregar-item-panel"]',
            onHighlighted: avanzarAlClickEn('[data-tour="lista-items"]'),
            popover: {
              title: "Agregá un ítem",
              description: 'Buscá algo como "mampostería" o elegí cualquiera de la lista, y hacé click para agregarlo al presupuesto.',
              side: "right",
            },
          },
          {
            element: '[data-tour="cantidad-item"]',
            onHighlighted: avanzarAlCambiarEn('[data-tour="cantidad-item"]'),
            popover: {
              title: "Cargá la cantidad",
              description: "Cambiá el número y apretá Enter: el costo y el precio se recalculan solos.",
              side: "left",
            },
          },
          {
            element: '[data-tour="nombre-item"]',
            onHighlighted: avanzarAlClickEn('[data-tour="nombre-item"]'),
            popover: {
              title: "Mirá el análisis de costos",
              description: "Hacé click en el nombre del ítem para ver el detalle: materiales, mano de obra y equipo.",
              side: "right",
            },
          },
          {
            element: '[data-tour="total-obra"]',
            popover: {
              title: "Se calcula todo solo",
              description: "El costo de ejecución y el precio al cliente se actualizan automáticamente con cada ítem que agregás.",
              side: "left",
            },
          },
          {
            element: '[data-tour="boton-cerrar"]',
            onHighlighted: avanzarAlClickEn('[data-tour="boton-cerrar"]'),
            popover: {
              title: "Cerrá el presupuesto",
              description: "Al cerrarlo, los precios quedan congelados y se habilita planificar y ejecutar la obra. Hacé click en \"Cerrar\".",
              side: "bottom",
            },
          },
          {
            element: '[data-tour="cerrar-metodologia"]',
            onHighlighted: avanzarAlClickEn('[data-tour="cerrar-metodologia"]'),
            popover: {
              title: "¿Cómo vas a cobrar?",
              description: 'Elegí "Por avance de obra" — es la más común. Después se puede cambiar desde la gestión de obra.',
            },
          },
          {
            popover: {
              title: "¡Presupuesto cerrado!",
              description: "Ahora se desbloquea la planificación de la obra, la curva de inversión y el listado de materiales. Vamos a verlas.",
              doneBtnText: "Ver planificación",
              onDoneClick: () => navigate(rutaGantt),
            },
          },
        ],
        gantt: [
          {
            popover: {
              title: "Así planificás la obra",
              description: "El Gantt: tareas, fechas y dependencias. Es la hoja de ruta de la obra, y de acá sale la curva de inversión.",
              doneBtnText: "Ver curva de inversión",
              onDoneClick: () => navigate(rutaCurva),
            },
          },
        ],
        curva: [
          {
            popover: {
              title: "La curva de inversión",
              description: "Cuánto vas a necesitar invertir mes a mes, calculado solo a partir del Gantt y el presupuesto.",
              doneBtnText: "Ver materiales",
              onDoneClick: () => navigate(rutaMateriales),
            },
          },
        ],
        materiales: [
          {
            popover: {
              title: "Listado de materiales",
              description: "Todo lo que hay que comprar, sumado automáticamente desde el presupuesto — ideal para pedir cotizaciones a proveedores.",
              doneBtnText: "Quiero registrarme",
              onDoneClick: irARegistro,
            },
          },
        ],
      };

      tourDriver = driver({ ...baseConfig, steps: segmentos[segmento] });
      tourDriver.drive();
    })();
  }, [location.pathname, navigate]);

  return null;
}
