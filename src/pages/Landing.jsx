import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Award, BarChart2, Calendar, Users, Building2 } from 'lucide-react';

const C = {
  bg: '#f8f9fa', surface: '#ffffff', surface2: '#f1f3f5',
  border: '#e0e0e8', border2: '#d0d0dc',
  text: '#1a1a2e', muted: '#6b7280',
  accent: '#059669', accent2: '#7c3aed',
  warn: '#d97706', green: '#10b981', blue: '#3b82f6',
};

const PRECIO_BASE = 57000;
const PRECIO_EXTRA = 7000;
const MAX_BASE = 2;

const features = [
  { icon: FileText, title: 'Cotizador profesional', desc: 'Presupuestos con análisis de costos, cómputo y coeficientes configurables. Catálogo de 524 ítems actualizado mensualmente.', color: C.accent2 },
  { icon: Award, title: 'Certificados de obra', desc: 'Certificados de avance vinculados al presupuesto. Gantt automático y curva de inversión incluidos.', color: C.accent },
  { icon: BarChart2, title: 'Control financiero', desc: 'Ingresos, egresos y personal por semana, quincena o mes. Resumen por obra y vinculación automática con certificados.', color: C.warn },
  { icon: Calendar, title: 'Planner integrado', desc: 'Tablero kanban de tareas vinculado al Gantt y presupuestos. Sincronización individual con Google Calendar.', color: C.blue },
  { icon: Users, title: 'Portal de clientes', desc: 'Tus clientes ven el avance de su obra y sus certificados en un portal con tu logo y tus colores.', color: C.accent2 },
  { icon: Building2, title: 'Tu identidad', desc: 'Logo, nombre y color propios. Cada presupuesto y certificado sale con la imagen de tu estudio.', color: C.green },
];

