import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authHeaders } from '../../App';

const fmt = n => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';

export default function MenuCotizador() {
  const { API } = useAuth();
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [expandidos, setExpandidos] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalCliente, setModalCliente] = useState(false);
  const [modalPresupuesto, setModalPresupuesto] = useState(false);
  const [formCliente, setFormCliente] = useState({ nombre: '', email: '', telefono: '' });
  const [formPres, setFormPres] = useState({ nombre_obra: '', ubicacion: '', cliente_id: '' });

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch(`${API}/clientes`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API}/presupuestos`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      const presupPorCliente = {};
      (pRes || []).forEach(p => {
        if (!presupPorCliente[p.cliente_id]) presupPorCliente[p.cliente_id] = [];
        presupPorCliente[p.cliente_id].push(p);
      });
      setClientes((cRes || []).map(c => ({ ...c, presupuestos: presupPorCliente[c.id] || [] })));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const crearCliente = async () => {
    if (!formCliente.nombre) return;
    await fetch(`${API}/clientes`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(formCliente) });
    setModalCliente(false);
    setFormCliente({ nombre: '', email: '', telefono: '' });
    cargar();
  };

  const crearPresupuesto = async () => {
    if (!formPres.nombre_obra || !formPres.cliente_id) return;
    const res = await fetch(`${API}/presupuestos`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ ...formPres, cliente_id: parseInt(formPres.cliente_id) })
    });
    const data = await res.json();
    setModalPresupuesto(false);
    setFormPres({ nombre_obra: '', ubicacion: '', cliente_id: '' });
    navigate(`/app/cotizador/presupuesto/${data.id}`);
  };

  const s = { background: '#0f0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', padding: 24 };
  const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #2a2a3a', background: '#0f0f1a', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', marginBottom: 10 };
  const btn = (color='#7c3aed') => ({ padding: '8px 16px', borderRadius: 8, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 });

  return (
    <div style={s}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>📋 Cotizador</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setModalCliente(true)} style={btn('#334155')}>+ Cliente</button>
          <button onClick={() => setModalPresupuesto(true)} style={btn()}>+ Presupuesto</button>
        </div>
      </div>

      {loading ? <div style={{ color: '#64748b' }}>Cargando...</div> : (
        clientes.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: 60, color: '#64748b' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <p>No hay clientes todavía. Creá uno para empezar.</p>
          </div>
        ) : clientes.map(c => (
          <div key={c.id} style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
            <div onClick={() => setExpandidos(e => ({ ...e, [c.id]: !e[c.id] }))}
              style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{c.presupuestos.length} presupuesto{c.presupuestos.length !== 1 ? 's' : ''}</div>
              </div>
              <span style={{ color: '#64748b' }}>{expandidos[c.id] ? '▲' : '▼'}</span>
            </div>
            {expandidos[c.id] && (
              <div style={{ borderTop: '1px solid #2a2a3a' }}>
                {c.presupuestos.length === 0 ? (
                  <div style={{ padding: '16px 20px', color: '#64748b', fontSize: 13 }}>Sin presupuestos</div>
                ) : c.presupuestos.map(p => (
                  <div key={p.id} onClick={() => navigate(`/app/cotizador/presupuesto/${p.id}`)}
                    style={{ padding: '12px 20px', borderBottom: '1px solid #1e1e2e', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{p.nombre_obra}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{p.ubicacion || 'Sin ubicación'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(p.total_precio_con_iva)}</div>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: p.estado === 'cerrado' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: p.estado === 'cerrado' ? '#f87171' : '#4ade80' }}>
                        {p.estado}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {/* Modal cliente */}
      {modalCliente && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, padding: 28, width: 380 }}>
            <h3 style={{ marginBottom: 20 }}>Nuevo cliente</h3>
            <input placeholder="Nombre *" value={formCliente.nombre} onChange={e => setFormCliente(f => ({ ...f, nombre: e.target.value }))} style={inp} />
            <input placeholder="Email" value={formCliente.email} onChange={e => setFormCliente(f => ({ ...f, email: e.target.value }))} style={inp} />
            <input placeholder="Teléfono" value={formCliente.telefono} onChange={e => setFormCliente(f => ({ ...f, telefono: e.target.value }))} style={inp} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalCliente(false)} style={{ ...btn('#334155') }}>Cancelar</button>
              <button onClick={crearCliente} style={btn()}>Crear</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal presupuesto */}
      {modalPresupuesto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, padding: 28, width: 400 }}>
            <h3 style={{ marginBottom: 20 }}>Nuevo presupuesto</h3>
            <select value={formPres.cliente_id} onChange={e => setFormPres(f => ({ ...f, cliente_id: e.target.value }))} style={{ ...inp, marginBottom: 10 }}>
              <option value="">Seleccioná un cliente *</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input placeholder="Nombre de la obra *" value={formPres.nombre_obra} onChange={e => setFormPres(f => ({ ...f, nombre_obra: e.target.value }))} style={inp} />
            <input placeholder="Ubicación" value={formPres.ubicacion} onChange={e => setFormPres(f => ({ ...f, ubicacion: e.target.value }))} style={inp} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalPresupuesto(false)} style={btn('#334155')}>Cancelar</button>
              <button onClick={crearPresupuesto} style={btn()}>Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
