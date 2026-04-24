import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getPresupuesto, getCertificados, getCertificado, crearCertificado } from '../api';
import api from '../api';
import { createClient } from '@supabase/supabase-js';
import MobileMenu from './MobileMenu';
import { ArrowLeft, Plus, FileText, Printer, Trash2, Edit2 } from 'lucide-react';
import '../print.css';
const sb = createClient('https://bomxksdisszrhhsctowd.supabase.co','sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2');

const fmt = (n) => n ? '$ ' + Math.round(n).toLocaleString('es-AR') : '$ 0';
const fmtPct = (n) => (n != null ? Number(n).toFixed(1) + '%' : '0.0%');

export default function Certificado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presupuesto, setPresupuesto] = useState(null);
  const [certificados, setCertificados] = useState([]);
  const [certDetalle, setCertDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [nuevoCertFecha, setNuevoCertFecha] = useState(new Date().toISOString().split('T')[0]);
  const [nuevoCertDesde, setNuevoCertDesde] = useState('');
  const [nuevoCertHasta, setNuevoCertHasta] = useState('');
  const [avances, setAvances] = useState({});
  const [avancesAnteriores, setAvancesAnteriores] = useState({});
  const [guardando, setGuardando] = useState(false);
  // Ajustes del certificado
  const [certMayoresCostosPct, setCertMayoresCostosPct] = useState(0);
  const [certFondoReparoPct, setCertFondoReparoPct] = useState(0);
  const [certMultas, setCertMultas] = useState(0);
  const [certNota, setCertNota] = useState('');
  // Ajustes edición
  const [editMayoresCostosPct, setEditMayoresCostosPct] = useState(0);
  const [editFondoReparoPct, setEditFondoReparoPct] = useState(0);
  const [editMultas, setEditMultas] = useState(0);
  const [editNota, setEditNota] = useState('');
  const [egresos, setEgresos] = useState([]);
  const [modalEditCert, setModalEditCert] = useState(null);
  const [editFecha, setEditFecha] = useState('');
  const [editDesde, setEditDesde] = useState('');
  const [editHasta, setEditHasta] = useState('');
  const [editAvances, setEditAvances] = useState({});
  const [showEgresos, setShowEgresos] = useState(false);
  const [egresosSeleccion, setEgresosSeleccion] = useState({});
  const [certEgresosGuardados, setCertEgresosGuardados] = useState([]);
  // Nuevo: certificado al que se vincula el cert de egresos
  const [egresosVinculadoNum, setEgresosVinculadoNum] = useState('');
  // Gastos manuales en el cert de egresos
  const [gastosExtra, setGastosExtra] = useState([]);
  const [nuevoGasto, setNuevoGasto] = useState({ concepto: '', monto: '' });
  const [semanaFiltroEg, setSemanaFiltroEg] = useState('todas'); // 'todas' | semana id
  const [semanasDisp, setSemanasDisp] = useState([]); // lista de semanas para el filtro

  const [ajustesPorCert, setAjustesPorCert] = useState({});
  const [adicionales, setAdicionales] = useState([]);

  useEffect(() => { cargar(); cargarCertEgresos(); cargarAjustes(); cargarAdicionales(); }, [id]);

  useEffect(() => {
    if (presupuesto) cargarEgresos();
  }, [presupuesto]);

  // Al abrir el modal de egresos, pre-seleccionar el último certificado
  useEffect(() => {
    if (showEgresos && certificados.length > 0) {
      setEgresosVinculadoNum(certificados[certificados.length - 1].numero);
    }
  }, [showEgresos]);

  const cargarEgresos = async () => {
    try {
      const [semanasRes, certEgRes] = await Promise.all([
        sb.from('semanas').select('*').order('fecha', { ascending: false }),
        sb.from('cert_egresos').select('*').order('created_at', { ascending: false }),
      ]);
      const data = semanasRes.data || [];
      const certEgData = certEgRes.data || [];

      // Recolectar todas las _keys que ya fueron certificadas
      const keysCertificadas = new Set();
      certEgData.forEach(ce => {
        (ce.egresos || []).forEach(e => {
          if (e._key) keysCertificadas.add(e._key);
        });
      });

      const obraMatch = (presupuesto?.nombre_obra || '').toLowerCase().trim();
      const clienteMatch = (presupuesto?.cliente_nombre || '').toLowerCase().trim();
      const todos = [];
      const semList = [];
      data.forEach(sem => {
        let tienEgresos = false;
        (sem.egresos || []).forEach((e, i) => {
          const key = `${sem.id}-${i}`;
          if (keysCertificadas.has(key)) return; // ya certificado, no mostrar
          const obraEgreso = (e.obra || '').toLowerCase().trim();
          const coincide = obraEgreso === obraMatch ||
            obraEgreso === clienteMatch ||
            (obraMatch && obraEgreso.includes(obraMatch)) ||
            (clienteMatch && obraEgreso.includes(clienteMatch));
          todos.push({
            ...e,
            _key: key,
            _semana_id: sem.id,
            _coincide: coincide,
            _semana: sem.fecha_inicio
              ? new Date(sem.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR')
              : new Date((sem.fecha || '') + 'T12:00:00').toLocaleDateString('es-AR'),
            _semana_label: sem.fecha_inicio
              ? new Date(sem.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : new Date((sem.fecha || '') + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          });
          tienEgresos = true;
        });
        if (tienEgresos) {
          semList.push({
            id: sem.id,
            label: sem.fecha_inicio
              ? new Date(sem.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : new Date((sem.fecha || '') + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          });
        }
      });
      setEgresos(todos);
      setSemanasDisp(semList);
    } catch(e) { console.error('Error cargando egresos:', e); }
  };

  const cargarCertEgresos = async () => {
    const { data } = await sb.from('cert_egresos').select('*').eq('presupuesto_id', id).order('created_at', { ascending: false });
    if (data) setCertEgresosGuardados(data);
  };

  const cargarAjustes = async () => {
    try {
      const { data } = await sb.from('cert_ajustes').select('*').eq('presupuesto_id', id);
      if (data) {
        const map = {};
        data.forEach(a => { map[a.certificado_num] = a; });
        setAjustesPorCert(map);
      }
    } catch(e) { console.error('Error cargando ajustes:', e); }
  };

  const cargarAdicionales = async () => {
    try {
      const res = await api.get(`/presupuestos/${id}/adicionales`);
      setAdicionales(res.data || []);
    } catch(e) { setAdicionales([]); }
  };

  const cargar = async () => {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([getPresupuesto(id), getCertificados(id)]);
      setPresupuesto(pRes.data);
      setCertificados(cRes.data.certificados || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const abrirModalNuevo = async () => {
    // Lineas del presupuesto base
    const lineasBase = presupuesto?.rubros?.flatMap(r => r.lineas) || [];
    // Lineas de adicionales (solo los cerrados)
    const lineasAdicionales = adicionales
      .filter(a => a.estado === 'cerrado')
      .flatMap(a => a.rubros?.flatMap(r => r.lineas) || []);
    const todasLineas = [...lineasBase, ...lineasAdicionales];

    const initAvances = {};
    const initAnteriores = {};
    todasLineas.forEach(l => { initAvances[l.id] = 0; initAnteriores[l.id] = 0; });

    if (certificados.length > 0) {
      try {
        const ultimo = certificados[certificados.length - 1];
        const res = await getCertificado(id, ultimo.numero);
        res.data.detalles?.forEach(d => {
          initAnteriores[d.linea_id] = parseFloat(d.pct_acumulado) || 0;
          initAvances[d.linea_id] = 0;
        });
      } catch (e) { console.error(e); }
    }

    setAvancesAnteriores(initAnteriores);
    setAvances(initAvances);
    setModalNuevo(true);
  };

  const verDetalle = async (num) => {
    if (certDetalle?.certificado?.numero === num) { setCertDetalle(null); return; }
    try {
      const res = await getCertificado(id, num);
      setCertDetalle(res.data);
    } catch (e) { console.error(e); }
  };

  const handleEditCert = async () => {
    if (!modalEditCert) return;
    try {
      const avancesArr = Object.entries(editAvances).map(([lid, pct]) => ({
        linea_id: parseInt(lid),
        pct_periodo: parseFloat(pct) || 0,
      }));
      await api.patch(`/presupuestos/${id}/certificados/${modalEditCert.numero}`, {
        fecha: editFecha || undefined,
        periodo_desde: editDesde || null,
        periodo_hasta: editHasta || null,
        avances: avancesArr.length > 0 ? avancesArr : undefined,
      });
      // Guardar ajustes
      await sb.from('cert_ajustes').upsert({
        presupuesto_id: parseInt(id),
        certificado_num: modalEditCert.numero,
        mayores_costos_pct: parseFloat(editMayoresCostosPct) || 0,
        fondo_reparo_pct: parseFloat(editFondoReparoPct) || 0,
        multas: parseFloat(editMultas) || 0,
        nota: editNota || null,
      }, { onConflict: 'presupuesto_id,certificado_num' });
      setModalEditCert(null);
      cargar();
      cargarAjustes();
    } catch(e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleEliminarCert = async (num) => {
    if (!window.confirm(`¿Eliminar el Certificado Nº${num}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/presupuestos/${id}/certificados/${num}`);
      if (certDetalle?.certificado?.numero === num) setCertDetalle(null);
      cargar();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleCrearCertificado = async () => {
    setGuardando(true);
    try {
      const avancesArr = Object.entries(avances).map(([lid, pct]) => ({
        linea_presupuesto_id: parseInt(lid),
        pct_avance_acumulado: Math.min(100, (avancesAnteriores[lid] || 0) + (parseFloat(pct) || 0)),
      }));
      const res = await crearCertificado(id, { 
        avances: avancesArr,
        fecha: nuevoCertFecha || new Date().toISOString().split('T')[0],
        periodo_desde: nuevoCertDesde || null,
        periodo_hasta: nuevoCertHasta || null,
      });
      // Guardar ajustes si hay algo
      const numNuevo = (res?.data?.numero) || (certificados.length + 1);
      const tieneAjustes = parseFloat(certMayoresCostosPct) || parseFloat(certFondoReparoPct) || parseFloat(certMultas) || certNota;
      if (tieneAjustes) {
        await sb.from('cert_ajustes').upsert({
          presupuesto_id: parseInt(id),
          certificado_num: numNuevo,
          mayores_costos_pct: parseFloat(certMayoresCostosPct) || 0,
          fondo_reparo_pct: parseFloat(certFondoReparoPct) || 0,
          multas: parseFloat(certMultas) || 0,
          nota: certNota || null,
        }, { onConflict: 'presupuesto_id,certificado_num' });
      }
      setCertMayoresCostosPct(0); setCertFondoReparoPct(0); setCertMultas(0); setCertNota('');
      setModalNuevo(false);
      setCertDetalle(null);
      cargar();
      cargarAjustes();
    } catch (e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
    setGuardando(false);
  };

  const imprimirCertItems = (d) => {
    const hoyStr = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'long',year:'numeric'});
    // Obtener cert de egresos vinculado a este número si existe
    const certEg = certEgresosGuardados.find(ce => ce.certificado_num === d.certificado?.numero);
    const rows = d.detalles?.map(det=>`<tr><td>${det.nombre_item||'—'}</td><td class="n">${fmt(det.precio_total_item)}</td><td class="n m">${fmtPct(det.pct_anterior)}</td><td class="n b">${fmtPct(det.pct_periodo)}</td><td class="n b">${fmtPct(det.pct_acumulado)}</td><td class="n b">${fmt(det.monto_periodo)}</td><td class="n b">${fmt(det.monto_acumulado)}</td></tr>`).join('');
    const egresosSection = certEg ? `
      <div style="margin-top:28px;page-break-inside:avoid">
        <div style="border-bottom:2px solid #111;margin-bottom:10px;padding-bottom:6px">
          <div style="font-size:10pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#444">Certificado de Egresos / Materiales</div>
        </div>
        <table>
          <thead><tr><th>Concepto</th><th class="r">Monto</th><th>Semana</th><th>Estado</th></tr></thead>
          <tbody>
            ${(certEg.egresos||[]).map(e=>`<tr><td>${e.concepto||'—'}</td><td class="n b">$${Math.round(parseFloat(e.monto)||0).toLocaleString('es-AR')}</td><td>${e._semana||'—'}</td><td>${e.estado||'—'}</td></tr>`).join('')}
            <tr style="background:#f0f0f0;font-weight:700"><td>Total egresos</td><td class="n">$${Math.round(certEg.total||0).toLocaleString('es-AR')}</td><td></td><td></td></tr>
          </tbody>
        </table>
      </div>` : '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Certificado Nº ${d.certificado?.numero}</title>
<style>
html,body{background:#fff;color:#111;font-family:Arial,sans-serif;font-size:10pt;margin:0;padding:20px 28px}
.top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
.empresa{font-size:18pt;font-weight:900}
.titulo{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#444;margin-top:2px}
.datos{font-size:8.5pt;color:#555;margin-top:5px;line-height:1.5}
.meta{font-size:8.5pt;color:#555;text-align:right;line-height:1.7}
table{width:100%;border-collapse:collapse;margin-bottom:14px}
th{background:#1a1a1a;color:#fff;padding:5px 8px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.8px;text-align:left}
th.r{text-align:right}
td{padding:5px 8px;border-bottom:1px solid #e5e5e5;font-size:9pt;color:#111}
tr:nth-child(even) td{background:#f9f9f9}
.n{text-align:right;font-family:'Courier New',monospace}
.m{color:#999}.b{font-weight:700}
.res{border:1.5px solid #111;margin-bottom:20px}
.res-h{background:#1a1a1a;color:#fff;padding:5px 10px;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.res-b{display:flex}
.blk{flex:1;padding:8px 10px;border-right:1px solid #ddd;text-align:center;background:#fff}
.blk:last-child{border-right:none}
.lbl{font-size:7pt;text-transform:uppercase;letter-spacing:.8px;color:#666;margin-bottom:3px}
.val{font-size:13pt;font-weight:900;font-family:'Courier New',monospace;color:#111}
.firmas{display:flex;justify-content:space-between;margin-top:50px;padding:0 10px}
.firma{width:200px;text-align:center}
.firma div{border-top:1px solid #333;padding-top:7px;font-size:9pt;color:#444}
footer{margin-top:16px;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between;font-size:8pt;color:#888}
</style></head><body>
<div class="top">
  <div>
    <div class="empresa">Fima Arquitectura</div>
    <div class="titulo">Certificado de avance Nº ${d.certificado?.numero}</div>
    <div class="datos"><strong>Obra:</strong> ${presupuesto?.nombre_obra}${presupuesto?.ubicacion?' &nbsp;·&nbsp; <strong>Ubicación:</strong> '+presupuesto.ubicacion:''}</div>
    ${d.certificado?.periodo_desde?`<div class="datos"><strong>Período:</strong> ${new Date(d.certificado.periodo_desde+'T12:00:00').toLocaleDateString('es-AR')} al ${d.certificado?.periodo_hasta?new Date(d.certificado.periodo_hasta+'T12:00:00').toLocaleDateString('es-AR'):'—'}</div>`:''}
  </div>
  <div class="meta">
    <div>Resistencia, ${hoyStr}</div>
    ${d.certificado?.fecha?`<div>Fecha: ${new Date(d.certificado.fecha).toLocaleDateString('es-AR')}</div>`:''}
  </div>
</div>
<table>
  <thead><tr><th>Ítem</th><th class="r">Precio total</th><th class="r">% Anterior</th><th class="r">% Este cert.</th><th class="r">% Acumulado</th><th class="r">Monto período</th><th class="r">Monto acumulado</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="res">
  <div class="res-h">Resumen del certificado</div>
  <div class="res-b">
    <div class="blk"><div class="lbl">Total presupuesto</div><div class="val">${fmt(totalPresupuesto)}</div></div>
    <div class="blk"><div class="lbl">Este período</div><div class="val" style="font-size:15pt">${fmt(d.totales?.total_periodo)}</div></div>
    <div class="blk"><div class="lbl">Total acumulado</div><div class="val">${fmt(d.totales?.total_acumulado)}</div></div>
    <div class="blk"><div class="lbl">Avance global</div><div class="val">${fmtPct(d.totales?.pct_avance_global)}</div></div>
  </div>
</div>
${(() => {
  const aj = ajustesPorCert[d.certificado?.numero] || {};
  const subtotal = d.totales?.total_periodo || 0;
  const mayores = subtotal * (parseFloat(aj.mayores_costos_pct) || 0) / 100;
  const fondo = subtotal * (parseFloat(aj.fondo_reparo_pct) || 0) / 100;
  const multas = parseFloat(aj.multas) || 0;
  const neto = subtotal + mayores - fondo - multas;
  const tieneAjustes = mayores || fondo || multas || aj.nota;
  if (!tieneAjustes) return '';
  return '<table style="width:100%;border-collapse:collapse;margin-bottom:14px">' +
    '<thead><tr><th colspan="2" style="background:#1a1a1a;color:#fff;padding:5px 8px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.8px;text-align:left">Ajustes del certificado</th></tr></thead>' +
    '<tbody>' +
    '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt">Subtotal certificado</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt;text-align:right;font-family:monospace">' + fmt(subtotal) + '</td></tr>' +
    (mayores > 0 ? '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt">+ Mayores costos (' + aj.mayores_costos_pct + '%)</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt;text-align:right;font-family:monospace">+ ' + fmt(mayores) + '</td></tr>' : '') +
    (fondo > 0 ? '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt">− Fondo de reparo (' + aj.fondo_reparo_pct + '%)</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt;text-align:right;font-family:monospace">− ' + fmt(fondo) + '</td></tr>' : '') +
    (multas > 0 ? '<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt">− Multas</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:9pt;text-align:right;font-family:monospace">− ' + fmt(multas) + '</td></tr>' : '') +
    '<tr style="background:#f5f5f5;font-weight:700"><td style="padding:6px 8px;font-size:9.5pt">Importe neto del certificado</td><td style="padding:6px 8px;font-size:9.5pt;text-align:right;font-family:monospace">' + fmt(neto) + '</td></tr>' +
    (aj.nota ? '<tr><td colspan="2" style="padding:5px 8px;font-size:8.5pt;color:#555;font-style:italic"><strong>Nota:</strong> ' + aj.nota + '</td></tr>' : '') +
    '</tbody></table>';
})()}
${egresosSection}
${certEg ? `
<div style="margin-top:20px;border:2.5px solid #111;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;page-break-inside:avoid">
  <div style="font-size:11pt;font-weight:700;text-transform:uppercase;letter-spacing:1px">Total a pagar</div>
  <div style="display:flex;gap:32px;align-items:center">
    <div style="text-align:center">
      <div style="font-size:7.5pt;text-transform:uppercase;color:#666;letter-spacing:.8px;margin-bottom:3px">Certificado de avance</div>
      <div style="font-family:Courier New,monospace;font-size:13pt;font-weight:700">${fmt(d.totales?.total_periodo)}</div>
    </div>
    <div style="font-size:18pt;color:#888">+</div>
    <div style="text-align:center">
      <div style="font-size:7.5pt;text-transform:uppercase;color:#666;letter-spacing:.8px;margin-bottom:3px">Egresos / materiales</div>
      <div style="font-family:Courier New,monospace;font-size:13pt;font-weight:700">${fmt(certEg.total)}</div>
    </div>
    <div style="font-size:18pt;color:#888">=</div>
    <div style="text-align:center;border-left:2px solid #111;padding-left:20px">
      <div style="font-size:7.5pt;text-transform:uppercase;color:#666;letter-spacing:.8px;margin-bottom:3px">Total</div>
      <div style="font-family:Courier New,monospace;font-size:16pt;font-weight:900">${fmt((d.totales?.total_periodo||0) + (certEg.total||0))}</div>
    </div>
  </div>
</div>` : ''}
<div class="firmas">
  <div class="firma"><div>Firma dirección de obra</div></div>
  <div class="firma"><div>Firma comitente</div></div>
</div>
<footer><span>Fima Arquitectura — Certificado Nº ${d.certificado?.numero} — ${hoyStr}</span><span>${presupuesto?.nombre_obra}</span></footer>
</body></html>`;
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const win = window.open(url,'_blank');
    setTimeout(()=>{ win.print(); URL.revokeObjectURL(url); }, 800);
  };

  const guardarCertEgresos = async (sel, total, vinculadoNum) => {
    await sb.from('cert_egresos').insert({
      presupuesto_id: parseInt(id),
      certificado_num: vinculadoNum ? parseInt(vinculadoNum) : null,
      fecha: new Date().toISOString().split('T')[0],
      obra: presupuesto?.nombre_obra,
      egresos: sel,
      total: total,
    });
    await cargarCertEgresos();
  };

  // Función reutilizable de impresión del cert de egresos (standalone)
  const imprimirCertEgresos = (sel, total, vinculadoNum) => {
    const now = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
    const certNumLabel = vinculadoNum ? ("Nº " + vinculadoNum) : "";
    const obraNombre = presupuesto?.nombre_obra || "";
    const filas = (sel||[]).map(e =>
      ["<tr><td>", (e.concepto||"—"), "</td><td class=\"n b\">$",
       Math.round(parseFloat(e.monto)||0).toLocaleString("es-AR"),
       "</td><td>", (e._semana||"—"), "</td><td>", (e.estado||"—"),
       "</td></tr>"].join("")
    ).join("");
    const totalFmt = Math.round(total).toLocaleString("es-AR");
    const win = window.open("","_blank");
    win.document.open();
    win.document.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Cert. Egresos</title>");
    win.document.write("<style>");
    win.document.write("html,body{background:#fff;color:#111;font-family:Arial,sans-serif;font-size:10pt;margin:0;padding:20px 28px}");
    win.document.write(".top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}");
    win.document.write(".empresa{font-size:18pt;font-weight:900}");
    win.document.write(".titulo{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#444;margin-top:2px}");
    win.document.write(".datos{font-size:8.5pt;color:#555;margin-top:5px}");
    win.document.write(".meta{font-size:8.5pt;color:#555;text-align:right;line-height:1.7}");
    win.document.write("table{width:100%;border-collapse:collapse;margin-bottom:14px}");
    win.document.write("th{background:#1a1a1a;color:#fff;padding:5px 8px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.8px;text-align:left}");
    win.document.write("th.r{text-align:right}");
    win.document.write("td{padding:5px 8px;border-bottom:1px solid #e5e5e5;font-size:9pt;color:#111}");
    win.document.write("tr:nth-child(even) td{background:#f9f9f9}");
    win.document.write(".n{text-align:right;font-family:monospace}.b{font-weight:700}");
    win.document.write(".total-row{font-weight:700;background:#f5f5f5}");
    win.document.write(".firmas{display:flex;justify-content:space-between;margin-top:50px;padding:0 10px}");
    win.document.write(".firma{width:200px;text-align:center}");
    win.document.write(".firma div{border-top:1px solid #333;padding-top:7px;font-size:9pt;color:#444}");
    win.document.write("footer{margin-top:16px;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between;font-size:8pt;color:#888}");
    win.document.write("</style></head><body>");
    win.document.write("<div class=\"top\"><div>");
    win.document.write("<div class=\"empresa\">Fima Arquitectura</div>");
    win.document.write("<div class=\"titulo\">Certificado de Egresos / Materiales " + certNumLabel + "</div>");
    win.document.write("<div class=\"datos\"><strong>Obra:</strong> " + obraNombre + "</div>");
    win.document.write("<div class=\"datos\"><strong>Fecha:</strong> " + now + "</div>");
    win.document.write("</div><div class=\"meta\"><div>Resistencia, " + now + "</div></div></div>");
    win.document.write("<table><thead><tr><th>Concepto</th><th class=\"r\">Monto</th><th>Semana</th><th>Estado</th></tr></thead><tbody>");
    win.document.write(filas);
    win.document.write("<tr class=\"total-row\"><td>Total</td><td class=\"n\">$" + totalFmt + "</td><td></td><td></td></tr>");
    win.document.write("</tbody></table>");
    win.document.write("<div class=\"firmas\"><div class=\"firma\"><div>Firma dirección de obra</div></div><div class=\"firma\"><div>Firma comitente</div></div></div>");
    win.document.write("<footer><span>Fima Arquitectura — Cert. Egresos " + certNumLabel + " — " + now + "</span><span>" + obraNombre + "</span></footer>");
    win.document.write("</body></html>");
    win.document.close();
    setTimeout(function(){ win.document.body.style.background="white"; win.print(); }, 600);
  };

  if (loading) return <div className="loading">Cargando...</div>;

  const lineas = [
    ...(presupuesto?.rubros?.flatMap(r => r.lineas) || []),
    ...adicionales.filter(a => a.estado === 'cerrado').flatMap(a => a.rubros?.flatMap(r => r.lineas) || [])
  ];
  const totalPresupuesto = presupuesto?.totales?.total_precio_con_iva || 0;
  const ultimoNumCert = certificados.length > 0 ? certificados[certificados.length - 1].numero : 0;
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div>
      <div className="no-print">
        <div className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>FIMA</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>
              <ArrowLeft size={14} /> Volver
            </button>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{presupuesto?.nombre_obra}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Certificados de avance</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div className="header-actions-desktop" style={{ gap: 8 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEgresos(true)}>
                📄 Cert. egresos
              </button>
              {presupuesto?.estado === 'cerrado' && (
                <button className="btn btn-primary btn-sm" onClick={abrirModalNuevo}>
                  <Plus size={14} /> Nuevo certificado
                </button>
              )}
            </div>
            <MobileMenu actions={[
              { label: 'Cert. egresos', icon: '📄', onClick: () => setShowEgresos(true) },
              ...(presupuesto?.estado === 'cerrado' ? [{ label: 'Nuevo certificado', icon: '➕', onClick: abrirModalNuevo, color: 'var(--accent2)' }] : []),
            ]} />
          </div>
        </div>

        <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
          {adicionales.length > 0 && (
            <div style={{ marginBottom: 12, padding: '8px 14px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--accent2)', fontWeight: 600 }}>📋 Adicionales vinculados: </span>
              {adicionales.map(a => (
                <span key={a.id} style={{ marginRight: 12, color: 'var(--muted)' }}>
                  {a.nombre_obra}
                  {a.estado === 'cerrado'
                    ? <span style={{ color: 'var(--accent2)', marginLeft: 4 }}>{fmt(a.total_precio_con_iva)} ✓</span>
                    : <span style={{ color: 'var(--warn)', marginLeft: 4 }}>⚠ abierto — cerrar para incluir en certificado</span>}
                </span>
              ))}
            </div>
          )}
          <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Total presupuesto</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--precio)' }}>{fmt(totalPresupuesto)}</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }}></div>
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Certificados emitidos</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700 }}>{certificados.length}</div>
            </div>
            {certificados.length > 0 && (
              <>
                <div style={{ width: 1, background: 'var(--border)' }}></div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Total certificado</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--warn)' }}>
                    {fmt(certificados[certificados.length - 1]?.total_acumulado)}
                  </div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }}></div>
                <div>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)' }}>Avance global</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                    {totalPresupuesto > 0 ? (certificados[certificados.length - 1]?.total_acumulado / totalPresupuesto * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </>
            )}
          </div>

          {certificados.length === 0 ? (
            <div className="empty"><h3>Sin certificados aún</h3><p>Creá el primer certificado de avance</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {certificados.map(cert => {
                // cert de egresos vinculado a este número
                const certEgVinculado = certEgresosGuardados.find(ce => ce.certificado_num === cert.numero);
                return (
                  <div key={cert.id}>
                    <div className="card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>
                          {cert.numero}
                        </div>
                        <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => verDetalle(cert.numero)}>
                          <div style={{ fontWeight: 700 }}>Certificado Nº {cert.numero}</div>
                          {cert.fecha && <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{new Date(cert.fecha+'T12:00:00').toLocaleDateString('es-AR')}</div>}
                          {cert.periodo_desde && <div style={{ fontSize: 10, color: 'var(--muted)' }}>Período: {new Date(cert.periodo_desde+'T12:00:00').toLocaleDateString('es-AR')} → {cert.periodo_hasta ? new Date(cert.periodo_hasta+'T12:00:00').toLocaleDateString('es-AR') : '—'}</div>}
                          {certEgVinculado && (
                            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2 }}>
                              📎 Cert. egresos: {fmt(certEgVinculado.total)}
                            </div>
                          )}
                          {ajustesPorCert[cert.numero] && (ajustesPorCert[cert.numero].mayores_costos_pct > 0 || ajustesPorCert[cert.numero].fondo_reparo_pct > 0 || ajustesPorCert[cert.numero].multas > 0) && (
                            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                              {ajustesPorCert[cert.numero].mayores_costos_pct > 0 && <span style={{ marginRight: 8 }}>MC: {ajustesPorCert[cert.numero].mayores_costos_pct}%</span>}
                              {ajustesPorCert[cert.numero].fondo_reparo_pct > 0 && <span style={{ marginRight: 8 }}>FR: {ajustesPorCert[cert.numero].fondo_reparo_pct}%</span>}
                              {ajustesPorCert[cert.numero].multas > 0 && <span>Multas: {fmt(ajustesPorCert[cert.numero].multas)}</span>}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => verDetalle(cert.numero)}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Este período</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--precio)' }}>{fmt(cert.total_periodo)}</div>
                        </div>
                        <div style={{ width: 1, height: 36, background: 'var(--border)' }}></div>
                        <div style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => verDetalle(cert.numero)}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Acumulado</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--warn)' }}>{fmt(cert.total_acumulado)}</div>
                        </div>
                        <div style={{ textAlign: 'right', minWidth: 60, cursor: 'pointer' }} onClick={() => verDetalle(cert.numero)}>
                          <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Avance</div>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                            {totalPresupuesto > 0 ? (cert.total_acumulado / totalPresupuesto * 100).toFixed(1) : 0}%
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            // Need full detail to print
                            let det = certDetalle;
                            if (!det || det.certificado?.numero !== cert.numero) {
                              try { const res = await getCertificado(id, cert.numero); det = res.data; } catch(e) {}
                            }
                            if (det) imprimirCertItems(det);
                          }} title="Imprimir certificado">
                            <Printer size={13} />
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={async () => {
                            let det = certDetalle;
                            if (!det || det.certificado?.numero !== cert.numero) {
                              try { const res = await getCertificado(id, cert.numero); det = res.data; setCertDetalle(det); } catch(e) {}
                            } else { det = certDetalle; }
                            if (det) {
                              setModalEditCert(det.certificado);
                              setEditFecha(det.certificado?.fecha?.split('T')[0] || '');
                              setEditDesde(det.certificado?.periodo_desde || '');
                              setEditHasta(det.certificado?.periodo_hasta || '');
                              const av = {};
                              det.detalles?.forEach(d => { av[d.linea_id] = d.pct_periodo; });
                              setEditAvances(av);
                              // Pre-fill ajustes
                              const aj = ajustesPorCert[det.certificado?.numero] || {};
                              setEditMayoresCostosPct(aj.mayores_costos_pct || 0);
                              setEditFondoReparoPct(aj.fondo_reparo_pct || 0);
                              setEditMultas(aj.multas || 0);
                              setEditNota(aj.nota || '');
                            }
                          }} title="Editar certificado">
                            <Edit2 size={13} />
                          </button>
                          {cert.numero === ultimoNumCert && (
                            <button className="btn btn-danger btn-sm"
                              onClick={() => handleEliminarCert(cert.numero)}
                              title="Eliminar este certificado">
                              <Trash2 size={13} />
                            </button>
                          )}
                          <div style={{ color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }} onClick={() => verDetalle(cert.numero)}>
                            {certDetalle?.certificado?.numero === cert.numero ? '▲' : '▼'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cert de egresos vinculado a este cert — aparece debajo */}
                    {certEgVinculado && (
                      <div style={{ marginTop: 2, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--danger)' }}>📎 Certificado de Egresos adjunto</div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                            {(certEgVinculado.egresos||[]).length} ítems · {certEgVinculado.fecha ? new Date(certEgVinculado.fecha+'T12:00:00').toLocaleDateString('es-AR') : '—'}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 15, fontWeight: 700, color: 'var(--danger)' }}>{fmt(certEgVinculado.total)}</div>
                          <button className="btn btn-secondary btn-sm" onClick={() => imprimirCertEgresos(certEgVinculado.egresos||[], certEgVinculado.total, certEgVinculado.certificado_num)}>🖨 Imprimir</button>
                          <button className="btn btn-danger btn-sm" onClick={async () => {
                            if(!window.confirm('¿Eliminar este certificado de egresos?')) return;
                            await sb.from('cert_egresos').delete().eq('id', certEgVinculado.id);
                            await cargarCertEgresos();
                          }}>×</button>
                        </div>
                      </div>
                    )}

                    {certDetalle?.certificado?.numero === cert.numero && (
                      <div className="card" style={{ marginTop: 4, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: 'none' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ background: 'var(--surface2)' }}>
                              <th style={th}>Ítem</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Precio total</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--muted)' }}>% Anterior</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--accent2)' }}>% Este cert.</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--accent)' }}>% Acumulado</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Monto período</th>
                              <th style={{ ...th, textAlign: 'right', color: 'var(--warn)' }}>Monto acumulado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {certDetalle.detalles?.map((d, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid rgba(46,46,56,0.5)' }}>
                                <td style={td}>
                                  <div style={{ fontSize: 12 }}>{d.nombre_item}</div>
                                  <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{d.categoria_nombre}</div>
                                </td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--precio)' }}>{fmt(d.precio_total_item)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtPct(d.pct_anterior)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{fmtPct(d.pct_periodo)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{fmtPct(d.pct_acumulado)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--precio)' }}>{fmt(d.monto_periodo)}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>{fmt(d.monto_acumulado)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
                          {[
                            { label: 'Total período', val: certDetalle.totales?.total_periodo, color: 'var(--precio)' },
                            { label: 'Total acumulado', val: certDetalle.totales?.total_acumulado, color: 'var(--warn)' },
                            { label: 'Avance global', val: null, extra: fmtPct(certDetalle.totales?.pct_avance_global), color: 'var(--accent)' },
                          ].map((t, i) => (
                            <div key={i} style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--muted)' }}>{t.label}</div>
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: t.color }}>{t.extra || fmt(t.val)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL NUEVO CERTIFICADO */}
        {modalNuevo && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 750 }} onClick={e => e.stopPropagation()}>
              <h2>Nuevo certificado — Nº {certificados.length + 1}</h2>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
                Ingresá el % de avance <strong>de este período</strong>. El acumulado se calcula automáticamente.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha certificado</label>
                  <input className="input" type="date" value={nuevoCertFecha || ''} onChange={e => setNuevoCertFecha(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Período desde</label>
                  <input className="input" type="date" value={nuevoCertDesde || ''} onChange={e => setNuevoCertDesde(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Período hasta</label>
                  <input className="input" type="date" value={nuevoCertHasta || ''} onChange={e => setNuevoCertHasta(e.target.value)} />
                </div>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 1 }}>Ítem</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 1 }}>% Anterior</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--accent2)', letterSpacing: 1 }}>% Este período</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, textTransform: 'uppercase', color: 'var(--accent)', letterSpacing: 1 }}>% Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Rubros del presupuesto base */}
                    {presupuesto?.rubros?.map(rubro => (
                      <React.Fragment key={rubro.numero}>
                        <tr>
                          <td colSpan={4} style={{ padding: '6px 12px', background: 'var(--surface2)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.8 }}>
                            {rubro.numero} — {rubro.nombre}
                          </td>
                        </tr>
                        {rubro.lineas?.map(linea => {
                          const pctAnt = avancesAnteriores[linea.id] || 0;
                          const pctPer = parseFloat(avances[linea.id]) || 0;
                          const pctAcum = Math.min(100, pctAnt + pctPer).toFixed(1);
                          return (
                            <tr key={linea.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.5)' }}>
                              <td style={{ padding: '8px 12px', fontSize: 12 }}>{linea.nombre_item || linea.nombre_libre}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtPct(pctAnt)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                  <input type="number" min="0" max={100 - pctAnt} step="1"
                                    value={avances[linea.id] || 0}
                                    onChange={e => setAvances(prev => ({ ...prev, [linea.id]: e.target.value }))}
                                    style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }} />
                                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>%</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{pctAcum}%</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                    {/* Adicionales cerrados */}
                    {adicionales.filter(a => a.estado === 'cerrado').map(adic => (
                      <React.Fragment key={'adic-' + adic.id}>
                        <tr>
                          <td colSpan={4} style={{ padding: '6px 12px', background: 'rgba(167,139,250,0.12)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent2)', letterSpacing: 0.8 }}>
                            📋 Adicional — {adic.nombre_obra}
                          </td>
                        </tr>
                        {adic.rubros?.flatMap(r => r.lineas)?.map(linea => {
                          const pctAnt = avancesAnteriores[linea.id] || 0;
                          const pctPer = parseFloat(avances[linea.id]) || 0;
                          const pctAcum = Math.min(100, pctAnt + pctPer).toFixed(1);
                          return (
                            <tr key={linea.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.5)' }}>
                              <td style={{ padding: '8px 12px', fontSize: 12 }}>{linea.nombre_item || linea.nombre_libre}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>{fmtPct(pctAnt)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                  <input type="number" min="0" max={100 - pctAnt} step="1"
                                    value={avances[linea.id] || 0}
                                    onChange={e => setAvances(prev => ({ ...prev, [linea.id]: e.target.value }))}
                                    style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }} />
                                  <span style={{ color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>%</span>
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{pctAcum}%</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Ajustes */}
              <div style={{ marginTop: 16, background: 'var(--surface2)', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Ajustes del certificado</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Mayores costos %</label>
                    <input className="input" type="number" min="0" step="0.1" value={certMayoresCostosPct} onChange={e => setCertMayoresCostosPct(e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fondo de reparo %</label>
                    <input className="input" type="number" min="0" step="0.1" value={certFondoReparoPct} onChange={e => setCertFondoReparoPct(e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Multas $</label>
                    <input className="input" type="number" min="0" value={certMultas} onChange={e => setCertMultas(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nota / observación</label>
                  <input className="input" value={certNota} onChange={e => setCertNota(e.target.value)} placeholder="Observaciones del certificado..." />
                </div>
              </div>

              <div style={{ marginTop: 12, padding: '12px', background: 'var(--surface2)', borderRadius: 8, fontFamily: 'var(--mono)', fontSize: 13 }}>
                {(() => {
                  const subtotal = lineas.reduce((sum, l) => {
                    const pctPer = parseFloat(avances[l.id]) || 0;
                    return sum + (l.precio_venta_con_iva * pctPer / 100);
                  }, 0);
                  const mayores = subtotal * (parseFloat(certMayoresCostosPct) || 0) / 100;
                  const fondo = subtotal * (parseFloat(certFondoReparoPct) || 0) / 100;
                  const multas = parseFloat(certMultas) || 0;
                  const neto = subtotal + mayores - fondo - multas;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>Subtotal certificado:</span>
                        <span style={{ color: 'var(--precio)' }}>{fmt(subtotal)}</span>
                      </div>
                      {mayores > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>+ Mayores costos ({certMayoresCostosPct}%):</span>
                        <span style={{ color: 'var(--accent)' }}>+ {fmt(mayores)}</span>
                      </div>}
                      {fondo > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>− Fondo de reparo ({certFondoReparoPct}%):</span>
                        <span style={{ color: 'var(--warn)' }}>− {fmt(fondo)}</span>
                      </div>}
                      {multas > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted)' }}>− Multas:</span>
                        <span style={{ color: 'var(--danger)' }}>− {fmt(multas)}</span>
                      </div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4, fontWeight: 700, fontSize: 15 }}>
                        <span style={{ color: 'var(--muted)' }}>Importe neto:</span>
                        <span style={{ color: 'var(--precio)' }}>{fmt(neto)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setModalNuevo(false)}>Cancelar</button>
                <button className="btn btn-success" onClick={handleCrearCertificado} disabled={guardando}>
                  <FileText size={14} /> {guardando ? 'Guardando...' : 'Emitir certificado'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDITAR CERTIFICADO */}
        {modalEditCert && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
              <h2>Editar certificado Nº {modalEditCert.numero}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Fecha certificado</label>
                  <input className="input" type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Período desde</label>
                  <input className="input" type="date" value={editDesde} onChange={e => setEditDesde(e.target.value)} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Período hasta</label>
                  <input className="input" type="date" value={editHasta} onChange={e => setEditHasta(e.target.value)} />
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>
                Porcentajes de avance — este período
              </div>
              <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                {certDetalle?.detalles?.map(d => (
                  <div key={d.linea_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border2)' }}>
                    <div style={{ flex: 1, fontSize: 12 }}>{d.nombre_item}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', minWidth: 80, textAlign: 'right' }}>
                      Ant: {d.pct_anterior?.toFixed(1)}%
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" max={100 - (d.pct_anterior || 0)} step="1"
                        value={editAvances[d.linea_id] ?? d.pct_periodo}
                        onChange={e => setEditAvances(prev => ({ ...prev, [d.linea_id]: e.target.value }))}
                        style={{ width: 70, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '4px 8px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 12, textAlign: 'right' }} />
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>%</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--accent)', minWidth: 70, textAlign: 'right', fontFamily: 'var(--mono)' }}>
                      Acum: {Math.min(100, (d.pct_anterior || 0) + parseFloat((editAvances[d.linea_id] ?? d.pct_periodo) || 0)).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
              {/* Ajustes edición */}
              <div style={{ marginTop: 12, background: 'var(--surface2)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10 }}>Ajustes</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Mayores costos %</label>
                    <input className="input" type="number" min="0" step="0.1" value={editMayoresCostosPct} onChange={e => setEditMayoresCostosPct(e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fondo de reparo %</label>
                    <input className="input" type="number" min="0" step="0.1" value={editFondoReparoPct} onChange={e => setEditFondoReparoPct(e.target.value)} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Multas $</label>
                    <input className="input" type="number" min="0" value={editMultas} onChange={e => setEditMultas(e.target.value)} placeholder="0" />
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Nota / observación</label>
                  <input className="input" value={editNota} onChange={e => setEditNota(e.target.value)} placeholder="Observaciones..." />
                </div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setModalEditCert(null)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleEditCert}>Guardar cambios</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CERTIFICADO DE EGRESOS */}
        {showEgresos && (
          <div className="modal-overlay">
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <h2>Certificado de egresos — {presupuesto?.nombre_obra}</h2>
              <p style={{ color: 'var(--muted)', fontSize: 12, marginBottom: 12 }}>
                Seleccioná los egresos e indicá a qué certificado corresponden
              </p>

              {/* Selector de certificado al que se vincula */}
              {certificados.length > 0 && (
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>Vincular al certificado Nº</label>
                  <select className="input" value={egresosVinculadoNum} onChange={e => setEgresosVinculadoNum(e.target.value)}>
                    <option value="">Sin vincular</option>
                    {certificados.map(c => (
                      <option key={c.numero} value={c.numero}>
                        Certificado Nº {c.numero}{c.periodo_desde ? ` — ${new Date(c.periodo_desde+'T12:00:00').toLocaleDateString('es-AR')}` : ''}{c.fecha ? ` (${new Date(c.fecha+'T12:00:00').toLocaleDateString('es-AR')})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Filtro por semana */}
              {semanasDisp.length > 1 && (
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label>Semana</label>
                  <select className="input" value={semanaFiltroEg} onChange={e => setSemanaFiltroEg(e.target.value)}>
                    <option value="todas">Todas las semanas ({egresos.length} egresos)</option>
                    {semanasDisp.map(s => {
                      const cnt = egresos.filter(e => e._semana_id === s.id).length;
                      return <option key={s.id} value={s.id}>Semana {s.label} ({cnt} egresos)</option>;
                    })}
                  </select>
                </div>
              )}

              {/* Lista filtrada */}
              {(() => {
                const egFiltrados = semanaFiltroEg === 'todas' ? egresos : egresos.filter(e => String(e._semana_id) === String(semanaFiltroEg));
                return (
              <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 16 }}>
                {egFiltrados.length === 0 && <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 20 }}>{egresos.length === 0 ? 'Sin egresos pendientes de certificar' : 'No hay egresos en esta semana'}</div>}
                {egFiltrados.filter(e=>e._coincide).length > 0 && (
                  <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '6px 0', marginBottom: 4 }}>
                    ● Coinciden con esta obra ({egFiltrados.filter(e=>e._coincide).length})
                    <button onClick={() => { const sel = {}; egFiltrados.filter(e=>e._coincide).forEach(e=>{ sel[e._key]=true; }); setEgresosSeleccion(sel); }}
                      style={{ marginLeft: 10, fontSize: 10, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                      Seleccionar todos
                    </button>
                  </div>
                )}
                {[...egFiltrados.filter(e=>e._coincide), ...egFiltrados.filter(e=>!e._coincide)].map((e, idx) => (
                  <React.Fragment key={e._key}>
                    {idx === egFiltrados.filter(e=>e._coincide).length && egFiltrados.filter(e=>!e._coincide).length > 0 && (
                      <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', padding: '10px 0 4px' }}>
                        Otros egresos
                      </div>
                    )}
                    <div onClick={() => setEgresosSeleccion(s => ({ ...s, [e._key]: !s[e._key] }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 6,
                        background: egresosSeleccion[e._key] ? 'rgba(110,231,183,.08)' : 'var(--surface2)',
                        border: `1px solid ${egresosSeleccion[e._key] ? 'rgba(110,231,183,.3)' : 'var(--border)'}`, cursor: 'pointer' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: `1px solid ${egresosSeleccion[e._key] ? 'var(--accent)' : 'var(--border)'}`,
                        background: egresosSeleccion[e._key] ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#0f0f11', flexShrink: 0 }}>
                        {egresosSeleccion[e._key] ? '✓' : ''}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{e.concepto || '—'}</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{e._semana} · {e.estado || '—'}</span>
                          {e.obra && (
                            <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(110,231,183,0.1)', color: 'var(--accent)', fontWeight: 600 }}>
                              🏗 {e.obra}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--danger)' }}>
                        ${Math.round(parseFloat(e.monto)||0).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
                );
              })()}
              {/* Gastos manuales */}
              <div style={{ marginBottom: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                  + Agregar gasto manual
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <input className="input" placeholder="Concepto" value={nuevoGasto.concepto}
                    onChange={e => setNuevoGasto(g => ({...g, concepto: e.target.value}))}
                    style={{ flex: 2, fontSize: 12, padding: '6px 10px' }} />
                  <input className="input" placeholder="Monto" type="number" value={nuevoGasto.monto}
                    onChange={e => setNuevoGasto(g => ({...g, monto: e.target.value}))}
                    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} />
                  <button className="btn btn-secondary btn-sm" onClick={() => {
                    if (!nuevoGasto.concepto || !nuevoGasto.monto) return;
                    setGastosExtra(g => [...g, { concepto: nuevoGasto.concepto, monto: nuevoGasto.monto, _key: 'extra-' + Date.now(), _semana: '—', estado: 'Manual' }]);
                    setNuevoGasto({ concepto: '', monto: '' });
                  }}>+ Agregar</button>
                </div>
                {gastosExtra.map((g, i) => (
                  <div key={g._key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 4, border: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, fontSize: 12 }}>{g.concepto}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--warn)' }}>${Math.round(parseFloat(g.monto)||0).toLocaleString('es-AR')}</div>
                    <button onClick={() => setGastosExtra(prev => prev.filter((_,j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--border)', marginBottom: 16 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total seleccionado</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
                  ${Math.round(
                    egresos.filter(e=>egresosSeleccion[e._key]).reduce((a,b)=>a+(parseFloat(b.monto)||0),0) +
                    gastosExtra.reduce((a,b)=>a+(parseFloat(b.monto)||0),0)
                  ).toLocaleString('es-AR')}
                </span>
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setShowEgresos(false)}>Cancelar</button>
                <button className="btn btn-secondary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  💾 Guardar
                </button>
                <button className="btn btn-primary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    imprimirCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  🖨 Guardar e imprimir
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {certDetalle && (
        <div className="print-container">
          <div className="print-header">
            <div className="print-header-top">
              <div>
                <div className="print-empresa">Fima Arquitectura</div>
                <div className="print-titulo">Certificado de avance Nº {certDetalle.certificado?.numero}</div>
              </div>
              <div className="print-fecha">
                <div>Resistencia, {hoy}</div>
                {certDetalle.certificado?.fecha && (
                  <div>Fecha: {new Date(certDetalle.certificado.fecha).toLocaleDateString('es-AR')}</div>
                )}
                {certDetalle.certificado?.periodo_desde && (
                  <div>Período: {new Date(certDetalle.certificado.periodo_desde).toLocaleDateString('es-AR')} al {certDetalle.certificado?.periodo_hasta ? new Date(certDetalle.certificado.periodo_hasta).toLocaleDateString('es-AR') : '—'}</div>
                )}
              </div>
            </div>
            <div className="print-datos">
              <strong>Obra:</strong> {presupuesto?.nombre_obra}
              {presupuesto?.ubicacion && <> &nbsp;·&nbsp; <strong>Ubicación:</strong> {presupuesto.ubicacion}</>}
            </div>
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th>Ítem</th>
                <th className="right">Precio total</th>
                <th className="right">% Anterior</th>
                <th className="right">% Este cert.</th>
                <th className="right">% Acumulado</th>
                <th className="right">Monto período</th>
                <th className="right">Monto acumulado</th>
              </tr>
            </thead>
            <tbody>
              {certDetalle.detalles?.map((d, i) => (
                <tr key={i} className="print-row-item">
                  <td>{d.nombre_item}</td>
                  <td className="print-num print-col-precio">{fmt(d.precio_total_item)}</td>
                  <td className="print-num" style={{ color: '#888' }}>{fmtPct(d.pct_anterior)}</td>
                  <td className="print-num" style={{ fontWeight: 700 }}>{fmtPct(d.pct_periodo)}</td>
                  <td className="print-num" style={{ fontWeight: 700 }}>{fmtPct(d.pct_acumulado)}</td>
                  <td className="print-num print-col-precio">{fmt(d.monto_periodo)}</td>
                  <td className="print-num print-col-ejec" style={{ fontWeight: 700 }}>{fmt(d.monto_acumulado)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-totales">
            <div className="print-totales-header">Resumen del certificado</div>
            <div className="print-totales-body">
              <div className="print-total-block">
                <div className="print-total-label">Total presupuesto</div>
                <div className="print-total-val print-total-precio">{fmt(totalPresupuesto)}</div>
              </div>
              <div className="print-total-block">
                <div className="print-total-label">Este período</div>
                <div className="print-total-val print-total-precio" style={{ fontSize: 18 }}>{fmt(certDetalle.totales?.total_periodo)}</div>
              </div>
              <div className="print-total-block">
                <div className="print-total-label">Total acumulado</div>
                <div className="print-total-val print-total-margen">{fmt(certDetalle.totales?.total_acumulado)}</div>
              </div>
              <div className="print-total-block">
                <div className="print-total-label">Avance global</div>
                <div className="print-total-val print-total-ejec">{fmtPct(certDetalle.totales?.pct_avance_global)}</div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 48, display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'center', width: 200 }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, fontSize: 10, color: '#555' }}>Firma dirección de obra</div>
            </div>
            <div style={{ textAlign: 'center', width: 200 }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, fontSize: 10, color: '#555' }}>Firma comitente</div>
            </div>
          </div>

          <div className="print-footer">
            <span>Fima Arquitectura — Certificado Nº {certDetalle.certificado?.numero} — {hoy}</span>
            <span>{presupuesto?.nombre_obra}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '10px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '10px 12px', verticalAlign: 'middle' };