export default function Landing() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState(2);
  const precio = PRECIO_BASE + Math.max(0, usuarios - MAX_BASE) * PRECIO_EXTRA;

  const goApp = () => navigate('/');

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: "'Syne', sans-serif" }}>

      {/* NAV */}
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 48px', borderBottom: `1px solid ${C.border}`, background: C.surface, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.accent, letterSpacing: -0.5 }}>FAIM OBRAS</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <a href="#funcionalidades" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Funcionalidades</a>
          <a href="#precios" style={{ color: C.muted, textDecoration: 'none', fontSize: 14 }}>Precios</a>
          <button onClick={goApp} style={{ padding: '7px 18px', borderRadius: 8, border: `1px solid ${C.border2}`, color: C.muted, background: 'none', cursor: 'pointer', fontSize: 13, fontFamily: "'Syne', sans-serif" }}>Ingresar</button>
          <button onClick={goApp} style={{ padding: '7px 18px', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Crear cuenta →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ textAlign: 'center', padding: '80px 48px 64px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'inline-block', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 20, padding: '5px 16px', fontSize: 11, color: C.accent, marginBottom: 28, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px' }}>
          SOFTWARE PARA ESTUDIOS DE ARQUITECTURA E INGENIERÍA
        </div>
        <h1 style={{ fontSize: 'clamp(32px, 6vw, 60px)', fontWeight: 900, lineHeight: 1.1, margin: '0 auto 20px', maxWidth: 700, letterSpacing: -2, color: C.text }}>
          Gestioná tu estudio,<br />
          <span style={{ color: C.accent }}>sin complicaciones</span>
        </h1>
        <p style={{ fontSize: 16, color: C.muted, maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Presupuestos, certificados, control financiero y portal de clientes. Todo integrado, todo en la nube.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={goApp} style={{ padding: '13px 32px', borderRadius: 10, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
            Crear cuenta →
          </button>
          <a href="#funcionalidades" style={{ padding: '13px 32px', borderRadius: 10, border: `1px solid ${C.border2}`, color: C.muted, textDecoration: 'none', fontSize: 15, display: 'inline-flex', alignItems: 'center' }}>
            Ver funcionalidades
          </a>
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: C.muted }}>
          Suscripción mensual · Cancelás cuando quieras
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 48, padding: '28px 48px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap', background: C.surface2 }}>
        {[['524+', 'ítems en el catálogo'], ['100%', 'en la nube'], ['Multi', 'usuario'], ['Cloud', 'siempre actualizado']].map(([num, label]) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: C.accent, fontFamily: "'IBM Plex Mono', monospace" }}>{num}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <div id="funcionalidades" style={{ padding: '64px 48px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: 30, fontWeight: 800, marginBottom: 10, letterSpacing: -1, color: C.text }}>Todo lo que necesitás</h2>
        <p style={{ textAlign: 'center', color: C.muted, marginBottom: 44, fontSize: 15 }}>Un solo sistema para gestionar toda tu operación</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
          {features.map(f => {
            const Icon = f.icon;
            return (
              <div key={f.title}
                style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, transition: 'border-color 0.2s, box-shadow 0.2s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = f.color; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = 'none'; }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: f.color + '12', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <Icon size={20} strokeWidth={1.5} color={f.color} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: C.text }}>{f.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PRICING */}
      <div id="precios" style={{ padding: '64px 48px', textAlign: 'center', background: C.surface, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 10, letterSpacing: -1, color: C.text }}>Precio simple y transparente</h2>
        <p style={{ color: C.muted, marginBottom: 44, fontSize: 15 }}>Un solo plan con todo incluido. Calculá tu precio:</p>
        <div style={{ display: 'inline-block', background: C.surface, border: `2px solid ${C.accent}`, borderRadius: 16, padding: '36px 44px', maxWidth: 400, width: '100%', textAlign: 'left', boxShadow: '0 4px 24px rgba(5,150,105,0.08)' }}>
          <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '1px' }}>PLAN PROFESIONAL</div>
          <div style={{ fontSize: 44, fontWeight: 900, marginBottom: 4, letterSpacing: -2, color: C.text, fontFamily: "'IBM Plex Mono', monospace" }}>
            ${precio.toLocaleString('es-AR')}
          </div>
          <div style={{ color: C.muted, marginBottom: 28, fontSize: 13 }}>por mes · ARS · IVA no incluido</div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Cantidad de usuarios</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{usuarios}</span>
            </div>
            <input type="range" min="1" max="10" value={usuarios} onChange={e => setUsuarios(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: C.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginTop: 5 }}>
              <span>{MAX_BASE} usuarios incluidos</span>
              <span>+${PRECIO_EXTRA.toLocaleString('es-AR')}/usuario extra</span>
            </div>
          </div>
          {[
            'Cotizador ilimitado',
            'Certificados de obra',
            'Control financiero',
            'Planner + Google Calendar',
            'Portal de clientes',
            'Tu logo y marca',
            `${usuarios} usuario${usuarios !== 1 ? 's' : ''} incluido${usuarios !== 1 ? 's' : ''}`,
            'Soporte por WhatsApp',
          ].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ color: C.accent, fontWeight: 700, fontSize: 15 }}>✓</span>
              <span style={{ fontSize: 13, color: C.text }}>{item}</span>
            </div>
          ))}
          <button onClick={goApp} style={{ display: 'block', width: '100%', marginTop: 28, padding: '13px', borderRadius: 9, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
            Crear cuenta →
          </button>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 10, textAlign: 'center' }}>Suscripción mensual · Cancelás cuando quieras</div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '64px 48px', textAlign: 'center', background: C.bg }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 12, letterSpacing: -1, color: C.text }}>¿Listo para empezar?</h2>
        <p style={{ color: C.muted, marginBottom: 36, fontSize: 15 }}>Suscripción mensual, sin permanencia. Cancelás cuando quieras.</p>
        <button onClick={goApp} style={{ padding: '14px 44px', borderRadius: 12, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800, fontFamily: "'Syne', sans-serif", letterSpacing: -0.5 }}>
          Crear cuenta →
        </button>
      </div>

      {/* FOOTER */}
      <div style={{ textAlign: 'center', padding: '24px', borderTop: `1px solid ${C.border}`, color: C.muted, fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.3px', background: C.surface }}>
        © 2026 FAIM OBRAS · by FIMA Arquitectura · contacto.faimobras@gmail.com · Todos los derechos reservados
      </div>
    </div>
  );
}
