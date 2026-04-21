import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function Auth({ mode }) {
  const { login, API } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', nombre: '', estudio: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'register') {
        const res = await fetch(`${API}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            nombre_usuario: form.nombre,
            nombre_estudio: form.estudio,
            rubro: 'Arquitectura',
            ciudad: '',
            provincia: ''
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(Array.isArray(data.detail) ? data.detail.map(e => e.msg).join(', ') : (data.detail || 'Error al registrar'));
        // registro devuelve {token, tenant} sin usuario — construimos el user con el email
        const userData = { email: form.email, nombre: form.nombre, rol: 'admin' };
        login(userData, data.tenant, data.token);
        navigate('/onboarding');
      } else {
        const res = await fetch(`${API}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(Array.isArray(data.detail) ? data.detail.map(e => e.msg).join(', ') : (data.detail || 'Credenciales incorrectas'));
        // login devuelve {token, usuario, tenant}
        login(data.usuario, data.tenant, data.token);
        navigate('/app');
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid #2a2a3a', background: '#0f0f1a',
    color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12
  };

  return (
    <div style={{ background: '#0f0f1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#7c3aed', marginBottom: 8 }}>OBRAS</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#e2e8f0' }}>{mode === 'register' ? 'Crear cuenta' : 'Ingresar'}</div>
        </div>
        {mode === 'register' && <>
          <input placeholder="Tu nombre" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} style={inp} />
          <input placeholder="Nombre del estudio" value={form.estudio} onChange={e => setForm(f => ({ ...f, estudio: e.target.value }))} style={inp} />
        </>}
        <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} style={inp} />
        <input placeholder="Contraseña" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={inp}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', padding: '13px', borderRadius: 10, background: '#7c3aed', color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Cargando...' : mode === 'register' ? 'Crear cuenta' : 'Ingresar'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#64748b' }}>
          {mode === 'register'
            ? <>¿Ya tenés cuenta? <Link to="/login" style={{ color: '#a78bfa' }}>Ingresá</Link></>
            : <>¿No tenés cuenta? <Link to="/registro" style={{ color: '#a78bfa' }}>Registrate</Link></>}
        </div>
      </div>
    </div>
  );
}
