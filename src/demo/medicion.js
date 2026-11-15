const API = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';
let sesionMemoria;
const enviados = new Set();

export function sesionDemo() {
  if (sesionMemoria) return sesionMemoria;
  try { sesionMemoria = sessionStorage.getItem('faim_demo_v2_sesion'); } catch { /* almacenamiento opcional */ }
  if (!/^[a-f0-9-]{36}$/.test(sesionMemoria || '')) {
    sesionMemoria = window.crypto.randomUUID();
    try { sessionStorage.setItem('faim_demo_v2_sesion', sesionMemoria); } catch { /* sigue funcionando */ }
  }
  return sesionMemoria;
}

export function medir(tipo, escenario) {
  if (enviados.has(tipo)) return;
  enviados.add(tipo);
  const sesion = sesionDemo();
  // Instancia independiente: nunca lleva el JWT ni usa los interceptores del estudio.
  const mandar = intento => fetch(`${API}/demo/eventos`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', keepalive: true,
    body: JSON.stringify({ tipo, sesion, escenario }),
  }).then(r => { if (!r.ok) throw new Error('medicion'); }).catch(() => {
    if (intento === 0) window.setTimeout(() => mandar(1), 2000);
    else enviados.delete(tipo);
  });
  mandar(0);
}

export function enlaceRegistro() {
  return `/?registro=1&origen=demo&demo_sesion=${encodeURIComponent(sesionDemo())}`;
}
