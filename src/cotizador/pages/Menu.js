// FAIM OBRAS Menu build 1778444181
import '../index.css';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMenu, getClientes, crearCliente, crearPresupuesto, duplicarPresupuesto, actualizarPresupuesto } from '../api';
import api from '../api';
import { Plus, Copy, FolderOpen, Lock, User, Package, BarChart2, Edit2, Trash2, X, Check, Menu as MenuIcon, Wrench, Search } from 'lucide-react';
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
  const [formPresupuesto, setFormPresupuesto] = useState({ nombre_obra: '', ubicacion: '', cliente_id: '', proyecto_id: '', tipo: 'obra' });
  const [proyectosCliente, setProyectosCliente] = useState([]);
  const [menuMobileOpen, setMenuMobileOpen] = useState(false);

  // La lista se acomodaba sola por fecha y un cliente viejo se hundía sin
  // manera de traerlo arriba. Ahora se busca, se elige el orden, y se puede
  // fijar arriba a los que se están trabajando.
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState(() => localStorage.getItem('obras_menu_orden') || 'reciente');
  const [fijados, setFijados] = useState(() => {
    try { return JSON.parse(localStorage.getItem('obras_menu_fijados') || '[]'); } catch (e) { return []; }
  });
  const cambiarOrden = (o) => { setOrden(o); localStorage.setItem('obras_menu_orden', o); };
  const fijar = (cid) => {
    setFijados(prev => {
      const n = prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid];
      localStorage.setItem('obras_menu_fijados', JSON.stringify(n));
      return n;
    });
  };

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [menuRes, clientesRes] = await Promise.all([getMenu(), getClientes()]);
      setClientes(clientesRes.data);
      const presupPorCliente = {};
      const presupList = Array.isArray(menuRes.data) ? menuRes.data : [];
      const porClienteData = menuRes.data?.por_cliente || [];
      if (porClienteData.length > 0) {
        porClienteData.forEach(g => { presupPorCliente[g.cliente_id] = g.presupuestos || []; });
      } else {
        presupList.forEach(p => {
          const cid = p.cliente_id || 'sin_cliente';
          if (!presupPorCliente[cid]) presupPorCliente[cid] = [];
          presupPorCliente[cid].push(p);
        });
      }
      // Más recientes primero (por fecha de creación, con id como desempate)
      const byNew = (a, b) => (new Date(b.created_at || 0) - new Date(a.created_at || 0)) || ((b.id || 0) - (a.id || 0));
      const menuCompleto = clientesRes.data.map(c => ({
        ...c,
        presupuestos: (presupPorCliente[c.id] || []).slice().sort(byNew),
      }));
      const sinCliente = presupPorCliente['sin_cliente'] || [];
      if (sinCliente.length > 0) menuCompleto.push({ id: 'sin_cliente', nombre: 'Sin cliente', email: '', presupuestos: sinCliente.slice().sort(byNew) });
      // Clientes con actividad más reciente arriba
      menuCompleto.sort((a, b) => {
        const af = a.presupuestos[0]?.created_at ? new Date(a.presupuestos[0].created_at).getTime() : 0;
        const bf = b.presupuestos[0]?.created_at ? new Date(b.presupuestos[0].created_at).getTime() : 0;
        return bf - af;
      });
      setMenu(menuCompleto);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // Lo que se ve: filtrado por lo que se escribió y ordenado como se pidió.
  // Los fijados van siempre arriba, en el orden en que se fijaron.
  const q = busca.trim().toLowerCase();
  const menuVisible = menu
    .map(c => {
      if (!q) return c;
      const clienteCoincide = (c.nombre || '').toLowerCase().includes(q) ||
                              (c.email || '').toLowerCase().includes(q);
      const presups = (c.presupuestos || []).filter(p =>
        (p.nombre_obra || '').toLowerCase().includes(q) ||
        (p.ubicacion || '').toLowerCase().includes(q));
      // Si el que coincide es el cliente, se muestran todas sus obras.
      if (clienteCoincide) return c;
      return presups.length ? { ...c, presupuestos: presups } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const fa = fijados.indexOf(a.id), fb = fijados.indexOf(b.id);
      if (fa !== fb) return (fa === -1 ? 1e9 : fa) - (fb === -1 ? 1e9 : fb);
      if (orden === 'nombre') return (a.nombre || '').localeCompare(b.nombre || '', 'es');
      if (orden === 'cantidad') return (b.presupuestos?.length || 0) - (a.presupuestos?.length || 0);
      const af = a.presupuestos?.[0]?.created_at ? new Date(a.presupuestos[0].created_at).getTime() : 0;
      const bf = b.presupuestos?.[0]?.created_at ? new Date(b.presupuestos[0].created_at).getTime() : 0;
      return bf - af;
    });

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
      await api.put(`/clientes/${id}`, formCliente);
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
    if (!formPresupuesto.nombre_obra) return;
    try {
      const payload = { ...formPresupuesto };
      if (payload.cliente_id) payload.cliente_id = parseInt(payload.cliente_id); else delete payload.cliente_id;
      if (payload.proyecto_id) payload.proyecto_id = parseInt(payload.proyecto_id); else delete payload.proyecto_id;
      const res = await crearPresupuesto(payload);
      setModalPresupuesto(false);
      setFormPresupuesto({ nombre_obra: '', ubicacion: '', cliente_id: '', proyecto_id: '', tipo: 'obra' });
      setProyectosCliente([]);
      navigate(`/cotizador/presupuesto/${res.data.id}`);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const [modalDuplicar, setModalDuplicar] = useState(null); // { pid, nombre_obra, cliente_id }

  const abrirDuplicar = (p, e) => {
    e.stopPropagation();
    setModalDuplicar({ pid: p.id, nombre_obra: p.nombre_obra + ' (copia)', cliente_id: p.cliente_id || '' });
  };

  const handleDuplicar = async () => {
    if (!modalDuplicar) return;
    try {
      const res = await duplicarPresupuesto(
        modalDuplicar.pid, modalDuplicar.nombre_obra.trim(),
        modalDuplicar.cliente_id ? parseInt(modalDuplicar.cliente_id) : null,
      );
      setModalDuplicar(null);
      cargar();
      navigate(`/cotizador/presupuesto/${res.data.id}`);
    } catch (e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const handleRenombrar = async (p, e) => {
    e.stopPropagation();
    const nuevo = window.prompt('Nuevo nombre del presupuesto:', p.nombre_obra);
    if (nuevo === null) return; // canceló
    const nombre = nuevo.trim();
    if (!nombre || nombre === p.nombre_obra) return;
    try {
      await actualizarPresupuesto(p.id, { nombre_obra: nombre });
      cargar();
    } catch (err) { alert('Error al renombrar: ' + (err.response?.data?.detail || err.message)); }
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
    { label: 'Materiales',       icon: <Package  size={14} strokeWidth={1.5} />, path: '/cotizador/materiales' },
    { label: 'Mano de obra',     icon: <User     size={14} strokeWidth={1.5} />, path: '/cotizador/mano-obra' },
    { label: 'Maquinaria',       icon: <Wrench   size={14} strokeWidth={1.5} />, path: '/cotizador/maquinaria' },
    { label: 'Análisis de costos', icon: <BarChart2 size={14} strokeWidth={1.5} />, path: '/cotizador/analisis-costos' },
  ];

  return (
    <div>
      <div className="header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: -0.5, cursor: 'pointer', color: (()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');return s?.tenant?.color_primario||JSON.parse(localStorage.getItem('obras_tenant')||'{}')?.color_primario||'var(--accent)';}catch(e){return 'var(--accent)';}})() }} onClick={() => navigate('/')}>{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');const t=s?.tenant?.nombre;if(t)return t;const td=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(td?.nombre)return td.nombre;return 'FAIM OBRAS';}catch(e){return 'FAIM OBRAS';}})()}</div>
          <div style={{ width: 1, height: 24, background: 'var(--border)' }}></div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Presupuestos y obras</div>
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
            { label: 'Materiales',        icon: <Package  size={18} strokeWidth={1.5} />, onClick: () => navigate('/cotizador/materiales') },
            { label: 'Mano de obra',      icon: <User     size={18} strokeWidth={1.5} />, onClick: () => navigate('/cotizador/mano-obra') },
            { label: 'Maquinaria',        icon: <Wrench   size={18} strokeWidth={1.5} />, onClick: () => navigate('/cotizador/maquinaria') },
            { label: 'Análisis de costos',icon: <BarChart2 size={18} strokeWidth={1.5} />, onClick: () => navigate('/cotizador/analisis-costos') },
          ]} />
        </div>
      </div>

      {/* Mobile drawer */}
      {menuMobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300 }} onClick={() => setMenuMobileOpen(false)}>
          <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(260px, 86vw)', background: 'var(--surface)', boxShadow: '-4px 0 24px rgba(0,0,0,0.2)', padding: 20, display: 'flex', flexDirection: 'column', gap: 8,
                        overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
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

      {/* Buscar y ordenar. Con veinte clientes y cien presupuestos, sin esto
          hay que scrollear a ciegas. */}
      {menu.length > 0 && (
        <div style={{ padding: '12px 12px 0', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ position: 'relative', marginBottom: 9 }}>
            <Search size={15} color="var(--muted)"
              style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar cliente u obra…"
              style={{ width: '100%', padding: '10px 12px 10px 34px', borderRadius: 10, fontSize: 14,
                       border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
                       fontFamily: 'inherit', boxSizing: 'border-box' }} />
            {busca && (
              <button onClick={() => setBusca('')}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                         background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18 }}>×</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Ordenar por</span>
            {[['reciente', 'Lo último'], ['nombre', 'Nombre'], ['cantidad', 'Más obras']].map(([v, l]) => (
              <button key={v} onClick={() => cambiarOrden(v)}
                style={{ padding: '4px 11px', borderRadius: 14, fontSize: 11.5, cursor: 'pointer',
                         fontFamily: 'inherit', fontWeight: orden === v ? 700 : 400,
                         border: `1px solid ${orden === v ? 'var(--accent)' : 'var(--border)'}`,
                         background: orden === v ? 'rgba(16,185,129,.12)' : 'transparent',
                         color: orden === v ? 'var(--accent)' : 'var(--muted)' }}>
                {l}
              </button>
            ))}
            {fijados.length > 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                ★ {fijados.length} fijado{fijados.length !== 1 ? 's' : ''} arriba
              </span>
            )}
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
          menuVisible.length === 0 ? (
            <div className="empty">
              <h3>Nada con «{busca}»</h3>
              <p>Probá con otra parte del nombre del cliente o de la obra</p>
            </div>
          ) : menuVisible.map(cliente => (
            <div key={cliente.id} className="card" style={{ marginBottom: 12 }}>
              {/* HEADER CLIENTE */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => toggleCliente(cliente.id)}>
                <button onClick={e => { e.stopPropagation(); fijar(cliente.id); }}
                  title={fijados.includes(cliente.id) ? 'Sacar de arriba' : 'Fijar arriba de todo'}
                  style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, cursor: 'pointer',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                           background: fijados.includes(cliente.id) ? 'rgba(16,185,129,.14)' : 'var(--surface2)',
                           border: fijados.includes(cliente.id) ? '1px solid var(--accent)' : '1px solid transparent',
                           color: fijados.includes(cliente.id) ? 'var(--accent)' : 'var(--muted)', fontSize: 14 }}>
                  {fijados.includes(cliente.id) ? '★' : <User size={15} color="var(--muted)" />}
                </button>
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
                    {expandidos[cliente.id] === true ? '▼' : '▶'}
                  </div>
                </div>
              </div>

              {/* PRESUPUESTOS */}
              {expandidos[cliente.id] === true && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {(!cliente.presupuestos || cliente.presupuestos.length === 0) ? (
                    <div style={{ fontSize: 12, color: 'var(--muted)', padding: '6px 0' }}>Sin presupuestos</div>
                  ) : (
                    cliente.presupuestos.map(p => (
                      <div key={p.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', borderRadius: 8, cursor: 'pointer', marginBottom: 2 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => navigate(`/cotizador/presupuesto/${p.id}`)}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{p.nombre_obra}</span>
                            {p.proyecto_nombre && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: (p.proyecto_color || '#6ee7b7') + '22', color: p.proyecto_color || '#059669', flexShrink: 0 }}>
                                {p.proyecto_nombre}
                              </span>
                            )}
                            <span className={`badge badge-${p.estado}`} style={{ fontSize: 9, flexShrink: 0, display:'flex', alignItems:'center', gap:3 }}>
                              {p.estado === 'cerrado' ? <Lock size={9} strokeWidth={2} /> : '●'} {p.estado.toUpperCase()}
                            </span>
                          </div>
                          {p.ubicacion && <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ubicacion}</div>}
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--precio)', marginTop: 2 }}>
                            {fmt(p.total_precio_con_iva)}
                          </div>
                          {p.creado_por_nombre && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              por {p.creado_por_nombre}
                              {p.created_at && ` · ${new Date(p.created_at).toLocaleDateString('es-AR')}`}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button className="btn btn-secondary btn-sm" onClick={e => handleRenombrar(p, e)} title="Renombrar">
                            <Edit2 size={13} />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={e => abrirDuplicar(p, e)} title="Duplicar">
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
            {/* Que se esta presupuestando. Va primero porque de esto depende
                que significa todo lo demas: una obra se computa, un proyecto
                se cobra por etapas. */}
            <div className="form-group">
              <label>Qué vas a presupuestar</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['obra', 'Obra', 'Con cómputo y análisis de costo'],
                  ['servicio', 'Proyecto o servicio', 'Honorarios por etapas, sin cómputo']].map(([valor, titulo, ayuda]) => (
                  <button key={valor} type="button"
                    onClick={() => setFormPresupuesto(p => ({ ...p, tipo: valor }))}
                    style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
                             font: 'inherit',
                             border: `1px solid ${formPresupuesto.tipo === valor ? 'var(--accent)' : 'var(--border)'}`,
                             background: formPresupuesto.tipo === valor ? 'rgba(5,150,105,.08)' : 'var(--surface2)' }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>{ayuda}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Cliente *</label>
              <select className="input" value={formPresupuesto.cliente_id}
                onChange={e => {
                  const cid = e.target.value;
                  setFormPresupuesto(p => ({ ...p, cliente_id: cid, proyecto_id: '' }));
                  if (cid) {
                    api.get('/proyectos', { params: { cliente_id: parseInt(cid) } })
                      .then(r => setProyectosCliente(Array.isArray(r.data) ? r.data : []))
                      .catch(() => setProyectosCliente([]));
                  } else { setProyectosCliente([]); }
                }}>
                <option value="">Seleccionar cliente...</option>
                {menu.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            {proyectosCliente.length > 0 && (
              <div className="form-group">
                <label>Proyecto (opcional)</label>
                <select className="input" value={formPresupuesto.proyecto_id}
                  onChange={e => setFormPresupuesto(p => ({ ...p, proyecto_id: e.target.value }))}>
                  <option value="">Sin proyecto</option>
                  {proyectosCliente.map(pr => <option key={pr.id} value={pr.id}>{pr.nombre}</option>)}
                </select>
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setModalCliente(true)}>
                <Plus size={12} /> Nuevo cliente
              </button>
            </div>
            <div className="form-group">
              <label>{formPresupuesto.tipo === 'servicio' ? 'Nombre del proyecto *' : 'Nombre de la obra *'}</label>
              <input className="input" value={formPresupuesto.nombre_obra}
                onChange={e => setFormPresupuesto(p => ({ ...p, nombre_obra: e.target.value }))}
                placeholder={formPresupuesto.tipo === 'servicio' ? 'Ej: Anteproyecto casa Pérez' : 'Ej: Refacción vivienda'} autoFocus />
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

      {modalDuplicar && (
        <div className="modal-overlay" onClick={() => setModalDuplicar(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Duplicar presupuesto</h2>
            <div className="form-group">
              <label>Nombre de la copia</label>
              <input className="input" autoFocus value={modalDuplicar.nombre_obra}
                onChange={e => setModalDuplicar(m => ({ ...m, nombre_obra: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Cliente</label>
              <select className="input" value={modalDuplicar.cliente_id}
                onChange={e => setModalDuplicar(m => ({ ...m, cliente_id: e.target.value }))}>
                <option value="">Sin cliente</option>
                {menu.filter(c => c.id !== 'sin_cliente').map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Por defecto queda para el mismo cliente — elegí otro para copiarlo entre clientes.
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalDuplicar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleDuplicar} disabled={!modalDuplicar.nombre_obra.trim()}>Duplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
