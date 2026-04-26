import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import Menu from './cotizador/pages/Menu';
import Presupuesto from './cotizador/pages/Presupuesto';
import Certificado from './cotizador/pages/Certificado';
import Materiales from './cotizador/pages/Materiales';
import ManoObra from './cotizador/pages/ManoObra';
import AnalisisCostos from './cotizador/pages/AnalisisCostos';
import './cotizador/index.css';

const API_URL = process.env.REACT_APP_API_URL || 'https://obras-backend-production.up.railway.app';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/* ── Subscription blocked ─────────────────────────────────────────────────── */
function SuscripcionVencida({ suscripcion, onLogout }) {
  const [loading, setLoading] = useState(false);

  const handlePagar = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('obras_token');
      const res = await fetch(`${API_URL}/suscripcion/crear-preferencia`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
      else alert('Error al crear el pago. Contactá a soporte.');
    } catch (e) { alert('Error de conexión.'); }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--sans)',
      padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '48px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ color: 'var(--text)', fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0', fontFamily: 'var(--sans)' }}>
          FAIM OBRAS
        </h2>
        <p style={{ color: 'var(--muted)', marginBottom: '28px', fontSize: '14px' }}>
          Tu período de prueba ha vencido
        </p>

        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '20px',
          margin: '0 0 24px 0'
        }}>
          <p style={{ color: 'var(--accent)', fontSize: '30px', fontWeight: '700', margin: '0 0 2px 0', fontFamily: 'var(--mono)' }}>
            ${(suscripcion?.precio_mensual || 40000).toLocaleString('es-AR')}
          </p>
          <p style={{ color: 'var(--muted)', fontSize: '13px', margin: '0' }}>por mes · 2 usuarios incluidos</p>
        </div>

        <ul style={{ textAlign: 'left', color: 'var(--text)', fontSize: '13px', margin: '0 0 28px 0', paddingLeft: '0', listStyle: 'none' }}>
          {['Cotizador completo con catálogo actualizado','Certificados y control de avance','Panel financiero y Gantt','Múltiples presupuestos y clientes'].map(f => (
            <li key={f} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: 'var(--accent)', fontWeight: '700' }}>✓</span> {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handlePagar}
          disabled={loading}
          style={{
            width: '100%', padding: '13px',
            background: loading ? 'var(--border)' : 'var(--accent)',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
            marginBottom: '12px', fontFamily: 'var(--sans)'
          }}
        >
          {loading ? 'Procesando...' : 'Suscribirme con MercadoPago'}
        </button>
        <button onClick={onLogout} style={{
          background: 'none', border: 'none', color: 'var(--muted)',
          cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--sans)'
        }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/* ── Trial banner ─────────────────────────────────────────────────────────── */
function TrialBanner({ diasRestantes }) {
  if (diasRestantes > 7) return null;
  return (
    <div style={{
      background: diasRestantes <= 2 ? '#fef2f2' : '#fffbeb',
      borderBottom: `1px solid ${diasRestantes <= 2 ? '#fecaca' : '#fde68a'}`,
      color: diasRestantes <= 2 ? 'var(--danger)' : 'var(--warn)',
      textAlign: 'center', padding: '8px 16px',
      fontSize: '13px', fontFamily: 'var(--sans)'
    }}>
      ⚠️ Te {diasRestantes === 1 ? 'queda' : 'quedan'} <strong>{diasRestantes} día{diasRestantes !== 1 ? 's' : ''}</strong> de prueba gratuita.
      {diasRestantes <= 3 && ' Suscribite para no perder el acceso.'}
    </div>
  );
}

/* ── Login ────────────────────────────────────────────────────────────────── */
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // tenant login
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        await login(data.token, data.usuario, data.tenant);
        navigate('/'); return;
      }
    } catch (e) {}
    // admin login
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('obras_token', data.token);
        localStorage.setItem('obras_session', JSON.stringify({ user: { email, rol: 'superadmin' }, isAdmin: true }));
        navigate('/'); return;
      }
    } catch (e) {}
    setError('Email o contraseña incorrectos');
    setLoading(false);
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: '8px', color: 'var(--text)', fontSize: '14px',
    boxSizing: 'border-box', outline: 'none', fontFamily: 'var(--sans)'
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--sans)', padding: '20px'
    }}>
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '48px', maxWidth: '400px', width: '100%',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)'
      }}>
        <h1 style={{ color: 'var(--text)', fontSize: '26px', fontWeight: '800', margin: '0 0 4px 0' }}>
          FAIM OBRAS
        </h1>
        <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '32px' }}>
          Gestión para estudios y empresas
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: 'var(--text)', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', color: 'var(--text)', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          </div>
          {error && <p style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '12px',
            background: loading ? 'var(--border)' : 'var(--accent)',
            color: 'white', border: 'none', borderRadius: '8px',
            fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--sans)'
          }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Auth Provider ────────────────────────────────────────────────────────── */
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [suscripcion, setSuscripcion] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const checkSuscripcion = async (token) => {
    try {
      const res = await fetch(`${API_URL}/suscripcion/estado`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const data = await res.json(); setSuscripcion(data); return data; }
    } catch (e) {}
    return null;
  };

  useEffect(() => {
    const restore = async () => {
      const token = localStorage.getItem('obras_token');
      const sessionStr = localStorage.getItem('obras_session');
      if (!token || !sessionStr) { setLoadingAuth(false); return; }
      try {
        const session = JSON.parse(sessionStr);
        setUser(session.user);
        setTenant(session.tenant);
        await checkSuscripcion(token);
      } catch (e) {
        localStorage.removeItem('obras_token');
        localStorage.removeItem('obras_session');
      }
      setLoadingAuth(false);
    };
    restore();
  }, []);

  const login = async (token, userData, tenantData) => {
    localStorage.setItem('obras_token', token);
    localStorage.setItem('obras_session', JSON.stringify({ user: userData, tenant: tenantData, token }));
    setUser(userData);
    setTenant(tenantData);
    await checkSuscripcion(token);
  };

  const logout = () => {
    localStorage.removeItem('obras_token');
    localStorage.removeItem('obras_session');
    setUser(null); setTenant(null); setSuscripcion(null);
  };

  return (
    <AuthContext.Provider value={{ user, tenant, suscripcion, loadingAuth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── App Content ──────────────────────────────────────────────────────────── */
function AppContent() {
  const { user, suscripcion, loadingAuth, logout } = useAuth();

  if (loadingAuth) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--sans)' }}>
        <span style={{ color: 'var(--muted)', fontSize: '14px' }}>Cargando...</span>
      </div>
    );
  }

  if (!user) {
    return <Routes><Route path="*" element={<LoginPage />} /></Routes>;
  }

  if (suscripcion && suscripcion.trial_vencido) {
    return <SuscripcionVencida suscripcion={suscripcion} onLogout={logout} />;
  }

  return (
    <>
      {suscripcion && suscripcion.en_trial && <TrialBanner diasRestantes={suscripcion.dias_restantes} />}
      <Routes>
        <Route path="/" element={<Menu />} />
        <Route path="/presupuesto/:id" element={<Presupuesto />} />
        <Route path="/presupuesto/:id/certificado" element={<Certificado />} />
        <Route path="/materiales" element={<Materiales />} />
        <Route path="/mano-obra" element={<ManoObra />} />
        <Route path="/analisis" element={<AnalisisCostos />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

/* ── Root ─────────────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
