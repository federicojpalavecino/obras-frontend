import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://bomxksdisszrhhsctowd.supabase.co";
const SUPABASE_KEY = "sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const OBRAS_DEFAULT = ['Fima','Federico','Milagros'];
const SUPABASE_URL_CF = 'https://bomxksdisszrhhsctowd.supabase.co';
const SUPABASE_KEY_CF = 'sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2';
const ALBANILES = ['Luis','Nestor','Daniel Flores','Ale Flores','Jorge Charro'];
const RANGOS = ['Oficial','Ayudante','Sanitarista','Técnico A/A','Herrero'];
const COSTOS = {Oficial:4750,Ayudante:4250,Sanitarista:5000,'Técnico A/A':5500,Herrero:5000};
const HERRAM = ['Andamios','Ruedas de andamio','Hormigonera','Termofusora','Taladro','Laser','Escalera madera','Escalera metalica','Pala ancha','Pala de punta','Atornillador','Alargue','Reglas','Baldes'];

const fmt = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const fmtShort = (n) => {
  const v = Math.abs(Math.round(n || 0));
  if (v >= 1000000) return (n < 0 ? '-' : '') + '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (n < 0 ? '-' : '') + '$' + (v / 1000).toFixed(0) + 'k';
  return fmt(n);
};

const today = () => new Date().toISOString().split('T')[0];

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function getFriday() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -2 : 5 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
}

function emptyWeek() {
  const monday = getMonday();
  const friday = getFriday();
  return {
    fecha: monday,
    fecha_inicio: monday,
    fecha_fin: friday,
    ingresos: [],
    egresos: [],
    personal: [],
    herramientas: [],
    alimentacion_dias: { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 },
    config: { honorarios: [], pctColchon: 10 },
  };
}

function calcHonorario(resultado, hon) {
  if (!hon) return 0;
  if (hon.modo === 'monto') return parseFloat(hon.monto) || 0;
  const pct = parseFloat(hon.pct) || 0;
  return resultado > 0 ? resultado * pct / 100 : 0;
}

