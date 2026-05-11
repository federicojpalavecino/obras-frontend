import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const C = {
  bg: '#0a0a14',
  surface: '#12121f',
  surface2: '#1a1a2e',
  border: '#2a2a3e',
  text: '#f0f0ff',
  muted: '#6b7280',
  accent: '#059669',
  purple: '#7c3aed',
  purpleLight: '#a78bfa',
};

export default function Landing() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState(2);
  const precio = 35000 + Math.max(0, usuarios - 2) * 8000;

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Syne', sans-serif" }}>

      {/* Nav */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 48px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: C.bg, zIndex: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, letterSpacing: -0.5 }}>FAIM OBRAS</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#precios" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Precios</a>
          <a href="#funcionalidades" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Funcionalidades</a>
          <button onClick={() => navigate('/')} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.border}`, color: C.muted, background: 'none', cursor: 'pointer', fontSize: 14, fontFamily: "'Syne', sans-serif" }}>Ingresar</button>
          <button onClick={() => navigate('/')} style={{ padding: '8px 20px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Empezar gratis →</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '100px 48px 80px' }}>
        <div style={{ display: 'inline-block', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 20, padding: '6px 18px', fontSize: 13, color: C.accent, marginBottom: 32, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px' }}>
          SOFTWARE PARA ESTUDIOS DE ARQUITECTURA E INGENIERÍA
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.1, marginBottom: 28, maxWidth: 800, margin: '0 auto 28px', letterSpacing: -2 }}>
          Gestioná tu estudio,<br />
          <span style={{ color: C.accent }}>sin complicaciones</span>
        </h1>
        <p style={{ fontSize: 18, color: C.muted, maxWidth: 540, margin: '0 auto 48px', lineHeight: 1.7 }}>
          Presupuestos profesionales, certificados de obra, control financiero y portal de clientes. Todo integrado.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/')} style={{ padding: '16px 36px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
            Empezar prueba gratuita →
          </button>
          <a href="#funcionalidades" style={{ padding: '16px 36px', borderRadius: 10, border: `1px solid ${C.border}`, color: C.muted, textDecoration: 'none', fontSize: 16, display: 'inline-flex', alignItems: 'center' }}>
            Ver funcionalidades
          </a>
        </div>
        <div style={{ marginTop: 20, fontSize: 13, color: C.muted }}>
          15 días de prueba gratuita · Sin tarjeta de crédito
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, padding: '40px 48px', borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        {[['524+', 'ítems en el catálogo'], ['100%', 'en la nube'], ['15 días', 'de prueba gratis'], ['2 usuarios', 'incluidos en el plan']].map(([num, label]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: C.accent }}>{num}</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div id="funcionalidades" style={{ padding: '80px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: -1 }}>Todo lo que necesitás</h2>
        <p style={{ textAlign: 'center', color: C.muted, marginBottom: 56, fontSize: 16 }}>Un solo sistema para gestionar toda tu operación</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {[
            { icon: '📋', title: 'Cotizador profesional', desc: 'Presupuestos con análisis de costos, cómputo métrico y coeficientes configurables. Catálogo de 524 ítems actualizado.', color: C.purple },
            { icon: '📜', title: 'Certificados de obra', desc: 'Certificados de avance vinculados al presupuesto. Exportá al cliente en un click.', color: C.accent },
            { icon: '💰', title: 'Control financiero', desc: 'Ingresos, egresos, personal y herramientas. Gestión semana a semana de tu empresa.', color: '#d97706' },
            { icon: '👥', title: 'Portal de clientes', desc: 'Tus clientes ven sus proyectos y presupuestos en un portal propio con tu marca.', color: '#2563eb' },
            { icon: '🎨', title: 'Tu identidad', desc: 'Personalizá con tu logo, nombre y colores. Cada documento sale con la imagen de tu estudio.', color: '#ec4899' },
            { icon: '👤', title: 'Multi-usuario', desc: 'Trabajá en equipo. Hasta 2 usuarios en el plan base, más usuarios disponibles.', color: C.accent },
          ].map(f => (
            <div key={f.title} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = f.color}
              onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>{f.icon}</div>
              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: C.text }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Video section */}
      <div style={{ padding: '80px 48px', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: -1 }}>¿Cómo funciona?</h2>
          <p style={{ color: C.muted, marginBottom: 48, fontSize: 16 }}>Tutoriales en video para arrancar desde el primer día</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '📋', title: 'Crear tu primer presupuesto', min: '3 min' },
              { icon: '💰', title: 'Control financiero básico', min: '4 min' },
              { icon: '👥', title: 'Configurar portal de clientes', min: '2 min' },
              { icon: '🎨', title: 'Personalizar tu marca', min: '2 min' },
            ].map(v => (
              <div key={v.title} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{v.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{v.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{v.min}</div>
                <div style={{ marginTop: 12, fontSize: 12, color: C.accent, fontWeight: 600 }}>▶ Ver tutorial</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, fontSize: 13, color: C.muted }}>
            Videos generados con IA · Próximamente disponibles
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div id="precios" style={{ padding: '80px 48px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: -1 }}>Precio simple y transparente</h2>
        <p style={{ color: C.muted, marginBottom: 56, fontSize: 16 }}>Un solo plan con todo incluido. Calculá tu precio:</p>

        {/* Price calculator */}
        <div style={{ display: 'inline-block', background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 20, padding: '48px 56px', maxWidth: 420, width: '100%' }}>
          <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginBottom: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px' }}>PLAN PROFESIONAL</div>

          <div style={{ fontSize: 56, fontWeight: 900, marginBottom: 4, letterSpacing: -2 }}>
            ${precio.toLocaleString('es-AR')}
          </div>
          <div style={{ color: C.muted, marginBottom: 32, fontSize: 14 }}>por mes · ARS</div>

          {/* User slider */}
          <div style={{ marginBottom: 32, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 14, color: C.muted }}>Cantidad de usuarios</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.accent }}>{usuarios}</span>
            </div>
            <input type="range" min="2" max="10" value={usuarios} onChange={e => setUsuarios(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: C.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.muted, marginTop: 6 }}>
              <span>2 usuarios (base)</span>
              <span>+$8.000/usuario extra</span>
            </div>
          </div>

          {['Cotizador ilimitado', 'Certificados de obra', 'Control financiero', 'Portal de clientes', 'Tu logo y marca', `${usuarios} usuarios incluidos`, 'Soporte incluido'].map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, textAlign: 'left' }}>
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 16 }}>✓</span>
              <span style={{ fontSize: 14 }}>{f}</span>
            </div>
          ))}

          <button onClick={() => navigate('/')} style={{ display: 'block', width: '100%', marginTop: 32, padding: '16px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
            Empezar 15 días gratis →
          </button>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 12 }}>Sin tarjeta de crédito requerida</div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '80px 48px', textAlign: 'center', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 36, fontWeight: 800, marginBottom: 16, letterSpacing: -1 }}>¿Listo para empezar?</h2>
        <p style={{ color: C.muted, marginBottom: 40, fontSize: 16 }}>15 días de prueba gratuita. Sin compromisos.</p>
        <button onClick={() => navigate('/')} style={{ padding: '18px 48px', borderRadius: 12, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, fontWeight: 800, fontFamily: "'Syne', sans-serif", letterSpacing: -0.5 }}>
          Crear cuenta gratis →
        </button>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '32px', borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: 13 }}>
        © 2026 FAIM OBRAS · Software para estudios profesionales de arquitectura e ingeniería
      </div>
    </div>
  );
}
