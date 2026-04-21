import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import AdminPanel from './pages/admin/AdminPanel';
import MenuCotizador from './pages/cotizador/Menu';
import Presupuesto from './pages/cotizador/Presupuesto';
import Materiales from './pages/cotizador/Materiales';
import ManoObra from './pages/cotizador/ManoObra';
import Maquinaria from './pages/cotizador/Maquinaria';
import AnalisisCostos from './pages/cotizador/AnalisisCostos';

const API_BASE = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }
export function authHeaders() {
  const token = localStorage.getItem('obras_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const menuItems = [
  { id: 'cotizador', label: '📋 Cotizador', path: '/app' },
  { id: 'financiero', label: '💰 Control Financiero', path: '/app/financiero' },
  { id: 'fiscal', label: '🧾 Fiscal', path: '/app/fiscal' },
];

function Sidebar({ user, tenant, logout }) {
  const navigate = useNavigate();
  const color = tenant?.color_primario || '#7c3aed';
  const current = window.location.pathname;

  return (
    <div style={{ width: 200, background: '#1a1a2e', borderRight: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh' }}>
      <div style={{ padding: '18px 14px', borderBottom: '1px solid #2a2a3a' }}>
        {tenant?.logo_url
          ? <img src={tenant.logo_url} alt="logo" style={{ height: 36, objectFit: 'contain' }} />
          : <div style={{ fontSize: 16, fontWeight: 800, color }}>{tenant?.nombre || 'OBRAS'}</div>}
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{user?.nombre || user?.email}</div>
      </div>
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {menuItems.map(item => (
          <button key={item.id} onClick={() => navigate(item.path)}
            style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 13, background: current === item.path || (item.path !== '/app' && current.startsWith(item.path)) ? `${color}33` : 'transparent', color: current === item.path || (item.path !== '/app' && current.startsWith(item.path)) ? color : '#94a3b8', fontWeight: 500 }}>
            {item.label}
          </button>
        ))}
        {user?.rol === 'admin' && (
          <button onClick={() => navigate('/app/accesos')}
            style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 13, background: current === '/app/accesos' ? `${color}33` : 'transparent', color: current === '/app/accesos' ? color : '#94a3b8' }}>
            🔑 Accesos
          </button>
        )}
      </nav>
      <div style={{ padding: 12, borderTop: '1px solid #2a2a3a' }}>
        <button onClick={logout} style={{ width: '100%', padding: '7px', borderRadius: 7, border: '1px solid #2a2a3a', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12 }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function Layout({ children, user, tenant, logout }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8f9fa' }}>
      <Sidebar user={user} tenant={tenant} logout={logout} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function PlaceholderView({ title, icon }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 80, color: '#64748b' }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px', color: '#1a1a2e' }}>{title}</h2>
      <p>Próximamente disponible</p>
    </div>
  );
}

function AppRouter() {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('obras_session');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.user && s.token) { setUser(s.user); setTenant(s.tenant); }
      } catch {}
    }
    setTimeout(() => setLoading(false), 200);
  }, []);

  const login = (userData, tenantData, token) => {
    setUser(userData); setTenant(tenantData);
    localStorage.setItem('obras_token', token);
    localStorage.setItem('obras_session', JSON.stringify({ user: userData, tenant: tenantData, token }));
  };

  const logout = () => {
    setUser(null); setTenant(null);
    localStorage.removeItem('obras_token');
    localStorage.removeItem('obras_session');
  };

  if (loading) return <div style={{ background: '#f8f9fa', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontSize: 18 }}>Cargando...</div>;

  const wrap = (Component) => user ? (
    <Layout user={user} tenant={tenant} logout={logout}>
      <Component />
    </Layout>
  ) : <Navigate to="/login" />;

  const wrapFull = (Component) => user ? <Component /> : <Navigate to="/login" />;

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, API: API_BASE }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/app" /> : <Landing />} />
          <Route path="/registro" element={user ? <Navigate to="/app" /> : <Auth mode="register" />} />
          <Route path="/login" element={user ? <Navigate to="/app" /> : <Auth mode="login" />} />
          <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/login" />} />

          {/* App con sidebar */}
          <Route path="/app" element={wrap(MenuCotizador)} />
          <Route path="/app/financiero" element={wrap(() => <PlaceholderView title="Control Financiero" icon="💰" />)} />
          <Route path="/app/fiscal" element={wrap(() => <PlaceholderView title="Fiscal" icon="🧾" />)} />
          <Route path="/app/accesos" element={wrap(AdminPanel)} />
          <Route path="/app/cotizador/materiales" element={wrap(Materiales)} />
          <Route path="/app/cotizador/mano-obra" element={wrap(ManoObra)} />
          <Route path="/app/cotizador/maquinaria" element={wrap(Maquinaria)} />
          <Route path="/app/cotizador/analisis-costos" element={wrap(AnalisisCostos)} />

          {/* Presupuesto — pantalla completa sin sidebar de obras */}
          <Route path="/app/cotizador/presupuesto/:id" element={wrapFull(Presupuesto)} />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default AppRouter;
