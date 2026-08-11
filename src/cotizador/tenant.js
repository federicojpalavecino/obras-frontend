// Datos del estudio (tenant) guardados al iniciar sesión.
// Se leen de obras_session primero y de obras_tenant como respaldo, que es el
// orden que ya usaban las pantallas para el nombre y el color.

function leerTenant() {
  try {
    const s = JSON.parse(localStorage.getItem('obras_session') || '{}');
    if (s?.tenant) return s.tenant;
  } catch (e) {}
  try {
    const t = JSON.parse(localStorage.getItem('obras_tenant') || 'null');
    if (t) return t;
  } catch (e) {}
  return null;
}

export function tenantNombre() {
  return leerTenant()?.nombre || 'FAIM OBRAS';
}

// Localidad que se imprime al pie de presupuestos y certificados ("Ciudad, fecha").
// Sale de Configuración de la cuenta: cada estudio pone la suya. Si todavía no
// la cargó, se devuelve vacío y quien imprime muestra solo la fecha.
export function tenantLocalidad() {
  const t = leerTenant();
  const ciudad = (t?.ciudad || '').trim();
  const provincia = (t?.provincia || '').trim();
  if (ciudad && provincia) return `${ciudad}, ${provincia}`;
  return ciudad || provincia || '';
}

// "Ciudad, Provincia, 10 de agosto de 2026" — o solo la fecha si no hay localidad.
export function localidadYFecha(fecha) {
  const loc = tenantLocalidad();
  return loc ? `${loc}, ${fecha}` : fecha;
}