function calcWeek(week) {
  const totalIng = (week.ingresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalEg = (week.egresos || []).reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
  const totalPersonal = (week.personal || []).reduce((a, b) => a + (parseFloat(b.total) || 0), 0);
  const alim = Object.values(week.alimentacion_dias || {}).reduce((a, b) => a + (parseFloat(b) || 0), 0);
  const resultado = totalIng - totalEg - totalPersonal - alim;
  // Use honorarios from week.config (saved per semana)
  const honorariosActivos = week.config?.honorarios || [];
  const pctColchon = parseFloat(week.config?.pctColchon) || 0;
  const colchon = resultado > 0 ? resultado * pctColchon / 100 : 0;
  // Honorarios genéricos (array)
  const honorarios = honorariosActivos;
  const totalHonorarios = honorarios.reduce((sum, h) => sum + calcHonorario(resultado, h), 0);
  const ganancia = resultado - totalHonorarios - colchon;
  return { totalIng, totalEg, totalPersonal, alimentacion: alim, resultado, colchon, totalHonorarios, honorarios, ganancia };
}

export default function ControlFinanciero({ user, onLogout }) {
  const esArquitecto = user?.rol === "arquitecto";
  const [tab, setTab] = useState('carga');
  const [semanas, setSemanas] = useState([]);
  const [week, setWeek] = useState(emptyWeek());
  const [editingId, setEditingId] = useState(null);
  const editingIdRef = useRef(null);
  const setEditingIdSynced = (id) => { editingIdRef.current = id; setEditingId(id); };
  const [config, setConfig] = useState({
    honorarios: [
      { nombre: 'Honorario 1', pct: 15, monto: 0, modo: 'pct', activo: true },
      { nombre: 'Honorario 2', pct: 15, monto: 0, modo: 'pct', activo: true },
    ],
    pctColchon: 10, sheetsUrl: ''
  });
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(false);
  const [obras, setObras] = useState(OBRAS_DEFAULT);
  const [showCertEgresos, setShowCertEgresos] = useState(false);
  const [showImportCert, setShowImportCert] = useState(false);
  const [importCertTab, setImportCertTab] = useState('items');
  const [certDisponibles, setCertDisponibles] = useState([]);
  const [certEgresosDisponibles, setCertEgresosDisponibles] = useState([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [certEgresosObra, setCertEgresosObra] = useState('');
  const [certEgresosSeleccion, setCertEgresosSeleccion] = useState({});
  const [certFiltro, setCertFiltro] = useState(''); // búsqueda en modal import cert

  const weekLabel = w => {
    if (!w) return '';
    const di = new Date((w.fecha_inicio || w.fecha || '') + 'T12:00:00');
    const df = new Date((w.fecha_fin || w.fecha_inicio || w.fecha || '') + 'T12:00:00');
    if (di.toDateString() === df.toDateString()) return di.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    return di.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) + ' – ' + df.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  };

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    const cargarObras = async () => {
      try {
        // Cargar clientes desde Railway (backend) y obras desde Supabase
        const obrasSet = new Set(OBRAS_DEFAULT);
        // Clientes del sistema
        const resClientes = await fetch('https://fima-backend-production.up.railway.app/clientes');
        if (resClientes.ok) {
          const clientes = await resClientes.json();
          clientes.forEach(c => obrasSet.add(c.nombre));
        }
        // Obras de Supabase también
        const { data } = await sb.from('proyectos').select('nombre').eq('activo', true).order('nombre');
        if (data) data.forEach(p => obrasSet.add(p.nombre));
        setObras([...obrasSet].sort());
      } catch(e) {
        console.error('Error cargando obras:', e);
      }
    };
    cargarObras();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('fima-config');
    if (saved) setConfig(JSON.parse(saved));
    loadSemanas(true);
  }, []);

  const saveConfig = (cfg) => {
    setConfig(cfg);
    localStorage.setItem('fima-config', JSON.stringify(cfg));
  };

  const loadSemanas = async (loadCurrent = false) => {
    const { data, error } = await sb.from('semanas').select('*').order('fecha', { ascending: true });
    if (!error && data) {
      setSemanas(data);
      if (loadCurrent) {
        // Find semana for current week (not closed) - match by week range
        const monday = getMonday();
        const friday = getFriday();
        // First try exact match, then try any semana within current week
        let current = data.find(s => 
          (s.fecha_inicio === monday || s.fecha === monday) && !s.cerrada
        );
        if (!current) {
          // Find any non-closed semana whose fecha_inicio falls within the current week
          current = data.find(s => {
            if (s.cerrada) return false;
            const f = s.fecha_inicio || s.fecha || '';
            return f >= monday && f <= friday;
          });
        }
        if (!current) {
          // Find the most recent non-closed semana regardless of date
          const unclosed = data.filter(s => !s.cerrada);
          if (unclosed.length > 0) current = unclosed[unclosed.length - 1];
        }
        if (current) {
          setWeek({
            fecha: current.fecha || monday,
            fecha_inicio: current.fecha_inicio || current.fecha || monday,
            fecha_fin: current.fecha_fin || current.fecha || friday,
            ingresos: current.ingresos || [],
            egresos: current.egresos || [],
            personal: current.personal || [],
            herramientas: current.herramientas || [],
            alimentacion_dias: current.alimentacion_dias || { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 },
            config: current.config || config,
          });
          setEditingIdSynced(current.id);
        }
      }
    }
  };

  // Merge week.config with global config — honorarios from week take priority, fall back to config
  const configParaCalc = {
    ...(config || {}),
    ...(week.config || {}),
    honorarios: week.config?.honorarios?.length ? week.config.honorarios : (config.honorarios || []),
    pctColchon: week.config?.pctColchon ?? config.pctColchon ?? 10,
  };
  const calc = calcWeek({ ...week, config: configParaCalc });

  // ── IMPORTAR CERTIFICADO ──
  const abrirImportCert = async () => {
    setCertFiltro('');
    setLoadingCerts(true);
    setShowImportCert(true);
    setImportCertTab('items');
    try {
      const [resItems, resEg] = await Promise.all([
        fetch('https://fima-backend-production.up.railway.app/certificados/todos'),
        sb.from('cert_egresos').select('*').order('created_at', { ascending: false }),
      ]);
      const dataItems = await resItems.json();
      setCertDisponibles(dataItems || []);
      setCertEgresosDisponibles(resEg.data || []);
    } catch(e) { setCertDisponibles([]); setCertEgresosDisponibles([]); }
    setLoadingCerts(false);
  };

  const importarCertComoIngreso = (cert) => {
    const newIngreso = {
      concepto: 'Certificado N\u00BA ' + cert.numero + ' — ' + (cert.obra || ''),
      monto: String(Math.round(cert.total_periodo || 0)),
      estado: 'PENDIENTE',
      cliente: cert.cliente || '',
    };
    const newW = { ...week, ingresos: [...week.ingresos, newIngreso] };
    setWeek(newW);
    setTimeout(() => autoGuardar(newW), 300);
    setShowImportCert(false);
  };

  const importarCertEgresosComoIngreso = (ce) => {
    const label = ce.certificado_num ? (' — Cert. Nº ' + ce.certificado_num) : '';
    const newIngreso = {
      concepto: 'Egresos certificados' + label + ' — ' + (ce.obra || ''),
      monto: String(Math.round(ce.total || 0)),
      estado: 'PENDIENTE',
      cliente: ce.obra || '',
    };
    const newW = { ...week, ingresos: [...week.ingresos, newIngreso] };
    setWeek(newW);
    setTimeout(() => autoGuardar(newW), 300);
    setShowImportCert(false);
  };

  // ── INGRESOS ──
  const addIngreso = () => setWeek(w => {
    const newW = { ...w, ingresos: [...w.ingresos, { concepto: '', monto: '', estado: 'PENDIENTE', cliente: '', obra: '' }] };
    setTimeout(() => autoGuardar(newW), 300);
    return newW;
  });
  const updIngreso = (i, f, v) => setWeek(w => {
    const arr = [...w.ingresos];
    arr[i] = { ...arr[i], [f]: v };
    const newW = { ...w, ingresos: arr };
    clearTimeout(window._fimaSaveTimer);
    window._fimaSaveTimer = setTimeout(() => autoGuardar(newW), 1000);
    return newW;
  });
  const delIngreso = (i) => {
    const newWeek = { ...week, ingresos: week.ingresos.filter((_, j) => j !== i) };
    setWeek(newWeek);
    setTimeout(() => autoGuardar(newWeek), 300);
  };

  // ── EGRESOS ──
  const addEgreso = () => setWeek(w => {
    const newW = { ...w, egresos: [...w.egresos, { concepto: '', monto: '', estado: 'PENDIENTE', obra: '' }] };
    setTimeout(() => autoGuardar(newW), 300);
    return newW;
  });
  const updEgreso = (i, f, v) => setWeek(w => {
    const arr = [...w.egresos];
    arr[i] = { ...arr[i], [f]: v };
    const newW = { ...w, egresos: arr };
    clearTimeout(window._fimaSaveTimer);
    window._fimaSaveTimer = setTimeout(() => autoGuardar(newW), 1000);
    return newW;
  });
  const delEgreso = (i) => {
    const newWeek = { ...week, egresos: week.egresos.filter((_, j) => j !== i) };
    setWeek(newWeek);
    setTimeout(() => autoGuardar(newWeek), 300);
  };

  // ── PERSONAL ──
  const addPersonal = () => setWeek(w => {
    const newW = { ...w, personal: [...w.personal, { nombre: '', rango: '', dias: 5, hs: 8, costo: 0, total: 0, obra: '' }] };
    setTimeout(() => autoGuardar(newW), 300);
    return newW;
  });
  const updPersonal = (i, f, v) => setWeek(w => {
    const arr = [...w.personal];
    arr[i] = { ...arr[i], [f]: v };
    arr[i].total = (parseFloat(arr[i].dias) || 0) * (parseFloat(arr[i].hs) || 0) * (parseFloat(arr[i].costo) || 0);
    const newW = { ...w, personal: arr };
    clearTimeout(window._fimaSaveTimer);
    window._fimaSaveTimer = setTimeout(() => autoGuardar(newW), 1000);
    return newW;
  });
  const delPersonal = (i) => setWeek(w => {
    const newW = { ...w, personal: w.personal.filter((_, j) => j !== i) };
    setTimeout(() => autoGuardar(newW), 300);
    return newW;
  });

  // ── HERRAMIENTAS ──
  const addHerramienta = () => setWeek(w => ({ ...w, herramientas: [...w.herramientas, { nombre: '', cantidad: 1, obra: '', propietario: '', fechaIn: '', fechaEx: '' }] }));
  const updHerramienta = (i, f, v) => setWeek(w => { const arr = [...w.herramientas]; arr[i] = { ...arr[i], [f]: v }; return { ...w, herramientas: arr }; });
  const delHerramienta = (i) => setWeek(w => ({ ...w, herramientas: w.herramientas.filter((_, j) => j !== i) }));

  // ── GUARDAR ──
  // Auto-save current week state to Supabase on every change
  const autoGuardar = async (weekData) => {
    const c = calcWeek({ ...weekData, config: weekData.config || config });
    const data = {
      fecha: weekData.fecha,
      fecha_inicio: weekData.fecha_inicio || weekData.fecha,
      fecha_fin: weekData.fecha_fin || weekData.fecha,
      ingresos: weekData.ingresos,
      egresos: weekData.egresos,
      personal: weekData.personal,
      herramientas: weekData.herramientas,
      alimentacion_dias: weekData.alimentacion_dias,
      alimentacion: c.alimentacion,
      config: { ...(config || {}), ...(weekData.config || {}), honorarios: (weekData.config?.honorarios?.length ? weekData.config.honorarios : (config.honorarios || [])), pctColchon: weekData.config?.pctColchon ?? config.pctColchon ?? 10 },
      totalIng: c.totalIng,
      totalEg: c.totalEg,
      totalPersonal: c.totalPersonal,
      resultado: c.resultado,
      honFede: c.honFede,
      honMili: c.honMili,
      colchon: c.colchon,
      ganancia: c.ganancia,
      updated_by: user?.email,
    };
    // Use editingId ref if available, otherwise query DB directly
    if (editingIdRef.current) {
      await sb.from('semanas').update({ ...data, updated_by: user?.email }).eq('id', editingIdRef.current);
    } else {
      // Check DB directly for existing semana this week
      const monday = weekData.fecha_inicio || weekData.fecha;
      // Try matching by fecha_inicio first, then by fecha
      let existing = null;
      const { data: ex1 } = await sb.from('semanas').select('id').eq('fecha_inicio', monday).maybeSingle();
      if (ex1?.id) {
        existing = ex1;
      } else {
        const { data: ex2 } = await sb.from('semanas').select('id').eq('fecha', monday).maybeSingle();
        if (ex2?.id) existing = ex2;
      }
      if (existing?.id) {
        await sb.from('semanas').update({ ...data, updated_by: user?.email }).eq('id', existing.id);
        setEditingIdSynced(existing.id);
      } else {
        const { data: inserted } = await sb.from('semanas').insert({ ...data, created_by: user?.email }).select().single();
        if (inserted?.id) setEditingIdSynced(inserted.id);
      }
    }
    loadSemanas();
  };

  const guardar = async () => {
    setLoading(true);
    const c = calcWeek({ ...week, config: week.config || config });
    const data = {
      fecha: week.fecha,
      fecha_inicio: week.fecha_inicio || week.fecha,
      fecha_fin: week.fecha_fin || week.fecha,
      ingresos: week.ingresos,
      egresos: week.egresos,
      personal: week.personal,
      herramientas: week.herramientas,
      alimentacion_dias: week.alimentacion_dias,
      alimentacion: c.alimentacion,
      config: week.config || config,
      totalIng: c.totalIng,
      totalEg: c.totalEg,
      totalPersonal: c.totalPersonal,
      resultado: c.resultado,
      honFede: c.honFede,
      honMili: c.honMili,
      colchon: c.colchon,
      ganancia: c.ganancia,
      created_by: user?.email,
      updated_by: user?.email,
    };
    let error;
    if (editingId) {
      ({ error } = await sb.from('semanas').update({ ...data, updated_by: user?.email }).eq('id', editingId));
    } else {
      const existing = semanas.find(s => s.fecha === week.fecha);
      if (existing) {
        ({ error } = await sb.from('semanas').update({ ...data, updated_by: user?.email }).eq('id', existing.id));
      } else {
        ({ error } = await sb.from('semanas').insert(data));
      }
    }
    setLoading(false);
    if (error) { showToast('Error al guardar'); return; }
    showToast('✓ Semana guardada');
    setEditingIdSynced(null);
    setWeek(emptyWeek());
    loadSemanas();
  };

  const editSemana = (s) => {
    setWeek({
      fecha: s.fecha,
      fecha_inicio: s.fecha_inicio || s.fecha,
      fecha_fin: s.fecha_fin || s.fecha,
      ingresos: s.ingresos || [],
      egresos: s.egresos || [],
      personal: s.personal || [],
      herramientas: s.herramientas || [],
      alimentacion_dias: s.alimentacion_dias || { lunes: 0, martes: 0, miercoles: 0, jueves: 0, viernes: 0 },
      config: s.config || config,
    });
    setEditingId(s.id);
    setTab('carga');
    showToast('📝 Editando semana del ' + new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }));
  };

  const deleteSemana = async (s) => {
    if (!window.confirm('¿Eliminar esta semana?')) return;
    await sb.from('semanas').delete().eq('id', s.id);
    showToast('✓ Semana eliminada');
    loadSemanas();
  };

  const s = {
    bg: '#f8f9fa', surface: '#ffffff', surface2: '#f1f3f5', surface3: '#e9ecef',
    border: 'rgba(0,0,0,0.1)', text: '#1a1a2e', text2: '#6b7280', text3: '#9ca3af',
    green: '#059669', red: '#ef4444', amber: '#d97706', accent: '#7c3aed', accent2: '#5b21b6',
  };

  const inp = { background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none' };
  const sel = { ...inp };
  const btn = (primary) => ({
    padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: primary ? 600 : 500,
    cursor: 'pointer', border: `1px solid ${primary ? s.accent : s.border}`,
    background: primary ? s.accent : 'transparent', color: primary ? '#ffffff' : s.text,
    fontFamily: 'inherit',
  });

  const printCertEgresos = (obra, egresos) => {
    const now = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const egSel = egresos.filter(e => certEgresosSeleccion[e._key]);
    const total = egSel.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Cert. Egresos — ${obra}</title><style>
      body{font-family:Arial,sans-serif;font-size:11pt;color:#222;padding:24px}
      h1{font-size:18pt;margin:0}h2{font-size:10pt;color:#666;margin:4px 0 20px}
      table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10pt}
      th{background:#2D4A3E;color:#fff;padding:6px 8px;text-align:left}
      td{padding:7px 8px;border-bottom:1px solid #eee}
      .r{text-align:right}.total{font-weight:700;background:#f5f5f5;font-size:12pt}
      footer{margin-top:30px;font-size:9pt;color:#aaa;display:flex;justify-content:space-between;border-top:1px solid #eee;padding-top:8px}
    </style></head><body>
    <h1>FIMA — Estudio de Arquitectura</h1>
    <h2>Certificado de Egresos / Materiales · Obra: ${obra} · ${now}</h2>
    <table>
      <thead><tr><th>Concepto</th><th class="r">Monto</th><th>Semana</th></tr></thead>
      <tbody>
        ${egSel.map(e => `<tr><td>${e.concepto || '—'}</td><td class="r">$${Math.round(parseFloat(e.monto)||0).toLocaleString('es-AR')}</td><td>${e._semana || '—'}</td></tr>`).join('')}
        <tr class="total"><td>Total</td><td class="r">$${Math.round(total).toLocaleString('es-AR')}</td><td></td></tr>
      </tbody>
    </table>
    <footer><span>FIMA — Estudio de Arquitectura</span><span>Emitido el ${now}</span></footer>
    </body></html>`);
    win.document.close();
    win.print();
  };

  // Agrupar egresos de la semana actual por obra
  const egresosAgrupados = () => {
    const grupos = {};
    (week.egresos || []).forEach((e, i) => {
      const obra = e.obra || 'Sin obra';
      if (!grupos[obra]) grupos[obra] = [];
      grupos[obra].push({ ...e, _key: i, _semana: weekLabel(week) });
    });
    return grupos;
  };

  return (
    <div style={{ background: s.bg, color: s.text, minHeight: '100vh', fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      {/* TABS */}
      <div style={{ position: 'sticky', top: 64, background: s.surface, borderBottom: `1px solid ${s.border}`, display: 'flex', zIndex: 40 }}>
        {[['carga', '✏️', 'Carga'], ['obras', '🏗️', 'Obras'], ['dashboard', '📊', 'Dashboard'], ['historial', '📋', 'Historial'], ['config2', '⚙️', 'Config']].map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: '12px 8px', background: 'none', border: 'none', cursor: 'pointer', color: tab === id ? s.accent : s.text3, borderBottom: `2px solid ${tab === id ? s.accent : 'transparent'}`, fontSize: 12, fontFamily: 'inherit' }}>
            <div style={{ fontSize: 18 }}>{icon}</div>{label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16, maxWidth: 700, margin: '0 auto' }}>

        {/* ── CARGA ── */}
        {tab === 'carga' && (
          <div>
            {/* Week bar */}
            <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 12, padding: '14px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 600 }}>
                  {new Date(week.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                {editingId && <div style={{ fontSize: 11, color: s.amber, marginTop: 2 }}>Editando semana existente</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: s.text2 }}>Del</span>
                  <input type="date" value={week.fecha_inicio || week.fecha} 
                    onChange={e => setWeek(w => ({ ...w, fecha_inicio: e.target.value, fecha: e.target.value }))} 
                    style={{ ...inp, width: 'auto' }} />
                  <span style={{ fontSize: 11, color: s.text2 }}>al</span>
                  <input type="date" value={week.fecha_fin || week.fecha} 
                    onChange={e => setWeek(w => ({ ...w, fecha_fin: e.target.value }))} 
                    style={{ ...inp, width: 'auto' }} />
                </div>
                {editingId && <button onClick={() => { setEditingId(null); setWeek(emptyWeek()); }} style={{ ...btn(false), fontSize: 12, padding: '6px 12px', color: s.amber }}>Cancelar edición</button>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <span style={{ fontSize: 13, color: s.text2 }}>Colchón esta semana:</span>
                  <input type="number" min="0" max="100" step="1"
                    style={{ width: 64, padding: '6px 10px', background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, fontSize: 13, fontFamily: 'DM Mono, monospace', textAlign: 'right' }}
                    value={week.config?.pctColchon ?? config.pctColchon ?? 10}
                    onChange={e => {
                      const newW = { ...week, config: { ...(week.config || config), pctColchon: parseFloat(e.target.value) || 0 } };
                      setWeek(newW);
                      clearTimeout(window._fimaSaveTimer);
                      window._fimaSaveTimer = setTimeout(() => autoGuardar(newW), 1000);
                    }} />
                  <span style={{ color: s.text2 }}>%</span>
                </div>
              </div>
            </div>

            {!esArquitecto && <Card title="Ingresos" s={s} accent="#059669" borderColor="rgba(5,150,105,0.15)" count={week.ingresos?.length} total={fmt(calc.totalIng)} totalColor={s.green}>
              <AddBtn onClick={addIngreso}>+ Agregar ingreso</AddBtn>
              <AddBtn onClick={abrirImportCert} style={{ background: 'rgba(110,231,183,.08)', border: '1px solid rgba(110,231,183,.25)', color: 'var(--accent)' }}>📋 Importar certificado</AddBtn>
              {[...week.ingresos].reverse().map((ing, _i) => { const i = week.ingresos.length - 1 - _i; return (
                <EntryRow key={"ing-" + i} num={i + 1} onDel={() => delIngreso(i)} s={s}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Concepto"><input style={inp} value={ing.concepto} onChange={e => updIngreso(i, 'concepto', e.target.value)} placeholder="Descripción" /></Field>
                    <Field label="Monto"><input style={inp} type="number" value={ing.monto} onChange={e => updIngreso(i, 'monto', e.target.value)} placeholder="0" /></Field>
                    <Field label="Estado">
                      <select style={sel} value={ing.estado} onChange={e => updIngreso(i, 'estado', e.target.value)}>
                        {['PENDIENTE', 'PAGADO', 'PARCIAL'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Cliente">
                      <select style={sel} value={ing.cliente} onChange={e => updIngreso(i, 'cliente', e.target.value)}>
                        <option value="">—</option>
                        {obras.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>
                </EntryRow>
              ); })}
              <TotalLine label="Total ingresos" val={fmt(calc.totalIng)} color={s.green} main />
            </Card>}

            {/* Egresos */}
            <Card title="Egresos de materiales y gastos" s={s} accent="#ef4444" borderColor="rgba(239,68,68,0.15)" count={week.egresos?.length} total={fmt(calc.totalEg)} totalColor={s.red}>
              <AddBtn onClick={addEgreso}>+ Agregar egreso</AddBtn>
              {[...week.egresos].reverse().map((eg, _i) => { const i = week.egresos.length - 1 - _i; return (
                <EntryRow key={`eg-${i}`} num={i + 1} onDel={() => delEgreso(i)} s={s}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Concepto"><input style={inp} value={eg.concepto} onChange={e => updEgreso(i, 'concepto', e.target.value)} placeholder="Descripción" /></Field>
                    <Field label="Monto"><input style={inp} type="number" value={eg.monto} onChange={e => updEgreso(i, 'monto', e.target.value)} placeholder="0" /></Field>
                    <Field label="Estado">
                      <select style={sel} value={eg.estado} onChange={e => updEgreso(i, 'estado', e.target.value)}>
                        {['PENDIENTE', 'PAGADO', 'PARCIAL'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Obra">
                      <select style={sel} value={eg.obra} onChange={e => updEgreso(i, 'obra', e.target.value)}>
                        <option value="">—</option>
                        {obras.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>
                </EntryRow>
              ); })}
              <TotalLine label="Total egresos" val={fmt(calc.totalEg)} color={s.red} main />
            </Card>

            {/* Personal */}
            <Card title="Personal" s={s} accent="#7c3aed" borderColor="rgba(124,58,237,0.15)" count={week.personal?.length} total={!esArquitecto ? fmt(calc.totalPersonal) : undefined} totalColor="#7c3aed">
              <AddBtn onClick={addPersonal}>+ Agregar personal</AddBtn>
              {[...week.personal].reverse().map((p, _i) => { const i = week.personal.length - 1 - _i; return (
                <EntryRow key={i} num={i + 1} onDel={() => delPersonal(i)} s={s}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <Field label="Nombre">
                      <input style={inp} value={p.nombre} onChange={e => updPersonal(i, 'nombre', e.target.value)} placeholder="Nombre" list={`albaniles-list-${i}`} />
                      <datalist id={`albaniles-list-${i}`}>{ALBANILES.map(o => <option key={o} value={o} />)}</datalist>
                    </Field>
                    <Field label="Rango">
                      <input style={inp} value={p.rango} onChange={e => updPersonal(i, 'rango', e.target.value)} placeholder="Rango" list={`rangos-list-${i}`} />
                      <datalist id={`rangos-list-${i}`}>{RANGOS.map(o => <option key={o} value={o} />)}</datalist>
                    </Field>
                    <Field label="Días"><input style={inp} type="number" value={p.dias} onChange={e => updPersonal(i, 'dias', e.target.value)} /></Field>
                    <Field label="Hs/día"><input style={inp} type="number" value={p.hs} onChange={e => updPersonal(i, 'hs', e.target.value)} /></Field>
                    {!esArquitecto && <Field label="$/hora"><input style={inp} type="number" value={p.costo} onChange={e => updPersonal(i, 'costo', e.target.value)} /></Field>}
                    {!esArquitecto && <Field label="Total"><input style={{ ...inp, color: s.text2 }} readOnly value={fmt(p.total || 0)} /></Field>}
                    <Field label="Obra" style={{ gridColumn: '1 / -1' }}>
                      <select style={sel} value={p.obra || ''} onChange={e => updPersonal(i, 'obra', e.target.value)}>
                        <option value="">— Sin asignar</option>
                        {obras.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>
                </EntryRow>
              ); })}
              {!esArquitecto && <TotalLine label="Total personal" val={fmt(calc.totalPersonal)} main />}
            </Card>

            {/* Herramientas */}
            <Card title="Herramientas alquiladas" s={s} accent="#d97706" borderColor="rgba(217,119,6,0.15)" count={week.herramientas?.length}>
              {week.herramientas.map((h, i) => (
                <EntryRow key={i} num={i + 1} onDel={() => delHerramienta(i)} s={s}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Herramienta">
                      <select style={sel} value={h.nombre} onChange={e => updHerramienta(i, 'nombre', e.target.value)}>
                        <option value="">—</option>
                        {HERRAM.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Cantidad"><input style={inp} type="number" value={h.cantidad} onChange={e => updHerramienta(i, 'cantidad', e.target.value)} /></Field>
                    <Field label="Obra">
                      <select style={sel} value={h.obra} onChange={e => updHerramienta(i, 'obra', e.target.value)}>
                        <option value="">—</option>
                        {obras.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </Field>
                    <Field label="Propietario"><input style={inp} value={h.propietario} onChange={e => updHerramienta(i, 'propietario', e.target.value)} /></Field>
                    <Field label="Fecha entrada"><input style={inp} type="date" value={h.fechaIn} onChange={e => updHerramienta(i, 'fechaIn', e.target.value)} /></Field>
                    <Field label="Fecha salida"><input style={inp} type="date" value={h.fechaEx} onChange={e => updHerramienta(i, 'fechaEx', e.target.value)} /></Field>
                  </div>
                </EntryRow>
              ))}
              <AddBtn onClick={addHerramienta}>+ Agregar herramienta</AddBtn>
            </Card>

            {/* Alimentación */}
            <Card title="Alimentación" s={s} defaultOpen={true}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {['lunes', 'martes', 'miercoles', 'jueves', 'viernes'].map(d => (
                  <Field key={d} label={d.charAt(0).toUpperCase() + d.slice(1)}>
                    <input style={inp} type="number" value={week.alimentacion_dias[d] || ''} onChange={e => setWeek(w => ({ ...w, alimentacion_dias: { ...w.alimentacion_dias, [d]: e.target.value } }))} placeholder="0" />
                  </Field>
                ))}
              </div>
              <TotalLine label="Total alimentación" val={fmt(calc.alimentacion)} main />
            </Card>

            {/* Resultado */}
            <div style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 20, padding: 20, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: 10, color: s.text3, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 16 }}>Resultado y distribución de la semana</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 36, fontWeight: 700, color: calc.resultado >= 0 ? s.green : s.red, marginBottom: 4 }}>{fmt(calc.resultado)}</div>
              <div style={{ fontSize: 12, color: s.text2, marginBottom: 20 }}>Ingresos − (Egresos + Personal + Alimentación)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Honorarios — editables por semana */}
                {(week.config?.honorarios?.length ? week.config.honorarios : config.honorarios || []).map((h, idx) => {
                  const val = calcHonorario(calc.resultado, h);
                  const pctCalc = calc.resultado > 0 && val > 0 ? (val / calc.resultado * 100).toFixed(1) : '0';
                  const updHon = (field, value) => {
                    const base = week.config?.honorarios?.length ? week.config.honorarios : (config.honorarios || []);
                    const arr = base.map((item, i) => i === idx ? { ...item, [field]: value } : item);
                    const newW = { ...week, config: { ...(week.config || {}), honorarios: arr } };
                    setWeek(newW);
                    clearTimeout(window._fimaSaveTimer);
                    window._fimaSaveTimer = setTimeout(() => autoGuardar(newW), 1000);
                  };
                  return (
                    <div key={idx} style={{ padding: '10px 0', borderBottom: `1px solid ${s.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, color: s.text, fontWeight: 600 }}>{h.nombre || ('Honorario ' + (idx + 1))}</div>
                        <div style={{ fontSize: 14, color: s.green, fontFamily: 'DM Mono, monospace', fontWeight: 700 }}>{fmt(val)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Toggle % / $ */}
                        <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: `1px solid ${s.border}` }}>
                          {['pct', 'monto'].map(m => (
                            <button key={m} onClick={() => updHon('modo', m)}
                              style={{ padding: '5px 12px', fontSize: 12, border: 'none', cursor: 'pointer', background: h.modo === m ? s.green : s.surface2, color: h.modo === m ? '#fff' : s.text3, fontFamily: 'inherit', fontWeight: h.modo === m ? 700 : 400 }}>
                              {m === 'pct' ? '%' : '$'}
                            </button>
                          ))}
                        </div>
                        {h.modo === 'monto' ? (
                          <>
                            <input type="number" placeholder="Monto fijo"
                              style={inp}
                              value={h.monto || ''} onChange={e => updHon('monto', parseFloat(e.target.value) || 0)} />
                            <span style={{ fontSize: 11, color: s.text3, whiteSpace: 'nowrap' }}>{pctCalc}% del res.</span>
                          </>
                        ) : (
                          <>
                            <input type="number" placeholder="%" min="0" max="100" step="0.1"
                              style={{ ...inp, width: 80, flexShrink: 0 }}
                              value={h.pct || ''} onChange={e => updHon('pct', parseFloat(e.target.value) || 0)} />
                            <span style={{ fontSize: 12, color: s.text3 }}>%</span>
                            <span style={{ fontSize: 12, color: s.green, fontFamily: 'DM Mono, monospace', marginLeft: 4 }}>{fmt(val)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Colchón */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${s.border}` }}>
                  <div style={{ fontSize: 13, color: s.text2 }}>Colchón / reserva</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, fontWeight: 600, color: s.amber }}>{fmt(calc.colchon)}</div>
                </div>
                {/* Ganancia neta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.text }}>Ganancia neta</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 700, color: calc.ganancia >= 0 ? s.green : s.red }}>{fmt(calc.ganancia)}</div>
                </div>
              </div>
            </div>

            <button onClick={() => { setCertEgresosObra(''); setCertEgresosSeleccion({}); setShowCertEgresos(true); }}
              style={{ ...btn(false), width: '100%', padding: 12, marginBottom: 8, fontSize: 13 }}>
              📄 Emitir certificado de egresos
            </button>

            <div style={{ fontSize: 11, color: s.text3, textAlign: 'center', marginBottom: 6 }}>
              Los cambios se guardan automáticamente · Guardar semana para cerrarla
            </div>
            <button onClick={guardar} disabled={loading} style={{ ...btn(true), width: '100%', padding: 14, fontSize: 15, fontFamily: 'Syne, sans-serif', letterSpacing: '.02em', marginBottom: 12 }}>
              {loading ? 'Guardando...' : editingId ? 'Cerrar semana' : 'Guardar semana'}
            </button>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {tab === 'obras' && <PorObra semanas={semanas} obras={obras} s={s} fmt={fmt} fmtShort={fmtShort} />}

        {tab === 'dashboard' && <Dashboard semanas={semanas} s={s} fmt={fmt} fmtShort={fmtShort} />}

        {/* ── HISTORIAL ── */}
        {tab === 'historial' && (
          <div>
            {semanas.length === 0 && <div style={{ textAlign: 'center', color: s.text3, padding: 40 }}>No hay semanas guardadas aún</div>}
            {[...semanas].reverse().map((sem) => {
              const eg = (sem.totalEg || 0) + (sem.totalPersonal || 0) + (sem.alimentacion || 0);
              const d = new Date(sem.fecha + 'T12:00:00');
              const updBy = sem.updated_by ? `Editado por ${sem.updated_by.split('@')[0]}` : `Creado por ${(sem.created_by || '—').split('@')[0]}`;
              return (
                <div key={sem.id} style={{ background: s.surface, border: `1px solid ${s.border}`, borderRadius: 10, padding: 14, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'Syne, sans-serif' }}>{d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'long' })}</div>
                      <div style={{ fontSize: 11, color: s.text3, marginTop: 4 }}>{updBy}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: (sem.resultado || 0) >= 0 ? s.green : s.red }}>{fmtShort(sem.resultado || 0)}</div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 4 }}>
                        <button onClick={() => editSemana(sem)} style={{ fontSize: 11, color: s.accent2, background: 'none', border: `1px solid ${s.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => exportarSemanaSheets(sem, config, showToast)} style={{ fontSize: 11, color: s.green, background: 'none', border: `1px solid rgba(5,150,105,.3)`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>📥 Excel</button>
                        <button onClick={() => deleteSemana(sem)} style={{ fontSize: 11, color: s.red, background: 'none', border: `1px solid rgba(224,112,96,.3)`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Eliminar</button>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: s.text2 }}>
                    <span>Ing: <span style={{ color: s.green }}>{fmtShort(sem.totalIng || 0)}</span></span>
                    <span>Eg: <span style={{ color: s.red }}>{fmtShort(eg)}</span></span>
                    <span>Colchón: <span style={{ color: s.amber }}>{fmtShort(sem.colchon || 0)}</span></span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── CONFIG ── */}
        {tab === 'config2' && (
          <div>
            <Card title="Distribución del resultado" s={s} defaultOpen={true}>
              <div style={{ fontSize: 12, color: s.text3, marginBottom: 12 }}>
                Configurá los nombres de los honorarios. Los % o montos se cargan semana a semana en la sección de carga.
              </div>
              {(config.honorarios || []).map((h, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${s.border}` }}>
                  <input style={{ flex: 1, padding: '6px 10px', background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, fontSize: 13, fontFamily: 'inherit' }}
                    placeholder={"Honorario " + (idx + 1)} value={h.nombre || ''} onChange={e => { const arr = [...config.honorarios]; arr[idx] = { ...arr[idx], nombre: e.target.value }; saveConfig({ ...config, honorarios: arr }); }} />
                  <button onClick={() => { const arr = config.honorarios.filter((_, i) => i !== idx); saveConfig({ ...config, honorarios: arr }); }}
                    style={{ background: 'none', border: 'none', color: s.red, cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
                </div>
              ))}
              <button onClick={() => saveConfig({ ...config, honorarios: [...(config.honorarios || []), { nombre: '', pct: 0, monto: 0, modo: 'pct' }] })}
                style={{ width: '100%', padding: '8px 0', marginTop: 8, background: 'none', border: `1px dashed ${s.border}`, borderRadius: 8, color: s.text3, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                + Agregar honorario
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${s.border}`, marginTop: 12 }}>
                <div style={{ fontSize: 14 }}>Colchón / reserva %</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="number" style={{ width: 60, padding: '6px 10px', background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, fontSize: 14, fontFamily: 'DM Mono, monospace', textAlign: 'right' }}
                    value={config.pctColchon || 0} onChange={e => saveConfig({ ...config, pctColchon: parseFloat(e.target.value) || 0 })} />
                  <span style={{ color: s.text2 }}>%</span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: s.text3, textAlign: 'center', marginTop: 8 }}>Los valores se ingresan semana a semana en la sección Carga</div>
            </Card>
            <Card title="Exportar a Google Sheets" s={s} defaultOpen={true}>
              <Field label="URL del script">
                <input style={inp} type="text" value={config.sheetsUrl || ''} onChange={e => saveConfig({ ...config, sheetsUrl: e.target.value })} placeholder="https://script.google.com/macros/s/..." />
              </Field>
              <button onClick={() => exportToSheets(semanas, config, showToast)} style={{ ...btn(true), width: '100%', marginTop: 12 }}>📤 Exportar todas las semanas a Sheets</button>
            </Card>
          </div>
        )}
      </div>

      {/* TOAST */}
      {/* MODAL CERTIFICADO DE EGRESOS */}
      {showCertEgresos && (() => {
        const grupos = egresosAgrupados();
        const obras = Object.keys(grupos);
        const obraActual = certEgresosObra || obras[0] || '';
        const egresosObra = grupos[obraActual] || [];
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: s.surface, borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', maxHeight: '85vh', overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700 }}>Certificado de egresos</div>
                <button onClick={() => setShowCertEgresos(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.text2, fontSize: 20 }}>×</button>
              </div>

              {obras.length === 0 ? (
                <div style={{ textAlign: 'center', color: s.text3, padding: 20 }}>No hay egresos con obra asignada</div>
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: s.text2, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Agrupar por obra</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {obras.map(o => (
                        <button key={o} onClick={() => { setCertEgresosObra(o); setCertEgresosSeleccion({}); }}
                          style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${obraActual === o ? s.accent : s.border}`, background: obraActual === o ? 'rgba(110,231,183,.12)' : 'transparent', color: obraActual === o ? s.accent : s.text2, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {o}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: s.text2, textTransform: 'uppercase', letterSpacing: '.05em' }}>Egresos — {obraActual}</div>
                      <button onClick={() => {
                        const all = {};
                        egresosObra.forEach(e => { all[e._key] = true; });
                        setCertEgresosSeleccion(all);
                      }} style={{ fontSize: 11, color: s.accent, background: 'none', border: 'none', cursor: 'pointer' }}>Seleccionar todos</button>
                    </div>
                    {egresosObra.map(e => (
                      <div key={e._key} onClick={() => setCertEgresosSeleccion(s => ({ ...s, [e._key]: !s[e._key] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: certEgresosSeleccion[e._key] ? 'rgba(110,231,183,.08)' : s.surface2, border: `1px solid ${certEgresosSeleccion[e._key] ? 'rgba(110,231,183,.3)' : s.border}`, cursor: 'pointer' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${certEgresosSeleccion[e._key] ? s.accent : s.border}`, background: certEgresosSeleccion[e._key] ? s.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#f8f9fa', flexShrink: 0 }}>
                          {certEgresosSeleccion[e._key] ? '✓' : ''}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13 }}>{e.concepto || '—'}</div>
                          <div style={{ fontSize: 11, color: s.text2 }}>{e.estado || '—'}</div>
                        </div>
                        <div style={{ fontSize: 13, fontFamily: 'DM Mono, monospace', color: s.red }}>${Math.round(parseFloat(e.monto)||0).toLocaleString('es-AR')}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: `1px solid ${s.border}`, marginBottom: 16 }}>
                    <div style={{ fontSize: 13, color: s.text2 }}>Total seleccionado</div>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: s.accent }}>
                      ${Math.round(egresosObra.filter(e => certEgresosSeleccion[e._key]).reduce((a, b) => a + (parseFloat(b.monto)||0), 0)).toLocaleString('es-AR')}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowCertEgresos(false)} style={{ flex: 1, padding: 12, background: 'transparent', border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
                    <button onClick={() => printCertEgresos(obraActual, egresosObra)}
                      disabled={Object.values(certEgresosSeleccion).filter(Boolean).length === 0}
                      style={{ flex: 2, padding: 12, background: s.accent, border: 'none', borderRadius: 8, color: '#f8f9fa', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: Object.values(certEgresosSeleccion).filter(Boolean).length === 0 ? .4 : 1 }}>
                      🖨 Imprimir certificado
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 20, padding: '10px 20px', fontSize: 13, color: s.text, zIndex: 200, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      {/* MODAL IMPORTAR CERTIFICADO */}
      {showImportCert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowImportCert(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, width: 560, maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Importar como ingreso</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Seleccioná un certificado para cargarlo en los ingresos de esta semana
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--surface2)', borderRadius: 8, padding: 4 }}>
              {[
                { id: 'items', label: '📋 Certificados de avance' },
                { id: 'egresos', label: '📎 Certificados de egresos' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setImportCertTab(tab.id)}
                  style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    background: importCertTab === tab.id ? 'var(--accent)' : 'transparent',
                    color: importCertTab === tab.id ? '#f8f9fa' : 'var(--muted)' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Buscador */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14 }}>🔍</span>
              <input
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 32px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }}
                placeholder="Buscar por obra, cliente o número..."
                value={certFiltro}
                onChange={e => setCertFiltro(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingCerts ? (
                <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Cargando...</div>
              ) : importCertTab === 'items' ? (() => {
                const filtrados = certDisponibles.filter(c => {
                  if (!certFiltro.trim()) return true;
                  const q = certFiltro.toLowerCase();
                  return (c.obra || '').toLowerCase().includes(q) ||
                         (c.cliente || '').toLowerCase().includes(q) ||
                         String(c.numero || '').includes(q);
                });
                return filtrados.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                    {certDisponibles.length === 0 ? 'No hay certificados de avance emitidos' : 'Sin resultados para "' + certFiltro + '"'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtrados.map(cert => (
                      <div key={cert.id}
                        onClick={() => importarCertComoIngreso(cert)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            Cert. Nº {cert.numero} — {cert.obra}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {cert.cliente}{cert.fecha ? ' · ' + new Date(cert.fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
                            ${Math.round(cert.total_periodo || 0).toLocaleString('es-AR')}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>este período</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : (() => {
                const filtradosEg = certEgresosDisponibles.filter(c => {
                  if (!certFiltro.trim()) return true;
                  const q = certFiltro.toLowerCase();
                  return (c.obra || '').toLowerCase().includes(q) ||
                         String(c.certificado_num || '').includes(q);
                });
                return filtradosEg.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>
                    {certEgresosDisponibles.length === 0 ? 'No hay certificados de egresos emitidos' : 'Sin resultados para "' + certFiltro + '"'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filtradosEg.map(ce => (
                      <div key={ce.id}
                        onClick={() => importarCertEgresosComoIngreso(ce)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--warn)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>
                            Egresos{ce.certificado_num ? ' — Cert. Nº ' + ce.certificado_num : ''} — {ce.obra}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {(ce.egresos || []).length} ítems
                            {ce.fecha ? ' · ' + new Date(ce.fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--warn)' }}>
                            ${Math.round(ce.total || 0).toLocaleString('es-AR')}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>total egresos</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button onClick={() => setShowImportCert(false)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 18px', color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ title, s, children, accent, borderColor, count, total, totalColor, defaultOpen }) {
  const hasData = count != null && count > 0;
  const [open, setOpen] = useState(defaultOpen !== undefined ? defaultOpen : !hasData);
  return (
    <div style={{ background: s.surface, border: `1.5px solid ${borderColor || 'rgba(0,0,0,0.07)'}`, borderRadius: 12, marginBottom: 10, borderTop: `3px solid ${accent || 'transparent'}`, overflow: 'hidden' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accent || s.text3, flexShrink: 0 }}></span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: accent || s.text3, fontFamily: 'DM Mono, monospace', flex: 1 }}>{title}</span>
        {!open && hasData && (
          <span style={{ fontSize: 11, color: s.text3, fontFamily: 'DM Mono, monospace' }}>
            {count} {count === 1 ? 'ítem' : 'ítems'}
            {total != null && <span style={{ color: totalColor || accent || s.text3, marginLeft: 8, fontWeight: 700 }}>{total}</span>}
          </span>
        )}
        <span style={{ fontSize: 12, color: s.text3, transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', marginLeft: 4 }}>▾</span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  );
}

function EntryRow({ num, onDel, s, children }) {
  return (
    <div style={{ background: s.surface2, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: s.text3, fontFamily: 'DM Mono, monospace', letterSpacing: '.06em' }}>#{num}</span>
        <button onClick={onDel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s.red, fontSize: 16 }}>×</button>
      </div>
      {children}
    </div>
  );
}

function AddBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ width: '100%', padding: 11, border: '1px dashed rgba(255,255,255,0.07)', borderRadius: 8, background: 'transparent', color: '#8A8780', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'center', marginTop: 4 }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <label style={{ display: 'block', fontSize: 10, color: '#8A8780', marginBottom: 4, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</label>
      {children}
    </div>
  );
}

function TotalLine({ label, val, color, main }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: main ? 14 : 13, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <span style={{ color: '#8A8780' }}>{label}</span>
      <span style={{ fontWeight: main ? 600 : 500, fontFamily: 'DM Mono, monospace', color: color || '#F0EDE6' }}>{val}</span>
    </div>
  );
}

function SemanalDetalle({ semanasData, obraSelec, s, fmt, fmtShort, mono, card }) {
  const [expandidos, setExpandidos] = useState({});
  const toggle = (i) => setExpandidos(p => ({ ...p, [i]: !p[i] }));

  if (!semanasData.length) return (
    <div style={card}>
      <div style={{ textAlign: 'center', color: s.text3, padding: 20 }}>Sin movimientos en semanas pasadas</div>
    </div>
  );

  const SubSection = ({ titulo, color, items, renderItem }) => {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color, marginBottom: 4 }}>{titulo}</div>
        {items.map((item, i) => renderItem(item, i))}
      </div>
    );
  };

  let acum = 0;
  return (
    <div>
      {semanasData.map((sd, i) => {
        acum += sd.resultado;
        const d = new Date(sd.fecha + 'T12:00:00');
        const open = expandidos[i];
        return (
          <div key={i} style={{ ...card, marginBottom: 8, padding: 0, overflow: 'hidden' }}>
            {/* Header row — clickable */}
            <button onClick={() => toggle(i)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                <span style={{ fontSize: 11, color: s.text2, fontFamily: mono, minWidth: 40 }}>
                  {d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                </span>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {sd.totalIng > 0 && <span style={{ fontSize: 11, color: s.green, fontFamily: mono }}>▲ {fmtShort(sd.totalIng)}</span>}
                  {sd.totalEg > 0 && <span style={{ fontSize: 11, color: s.red, fontFamily: mono }}>▼ {fmtShort(sd.totalEg)}</span>}
                  {sd.totalPersonal > 0 && <span style={{ fontSize: 11, color: '#7c3aed', fontFamily: mono }}>👷 {fmtShort(sd.totalPersonal)}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: mono, color: sd.resultado >= 0 ? s.green : s.red }}>
                  {fmtShort(sd.resultado)}
                </span>
                <span style={{ fontSize: 12, color: s.text3, transform: open ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▾</span>
              </div>
            </button>

            {/* Expanded detail */}
            {open && (
              <div style={{ padding: '4px 16px 16px', borderTop: `1px solid ${s.border}` }}>

                {/* Ingresos */}
                <SubSection titulo="Ingresos" color={s.green} items={sd.ingresos} renderItem={(ing, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${s.border}`, gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>{ing.concepto || '—'}</div>
                      <div style={{ fontSize: 10, color: s.text3, marginTop: 1 }}>
                        {ing.estado || ''}{ing.cliente ? ` · ${ing.cliente}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: s.green, flexShrink: 0 }}>{fmt(parseFloat(ing.monto) || 0)}</div>
                  </div>
                )} />

                {/* Egresos */}
                <SubSection titulo="Egresos / Materiales" color={s.red} items={sd.egresos} renderItem={(eg, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${s.border}`, gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>{eg.concepto || '—'}</div>
                      <div style={{ fontSize: 10, color: s.text3, marginTop: 1 }}>
                        {eg.estado || ''}{eg.obra ? ` · ${eg.obra}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: s.red, flexShrink: 0 }}>{fmt(parseFloat(eg.monto) || 0)}</div>
                  </div>
                )} />

                {/* Personal */}
                <SubSection titulo="Personal" color="#7c3aed" items={sd.personal} renderItem={(p, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${s.border}`, gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>{p.nombre || '—'} <span style={{ color: s.text3, fontSize: 11 }}>({p.rango || '—'})</span></div>
                      <div style={{ fontSize: 10, color: s.text3, marginTop: 1 }}>
                        {p.dias}d × {p.hs}hs × ${(p.costo||0).toLocaleString('es-AR')}/h
                        {p.obra ? ` · ${p.obra}` : ''}
                      </div>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: '#7c3aed', flexShrink: 0 }}>{fmt(parseFloat(p.total) || 0)}</div>
                  </div>
                )} />

                {/* Herramientas */}
                <SubSection titulo="Herramientas" color={s.amber} items={sd.herramientas} renderItem={(h, j) => (
                  <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: `1px solid ${s.border}`, gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12 }}>{h.nombre || '—'} {h.cantidad > 1 ? `(x${h.cantidad})` : ''}</div>
                      <div style={{ fontSize: 10, color: s.text3, marginTop: 1 }}>
                        {h.propietario ? `${h.propietario}` : ''}{h.fechaIn ? ` · Desde ${h.fechaIn}` : ''}
                      </div>
                    </div>
                  </div>
                )} />

                {/* Totales de la semana */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: `1px solid ${s.border}` }}>
                  <div style={{ fontSize: 11, color: s.text3 }}>Resultado semana</div>
                  <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: sd.resultado >= 0 ? s.green : s.red }}>{fmt(sd.resultado)}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
                  <div style={{ fontSize: 11, color: s.text3 }}>Acumulado a esta semana</div>
                  <div style={{ fontFamily: mono, fontSize: 12, color: s.accent }}>{fmt(acum)}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PorObra({ semanas, obras, s, fmt, fmtShort }) {
  const [obraSelec, setObraSelec] = useState(obras[0] || '');
  const [vistaObra, setVistaObra] = useState('resumen'); // 'resumen' | 'semanal'

  if (!semanas.length) return <div style={{ textAlign: 'center', color: s.text3, padding: 40 }}>Sin datos aún</div>;

  // Calcular datos por obra
  const calcObra = (obra) => {
    const semanasData = [];
    let acumIng = 0, acumEg = 0;

    semanas.forEach(sem => {
      // Ingresos de esta obra (por cliente o por obra explícita)
      const ingresos = (sem.ingresos || []).filter(i =>
        (i.obra && i.obra === obra) || (!i.obra && i.cliente === obra)
      );
      // Egresos de esta obra
      const egresos = (sem.egresos || []).filter(e => e.obra === obra);
      // Personal de esta obra (tiene campo obra)
      const personal = (sem.personal || []).filter(p => p.obra === obra);
      // Personal sin asignar — se muestra como "sin asignar" pero no se incluye aquí
      // Herramientas de esta obra
      const herramientas = (sem.herramientas || []).filter(h => h.obra === obra);

      const totalIng = ingresos.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
      const totalEg = egresos.reduce((a, b) => a + (parseFloat(b.monto) || 0), 0);
      const totalPersonal = personal.reduce((a, b) => a + (parseFloat(b.total) || 0), 0);
      const totalHerr = 0; // herramientas no tienen monto directo aún
      const totalGastos = totalEg + totalPersonal;
      const resultado = totalIng - totalGastos;

      acumIng += totalIng;
      acumEg += totalGastos;

      if (totalIng > 0 || totalGastos > 0) {
        semanasData.push({
          sem, totalIng, totalEg, totalPersonal, totalGastos, resultado,
          acumIng, acumEg,
          ingresos, egresos, personal, herramientas,
          fecha: sem.fecha_inicio || sem.fecha,
        });
      }
    });

    return { semanasData, acumIng, acumEg, resultado: acumIng - acumEg };
  };

  const datos = calcObra(obraSelec);
  const margenPct = datos.acumIng > 0 ? ((datos.resultado / datos.acumIng) * 100) : 0;

  // Resumen de todas las obras para comparar
  const resumenObras = obras.map(o => {
    const d = calcObra(o);
    return { obra: o, ...d };
  }).filter(o => o.acumIng > 0 || o.acumEg > 0);

  const mono = 'DM Mono, monospace';
  const card = { background: s.surface, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 10, padding: 14, marginBottom: 10 };

  return (
    <div>
      {/* Selector de obra — dropdown */}
      <div style={card}>
        <div style={{ fontSize: 11, color: s.text3, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Seleccionar obra</div>
        <select
          value={obraSelec}
          onChange={e => setObraSelec(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', background: s.surface2, border: `1px solid ${s.border}`, borderRadius: 8, color: s.text, fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' }}>
          {resumenObras.length === 0
            ? obras.map(o => <option key={o} value={o}>{o}</option>)
            : resumenObras.map(o => (
                <option key={o.obra} value={o.obra}>
                  {o.obra}{o.resultado !== 0 ? '  ·  ' + (o.resultado >= 0 ? '+' : '') + fmtShort(o.resultado) : ''}
                </option>
              ))
          }
        </select>
      </div>

      {/* KPIs de la obra seleccionada */}
      {datos.acumIng === 0 && datos.acumEg === 0 ? (
        <div style={{ textAlign: 'center', color: s.text3, padding: 30 }}>
          No hay movimientos asignados a <b>{obraSelec}</b> aún.<br/>
          <span style={{ fontSize: 12 }}>Al cargar egresos, personal o ingresos, asignalos a esta obra.</span>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[
              { label: 'Ingresos acumulados', val: fmtShort(datos.acumIng), color: s.green },
              { label: 'Gastos acumulados', val: fmtShort(datos.acumEg), color: s.red },
              { label: 'Resultado', val: fmtShort(datos.resultado), color: datos.resultado >= 0 ? s.green : s.red },
              { label: 'Margen', val: margenPct.toFixed(1) + '%', color: margenPct >= 0 ? s.green : s.red },
            ].map((m, i) => (
              <div key={i} style={{ background: s.surface, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, color: s.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: mono }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 600, fontFamily: mono, color: m.color }}>{m.val}</div>
              </div>
            ))}
          </div>

          {/* Toggle semanal / resumen */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: `1px solid ${s.border}` }}>
            {[['resumen', 'Resumen por categoría'], ['semanal', 'Detalle semanal']].map(([v, l]) => (
              <button key={v} onClick={() => setVistaObra(v)}
                style={{ flex: 1, padding: '8px 0', fontSize: 12, border: 'none', cursor: 'pointer', fontWeight: vistaObra === v ? 700 : 400, background: vistaObra === v ? s.accent + '22' : s.surface2, color: vistaObra === v ? s.accent : s.text3, fontFamily: 'inherit' }}>
                {l}
              </button>
            ))}
          </div>

          {vistaObra === 'resumen' && (
            <div style={card}>
              <div style={{ fontSize: 10, color: s.text3, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: mono, marginBottom: 12 }}>Desglose — {obraSelec}</div>
              {/* Ingresos */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.green, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ingresos</div>
                {datos.semanasData.flatMap(sd => sd.ingresos).length === 0
                  ? <div style={{ fontSize: 12, color: s.text3 }}>Sin ingresos registrados</div>
                  : datos.semanasData.flatMap(sd => sd.ingresos.map(i => ({ ...i, _fecha: sd.fecha }))).map((i, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${s.border}`, fontSize: 12 }}>
                      <div>
                        <div>{i.concepto || '—'}</div>
                        <div style={{ fontSize: 10, color: s.text3 }}>{i._fecha ? new Date(i._fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''}</div>
                      </div>
                      <div style={{ fontFamily: mono, color: s.green }}>{fmt(parseFloat(i.monto) || 0)}</div>
                    </div>
                  ))
                }
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 12 }}>
                  <span style={{ color: s.text2 }}>Total ingresos</span>
                  <span style={{ fontFamily: mono, color: s.green }}>{fmt(datos.acumIng)}</span>
                </div>
              </div>
              {/* Egresos */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.red, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Egresos / Materiales</div>
                {datos.semanasData.flatMap(sd => sd.egresos).length === 0
                  ? <div style={{ fontSize: 12, color: s.text3 }}>Sin egresos registrados</div>
                  : datos.semanasData.flatMap(sd => sd.egresos.map(e => ({ ...e, _fecha: sd.fecha }))).map((e, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${s.border}`, fontSize: 12 }}>
                      <div>
                        <div>{e.concepto || '—'}</div>
                        <div style={{ fontSize: 10, color: s.text3 }}>{e._fecha ? new Date(e._fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''}</div>
                      </div>
                      <div style={{ fontFamily: mono, color: s.red }}>{fmt(parseFloat(e.monto) || 0)}</div>
                    </div>
                  ))
                }
              </div>
              {/* Personal */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em' }}>Personal asignado</div>
                {datos.semanasData.flatMap(sd => sd.personal).length === 0
                  ? <div style={{ fontSize: 12, color: s.text3 }}>Sin personal asignado a esta obra</div>
                  : datos.semanasData.flatMap(sd => sd.personal.map(p => ({ ...p, _fecha: sd.fecha }))).map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${s.border}`, fontSize: 12 }}>
                      <div>
                        <div>{p.nombre} <span style={{ color: s.text3 }}>({p.rango})</span></div>
                        <div style={{ fontSize: 10, color: s.text3 }}>{p.dias}d × {p.hs}hs × ${p.costo}/h · {p._fecha ? new Date(p._fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''}</div>
                      </div>
                      <div style={{ fontFamily: mono, color: '#7c3aed' }}>{fmt(parseFloat(p.total) || 0)}</div>
                    </div>
                  ))
                }
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 700, fontSize: 12 }}>
                  <span style={{ color: s.text2 }}>Total personal</span>
                  <span style={{ fontFamily: mono, color: '#7c3aed' }}>{fmt(datos.semanasData.reduce((a, sd) => a + sd.totalPersonal, 0))}</span>
                </div>
              </div>
            </div>
          )}

          {vistaObra === 'semanal' && (
            <SemanalDetalle semanasData={datos.semanasData} obraSelec={obraSelec} s={s} fmt={fmt} fmtShort={fmtShort} mono={mono} card={card} />
          )}
        </>
      )}
    </div>
  );
}

function Dashboard({ semanas, s, fmt, fmtShort }) {
  if (!semanas.length) return <div style={{ textAlign: 'center', color: s.text3, padding: 40 }}>Sin datos aún</div>;
  const totalIng = semanas.reduce((a, b) => a + (b.totalIng || 0), 0);
  const totalEg = semanas.reduce((a, b) => a + (b.totalEg || 0) + (b.totalPersonal || 0) + (b.alimentacion || 0), 0);
  const totalGan = semanas.reduce((a, b) => a + (b.ganancia || 0), 0);
  const prom = semanas.length ? totalIng / semanas.length : 0;
  const negs = semanas.filter(s => (s.resultado || 0) < 0).length;
  const pctGan = totalIng > 0 ? (totalGan / totalIng * 100) : 0;
  const pisoOp = totalEg / semanas.length;
  let acum = 0;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          { label: 'Total ingresos', val: fmtShort(totalIng), color: s.green },
          { label: 'Total egresos', val: fmtShort(totalEg), color: s.red },
          { label: 'Ganancia total', val: fmtShort(totalGan), color: totalGan >= 0 ? s.green : s.red },
          { label: 'Promedio semanal', val: fmtShort(prom), color: s.text },
        ].map((m, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: s.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'DM Mono, monospace' }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>

      <div style={{ background: s.surface, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 12, padding: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: s.text3, letterSpacing: '.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 14 }}>Detalle semanal</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Sem', 'Fecha', 'Ingresos', 'Egresos', 'Resultado', 'Acumulado'].map(h => (
                <th key={h} style={{ textAlign: h === 'Sem' || h === 'Fecha' ? 'left' : 'right', padding: '6px 8px', color: s.text3, fontWeight: 500, fontFamily: 'DM Mono, monospace', fontSize: 10, borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {semanas.map((sem, i) => {
                acum += (sem.resultado || 0);
                const eg = (sem.totalEg || 0) + (sem.totalPersonal || 0) + (sem.alimentacion || 0);
                const d = new Date(sem.fecha + 'T12:00:00');
                return (
                  <tr key={sem.id}>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>{d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: 'right', color: s.green, fontFamily: 'DM Mono, monospace' }}>{fmtShort(sem.totalIng || 0)}</td>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: 'right', color: s.red, fontFamily: 'DM Mono, monospace' }}>{fmtShort(eg)}</td>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: 'right', color: (sem.resultado || 0) >= 0 ? s.green : s.red, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{fmtShort(sem.resultado || 0)}</td>
                    <td style={{ padding: '8px 8px', borderBottom: `1px solid rgba(255,255,255,0.04)`, textAlign: 'right', color: s.accent, fontFamily: 'DM Mono, monospace' }}>{fmtShort(acum)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'Semanas negativas', val: negs, color: s.red },
          { label: '% Ganancia', val: pctGan.toFixed(1) + '%', color: s.green },
          { label: 'Piso operativo', val: fmtShort(pisoOp), color: s.amber },
          { label: 'Total colchón', val: fmtShort(semanas.reduce((a, b) => a + (b.colchon || 0), 0)), color: s.amber },
        ].map((m, i) => (
          <div key={i} style={{ background: s.surface, border: `1px solid rgba(255,255,255,0.04)`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: s.text2, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.05em', fontFamily: 'DM Mono, monospace' }}>{m.label}</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'DM Mono, monospace', color: m.color }}>{m.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function exportarSemanaSheets(sem, config, showToast) {
  const url = config.sheetsUrl;
  if (!url) { showToast('Configurá la URL del script en la sección de configuración'); return; }
  const fechaLabel = sem.fecha_inicio
    ? new Date(sem.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR')
    : new Date((sem.fecha || '') + 'T12:00:00').toLocaleDateString('es-AR');
  const sheetName = 'Semana ' + fechaLabel;

  // Calcular honorarios para incluir en la exportación
  const resultado = sem.resultado || 0;
  const honorarios = sem.config?.honorarios || [];
  const honorariosExport = honorarios.map(h => {
    let monto = 0;
    if (h.modo === 'monto') monto = parseFloat(h.monto) || 0;
    else monto = resultado > 0 ? resultado * (parseFloat(h.pct) || 0) / 100 : 0;
    return { nombre: h.nombre || 'Honorario', monto: Math.round(monto), pct: h.pct, modo: h.modo };
  });
  const totalHonorarios = honorariosExport.reduce((a, h) => a + h.monto, 0);

  const semanaConHonorarios = {
    ...sem,
    honorarios: honorariosExport,
    totalHonorarios,
  };

  try {
    showToast('Exportando a Sheets...');
    await fetch(url, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exportSemanaDetalle', sheetName, semana: semanaConHonorarios })
    });
    showToast('✓ Semana exportada a Google Sheets');
  } catch(e) {
    showToast('Error al conectar con el script');
  }
}


async function exportToSheets(semanas, config, showToast) {
  const url = config.sheetsUrl;
  if (!url) { showToast('Configurá la URL del script primero'); return; }
  const rows = semanas.map((s, i) => {
    const d = new Date(s.fecha + 'T12:00:00');
    const eg = (s.totalEg || 0) + (s.totalPersonal || 0) + (s.alimentacion || 0);
    return { semana: i + 1, fecha: d.toLocaleDateString('es-AR'), ingresos: s.totalIng || 0, egresos: eg, resultado: s.resultado || 0, honFede: s.honFede || 0, honMili: s.honMili || 0, colchon: s.colchon || 0, ganancia: s.ganancia || 0 };
  });
  try {
    await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'exportSemanas', rows }) });
    showToast('✓ Datos enviados a Google Sheets');
  } catch (e) {
    showToast('Error al conectar con el script');
  }
}
