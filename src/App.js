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
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif', padding:'20px' }}>
      <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'48px', maxWidth:'480px', width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
        <h2 style={{ color:'#f1f5f9', fontSize:'24px', margin:'0 0 8px 0' }}>FAIM OBRAS</h2>
        <p style={{ color:'#94a3b8', marginBottom:'24px', fontSize:'14px' }}>Tu período de prueba ha vencido</p>
        <div style={{ background:'rgba(5,150,105,0.1)', border:'1px solid rgba(5,150,105,0.3)', borderRadius:'12px', padding:'24px', margin:'0 0 24px 0' }}>
          <p style={{ color:'#10b981', fontSize:'32px', fontWeight:'700', margin:'0 0 4px 0' }}>${(suscripcion?.precio_mensual||40000).toLocaleString('es-AR')}</p>
          <p style={{ color:'#6ee7b7', fontSize:'14px', margin:'0' }}>por mes · 2 usuarios incluidos</p>
        </div>
        <ul style={{ textAlign:'left', color:'#cbd5e1', fontSize:'14px', margin:'0 0 24px 0', paddingLeft:'20px' }}>
          <li style={{ marginBottom:'8px' }}>✅ Cotizador completo con catálogo actualizado</li>
          <li style={{ marginBottom:'8px' }}>✅ Certificados y control de avance</li>
          <li style={{ marginBottom:'8px' }}>✅ Panel financiero y Gantt</li>
          <li style={{ marginBottom:'8px' }}>✅ Múltiples presupuestos y clientes</li>
        </ul>
        <button onClick={handlePagar} disabled={loading} style={{ width:'100%', padding:'14px', background:loading?'#374151':'#059669', color:'white', border:'none', borderRadius:'8px', fontSize:'16px', fontWeight:'600', cursor:loading?'not-allowed':'pointer', marginBottom:'12px' }}>
          {loading ? 'Procesando...' : 'Suscribirme con MercadoPago'}
        </button>
        <button onClick={onLogout} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'13px' }}>Cerrar sesión</button>
      </div>
    </div>
  );
}

function TrialBanner({ diasRestantes }) {
  if (diasRestantes > 7) return null;
  return (
    <div style={{ background:diasRestantes<=2?'#dc2626':'#d97706', color:'white', textAlign:'center', padding:'8px', fontSize:'13px', fontWeight:'500' }}>
      ⚠️ Te {diasRestantes===1?'queda':'quedan'} <strong>{diasRestantes} día{diasRestantes!==1?'s':''}</strong> de prueba gratuita.
      {diasRestantes<=3 && ' Suscribite para no perder el acceso.'}
    </div>
  );
}

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
    try {
      const res = await fetch(`${API_URL}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
      if (res.ok) { const data = await res.json(); await login(data.token, data.usuario, data.tenant); navigate('/'); return; }
    } catch(e) {}
    try {
      const res = await fetch(`${API_URL}/admin/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
      if (res.ok) { const data = await res.json(); localStorage.setItem('obras_token',data.token); localStorage.setItem('obras_session',JSON.stringify({user:{email,rol:'superadmin'},isAdmin:true})); navigate('/'); return; }
    } catch(e) {}
    setError('Email o contraseña incorrectos');
    setLoading(false);
  };

  const inputStyle = { width:'100%', padding:'10px 12px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.15)', borderRadius:'8px', color:'#f1f5f9', fontSize:'14px', boxSizing:'border-box', outline:'none' };
  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif', padding:'20px' }}>
      <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:'16px', padding:'48px', maxWidth:'400px', width:'100%' }}>
        <h1 style={{ color:'#f1f5f9', fontSize:'28px', margin:'0 0 4px 0' }}>FAIM OBRAS</h1>
        <p style={{ color:'#64748b', fontSize:'13px', marginBottom:'32px' }}>Gestión para estudios y empresas</p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:'16px' }}>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'13px', marginBottom:'6px' }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inputStyle} />
          </div>
          <div style={{ marginBottom:'24px' }}>
            <label style={{ display:'block', color:'#94a3b8', fontSize:'13px', marginBottom:'6px' }}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={inputStyle} />
          </div>
          {error && <p style={{ color:'#f87171', fontSize:'13px', marginBottom:'16px', textAlign:'center' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width:'100%', padding:'12px', background:loading?'#374151':'#059669', color:'white', border:'none', borderRadius:'8px', fontSize:'15px', fontWeight:'600', cursor:loading?'not-allowed':'pointer' }}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [suscripcion, setSuscripcion] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const checkSuscripcion = async (token) => {
    try {
      const res = await fetch(`${API_URL}/suscripcion/estado`, { headers:{'Authorization':`Bearer ${token}`} });
      if (res.ok) { const data = await res.json(); setSuscripcion(data); return data; }
    } catch(e) { console.error('Subscription check failed:', e); }
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
      } catch(e) {
        localStorage.removeItem('obras_token');
        localStorage.removeItem('obras_session');
      }
      setLoadingAuth(false);
    };
    restore();
  }, []);

  const login = async (token, userData, tenantData) => {
    localStorage.setItem('obras_token', token);
    localStorage.setItem('obras_session', JSON.stringify({user:userData, tenant:tenantData, token}));
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

function AppContent() {
  const { user, suscripcion, loadingAuth, logout } = useAuth();

  if (loadingAuth) {
    return (
      <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ color:'#64748b', fontSize:'14px' }}>Verificando sesión...</div>
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
