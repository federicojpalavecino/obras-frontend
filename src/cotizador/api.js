import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
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
  (response) => response,
  (error) => {
    const status = error.response?.status;
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
export const cerrarPresupuesto = (id) => api.post(`/presupuestos/${id}/cerrar`);
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
