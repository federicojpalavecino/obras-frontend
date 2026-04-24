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
