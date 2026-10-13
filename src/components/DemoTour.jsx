// Tour guiado del demo público (ver App.js: botón "Probar demo guiada").
// Entra directo al presupuesto de ejemplo y recorre agregar un ítem y ver el
// total calculado solo, terminando en un cartel invitando a registrarse.
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function DemoTour() {
  const navigate = useNavigate();
  const location = useLocation();
  const arrancado = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem("obras_tour_demo") !== "1") return;
    if (arrancado.current) return;

    const presuId = sessionStorage.getItem("obras_tour_presupuesto_id");
    const rutaPresu = presuId ? `/cotizador/presupuesto/${presuId}` : null;

    if (rutaPresu && location.pathname !== rutaPresu) {
      navigate(rutaPresu, { replace: true });
      return;
    }

    arrancado.current = true;
    (async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
      ]);
      const irARegistro = () => {
        sessionStorage.removeItem("obras_tour_demo");
        sessionStorage.removeItem("obras_tour_presupuesto_id");
        // Sale de la sesión demo para que "/" muestre el login/registro, no
        // el dashboard del tenant demo (el token todavía estaría guardado).
        localStorage.removeItem("obras_token");
        localStorage.removeItem("obras_session");
        window.location.href = "/?registro=1";
      };
      const tourDriver = driver({
        showProgress: true,
        nextBtnText: "Siguiente",
        prevBtnText: "Atrás",
        doneBtnText: "Listo",
        allowClose: true,
        overlayOpacity: 0.65,
        onCloseClick: () => {
          sessionStorage.removeItem("obras_tour_demo");
          sessionStorage.removeItem("obras_tour_presupuesto_id");
          tourDriver.destroy();
        },
        steps: [
          {
            popover: {
              title: "¡Bienvenido a FAIM Obras!",
              description: "Te armamos una obra de ejemplo. Te mostramos en 1 minuto cómo se arma un presupuesto.",
            },
          },
          {
            element: '[data-tour="buscar-item"]',
            popover: {
              title: "Agregá un ítem",
              description: 'Buscá algo como "mampostería" o "contrapiso" y hacé click en un resultado para agregarlo.',
              side: "right",
            },
          },
          {
            element: '[data-tour="total-obra"]',
            popover: {
              title: "Se calcula solo",
              description: "El costo y el precio al cliente se recalculan automáticamente con cada ítem que agregás, con materiales, mano de obra y equipo.",
              side: "left",
            },
          },
          {
            popover: {
              title: "¿Te copó?",
              description: "Arrancá con 3 meses a $35.000 pagando con débito automático de MercadoPago.",
              doneBtnText: "Quiero registrarme",
              onDoneClick: irARegistro,
            },
          },
        ],
      });
      tourDriver.drive();
    })();
  }, [location.pathname, navigate]);

  return null;
}
