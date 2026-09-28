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

// El papel en el que se imprime cualquier contrato, acta o pagaré: mismo
// encabezado con el logo y el CUIT del tenant, mismas secciones subrayadas en
// verde, mismo bloque de firmas al pie. Antes cada documento repetía este CSS
// entero; con nueve modelos legales distintos eso significaba mantener nueve
// copias del mismo estilo desincronizándose de a poco.
export function plantillaDocumentoLegal({ titulo, subtitulo, tenant = {}, secciones = [], firmantes = [], notaFinal }) {
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${titulo}</title>
<style>
  body { font-family: 'Georgia', serif; color: #1a1a2e; padding: 48px; font-size: 13px; line-height: 1.8; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; letter-spacing: 1px; }
  .subtitle { text-align: center; color: #6b7280; font-size: 12px; margin-bottom: 36px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #059669; }
  .logo { font-size: 18px; font-weight: 900; color: #059669; }
  .section { margin-bottom: 20px; }
  .section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #059669; margin-bottom: 8px; border-bottom: 1px solid #e0e0e8; padding-bottom: 4px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .field { margin-bottom: 8px; }
  .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; }
  .value { font-size: 13px; font-weight: 600; }
  .firma { margin-top: 80px; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 24px; }
  .firma-box { text-align: center; width: 220px; }
  .firma-line { border-top: 1px solid #1a1a2e; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; padding: 6px 8px; text-align: left; border-bottom: 1px solid #e0e0e8; }
  td { padding: 6px 8px; font-size: 12px; border-bottom: 1px solid #f1f3f5; }
  @media print { body { padding: 24px; } }
</style></head><body>
<div class="header">
  <div><div class="logo">${tenant.nombre || '—'}</div><div style="font-size:11px;color:#6b7280;margin-top:4px">${tenant.cuit ? `CUIT: ${tenant.cuit}` : ''}</div></div>
  <div style="text-align:right;font-size:11px;color:#6b7280">${hoy}</div>
</div>
<h1>${titulo}</h1>
${subtitulo ? `<div class="subtitle">${subtitulo}</div>` : ''}
${secciones.map(s => `<div class="section">${s.heading ? `<h3>${s.heading}</h3>` : ''}${s.html}</div>`).join('\n')}
${firmantes.length ? `<div class="firma">${firmantes.map(f => `<div class="firma-box"><div class="firma-line"></div><div>${f.nombre || '—'}</div><div style="font-size:11px;color:#6b7280">${f.rol || 'Firma y aclaración'}</div></div>`).join('')}</div>` : ''}
${notaFinal ? `<div style="text-align:center;margin-top:60px;font-size:10px;color:#9ca3af">${notaFinal}</div>` : ''}
</body></html>`;
}
