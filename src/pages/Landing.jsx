import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div style={{ background: '#0f0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: '1px solid #1a1a2e' }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#7c3aed' }}>OBRAS</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Link to="/login" style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #2a2a3a', color: '#94a3b8', textDecoration: 'none', fontSize: 14 }}>Ingresar</Link>
          <Link to="/registro" style={{ padding: '8px 20px', borderRadius: 8, background: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>Comenzar gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '80px 48px 60px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#a78bfa', marginBottom: 24 }}>
          Software para estudios de arquitectura e ingeniería
        </div>
        <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.15, marginBottom: 24, maxWidth: 800, margin: '0 auto 24px' }}>
          Gestioná tu estudio,<br />
          <span style={{ color: '#7c3aed' }}>sin complicaciones</span>
        </h1>
        <p style={{ fontSize: 18, color: '#64748b', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.6 }}>
          Presupuestos, certificados, control financiero y portal de clientes. Todo en un solo lugar.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
          <Link to="/registro" style={{ padding: '14px 32px', borderRadius: 10, background: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>
            Empezar ahora →
          </Link>
          <a href="#precios" style={{ padding: '14px 32px', borderRadius: 10, border: '1px solid #2a2a3a', color: '#94a3b8', textDecoration: 'none', fontSize: 16 }}>
            Ver precios
          </a>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '60px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 32, fontWeight: 700, marginBottom: 48 }}>Todo lo que necesitás</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            { icon: '📋', title: 'Cotizador profesional', desc: 'Presupuestos con análisis de costos, cómputo métrico y coeficientes configurables.' },
            { icon: '📜', title: 'Certificados de obra', desc: 'Certificados de avance y egresos vinculados al presupuesto.' },
            { icon: '💰', title: 'Control financiero', desc: 'Ingresos, egresos, personal y herramientas semana a semana.' },
            { icon: '🧾', title: 'Módulo fiscal', desc: 'Control impositivo para monotributo y responsable inscripto.' },
            { icon: '👥', title: 'Portal de clientes', desc: 'Tus clientes ven sus proyectos, presupuestos y pueden hacer consultas.' },
            { icon: '🎨', title: 'Tu marca', desc: 'Personalizá con tu logo y colores. Cada documento sale con tu identidad.' },
          ].map(f => (
            <div key={f.title} style={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div id="precios" style={{ padding: '60px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>Precio simple y transparente</h2>
        <p style={{ color: '#64748b', marginBottom: 48 }}>Un solo plan con todo incluido</p>
        <div style={{ display: 'inline-block', background: '#1a1a2e', border: '2px solid #7c3aed', borderRadius: 16, padding: '40px 48px', maxWidth: 380 }}>
          <div style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, marginBottom: 8 }}>PLAN PROFESIONAL</div>
          <div style={{ fontSize: 52, fontWeight: 800, marginBottom: 4 }}>$40.000</div>
          <div style={{ color: '#64748b', marginBottom: 8 }}>por mes · 2 usuarios incluidos</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 32 }}>+$5.000 por usuario adicional</div>
          {['Cotizador ilimitado', 'Certificados', 'Control financiero', 'Módulo fiscal', 'Portal de clientes', 'Tu logo y marca', 'Soporte incluido'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, textAlign: 'left' }}>
              <span style={{ color: '#7c3aed', fontWeight: 700 }}>✓</span>
              <span style={{ fontSize: 14 }}>{f}</span>
            </div>
          ))}
          <Link to="/registro" style={{ display: 'block', marginTop: 32, padding: '14px', borderRadius: 10, background: '#7c3aed', color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>
            Empezar ahora →
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px', borderTop: '1px solid #1a1a2e', color: '#374151', fontSize: 13 }}>
        © 2026 OBRAS · Software para estudios profesionales
      </div>
    </div>
  );
}
