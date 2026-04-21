import React, { useState, useEffect } from 'react';
import { useAuth, authHeaders } from '../../App';

export default function AdminPanel() {
  const { API } = useAuth();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, activos: 0, mrr: 0 });

  useEffect(() => {
    fetch(`${API}/admin/tenants`, { headers: authHeaders() })
      .then(r => r.json()).then(data => {
        setTenants(data);
        setStats({ total: data.length, activos: data.filter(t => t.activo).length, mrr: data.filter(t => t.activo).length * 40000 });
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const toggleTenant = async (id, activo) => {
    await fetch(`${API}/admin/tenants/${id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ activo: !activo }) });
    setTenants(ts => ts.map(t => t.id === id ? { ...t, activo: !activo } : t));
  };

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Cargando...</div>;

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>🔑 Panel de administración</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total cuentas', value: stats.total },
          { label: 'Cuentas activas', value: stats.activos },
          { label: 'MRR estimado', value: `$${stats.mrr.toLocaleString()}` },
        ].map(k => (
          <div key={k.label} style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{k.value}</div>
            <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a3a' }}>
              {['Estudio', 'Email admin', 'Usuarios', 'Estado', 'Acción'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>No hay cuentas registradas todavía</td></tr>
            ) : tenants.map(t => (
              <tr key={t.id} style={{ borderBottom: '1px solid #1e1e2e' }}>
                <td style={{ padding: '12px 16px', fontSize: 14 }}>{t.nombre}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>{t.admin_email}</td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{t.num_usuarios || 1}</td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: t.activo ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: t.activo ? '#4ade80' : '#f87171' }}>
                    {t.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <button onClick={() => toggleTenant(t.id, t.activo)}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #2a2a3a', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}>
                    {t.activo ? 'Suspender' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
