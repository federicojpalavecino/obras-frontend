import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import AdminPanel from './pages/admin/AdminPanel';
import MenuCotizador from './pages/cotizador/Menu';
import Presupuesto from './pages/cotizador/Presupuesto';

const API_BASE = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }
export function authHeaders() {
  const token = localStorage.getItem('obras_token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const menuItems = [
  { id: 'cotizador', label: '📋 Cotizador' },
  { id: 'clientes', label: '👥 Clientes' },
  { id: 'financiero', label: '💰 Control Financiero' },
  { id: 'fiscal', label: '🧾 Fiscal' },
];

function Sidebar({ activeTab, setActiveTab, user, tenant, logout }) {
  const color = tenant?.color_primario || '#7c3aed';
  return (
    <div style={{ width: 200, background: '#1a1a2e', borderRight: '1px solid #2a2a3a', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ padding: '20px 14px', borderBottom: '1px solid #2a2a3a' }}>
        {tenant?.logo_url
          ? <img src={tenant.logo_url} alt="logo" style={{ height: 36, objectFit: 'contain' }} />
          : <div style={{ fontSize: 16, fontWeight: 800, color }}>{tenant?.nombre || 'OBRAS'}</div>}
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{user?.nombre || user?.email}</div>
      </div>
      <nav style={{ flex: 1, padding: '10px 8px' }}>
        {menuItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 13, background: activeTab === item.id ? `${color}33` : 'transparent', color: activeTab === item.id ? color : '#94a3b8', fontWeight: activeTab === item.id ? 600 : 400 }}>
            {item.label}
          </button>
        ))}
        {user?.rol === 'admin' && (
          <button onClick={() => setActiveTab('accesos')}
            style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 7, border: 'none', cursor: 'pointer', marginBottom: 2, fontSize: 13, background: activeTab === 'accesos' ? `${color}33` : 'transparent', color: activeTab === 'accesos' ? color : '#94a3b8' }}>
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

function Dashboard({ user, tenant, logout }) {
  const [activeTab, setActiveTab] = useState('cotizador');

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f0f1a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} tenant={tenant} logout={logout} />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'cotizador' && <MenuCotizador />}
        {activeTab === 'clientes' && <PlaceholderView title="Clientes" icon="👥" />}
        {activeTab === 'financiero' && <PlaceholderView title="Control Financiero" icon="💰" />}
        {activeTab === 'fiscal' && <PlaceholderView title="Fiscal" icon="🧾" />}
        {activeTab === 'accesos' && <AdminPanel />}
      </div>
    </div>
  );
}

function PlaceholderView({ title, icon }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 80, color: '#64748b' }}>
      <div style={{ fontSize: 56 }}>{icon}</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: '16px 0 8px', color: '#e2e8f0' }}>{title}</h2>
      <p>Próximamente disponible</p>
    </div>
  );
}

function PresupuestoPage({ user, tenant, logout }) {
  const color = tenant?.color_primario || '#7c3aed';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f1a', color: '#e2e8f0', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Presupuesto />
      </div>
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
    setTimeout(() => setLoading(false), 300);
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

  if (loading) return <div style={{ background: '#0f0f1a', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontSize: 18 }}>Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, API: API_BASE }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/app" /> : <Landing />} />
          <Route path="/registro" element={user ? <Navigate to="/app" /> : <Auth mode="register" />} />
          <Route path="/login" element={user ? <Navigate to="/app" /> : <Auth mode="login" />} />
          <Route path="/onboarding" element={user ? <Onboarding /> : <Navigate to="/login" />} />
          <Route path="/app" element={user ? <Dashboard user={user} tenant={tenant} logout={logout} /> : <Navigate to="/login" />} />
          <Route path="/app/cotizador/presupuesto/:id" element={user ? <PresupuestoPage user={user} tenant={tenant} logout={logout} /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default AppRouter;
