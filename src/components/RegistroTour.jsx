// Continuación del tour del demo (ver DemoTour.jsx y ResumenDemo.jsx): una
// vez que la persona decide registrarse, este componente guía los 5 campos
// del formulario de registro. No depende de react-router (la pantalla de
// login/registro se renderiza fuera del BrowserRouter), por eso es un
// componente aparte y más simple que DemoTour.
import { useEffect, useRef } from "react";

export default function RegistroTour() {
  const arrancado = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem("obras_tour_registro") !== "1") return;
    if (arrancado.current) return;
    arrancado.current = true;

    (async () => {
      const [{ driver }] = await Promise.all([
        import("driver.js"),
        import("driver.js/dist/driver.css"),
        import("./DemoTour.css"),
      ]);

      const terminar = () => sessionStorage.removeItem("obras_tour_registro");

      const tourDriver = driver({
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
        skipMissingElement: true,
        onCloseClick: () => { terminar(); tourDriver.destroy(); },
        onDestroyed: terminar,
        steps: [
          {
            element: '[data-tour="reg-estudio"]',
            popover: {
              title: "El nombre de tu estudio o empresa",
              description: "Así va a aparecer en los presupuestos y en todo lo que vean tus clientes.",
              side: "bottom",
            },
          },
          {
            element: '[data-tour="reg-nombre"]',
            popover: { title: "Tu nombre", description: "Con éste vas a iniciar sesión vos.", side: "bottom" },
          },
          {
            element: '[data-tour="reg-email"]',
            popover: { title: "Tu email", description: "Ahí te va a llegar la confirmación y cualquier aviso importante de la cuenta.", side: "bottom" },
          },
          {
            element: '[data-tour="reg-pass"]',
            popover: { title: "Una contraseña", description: "La que quieras, para entrar la próxima vez.", side: "bottom" },
          },
          {
            element: '[data-tour="reg-crear"]',
            popover: {
              title: "Y listo",
              description: 'Con "Crear cuenta y suscribirme" arrancás con tu propio estudio, ya configurado — y ya sabés cómo armar un presupuesto, un cronograma, la curva de inversión y los certificados.',
              doneBtnText: "Entendido",
              onDoneClick: terminar,
            },
          },
        ],
      });
      tourDriver.drive();
    })();
  }, []);

  return null;
}
