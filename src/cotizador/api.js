import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 25000, // corta esperas eternas con conexión débil
});

// JWT token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('obras_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Manejo de sesión expirada — si el token venció, cerrar sesión y volver al login
let sesionExpiradaAvisada = false;
let suscripcionBloqueadaAvisada = false;
api.interceptors.response.use(
  (response) => {
    // Cualquier borrado que salga bien avisa, y el botón de Deshacer aparece
    // solo. Va acá y no en cada pantalla: son más de veinte lugares donde se
    // borra algo, y el que se agregue mañana queda cubierto sin acordarse.
    try {
      const m = (response.config?.method || '').toLowerCase();
      if (m === 'delete') {
        window.dispatchEvent(new CustomEvent('faim:borrado', {
          detail: { url: response.config?.url, data: response.data },
        }));
      }
    } catch (e) {}
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    // ── Reintentos con conexión débil ──
    // Reintenta GET (y otros idempotentes) ante error de red / timeout / 5xx.
    const cfg = error.config || {};
    const metodo = (cfg.method || 'get').toLowerCase();
    const sinRespuesta = !error.response || error.code === 'ECONNABORTED';
    const servidorCaido = status >= 500 && status < 600;
    const reintentable = ['get', 'head', 'options'].includes(metodo) && (sinRespuesta || servidorCaido);
    if (reintentable) {
      cfg.__retry = (cfg.__retry || 0) + 1;
      if (cfg.__retry <= 3) {
        await new Promise((r) => setTimeout(r, 700 * cfg.__retry)); // backoff: 0.7s, 1.4s, 2.1s
        return api(cfg);
      }
    }
    const detail = error.response?.data?.detail || '';
    const tokenMuerto = status === 401 || (status === 403 && /token/i.test(detail));
    if (tokenMuerto && localStorage.getItem('obras_token')) {
      if (!sesionExpiradaAvisada) {
        sesionExpiradaAvisada = true;
        localStorage.removeItem('obras_token');
        localStorage.removeItem('obras_tenant');
        localStorage.removeItem('obras_estudio');
        alert('Tu sesión expiró. Por favor, ingresá de nuevo.');
        window.location.href = '/';
      }
    }
    // Suscripción vencida / cuenta suspendida → recargar UNA vez para que App muestre el paywall.
    // El guard en sessionStorage evita un bucle de recargas si el restore vuelve a recibir 402.
    if (status === 402 && localStorage.getItem('obras_token')) {
      if (!suscripcionBloqueadaAvisada && !sessionStorage.getItem('susc_reload')) {
        suscripcionBloqueadaAvisada = true;
        sessionStorage.setItem('susc_reload', '1');
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

// PRESUPUESTOS
export const getMenu = (estado, clienteId) => {
  const params = {};
  if (estado) params.estado = estado;
  if (clienteId) params.cliente_id = clienteId;
  return api.get('/presupuestos', { params });
};
export const getPresupuesto = (id) => api.get(`/presupuestos/${id}`);
export const crearPresupuesto = (data) => api.post('/presupuestos', data);
export const actualizarPresupuesto = (id, data) => api.put(`/presupuestos/${id}`, data);
// Al cerrar se define como se va a gestionar la obra. Sin metodologia el
// backend la deja en certificacion, que es como se comporto siempre.
export const cerrarPresupuesto = (id, metodologia) =>
  api.post(`/presupuestos/${id}/cerrar`, metodologia ? { metodologia } : {});
export const reabrirPresupuesto = (id) => api.post(`/presupuestos/${id}/reabrir`);
export const duplicarPresupuesto = (id, nombre) => api.post(`/presupuestos/${id}/duplicar`, null, { params: { nuevo_nombre: nombre } });

// LÍNEAS
export const agregarLinea = (pid, data) => api.post(`/presupuestos/${pid}/lineas`, data);
export const actualizarLinea = (pid, lid, data) => api.put(`/presupuestos/${pid}/lineas/${lid}`, data);
export const eliminarLinea = (pid, lid) => api.delete(`/presupuestos/${pid}/lineas/${lid}`);

// RUBROS
export const crearRubroVacio = (pid, data) => api.post(`/presupuestos/${pid}/rubros`, data);

// CERTIFICADOS
export const getCertificados = (pid) => api.get(`/presupuestos/${pid}/certificados`);
export const getCertificado = (pid, num) => api.get(`/presupuestos/${pid}/certificados/${num}`);
export const crearCertificado = (pid, data) => api.post(`/presupuestos/${pid}/certificados`, data);

// MAESTROS
export const getCategorias = () => api.get('/maestros/categorias');
export const getItems = (catId) => api.get('/maestros/items', { params: catId ? { categoria_id: catId } : {} });
export const getClientes = () => api.get('/clientes');
export const crearCliente = (data) => api.post('/clientes', data);

export default api;
