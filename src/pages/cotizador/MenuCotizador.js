import '../../cotizador.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMenu, getClientes, crearCliente, crearPresupuesto, duplicarPresupuesto } from '../../api';
import api from '../../api';
import { Plus, Copy, FolderOpen, Lock, User, Package, BarChart2, Edit2, Trash2, X, Check, Menu as MenuIcon } from 'lucide-react';
import MobileMenu from './MobileMenu';

const fmt = (n) => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';

export default function Menu() {
  const navigate = useNavigate();
  const [menu, setMenu] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState({});
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPresupuesto, setModalPresupuesto] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [editandoCliente, setEditandoCliente] = useState(null);
  const [formCliente, setFormCliente] = useState({ nombre: '', email: '', telefono: '' });
  const [formPresupuesto, setFormPresupuesto] = useState({ nombre_obra: '', ubicacion: '', cliente_id: '' });
  const [menuMobileOpen, setMenuMobileOpen] = useState(false);

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [menuRes, clientesRes] = await Promise.all([getMenu(), getClientes()]);
      setClientes(clientesRes.data);
      const presupPorCliente = {};
      (menuRes.data?.por_cliente || []).forEach(grupo => {
        presupPorCliente[grupo.cliente_id] = grupo.presupuestos || [];
      });
      const menuCompleto = clientesRes.data.map(c => ({
        ...c,
        presupuestos: presupPorCliente[c.id] || [],
      }));
      setMenu(menuCompleto);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleCrearCliente = async () => {
    if (!formCliente.nombre) return;
    try {
      await crearCliente(formCliente);
      setModalCliente(false);
      setFormCliente({ nombre: '', email: '', telefono: '' });
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEditarCliente = async (id) => {
    try {
      await api.patch(`/clientes/${id}`, formCliente);
      setEditandoCliente(null);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarCliente = async (cliente) => {
    if (!window.confirm(`¿Eliminar a "${cliente.nombre}"? Solo se puede si no tiene presupuestos.`)) return;
    try {
      await api.delete(`/clientes/${cliente.id}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleCrearPresupuesto = async () => {
    if (!formPresupuesto.nombre_obra || !formPresupuesto.cliente_id) return;
    try {
      const res = await crearPresupuesto({ ...formPresupuesto, cliente_id: parseInt(formPresupuesto.cliente_id) });
      setModalPresupuesto(false);
      setFormPresupuesto({ nombre_obra: '', ubicacion: '', cliente_id: '' });
      navigate(`/app/cotizador/presupuesto/${res.data.id}`);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleDuplicar = async (pid, e) => {
    e.stopPropagation();
    try {
      const res = await duplicarPresupuesto(pid);
      cargar();
      navigate(`/app/cotizador/presupuesto/${res.data.id}`);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleEliminarPresupuesto = async (pid, nombre, e) => {
    e.stopPropagation();
    if (!window.confirm(`¿Eliminar el presupuesto "${nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/presupuestos/${pid}`);
      cargar();
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const toggleCliente = (id) => setExpandidos(p => ({ ...p, [id]: !p[id] }));

  const abrirEditarCliente = (cliente, e) => {
    e.stopPropagation();
    setEditandoCliente(cliente.id);
    setFormCliente({ nombre: cliente.nombre, email: cliente.email || '', telefono: cliente.telefono || '' });
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const navItems = [
    { label: 'Materiales', icon: <Package size={14} />, path: '/app/cotizador/materiales' },
    { label: 'Mano de obra', icon: <User size={14} />, path: '/app/cotizador/mano-obra' },
    { label: 'Maquinaria', icon: <Package size={14} />, path: '/app/cotizador/maquinaria' },
    { label: 'Análisis', icon: <BarChart2 size={14} />, path: '/app/cotizador/analisis-costos' },
  ];

  return (
    <div>
      <div className="header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.5, cursor: 'pointer', color: 'var(--accent)' }} onClick={() => navigate('/app')}>OBRAS</div>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }}></div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Cotizador</div>
        </div>

        {/* Desktop nav */}
        <div className="menu-desktop-nav" style={{ gap: 8, alignItems: 'center' }}>
          {navItems.map(n => (
            <button key={n.path} className="btn btn-secondary btn-sm" onClick={() => navigate(n.path)}>
              {n.icon} {n.label}
            </button>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => setModalPresupuesto(true)}>
            <Plus size={14} /> Presupuesto
          </button>
        </div>

        {/* Mobile nav */}
        <div className="menu-mobile-nav" style={{ gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setModalPresupuesto(true)}>
            <Plus size={14} /> Nuevo
          </button>
          <MobileMenu actions={[
            { label: 'Materiales', icon: '📦', onClick: () => navigate('/app/cotizador/materiales') },
            { label: 'Mano de obra', icon: '👷', onClick: () => navigate('/app/cotizador/mano-obra') },
            { label: 'Maquinaria', icon: '🔧', onClick: () => navigate('/app/cotizador/maquinaria') },
            { label: 'Análisis de costos', icon: '📊', onClick: () => navigate('/app/cotizador/analisis-costos') },
          ]} />
        </div>
      </div>

      {/* Mobile drawer */}
      {menuMobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setMenuMobileOpen(false)}>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 260, background: 'var(--surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>Maestros</span>
              <button onClick={() => setMenuMobileOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            {navItems.map(n => (
              <button key={n.path} className="btn btn-secondary" style={{ justifyContent: 'flex-start', gap: 10 }}
                onClick={() => { navigate(n.path); setMenuMobileOpen(false); }}>
                {n.icon} {n.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: '16px 12px', maxWidth: 900, margin: '0 auto' }}>
        {menu.length === 0 ? (
          <div className="empty">
            <h3>Sin presupuestos</h3>
            <p>Creá un cliente y luego un presupuesto para empezar</p>
          </div>
        ) : (
          menu.map(cliente => (
            <div key={cliente.id} className="card" style={{ marginBottom: 12 }}>
              {/* HEADER CLIENTE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => toggleCliente(cliente.id)}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={15} color="var(--muted)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editandoCliente === cliente.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <input className="input" style={{ fontSize: 13, fontWeight: 700 }}
                        value={formCliente.nombre} onChange={e => setFormCliente(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre" />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input className="input" style={{ fontSize: 12, flex: 1 }} placeholder="Email"
                          value={formCliente.email} onChange={e => setFormCliente(p => ({ ...p, email: e.target.value }))} />
                        <input className="input" style={{ fontSize: 12, flex: 1 }} placeholder="Tel"
                          value={formCliente.telefono} onChange={e => setFormCliente(p => ({ ...p, telefono: e.target.value }))} />
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-success btn-sm" onClick={() => handleEditarCliente(cliente.id)}><Check size={13} /> Guardar</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditandoCliente(null)}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nombre}</div>
                      {(cliente.email || cliente.telefono) && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[cliente.email, cliente.telefono].filter(Boolean).join(' · ')}</div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--muted)', display: 'none' }} className="show-desktop">
                    {cliente.presupuestos?.length || 0} presup.
                  </span>
                  {editandoCliente !== cliente.id && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={e => abrirEditarCliente(cliente, e)} title="Editar cliente">
                        <Edit2 size={12} />
                      </button>
                      {(!cliente.presupuestos || cliente.presupuestos.length === 0) && (
                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleEliminarCliente(cliente); }} title="Eliminar">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </>
                  )}
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {expandidos[cliente.id] !== false ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* PRESUPUESTOS */}
              {expandidos[cliente.id] !== false && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {(!cliente.presupuestos || cliente.presupuestos.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>Sin presupuestos</div>
                  ) : (
                    cliente.presupuestos.map(p => (
                      <div key={p.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => navigate(`/app/cotizador/presupuesto/${p.id}`)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.nombre_obra}</span>
                            <span className={`badge badge-${p.estado}`} style={{ fontSize: 9, flexShrink: 0 }}>
                              {p.estado === 'cerrado' ? '🔒' : '●'} {p.estado.toUpperCase()}
                            </span>
                          </div>
                          {p.ubicacion && <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ubicacion}</div>}
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--precio)', marginTop: 2 }}>
                            {fmt(p.total_precio_con_iva)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button className="btn btn-secondary btn-sm" onClick={e => handleDuplicar(p.id, e)} title="Duplicar">
                            <Copy size={13} />
                          </button>
                          <button className="btn btn-danger btn-sm"
                            onClick={e => handleEliminarPresupuesto(p.id, p.nombre_obra, e)}
                            title="Eliminar">
                            <Trash2 size={13} />
                          </button>
                          <FolderOpen size={16} color="var(--muted)" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL CLIENTE */}
      {modalCliente && (
        <div className="modal-overlay" onClick={() => setModalCliente(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo cliente</h2>
            <div className="form-group">
              <label>Nombre *</label>
              <input className="input" value={formCliente.nombre}
                onChange={e => setFormCliente(p => ({ ...p, nombre: e.target.value }))}
                placeholder="Nombre o razón social" autoFocus />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" value={formCliente.email}
                onChange={e => setFormCliente(p => ({ ...p, email: e.target.value }))}
                placeholder="email@ejemplo.com" />
            </div>
            <div className="form-group">
              <label>Teléfono</label>
              <input className="input" value={formCliente.telefono}
                onChange={e => setFormCliente(p => ({ ...p, telefono: e.target.value }))}
                placeholder="+54 362 ..." />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalCliente(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearCliente}>Crear cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRESUPUESTO */}
      {modalPresupuesto && (
        <div className="modal-overlay" onClick={() => setModalPresupuesto(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Nuevo presupuesto</h2>
            <div className="form-group">
              <label>Cliente *</label>
              <select className="input" value={formPresupuesto.cliente_id}
                onChange={e => setFormPresupuesto(p => ({ ...p, cliente_id: e.target.value }))}>
                <option value="">Seleccionar cliente...</option>
                {menu.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setModalCliente(true)}>
                <Plus size={12} /> Nuevo cliente
              </button>
            </div>
            <div className="form-group">
              <label>Nombre de la obra *</label>
              <input className="input" value={formPresupuesto.nombre_obra}
                onChange={e => setFormPresupuesto(p => ({ ...p, nombre_obra: e.target.value }))}
                placeholder="Ej: Refacción vivienda" autoFocus />
            </div>
            <div className="form-group">
              <label>Ubicación</label>
              <input className="input" value={formPresupuesto.ubicacion}
                onChange={e => setFormPresupuesto(p => ({ ...p, ubicacion: e.target.value }))}
                placeholder="Barranqueras, Chaco" />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalPresupuesto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCrearPresupuesto}>Crear presupuesto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
