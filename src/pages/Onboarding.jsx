import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, authHeaders } from '../App';

export default function Onboarding() {
  const { API, tenant } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ color_primario: '#7c3aed', cuit: '', direccion: '', telefono: '' });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    await fetch(`${API}/tenant`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(form) });
    setLoading(false);
    navigate('/app');
  };

  const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #2a2a3a', background: '#0f0f1a', color: '#e2e8f0', fontSize: 14, boxSizing: 'border-box', marginBottom: 12 };

  return (
    <div style={{ background: '#0f0f1a', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 16, padding: 40, width: '100%', maxWidth: 480 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Configurá tu estudio</h2>
        <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>Estos datos aparecerán en tus presupuestos y documentos.</p>
        <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Color principal</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <input type="color" value={form.color_primario} onChange={e => setForm(f => ({ ...f, color_primario: e.target.value }))}
            style={{ width: 48, height: 40, borderRadius: 8, border: '1px solid #2a2a3a', background: 'none', cursor: 'pointer' }} />
          <span style={{ fontSize: 14, color: '#64748b' }}>{form.color_primario}</span>
        </div>
        <input placeholder="CUIT (opcional)" value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} style={inp} />
        <input placeholder="Dirección (opcional)" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} style={inp} />
        <input placeholder="Teléfono (opcional)" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} style={inp} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={() => navigate('/app')} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid #2a2a3a', background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>
            Omitir por ahora
          </button>
          <button onClick={handleSave} disabled={loading} style={{ flex: 2, padding: '12px', borderRadius: 10, background: '#7c3aed', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
            {loading ? 'Guardando...' : 'Guardar y entrar →'}
          </button>
        </div>
      </div>
    </div>
  );
}
