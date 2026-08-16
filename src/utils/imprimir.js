// Imprimir sin salirse del sistema.
//
// Todas las impresiones abrían una pestaña nueva con `window.open` y escribían
// el documento ahí. En una computadora se nota poco, pero en iPhone Safari
// bloquea la pestaña nueva y reemplaza la que está abierta: se abre el diálogo
// de impresión, y al volver el estudio se encontraba fuera de la aplicación y
// tenía que entrar de nuevo.
//
// Con un iframe escondido el documento se imprime desde la misma página. El
// usuario cierra el diálogo y sigue exactamente donde estaba.

export function imprimirHTML(html, { titulo = '', esperar = 400 } = {}) {
  if (typeof document === 'undefined') return;

  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.setAttribute('title', titulo || 'Impresión');
  // Fuera de la vista pero con tamaño real: un iframe de 0x0 imprime en blanco
  // en varios navegadores.
  marco.style.cssText =
    'position:fixed;left:-10000px;top:0;width:1024px;height:1400px;border:0;visibility:hidden;';
  document.body.appendChild(marco);

  const limpiar = () => {
    if (marco.parentNode) marco.parentNode.removeChild(marco);
  };

  let lanzado = false;
  const lanzar = () => {
    if (lanzado) return;
    lanzado = true;
    try {
      const w = marco.contentWindow;
      w.focus();
      // Safari en iOS necesita que el foco esté en el iframe antes de imprimir.
      w.print();
    } catch (e) {
      // Si el iframe falla por lo que sea, no dejamos al usuario sin imprimir:
      // se cae a la pestaña nueva de siempre.
      try {
        const otra = window.open('', '_blank');
        if (otra) {
          otra.document.write(html);
          otra.document.close();
          otra.focus();
          otra.print();
        }
      } catch (e2) { /* nada más que hacer */ }
    }
    // El diálogo es modal y bloquea el hilo; igual damos margen antes de sacar
    // el iframe, porque en iOS la impresión es asincrónica.
    setTimeout(limpiar, 60000);
  };

  const doc = marco.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  // Se espera a que carguen fuentes e imágenes: sin esto salen hojas a medio
  // dibujar.
  if (doc.readyState === 'complete') {
    setTimeout(lanzar, esperar);
  } else {
    marco.onload = () => setTimeout(lanzar, esperar);
    // Red de seguridad por si onload no dispara con documentos escritos a mano.
    setTimeout(lanzar, esperar + 1200);
  }
}
