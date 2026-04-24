import '../index.css';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getPresupuesto, actualizarPresupuesto, cerrarPresupuesto, reabrirPresupuesto,
  getCategorias, getItems, agregarLinea, actualizarLinea, eliminarLinea
} from '../api';
import api from '../api';
import { ArrowLeft, Lock, Unlock, Search, Plus, FileText, BarChart2, X } from 'lucide-react';
import PrintPresupuesto from './PrintPresupuesto';
import PanelAnalisis from './PanelAnalisis';
import PanelComputo from './PanelComputo';
import MobileMenu from './MobileMenu';
import '../print.css';

const fmt = (n) => {
  if (!n && n !== 0) return '—';
  if (n === 0) return '$ 0';
  return '$ ' + Math.round(n).toLocaleString('es-AR');
};

export default function Presupuesto() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [items, setItems] = useState([]);
  const [catSeleccionada, setCatSeleccionada] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState('ambos');
  const [loading, setLoading] = useState(true);
  const [modalLibre, setModalLibre] = useState(false);
  const [itemLibre, setItemLibre] = useState({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
  const [modoLibre, setModoLibre] = useState('global'); // 'global' | 'desglosado'
  const [libreAbrirAnalisis, setLibreAbrirAnalisis] = useState(false); // abrir panel tras crear
  const [itemPendiente, setItemPendiente] = useState(null); // ítem catálogo esperando rubro destino
  const [rubroLibreSelec, setRubroLibreSelec] = useState(''); // rubro destino para ítem libre
  const [modalNuevoRubro, setModalNuevoRubro] = useState(false);
  const [nuevoRubroNombre, setNuevoRubroNombre] = useState('');
  const [coefs, setCoefs] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [printMode, setPrintMode] = useState('comercial');
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [computoLinea, setComputoLinea] = useState(null); // ítem con panel de cómputo abierto
  const [lineaSeleccionadaAdic, setLineaSeleccionadaAdic] = useState(null); // para PanelAnalisis del adicional
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const [coefsOpen, setCoefsOpen] = useState(false); // coeficientes panel collapsed by default
  const [observaciones, setObservaciones] = useState(''); // observación general del presupuesto
  const [obsOpen, setObsOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false); // mobile header menu
  const [editandoNombreId, setEditandoNombreId] = useState(null); // id de línea en edición de nombre
  const [nombreEditVal, setNombreEditVal] = useState('');
  const [editandoRubroNum, setEditandoRubroNum] = useState(null);
  const [rubroEditVal, setRubroEditVal] = useState('');

  // Adicionales
  const [adicionales, setAdicionales] = useState([]);
  const [modalAdicional, setModalAdicional] = useState(null); // { id, nombre_obra, estado } | 'nuevo'
  const [busquedaAdic, setBusquedaAdic] = useState('');
  const [catAdic, setCatAdic] = useState(null);
  const [itemsAdic, setItemsAdic] = useState([]);
  const [itemLibreAdic, setItemLibreAdic] = useState({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
  const [showLibreAdic, setShowLibreAdic] = useState(false);
  const [creandoAdic, setCreandoAdic] = useState(false);

  useEffect(() => { cargar(); cargarAdicionales(); getCategorias().then(r => setCategorias(r.data)); }, [id]);
  useEffect(() => {
    if (catSeleccionada) getItems(catSeleccionada).then(r => setItems(r.data));
    else getItems().then(r => setItems(r.data));
  }, [catSeleccionada]);
  useEffect(() => {
    if (catAdic) getItems(catAdic).then(r => setItemsAdic(r.data));
    else getItems().then(r => setItemsAdic(r.data));
  }, [catAdic]);

  const cargar = async () => {
    setLoading(true);
    try {
      const res = await getPresupuesto(id);
      setData(res.data);
      setCoefs({
        k_materiales: res.data.coeficientes.k_materiales,
        k_mano_obra: res.data.coeficientes.k_mano_obra,
        k_maquinaria: res.data.coeficientes.k_maquinaria,
        gg_porcentaje: res.data.coeficientes.gg_porcentaje,
        ben_porcentaje: res.data.coeficientes.ben_porcentaje,
        iva_porcentaje: res.data.coeficientes.iva_porcentaje,
        modo_gestion: res.data.coeficientes.modo_gestion,
        pct_gestion: res.data.coeficientes.pct_gestion,
        cargas_sociales_activas: res.data.coeficientes.cargas_sociales_activas,
        cargas_sociales_factor: res.data.coeficientes.cargas_sociales_factor,
        total_cargas_globales: res.data.coeficientes.total_cargas_globales,
        dias_vigencia: res.data.dias_vigencia || 30,
      });
      setObservaciones(res.data.observaciones || '');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const cargarAdicionales = async () => {
    try {
      const res = await api.get(`/presupuestos/${id}/adicionales`);
      setAdicionales(res.data || []);
    } catch(e) { setAdicionales([]); }
  };

  const crearAdicional = async () => {
    setCreandoAdic(true);
    try {
      const res = await api.post(`/presupuestos`, {
        nombre_obra: (data?.nombre_obra || '') + ' — Adicional ' + (adicionales.length + 1),
        ubicacion: data?.ubicacion || '',
        cliente_id: data?.cliente_id,
        es_adicional: true,
        presupuesto_base_id: parseInt(id),
      });
      await cargarAdicionales();
      // Open the new adicional modal
      const nuevoId = res.data?.id;
      if (nuevoId) {
        const adics = await api.get(`/presupuestos/${id}/adicionales`);
        const nuevo = (adics.data || []).find(a => a.id === nuevoId);
        if (nuevo) setModalAdicional(nuevo);
      }
    } catch(e) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    }
    setCreandoAdic(false);
  };

  const abrirAdicional = (adic) => {
    setBusquedaAdic('');
    setCatAdic(null);
    setShowLibreAdic(false);
    setItemLibreAdic({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
    setModalAdicional(adic);
  };

  const agregarItemAlAdicional = async (item) => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 });
      await cargarAdicionales();
      // refresh modal data
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { console.error(e); }
  };

  const agregarLibreAlAdicional = async () => {
    if (!modalAdicional || !itemLibreAdic.nombre_libre || !itemLibreAdic.costo_directo_libre) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/lineas`, {
        tipo: 'libre',
        nombre_libre: itemLibreAdic.nombre_libre,
        unidad_libre: itemLibreAdic.unidad_libre,
        cantidad: parseFloat(itemLibreAdic.cantidad) || 1,
        costo_directo_libre: parseFloat(itemLibreAdic.costo_directo_libre),
      });
      setItemLibreAdic({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
      setShowLibreAdic(false);
      await cargarAdicionales();
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { console.error(e); }
  };

  const eliminarLineaAdicional = async (lineaId) => {
    if (!modalAdicional) return;
    try {
      await api.delete(`/presupuestos/${modalAdicional.id}/lineas/${lineaId}`);
      await cargarAdicionales();
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { console.error(e); }
  };

  const handleCantidadAdicional = async (lineaId, cant) => {
    if (!modalAdicional || !cant || cant <= 0) return;
    await api.patch(`/presupuestos/${modalAdicional.id}/lineas/${lineaId}`, { cantidad: parseFloat(cant) });
    await cargarAdicionales();
    const adics = await api.get(`/presupuestos/${id}/adicionales`);
    const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
    if (updated) setModalAdicional(updated);
  };

  const cerrarAdicional = async () => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/cerrar`);
      await cargarAdicionales();
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const reabrirAdicional = async () => {
    if (!modalAdicional) return;
    try {
      await api.post(`/presupuestos/${modalAdicional.id}/reabrir`);
      await cargarAdicionales();
      const adics = await api.get(`/presupuestos/${id}/adicionales`);
      const updated = (adics.data || []).find(a => a.id === modalAdicional.id);
      if (updated) setModalAdicional(updated);
    } catch(e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const eliminarAdicional = async (adicId) => {
    try {
      await api.delete(`/presupuestos/${adicId}`);
      if (modalAdicional?.id === adicId) setModalAdicional(null);
      await cargarAdicionales();
    } catch(e) { alert('Error: ' + (e.response?.data?.detail || e.message)); }
  };

  const guardarCoefs = async () => {
    if (!coefs) return;
    setGuardando(true);
    try { await actualizarPresupuesto(id, { ...coefs, dias_vigencia: coefs.dias_vigencia, observaciones: observaciones || null }); await cargar(); }
    catch (e) { console.error(e); }
    setGuardando(false);
  };

  const handleCerrar = async () => {
    if (!window.confirm('¿Cerrar el presupuesto? Los precios quedarán congelados.')) return;
    await cerrarPresupuesto(id); cargar();
  };

  const handleReabrir = async () => {
    if (!window.confirm('¿Reabrir el presupuesto?')) return;
    await reabrirPresupuesto(id); cargar();
  };

  const handleAgregarItem = async (item, rubroDestino) => {
    if (data?.estado !== 'abierto') return;
    const rubros = data?.rubros || [];
    // Si hay rubros y no se especificó destino, mostrar selector
    if (rubros.length > 0 && rubroDestino === undefined) {
      setItemPendiente(item);
      return;
    }
    try {
      const payload = { tipo: 'catalogo', item_obra_id: item.id, cantidad: 1 };
      if (rubroDestino) {
        payload.categoria_numero = rubroDestino.numero;
        payload.categoria_nombre = rubroDestino.nombre;
      }
      await agregarLinea(id, payload);
      cargar();
    } catch (e) { console.error(e); }
    setItemPendiente(null);
  };

  const handleCrearRubro = async () => {
    if (!nuevoRubroNombre.trim()) return;
    try {
      await api.post(`/presupuestos/${id}/rubros`, { nombre: nuevoRubroNombre.trim() });
      setNuevoRubroNombre('');
      setModalNuevoRubro(false);
      await cargar();
    } catch(e) { alert('Error: ' + e.message); }
  };

  const handleAgregarLibre = async () => {
    if (!itemLibre.nombre_libre) return;
    if (modoLibre === 'global' && !itemLibre.costo_directo_libre) return;
    if (itemLibre._editId) {
      await api.patch(`/presupuestos/${id}/lineas/${itemLibre._editId}`, {
        nombre_libre: itemLibre.nombre_libre,
        unidad_libre: itemLibre.unidad_libre,
        cantidad: parseFloat(itemLibre.cantidad),
        costo_directo_libre: modoLibre === 'global' ? parseFloat(itemLibre.costo_directo_libre) : 0,
      });
      const editId = itemLibre._editId;
      const editNombre = itemLibre.nombre_libre;
      setModalLibre(false);
      setItemLibre({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
      await cargar();
      // Si eligió desglosar en modo edición, abrir panel
      if (modoLibre === 'desglosado') {
        setLineaSeleccionada({ id: editId, tipo: 'libre', nombre_libre: editNombre });
      }
    } else {
      // Determinar rubro destino
      let catNum = null, catNom = null;
      if (rubroLibreSelec === '__nuevo__') {
        // nuevo rubro con nombre personalizado — se genera número automático via backend
        catNum = null; catNom = null;
      } else if (rubroLibreSelec) {
        const r = (data?.rubros || []).find(r => String(r.numero) === String(rubroLibreSelec));
        if (r) { catNum = r.numero; catNom = r.nombre; }
      }
      const res = await agregarLinea(id, {
        tipo: 'libre',
        nombre_libre: itemLibre.nombre_libre,
        unidad_libre: itemLibre.unidad_libre,
        cantidad: parseFloat(itemLibre.cantidad) || 1,
        costo_directo_libre: modoLibre === 'global' ? parseFloat(itemLibre.costo_directo_libre) : 0,
        ...(catNum !== null ? { categoria_numero: catNum, categoria_nombre: catNom } : {}),
      });
      setModalLibre(false);
      setItemLibre({ nombre_libre: '', unidad_libre: 'Gl', costo_directo_libre: '', cantidad: 1 });
      await cargar();
      // Si eligió desglosar, abrir PanelAnalisis automáticamente
      if (modoLibre === 'desglosado' && res?.id) {
        setLineaSeleccionada({ id: res.id, tipo: 'libre', nombre_libre: itemLibre.nombre_libre });
      }
    }
  };

  const imprimirComputoGeneral = () => {
    const rubros = data?.rubros || [];
    const items = [];
    rubros.forEach(rubro => {
      (rubro.lineas || []).forEach(linea => {
        const key = 'computo_' + id + '_' + linea.id;
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const filas = JSON.parse(saved);
            if (filas.length > 0) items.push({ linea, rubro, filas });
          }
        } catch {}
      });
    });

    if (items.length === 0) {
      alert('No hay cómputos cargados en ningún ítem de este presupuesto.');
      return;
    }

    const win = window.open('', '_blank');
    const unidLabel = (l) => l.unidad_item || l.unidad_libre || 'u';

    const calcFila = (tipo, f) => {
      const n = (v) => parseFloat(v) || 0;
      if (tipo === 'm2')   return n(f.alto) * n(f.ancho) * n(f.cant);
      if (tipo === 'm3')   return n(f.alto) * n(f.ancho) * n(f.largo) * n(f.cant);
      if (tipo === 'ml')   return n(f.long) * n(f.cant);
      if (tipo === 'm2pm') return n(f.perim) * n(f.alto) * n(f.cant);
      return n(f.cant);
    };

    const detectTipo = (u) => {
      if (!u) return 'u';
      const s = u.toLowerCase().trim();
      if (s === 'm2' || s === 'm²') return 'm2';
      if (s === 'm3' || s === 'm³') return 'm3';
      if (s === 'ml' || s === 'm') return 'ml';
      if (s === 'm2/m' || s === 'm²/m') return 'm2pm';
      return 'u';
    };

    const renderItem = ({ linea, rubro, filas }) => {
      const tipo = detectTipo(unidLabel(linea));
      const total = filas.reduce((acc, f) => {
        const val = calcFila(tipo, f);
        return f.signo === '-' ? acc - val : acc + val;
      }, 0);
      const nombre = linea.nombre_override || linea.nombre_item || linea.nombre_libre || '—';
      const rows = filas.map((f, i) => {
        const val = calcFila(tipo, f);
        let formula = '';
        if (tipo === 'm2')   formula = (f.alto||0) + ' × ' + (f.ancho||0) + ' × ' + (f.cant||1);
        if (tipo === 'm3')   formula = (f.alto||0) + ' × ' + (f.ancho||0) + ' × ' + (f.largo||0) + ' × ' + (f.cant||1);
        if (tipo === 'ml')   formula = (f.long||0) + ' × ' + (f.cant||1);
        if (tipo === 'm2pm') formula = (f.perim||0) + ' × ' + (f.alto||0) + ' × ' + (f.cant||1);
        if (tipo === 'u')    formula = String(f.cant||1);
        const color = f.signo === '-' ? '#c0392b' : '#27ae60';
        const signo = f.signo === '-' ? '−' : '+';
        return '<tr><td>' + (i+1) + '</td><td>' + (f.desc||'—') + '</td>'
          + '<td style="text-align:center;color:' + color + '">' + signo + '</td>'
          + '<td style="font-family:monospace;text-align:right">' + formula + '</td>'
          + '<td style="font-family:monospace;text-align:right">' + val.toFixed(3) + '</td></tr>';
      }).join('');
      return '<div class="item-block"><div class="item-header">'
        + '<span class="rubro-tag">' + rubro.numero + ' — ' + rubro.nombre + '</span>'
        + '<span class="item-name">' + nombre + '</span></div>'
        + '<table><thead><tr><th>#</th><th>Descripción</th><th style="text-align:center">±</th>'
        + '<th style="text-align:right">Fórmula</th><th style="text-align:right">Parcial (' + unidLabel(linea) + ')</th></tr></thead>'
        + '<tbody>' + rows
        + '<tr class="total-row"><td colspan="4" style="text-align:right;font-weight:700">TOTAL</td>'
        + '<td style="font-family:monospace;font-weight:700;text-align:right">' + total.toFixed(3) + ' ' + unidLabel(linea) + '</td></tr>'
        + '</tbody></table></div>';
    };

    const html = '<!DOCTYPE html><html><head><title>Cómputo general</title>'
      + '<style>'
      + 'body{font-family:Arial,sans-serif;font-size:10pt;padding:24px;color:#111}'
      + 'h1{font-size:15pt;margin:0 0 4px}'
      + '.sub{font-size:10pt;color:#666;margin-bottom:20px}'
      + '.item-block{margin-bottom:20px;page-break-inside:avoid}'
      + '.item-header{margin-bottom:4px}'
      + '.rubro-tag{font-size:8pt;color:#888;text-transform:uppercase;letter-spacing:.05em;display:block}'
      + '.item-name{font-size:12pt;font-weight:700}'
      + 'table{width:100%;border-collapse:collapse;font-size:10pt}'
      + 'th{background:#f0f0f0;padding:5px 8px;text-align:left;border:1px solid #ddd;font-size:9pt}'
      + 'td{padding:4px 8px;border:1px solid #eee}'
      + '.total-row td{background:#f8f8f8;border-top:2px solid #ccc}'
      + '@media print{body{padding:0}}'
      + '</style></head><body>'
      + '<h1>Cómputo de cantidades</h1>'
      + '<div class="sub">' + (data?.nombre_obra || '') + (data?.ubicacion ? ' · ' + data.ubicacion : '') + ' · ' + new Date().toLocaleDateString('es-AR') + '</div>'
      + items.map(renderItem).join('')
      + '</body></html>';

    win.document.write(html);
    win.document.close();
    win.print();
  };

    const handleCantidad = async (linea_id, cant) => {
    if (!cant || cant <= 0) return;
    await actualizarLinea(id, linea_id, { cantidad: parseFloat(cant) });
    cargar();
  };

  const handleEliminar = async (linea_id) => {
    if (lineaSeleccionada?.id === linea_id) setLineaSeleccionada(null);
    await eliminarLinea(id, linea_id);
    cargar();
  };

  const handleImprimir = (modo) => {
    if (!data) return;
    const { totales, coeficientes, rubros } = data;
    const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
    const cerrado = data.estado === 'cerrado';
    const esComercial = modo === 'comercial';
    const fmt = (n) => { if (!n && n !== 0) return '—'; if (n === 0) return '$ 0'; return '$ ' + Math.round(n).toLocaleString('es-AR'); };
    const fmtPct = (n) => n != null ? n.toFixed(1) + '%' : '—';

    const rubrosHTML = (rubros || []).map(rubro => {
      const filas = (rubro.lineas || []).map(linea => {
        const precioUnit = linea.cantidad > 0 ? linea.precio_venta_con_iva / linea.cantidad : linea.precio_venta_con_iva;
        return `<tr>
          ${!esComercial ? `<td class="cod">${linea.tipo === 'libre' ? '—' : linea.item_obra_id}</td>` : ''}
          <td>${linea.nombre_override || linea.nombre_item || linea.nombre_libre || ''}${linea.tipo === 'libre' && !esComercial ? ' <span class="sub">(subcontrato)</span>' : ''}</td>
          <td class="c">${linea.unidad_item || linea.unidad_libre || ''}</td>
          <td class="r">${linea.cantidad}</td>
          ${!esComercial ? `
          <td class="r">${linea.costo_mat ? fmt(linea.costo_mat) : '—'}</td>
          <td class="r">${linea.costo_mo ? fmt(linea.costo_mo) : '—'}</td>
          <td class="r">${linea.costo_maq ? fmt(linea.costo_maq) : '—'}</td>
          <td class="r ejec">${fmt(linea.total_ejecucion)}</td>` : ''}
          <td class="r precio">${fmt(precioUnit)}</td>
          <td class="r precio bold">${fmt(linea.precio_venta_con_iva)}</td>
          ${!esComercial ? `<td class="r muted">${totales?.total_precio_con_iva > 0 ? fmtPct(linea.precio_venta_con_iva / totales.total_precio_con_iva * 100) : '—'}</td>` : ''}
        </tr>`;
      }).join('');
      const subtotalCols = esComercial
        ? `<td colspan="3" class="muted" style="font-size:8px">Subtotal ${rubro.numero} — ${rubro.nombre}</td><td></td><td class="r precio">${fmt(rubro.subtotal_precio)}</td>`
        : `<td colspan="8" class="muted" style="font-size:8px">Subtotal ${rubro.numero} — ${rubro.nombre}</td><td class="r ejec">${fmt(rubro.subtotal_ejecucion)}</td><td></td><td class="r precio">${fmt(rubro.subtotal_precio)}</td><td></td>`;
      return `
        <tr class="rubro"><td colspan="${esComercial ? 6 : 11}">${rubro.numero} — ${rubro.nombre}</td></tr>
        ${filas}
        <tr class="subtotal">${subtotalCols}</tr>`;
    }).join('');

    const thInterno = !esComercial ? `<th>Mat×Cant</th><th>MO×Cant</th><th>Maq×Cant</th><th class="r">Total Ejec</th>` : '';
    const thPct = !esComercial ? `<th class="r">%</th>` : '';
    const thCod = !esComercial ? `<th>Cód.</th>` : '';
    const totalEjec = !esComercial ? `<div class="blk"><div class="lbl">Costo ejecución</div><div class="val ejec">${fmt(totales?.total_ejecucion)}</div></div><div class="blk"><div class="lbl">Margen</div><div class="val margen">${fmtPct(totales?.margen_pct)}</div></div>` : '';
    const coefs = !esComercial ? `<div class="coefs"><b>Coeficientes:</b> K Mat: ${coeficientes?.k_materiales} · K MO: ${coeficientes?.k_mano_obra} · K Maq: ${coeficientes?.k_maquinaria} · GG: ${coeficientes?.gg_porcentaje}% · Ben: ${coeficientes?.ben_porcentaje}% · IVA: ${coeficientes?.iva_porcentaje}%</div>` : '';
    const firma = esComercial ? `<div class="firma"><div class="firma-linea">Firma y sello</div></div>` : '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esComercial ? 'Presupuesto' : 'Presupuesto Interno'} — ${data.nombre_obra}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:white;color:#111;font-family:Arial,sans-serif;font-size:10pt;padding:20px 28px}
.top{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
.empresa{font-size:18pt;font-weight:900}
.titulo{font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#444;margin-top:2px}
.datos{font-size:8.5pt;color:#555;margin-top:6px}
.meta{font-size:8.5pt;color:#555;text-align:right}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{background:#1a1a1a;color:#fff;padding:5px 8px;font-size:7.5pt;text-transform:uppercase;letter-spacing:.8px;text-align:left}
th.r{text-align:right}
td{padding:4px 8px;font-size:9pt;border-bottom:1px solid #eee;vertical-align:middle}
tr.rubro td{background:#f0f0f0;font-size:8pt;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#333;border-top:1px solid #ccc;border-bottom:1px solid #ccc}
tr.subtotal td{background:#f5f0ff;font-size:8.5pt;font-weight:700;border-top:1px solid #ccc;border-bottom:2px solid #ccc}
tr:nth-child(even):not(.rubro):not(.subtotal) td{background:#fafafa}
.r{text-align:right;font-family:'Courier New',monospace}
.c{text-align:center;color:#666}
.cod{color:#888;font-size:8pt;font-family:'Courier New',monospace}
.muted{color:#888}
.sub{font-size:7pt;color:#888}
.ejec{color:#5b21b6;font-weight:700}
.precio{color:#065f46;font-weight:700}
.bold{font-weight:700}
.margen{color:#92400e;font-weight:700}
.totales{border:2px solid #111;margin-bottom:16px;page-break-inside:avoid}
.totales-h{background:#1a1a1a;color:#fff;padding:5px 10px;font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.totales-b{display:flex}
.blk{flex:1;padding:10px 12px;border-right:1px solid #e0e0e0;text-align:center}
.blk:last-child{border-right:none}
.lbl{font-size:7pt;text-transform:uppercase;letter-spacing:.8px;color:#666;margin-bottom:3px}
.val{font-size:13pt;font-weight:900;font-family:'Courier New',monospace}
.coefs{margin-top:10px;font-size:8pt;color:#555;page-break-inside:avoid}
.firma{display:flex;justify-content:flex-end;margin-top:50px}
.firma-linea{width:220px;text-align:center;border-top:1px solid #333;padding-top:8px;font-size:9pt;color:#444}
footer{margin-top:16px;border-top:1px solid #ccc;padding-top:6px;display:flex;justify-content:space-between;font-size:8pt;color:#888}
@page{margin:1.2cm;background:white}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="top">
  <div>
    <div class="empresa">Fima Arquitectura</div>
    <div class="titulo">${esComercial ? 'Presupuesto' : 'Presupuesto de ejecución (uso interno)'}</div>
    <div class="datos"><strong>Obra:</strong> ${data.nombre_obra}${data.ubicacion ? ' &nbsp;·&nbsp; <strong>Ubicación:</strong> ' + data.ubicacion : ''}</div>
    ${esComercial ? `<div class="datos" style="margin-top:4px"><strong>Vigencia:</strong> ${data.dias_vigencia || coefs?.dias_vigencia || 30} días desde la fecha</div>` : ''}
  </div>
  <div class="meta">
    <div>Resistencia, ${hoy}</div>
    ${cerrado && data.fecha_cierre ? `<div style="font-size:8pt;color:#888;margin-top:3px">Cerrado: ${new Date(data.fecha_cierre).toLocaleDateString('es-AR')}</div>` : ''}
  </div>
</div>
<table>
  <thead><tr>${thCod}<th>Ítem</th><th class="c">Unid.</th><th class="r">Cant.</th>${thInterno}<th class="r">P. Unitario</th><th class="r">Total</th>${thPct}</tr></thead>
  <tbody>${rubrosHTML}</tbody>
</table>
<div class="totales">
  <div class="totales-h">${esComercial ? 'Total del presupuesto' : 'Resumen económico'}</div>
  <div class="totales-b">
    ${totalEjec}
    <div class="blk"><div class="lbl">Subtotal s/IVA</div><div class="val precio">${fmt(totales?.total_precio_sin_iva)}</div></div>
    <div class="blk"><div class="lbl">IVA (${coeficientes?.iva_porcentaje}%)</div><div class="val muted">${fmt(totales?.total_iva)}</div></div>
    <div class="blk"><div class="lbl">TOTAL</div><div class="val precio" style="font-size:16pt">${fmt(totales?.total_precio_con_iva)}</div></div>
  </div>
</div>
${coefs}
${observaciones ? '<div style="margin-top:20px;padding:12px 16px;border:1px solid #e0e0e8;border-radius:6px;page-break-inside:avoid"><div style="font-size:9pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#666;margin-bottom:6px">Observaciones</div><div style="font-size:10pt;color:#1a1a2e;white-space:pre-wrap">' + observaciones + '</div></div>' : ''}
${firma}
<footer><span>Fima Arquitectura — ${hoy}</span><span>${data.nombre_obra}${data.ubicacion ? ' · ' + data.ubicacion : ''}</span></footer>
</body></html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 800);
  };
  const toggleLinea = (linea) => { setLineaSeleccionada(lineaSeleccionada?.id === linea.id ? null : linea); };

  const handleRenombrarLinea = async (lineaId, nuevoNombre) => {
    if (!nuevoNombre || !nuevoNombre.trim()) { setEditandoNombreId(null); return; }
    try {
      const res = await fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/lineas/${lineaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_override: nuevoNombre.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert('Error al guardar: ' + (err.detail || res.status));
        return;
      }
      setEditandoNombreId(null);
      setNombreEditVal('');
      await cargar();
    } catch(e) {
      alert('Error de red: ' + e.message);
    }
  };

  const handleRenombrarRubro = async (rubroNumero, nuevoNombre) => {
    if (!nuevoNombre || !nuevoNombre.trim()) return;
    const rubro = data?.rubros?.find(r => r.numero === rubroNumero);
    if (!rubro?.lineas?.length) return;
    try {
      await Promise.all(
        rubro.lineas.map(l =>
          fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/lineas/${l.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoria_nombre: nuevoNombre.trim() }),
          })
        )
      );
      await cargar();
    } catch(e) {
      alert('Error: ' + e.message);
    }
  };

  const itemsFiltrados = items.filter(i =>
    i.nombre.toLowerCase().includes(busqueda.toLowerCase()) || i.codigo.includes(busqueda)
  );
  const itemsAdicFiltrados = itemsAdic.filter(i =>
    i.nombre.toLowerCase().includes(busquedaAdic.toLowerCase()) || i.codigo.includes(busquedaAdic)
  );

  const cerrado = data?.estado === 'cerrado';
  const coefGgBen = coefs ? 1 / (1 - coefs.gg_porcentaje / 100 - coefs.ben_porcentaje / 100) : 1;

  if (loading) return <div className="loading">Cargando presupuesto...</div>;
  if (!data) return <div className="loading">No encontrado</div>;

  const { totales } = data;
  const totalAdic = adicionales.reduce((s, a) => s + (a.total_precio_con_iva || 0), 0);

  return (
    <>
      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* HEADER — responsive */}
        <div className="header" style={{ flexWrap: 'wrap', gap: 6, minHeight: 'auto', padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>FIMA</span>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/cotizador')} style={{ flexShrink: 0 }}>
              <ArrowLeft size={14} />
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.nombre_obra}</div>
              {data.ubicacion && <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.ubicacion}</div>}
            </div>
            <span className={`badge badge-${data.estado}`} style={{ flexShrink: 0, fontSize: 9 }}>
              {cerrado ? '🔒' : '●'} {data.estado.toUpperCase()}
            </span>
          </div>

          {/* Desktop action buttons */}
          <div className="header-actions-desktop" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Imprimir group */}
            <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => handleImprimir('comercial')}>🖨 Cliente</button>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => handleImprimir('interno')}>🖨 Interno</button>
              <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={imprimirComputoGeneral} title="Imprimir cómputo de cantidades">∑ Cómputo</button>
            </div>
            {cerrado ? (
              <>
                {/* Gestión group */}
                <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/certificado`)}>
                    <FileText size={13} /> Cert.
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/gantt/${id}`)}>
                    <BarChart2 size={13} /> Gantt
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderRight: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/curva`)}>
                    📈 Curva
                  </button>
                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0 }} onClick={() => navigate(`/cotizador/presupuesto/${id}/materiales`)}>
                    📦 Mat.
                  </button>
                </div>
                {/* Adicional + Reabrir */}
                <button className="btn btn-secondary btn-sm" onClick={crearAdicional} disabled={creandoAdic}
                  style={{ color: 'var(--accent2)', borderColor: 'rgba(167,139,250,0.4)' }}>
                  <Plus size={14} /> {creandoAdic ? '...' : 'Adicional'}
                </button>
                <button className="btn btn-warn btn-sm" onClick={handleReabrir}><Unlock size={14} /> Reabrir</button>
              </>
            ) : (
              <button className="btn btn-warn btn-sm" onClick={handleCerrar}><Lock size={14} /> Cerrar</button>
            )}
          </div>

          {/* Mobile action buttons */}
          <div className="header-actions-mobile" style={{ gap: 6 }}>
            <MobileMenu actions={[
              { label: 'Imprimir — Cliente', icon: '🖨', onClick: () => handleImprimir('comercial') },
              { label: 'Imprimir — Interno', icon: '🖨', onClick: () => handleImprimir('interno') },
              ...(cerrado ? [
                { label: 'Certificados', icon: '📄', onClick: () => navigate(`/cotizador/presupuesto/${id}/certificado`) },
                { label: 'Gantt', icon: '📊', onClick: () => navigate(`/cotizador/gantt/${id}`) },
                { label: 'Curva de inversión', icon: '📈', onClick: () => navigate(`/cotizador/presupuesto/${id}/curva`) },
                { label: 'Listado de materiales', icon: '📦', onClick: () => navigate(`/cotizador/presupuesto/${id}/materiales`) },
                { label: creandoAdic ? 'Creando adicional...' : 'Crear adicional', icon: '➕', onClick: crearAdicional, disabled: creandoAdic, color: 'var(--accent2)' },
                { label: 'Reabrir presupuesto', icon: '🔓', onClick: handleReabrir, color: 'var(--warn)' },
              ] : [
                { label: 'Cerrar presupuesto', icon: '🔒', onClick: handleCerrar, color: 'var(--warn)' },
              ]),
            ]} />
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* SIDEBAR — desktop siempre visible, mobile como drawer */}
          {/* Mobile overlay */}
          {sidebarOpen && (
            <div className="sidebar-mobile-overlay"
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }}
              onClick={() => setSidebarOpen(false)} />
          )}

          <div className={`sidebar-presupuesto${sidebarOpen ? ' open' : ''}`}
            data-open={sidebarOpen ? 'true' : 'false'}
            style={{
              width: 280,
              background: 'var(--surface)',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
            {/* Mobile close button */}
            <div className="sidebar-mobile-close" style={{ display: 'none', padding: '8px 14px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>
                {cerrado ? 'Configuración' : 'Agregar ítems'}
              </span>
              <button onClick={() => setSidebarOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* COEFICIENTES — colapsable */}
            <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => setCoefsOpen(v => !v)}
                style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)' }}>Coeficientes</span>
                  {coefs && !coefsOpen && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>
                      GG {coefs.gg_porcentaje}% · BEN {coefs.ben_porcentaje}% · IVA {coefs.iva_porcentaje}%
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: 'var(--muted)', transform: coefsOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
              </button>
              {coefsOpen && (
              <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, paddingTop: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Gestión de materiales</div>
                    <div style={{ fontSize: 9, color: 'var(--border2)' }}>El cliente provee los materiales</div>
                  </div>
                  <button disabled={cerrado} onClick={() => setCoefs(prev => ({ ...prev, modo_gestion: !prev.modo_gestion }))}
                    style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: cerrado ? 'default' : 'pointer',
                      background: coefs?.modo_gestion ? 'var(--accent2)' : 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, left: coefs?.modo_gestion ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                </div>
                {coefs?.modo_gestion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0 6px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--accent2)' }}>% Gestión sobre materiales</div></div>
                    <input type="number" step="0.01" min="0" max="100" className="input input-mono"
                      style={{ width: 68, padding: '3px 6px', fontSize: 12 }} value={coefs?.pct_gestion ?? 30}
                      disabled={cerrado} onChange={e => setCoefs(prev => ({ ...prev, pct_gestion: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Cargas sociales MO</div>
                    <div style={{ fontSize: 9, color: 'var(--border2)' }}>{coefs?.total_cargas_globales ? `Global: ${coefs.total_cargas_globales}%` : ''}</div>
                  </div>
                  <button disabled={cerrado} onClick={() => setCoefs(prev => ({ ...prev, cargas_sociales_activas: !prev.cargas_sociales_activas }))}
                    style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: cerrado ? 'default' : 'pointer',
                      background: coefs?.cargas_sociales_activas ? 'var(--success)' : 'var(--border2)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, left: coefs?.cargas_sociales_activas ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s', display: 'block' }} />
                  </button>
                </div>
                {coefs?.cargas_sociales_activas && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>Factor cargas</div>
                      <div style={{ fontSize: 9, color: 'var(--border2)' }}>1 = 100%, 0.5 = 50%</div>
                    </div>
                    <input type="number" step="0.01" min="0" max="1" className="input input-mono"
                      style={{ width: 68, padding: '3px 6px', fontSize: 12 }} value={coefs?.cargas_sociales_factor ?? 1}
                      disabled={cerrado} onChange={e => setCoefs(prev => ({ ...prev, cargas_sociales_factor: parseFloat(e.target.value) || 0 }))} />
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>K Materiales</div>
                    <div style={{ fontSize: 9, color: 'var(--border2)' }}>0 = sin materiales</div>
                  </div>
                  <input type="number" step="0.01" min="0" className="input input-mono"
                    style={{ width: 68, padding: '3px 6px', fontSize: 12 }} value={coefs?.k_materiales ?? 1}
                    disabled={cerrado} onChange={e => setCoefs(prev => ({ ...prev, k_materiales: parseFloat(e.target.value) || 0 }))} />
                </div>
                {[
                  { label: 'K Mano de obra', key: 'k_mano_obra' },
                  { label: 'K Maq/Eq/Herr', key: 'k_maquinaria' },
                  { label: 'Gastos generales %', key: 'gg_porcentaje' },
                  { label: 'Beneficios %', key: 'ben_porcentaje' },
                  { label: 'IVA %', key: 'iva_porcentaje' },
                ].map(({ label, key }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>{label}</div></div>
                    <input type="number" step="0.01" min="0" className="input input-mono"
                      style={{ width: 68, padding: '3px 6px', fontSize: 12 }} value={coefs?.[key] ?? ''}
                      disabled={cerrado} onChange={e => setCoefs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))} />
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Vigencia (días)</div>
                    <div style={{ fontSize: 9, color: 'var(--border2)' }}>Desde la fecha del presupuesto</div>
                  </div>
                  <input type="number" step="1" min="1" className="input input-mono"
                    style={{ width: 68, padding: '3px 6px', fontSize: 12 }}
                    value={coefs?.dias_vigencia ?? 30}
                    disabled={cerrado}
                    onChange={e => setCoefs(prev => ({ ...prev, dias_vigencia: parseInt(e.target.value) || 30 }))} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--accent2)', fontWeight: 600 }}>Coef GG+BEN</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent2)' }}>{coefGgBen.toFixed(4)}</div>
                  </div>
                  {!cerrado && (
                    <button className="btn btn-primary btn-sm" onClick={guardarCoefs} disabled={guardando}>
                      {guardando ? '...' : 'Aplicar'}
                    </button>
                  )}
                </div>
              </div>
              </div>
              )}
            </div>

            {!cerrado && (
              <>
                <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 7 }}>Agregar ítem</div>
                  <div style={{ position: 'relative', marginBottom: 7 }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    <input className="input" style={{ paddingLeft: 26, fontSize: 11 }} placeholder="Buscar ítem..."
                      value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                  </div>
                  <select className="input" style={{ fontSize: 11 }} value={catSeleccionada || ''}
                    onChange={e => setCatSeleccionada(e.target.value || null)}>
                    <option value="">Todos los rubros</option>
                    {categorias.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {itemsFiltrados.slice(0, 80).map(item => (
                    <div key={item.id}
                      style={{ padding: '7px 14px', borderBottom: '1px solid rgba(46,46,56,0.5)', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => handleAgregarItem(item)}>
                      <div style={{ fontSize: 11, lineHeight: 1.3 }}>{item.nombre}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                        <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--muted)' }}>{item.codigo} · {item.unidad_ejecucion}</span>
                        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--ejec)' }}>{fmt(item.costo_total)}</span>
                      </div>
                    </div>
                  ))}
                  <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setModoLibre('global'); setRubroLibreSelec(''); setModalLibre(true); }}>
                      <Plus size={12} /> Ítem libre / subcontrato
                    </button>
                    <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--accent2)', borderColor: 'rgba(167,139,250,0.3)' }}
                      onClick={() => setModalNuevoRubro(true)}>
                      <Plus size={12} /> Crear rubro
                    </button>
                  </div>
                </div>
              </>
            )}

            {cerrado && adicionales.length > 0 && (
              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--accent2)', marginBottom: 8 }}>Adicionales</div>
                {adicionales.map(a => (
                  <div key={a.id} onClick={() => { abrirAdicional(a); setSidebarOpen(false); }}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent2)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.2)'}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--accent2)', fontWeight: 600 }}>Adicional {adicionales.indexOf(a) + 1}</div>
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{a.estado === 'cerrado' ? '🔒' : '●'} {a.estado}</div>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--precio)' }}>
                      {a.total_precio_con_iva > 0 ? fmt(a.total_precio_con_iva) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AREA CENTRAL */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="toolbar-presupuesto" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {[['ambos', 'Ejec + Precio'], ['ejec', 'Ejecución'], ['comercial', 'Precio']].map(([v, l]) => (
                    <button key={v} onClick={() => setVista(v)}
                      style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'var(--sans)',
                        background: vista === v ? 'var(--accent2)' : 'transparent', color: vista === v ? 'white' : 'var(--muted)' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {/* Mobile: botón para abrir sidebar */}
                {!cerrado && (
                  <button className="btn btn-primary btn-sm sidebar-toggle-btn"
                    style={{ display: 'none' }}
                    onClick={() => setSidebarOpen(true)}>
                    <Plus size={13} /> Agregar ítem
                  </button>
                )}
                {cerrado && (
                  <button className="btn btn-secondary btn-sm sidebar-toggle-btn"
                    style={{ display: 'none', fontSize: 11 }}
                    onClick={() => setSidebarOpen(true)}>
                    ⚙ Coeficientes
                  </button>
                )}
                {lineaSeleccionada && (
                  <span style={{ fontSize: 11, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>⚙ {lineaSeleccionada.nombre_item}</span>
                )}
              </div>

              <div style={{ flex: 1, overflow: 'auto', paddingBottom: 80 }}>
                {data?.es_adicional && data?.presupuesto_base_id && (
                  <div style={{ margin: 10, padding: '7px 12px', background: 'rgba(110,231,183,0.06)', border: '1px solid rgba(110,231,183,0.2)', borderRadius: 6, fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>📋 Adicional de obra</span>
                    <button onClick={() => navigate('/cotizador/presupuesto/' + data.presupuesto_base_id)}
                      style={{ background: 'none', border: '1px solid rgba(110,231,183,0.3)', borderRadius: 5, padding: '2px 10px', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                      Ver base
                    </button>
                  </div>
                )}
                {cerrado && (
                  <div style={{ margin: 10, padding: '7px 12px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, fontSize: 11, color: 'var(--warn)', textAlign: 'center' }}>
                    🔒 Precios congelados al {new Date(data.fecha_cierre).toLocaleDateString('es-AR')}
                  </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 400 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0, zIndex: 10 }}>
                      <th style={{ ...th, display: vista === 'comercial' ? 'none' : undefined }} className="col-cod">Cód.</th>
                      <th style={th}>Ítem</th>
                      <th style={{ ...th, textAlign: 'center' }} className="col-unid">Unid.</th>
                      <th style={{ ...th, textAlign: 'right' }}>Cant.</th>
                      {(vista === 'ambos' || vista === 'ejec') && <>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--mat)' }} className="col-ejec">Mat</th>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--mo)' }} className="col-ejec">MO</th>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--maq)' }} className="col-ejec">Maq</th>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--ejec)' }} className="col-ejec">T.Ejec</th>
                      </>}
                      {(vista === 'ambos' || vista === 'comercial') && <>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Precio</th>
                        <th style={{ ...th, textAlign: 'right', color: 'var(--muted)', fontSize: 9 }} className="col-pct">%</th>
                      </>}
                      <th style={{ ...th, width: 30 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rubros?.map(rubro => (
                      <React.Fragment key={rubro.numero}>
                        <tr>
                          <td colSpan={12} style={{ padding: '7px 12px', background: 'var(--surface2)', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: 'var(--muted)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                            {editandoRubroNum === rubro.numero ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                                <input
                                  autoFocus
                                  value={rubroEditVal}
                                  onChange={e => setRubroEditVal(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') { handleRenombrarRubro(rubro.numero, rubroEditVal); setEditandoRubroNum(null); }
                                    if (e.key === 'Escape') setEditandoRubroNum(null);
                                  }}
                                  style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--accent2)', background: 'var(--bg2)', color: 'var(--text)', width: 200, textTransform: 'none', letterSpacing: 0 }}
                                />
                                <button onClick={() => { handleRenombrarRubro(rubro.numero, rubroEditVal); setEditandoRubroNum(null); }}
                                  style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: 'none', background: 'var(--accent2)', color: '#fff', cursor: 'pointer' }}>✓</button>
                                <button onClick={() => setEditandoRubroNum(null)}
                                  style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: 'none', background: 'var(--border2)', color: 'var(--text)', cursor: 'pointer' }}>✕</button>
                              </div>
                            ) : (
                              <span>
                                {rubro.numero} — {rubro.nombre}
                                {!cerrado && (
                                  <span title="Renombrar rubro" style={{ marginLeft: 8, fontSize: 10, color: 'var(--border2)', cursor: 'pointer', opacity: 0.6 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent2)'; e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--border2)'; e.currentTarget.style.opacity = '0.6'; }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      setRubroEditVal(rubro.nombre || '');
                                      setEditandoRubroNum(rubro.numero);
                                    }}>
                                    ✏
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                        </tr>
                        {rubro.lineas?.map(linea => {
                          const isSelected = lineaSeleccionada?.id === linea.id;
                          return (
                            <tr key={linea.id}
                              style={{ borderBottom: '1px solid rgba(46,46,56,0.6)', background: isSelected ? 'rgba(167,139,250,0.08)' : 'transparent' }}
                              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                              <td style={{ ...td, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }} className="col-cod">{linea.tipo === 'libre' ? '—' : linea.item_obra_id}</td>
                              <td style={td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {editandoNombreId === linea.id ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => e.stopPropagation()}>
                                        <input
                                          autoFocus
                                          value={nombreEditVal}
                                          onChange={e => setNombreEditVal(e.target.value)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') handleRenombrarLinea(linea.id, nombreEditVal);
                                            if (e.key === 'Escape') { setEditandoNombreId(null); setNombreEditVal(''); }
                                          }}
                                          style={{ fontSize: 12, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--accent2)', background: 'var(--bg2)', color: 'var(--text)', width: 200 }}
                                        />
                                        <button onClick={() => handleRenombrarLinea(linea.id, nombreEditVal)}
                                          style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: 'none', background: 'var(--accent2)', color: '#fff', cursor: 'pointer' }}>✓</button>
                                        <button onClick={() => { setEditandoNombreId(null); setNombreEditVal(''); }}
                                          style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, border: 'none', background: 'var(--border2)', color: 'var(--text)', cursor: 'pointer' }}>✕</button>
                                      </div>
                                    ) : (
                                      <>
                                        <span style={{ fontSize: 12, lineHeight: 1.3, cursor: !cerrado ? 'pointer' : 'default', color: isSelected ? 'var(--accent2)' : 'inherit' }}
                                          onClick={() => { if(cerrado) return; if(linea.tipo === 'catalogo') toggleLinea(linea); else { setModoLibre(linea.costo_directo_libre > 0 ? 'global' : 'desglosado'); setItemLibre({ ...linea, _editId: linea.id }); setModalLibre(true); } }}
                                          title={!cerrado ? (linea.tipo === 'catalogo' ? 'Click para editar análisis de costos' : 'Click para editar ítem') : ''}>
                                          {linea.nombre_override || linea.nombre_item || linea.nombre_libre}
                                        </span>
                                        {!cerrado && (
                                          <span title="Renombrar ítem"
                                            style={{ fontSize: 10, color: 'var(--border2)', cursor: 'pointer', flexShrink: 0, padding: '1px 4px', borderRadius: 3, opacity: 0.6 }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent2)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--border2)'; }}
                                            onClick={e => {
                                              e.stopPropagation();
                                              setNombreEditVal(linea.nombre_override || linea.nombre_item || linea.nombre_libre || '');
                                              setEditandoNombreId(linea.id);
                                            }}>
                                            ✏
                                          </span>
                                        )}
                                        {linea.tipo === 'catalogo' && !cerrado && (
                                          <span style={{ fontSize: 11, color: isSelected ? 'var(--accent2)' : 'var(--border2)', cursor: 'pointer', flexShrink: 0 }} onClick={() => toggleLinea(linea)}>⚙</span>
                                        )}
                                        {linea.tipo === 'libre' && !cerrado && (
                                          <span title="Desglosar costos / ver análisis"
                                            style={{ fontSize: 11, color: isSelected ? 'var(--accent)' : 'var(--border2)', cursor: 'pointer', flexShrink: 0 }}
                                            onClick={e => { e.stopPropagation(); setLineaSeleccionada(linea); }}>⚙</span>
                                        )}

                                      </>
                                    )}
                                  </div>
                                {linea.tipo === 'libre' && <div style={{ fontSize: 9, color: (linea.costo_mat || linea.costo_mo || linea.costo_maq) ? 'var(--warn)' : 'var(--accent2)', fontFamily: 'var(--mono)' }}>{(linea.costo_mat || linea.costo_mo || linea.costo_maq) ? 'desglosado' : 'subcontrato'}</div>}
                              </td>
                              <td style={{ ...td, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }} className="col-unid">{linea.unidad_item || linea.unidad_libre}</td>
                              <td style={{ ...td, textAlign: 'right' }}>
                                <input type="number" min="0" step="0.01" defaultValue={linea.cantidad} disabled={cerrado}
                                  style={{ width: 55, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '3px 5px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right' }}
                                  onBlur={e => handleCantidad(linea.id, e.target.value)} />
                                {!cerrado && (
                                  <div
                                    onClick={e => { e.stopPropagation(); setComputoLinea(computoLinea?.id === linea.id ? null : linea); setLineaSeleccionada(null); }}
                                    style={{ fontSize: 9, fontFamily: 'var(--mono)', color: computoLinea?.id === linea.id ? 'var(--accent2)' : 'var(--border2)', cursor: 'pointer', textAlign: 'right', marginTop: 2, letterSpacing: 0.3, textTransform: 'uppercase', userSelect: 'none' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--accent2)'}
                                    onMouseLeave={e => e.currentTarget.style.color = computoLinea?.id === linea.id ? 'var(--accent2)' : 'var(--border2)'}>
                                    {computoLinea?.id === linea.id ? '▸ cómputo' : 'cómputo'}
                                  </div>
                                )}
                              </td>
                              {(vista === 'ambos' || vista === 'ejec') && <>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: linea.costo_mat ? 'var(--mat)' : 'var(--border2)' }} className="col-ejec">{linea.costo_mat ? fmt(linea.costo_mat) : '—'}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: linea.costo_mo ? 'var(--mo)' : 'var(--border2)' }} className="col-ejec">{linea.costo_mo ? fmt(linea.costo_mo) : '—'}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: linea.costo_maq ? 'var(--maq)' : 'var(--border2)' }} className="col-ejec">{linea.costo_maq ? fmt(linea.costo_maq) : '—'}</td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ejec)', fontWeight: 500 }} className="col-ejec">{fmt(linea.total_ejecucion)}</td>
                              </>}
                              {(vista === 'ambos' || vista === 'comercial') && <>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)' }}>
                                  <div style={{ fontSize: 12, color: 'var(--precio)', fontWeight: 600 }}>{fmt(linea.precio_venta_con_iva)}</div>
                                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 1 }}>
                                    {fmt(linea.cantidad > 0 ? linea.precio_venta_con_iva / linea.cantidad : 0)}/{linea.unidad_item || linea.unidad_libre || 'u'}
                                  </div>
                                </td>
                                <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }} className="col-pct">
                                  {totales.total_precio_con_iva > 0 ? (linea.precio_venta_con_iva / totales.total_precio_con_iva * 100).toFixed(1) + '%' : '—'}
                                </td>
                              </>}
                              <td style={td}>
                                {!cerrado && (
                                  <button onClick={() => handleEliminar(linea.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--border2)', fontSize: 15, cursor: 'pointer', padding: '1px 5px', borderRadius: 4 }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}>×</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(167,139,250,0.04)' }}>
                          <td colSpan={4} style={{ ...td, fontSize: 9, color: 'var(--muted)' }}>Subtotal {rubro.numero}</td>
                          {(vista === 'ambos' || vista === 'ejec') && <><td colSpan={3} className="col-ejec"></td><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ejec)', fontWeight: 600 }} className="col-ejec">{fmt(rubro.subtotal_ejecucion)}</td></>}
                          {(vista === 'ambos' || vista === 'comercial') && <><td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--precio)', fontWeight: 600 }}>{fmt(rubro.subtotal_precio)}</td><td colSpan={2}></td></>}
                        </tr>
                      </React.Fragment>
                    ))}
                    {(!data.rubros || data.rubros.length === 0) && (
                      <tr><td colSpan={12}><div className="empty"><h3>Sin ítems</h3><p>Agregá ítems desde el panel izquierdo</p></div></td></tr>
                    )}

                    {adicionales.map(a => (
                      <React.Fragment key={'adic-' + a.id}>
                        <tr onClick={() => abrirAdicional(a)} style={{ cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td colSpan={12} style={{ padding: '8px 12px', background: 'rgba(167,139,250,0.08)', borderTop: '2px solid rgba(167,139,250,0.3)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent2)' }}>📋 {a.nombre_obra}</span>
                                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4,
                                  background: a.estado === 'cerrado' ? 'rgba(251,191,36,.15)' : 'rgba(110,231,183,.15)',
                                  color: a.estado === 'cerrado' ? 'var(--warn)' : 'var(--accent)' }}>
                                  {a.estado === 'cerrado' ? '🔒' : '●'} {a.estado}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{a.cant_items} ítem{a.cant_items !== 1 ? 's' : ''}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--accent2)' }}>{fmt(a.total_precio_con_iva)}</span>
                                <button onClick={e => { e.stopPropagation(); eliminarAdicional(a.id); }}
                                  style={{ background: 'none', border: '1px solid rgba(248,113,113,.3)', borderRadius: 4, color: 'var(--danger)', cursor: 'pointer', padding: '2px 7px', fontSize: 11 }}>×</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="totales-bar" style={{ position: 'sticky', bottom: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Costo Ejec', val: totales?.total_ejecucion, color: 'var(--ejec)', size: 13 },
                  { label: 'Precio s/IVA', val: totales?.total_precio_sin_iva, color: 'var(--precio)', size: 13 },
                  { label: 'IVA', val: totales?.total_iva, color: 'var(--muted)', size: 12 },
                  { label: 'Total c/IVA', val: totales?.total_precio_con_iva, color: 'var(--precio)', size: 16 },
                  { label: 'Margen', extra: `${totales?.margen_pct?.toFixed(1)}%`, color: 'var(--warn)', size: 14 },
                ].map((t, i) => (
                  <React.Fragment key={t.label}>
                    {i > 0 && <div style={{ width: 1, height: 28, background: 'var(--border)' }}></div>}
                    <div>
                      <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)' }}>{t.label}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: t.size, fontWeight: 600, color: t.color }}>{t.extra || fmt(t.val)}</div>
                    </div>
                  </React.Fragment>
                ))}
                {totalAdic > 0 && <>
                  <div style={{ width: 1, height: 28, background: 'rgba(167,139,250,0.4)' }}></div>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent2)' }}>Adicionales</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent2)' }}>{fmt(totalAdic)}</div>
                  </div>
                  <div style={{ width: 1, height: 28, background: 'rgba(167,139,250,0.4)' }}></div>
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent2)' }}>Total obra</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, color: 'var(--accent2)' }}>{fmt((totales?.total_precio_con_iva || 0) + totalAdic)}</div>
                  </div>
                </>}
              </div>
            </div>

            {lineaSeleccionada && (
              <PanelAnalisis presupuestoId={id} linea={lineaSeleccionada} onClose={() => setLineaSeleccionada(null)} onCostoChange={() => cargar()} />
            )}
            {computoLinea && (
              <PanelComputo presupuestoId={id} linea={computoLinea} onClose={() => setComputoLinea(null)}
                onCantidadChange={(lineaId, cant) => { cargar(); }} />
            )}
          </div>
        </div>

        {/* OBSERVACIONES — botón flotante */}
        <div style={{ position: 'fixed', bottom: 56, right: 16, zIndex: 40 }}>
          {obsOpen && (
            <div style={{ position: 'absolute', bottom: 48, right: 0, width: 320, background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--muted)', marginBottom: 8 }}>Observaciones generales</div>
              {!cerrado ? (
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  onBlur={() => { if (coefs) actualizarPresupuesto(id, { observaciones: observaciones || null }); }}
                  placeholder="Notas, aclaraciones o condiciones para el cliente..."
                  rows={5}
                  autoFocus
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }}
                />
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap', padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)', minHeight: 60 }}>{observaciones || 'Sin observaciones'}</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>Aparece al pie de la impresión cliente</div>
            </div>
          )}
          <button
            onClick={() => setObsOpen(v => !v)}
            title="Observaciones generales"
            style={{ width: 40, height: 40, borderRadius: '50%', background: observaciones ? 'var(--accent)' : 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: observaciones ? '#fff' : 'var(--muted)' }}>
            📝
          </button>
        </div>

        {/* MODAL ÍTEM LIBRE BASE */}
        {modalLibre && (
          <div className="modal-overlay" onClick={() => setModalLibre(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>{itemLibre._editId ? 'Editar ítem' : 'Nuevo ítem'}</h2>

              {/* Toggle modo — siempre visible */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                {[['global', '$ Monto global'], ['desglosado', '⚙ Desglosar costos']].map(([val, label]) => (
                  <button key={val} onClick={() => setModoLibre(val)}
                    style={{ flex: 1, padding: '7px 0', fontSize: 12, border: 'none', cursor: 'pointer', fontWeight: modoLibre === val ? 700 : 400,
                      background: modoLibre === val ? 'var(--accent2)' : 'var(--surface2)',
                      color: modoLibre === val ? '#fff' : 'var(--muted)' }}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label>Descripción *</label>
                <input className="input" value={itemLibre.nombre_libre}
                  onChange={e => setItemLibre({ ...itemLibre, nombre_libre: e.target.value })}
                  placeholder="Ej: Instalación eléctrica subcontratada" />
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                  <label>Unidad</label>
                  <input className="input" value={itemLibre.unidad_libre}
                    onChange={e => setItemLibre({ ...itemLibre, unidad_libre: e.target.value })} />
                </div>
                <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                  <label>Cantidad</label>
                  <input className="input input-mono" type="number" min="0" step="0.01" value={itemLibre.cantidad}
                    onChange={e => setItemLibre({ ...itemLibre, cantidad: parseFloat(e.target.value) })} />
                </div>
              </div>

              {/* Selector de rubro destino — solo al crear */}
              {!itemLibre._editId && (data?.rubros || []).length > 0 && (
                <div className="form-group">
                  <label>Rubro</label>
                  <select className="input" value={rubroLibreSelec} onChange={e => setRubroLibreSelec(e.target.value)}>
                    <option value="">Sin rubro específico</option>
                    {(data?.rubros || []).map(r => (
                      <option key={r.numero} value={r.numero}>{r.numero} — {r.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {modoLibre === 'global' ? (
                <div className="form-group">
                  <label>Costo directo de ejecución *</label>
                  <input className="input input-mono" type="number" min="0"
                    value={itemLibre.costo_directo_libre}
                    onChange={e => setItemLibre({ ...itemLibre, costo_directo_libre: e.target.value })}
                    placeholder="0" />
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Se aplican los coeficientes GG + BEN + IVA del presupuesto.</div>
                </div>
              ) : (
                <div style={{ padding: '10px 12px', borderRadius: 6, background: 'var(--surface2)', fontSize: 12, color: 'var(--muted)', border: '1px solid var(--border)' }}>
                  {itemLibre._editId ? 'Al guardar se abrirá el panel de análisis.' : 'Después de agregar, se abre el panel de análisis para cargar materiales, mano de obra y maquinaria.'}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setModalLibre(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleAgregarLibre}>
                  {modoLibre === 'desglosado' ? (itemLibre._editId ? 'Guardar y abrir análisis →' : 'Agregar y desglosar →') : (itemLibre._editId ? 'Guardar cambios' : 'Agregar')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SELECTOR DE RUBRO DESTINO */}
        {itemPendiente && (
          <div className="modal-overlay" onClick={() => setItemPendiente(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>¿A qué rubro agregás este ítem?</h2>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}><b>{itemPendiente.nombre}</b></div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>Elegí el rubro destino dentro de este presupuesto.</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                <button
                  onClick={() => handleAgregarItem(itemPendiente, null)}
                  style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>📦 Rubro original del catálogo</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{itemPendiente.categoria_nombre || 'Sin rubro'}</div>
                </button>
                {(data?.rubros || []).map(r => (
                  <button key={r.numero}
                    onClick={() => handleAgregarItem(itemPendiente, { numero: r.numero, nombre: r.nombre })}
                    style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.numero} — {r.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.lineas?.length || 0} ítems</div>
                  </button>
                ))}
              </div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setItemPendiente(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CREAR RUBRO VACÍO */}
        {modalNuevoRubro && (
          <div className="modal-overlay" onClick={() => setModalNuevoRubro(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h2>Crear rubro</h2>
              <div className="form-group">
                <label>Nombre del rubro *</label>
                <input className="input" autoFocus value={nuevoRubroNombre}
                  onChange={e => setNuevoRubroNombre(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCrearRubro(); if (e.key === 'Escape') setModalNuevoRubro(false); }}
                  placeholder="Ej: Escalera, Fachada, Instalaciones..." />
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Se crea el rubro vacío. Después podés agregarle ítems del catálogo o ítems libres.</div>
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setModalNuevoRubro(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCrearRubro}>Crear</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ADICIONAL */}
        {modalAdicional && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 200 }}
            onClick={() => { setModalAdicional(null); setLineaSeleccionadaAdic(null); }}>
            <div style={{ width: 'min(720px, 100vw)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 32px rgba(0,0,0,0.4)' }}
              onClick={e => e.stopPropagation()}>

              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(167,139,250,0.08)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent2)' }}>📋 {modalAdicional.nombre_obra}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {modalAdicional.estado === 'cerrado' ? '🔒 Cerrado' : '● Abierto — podés agregar ítems'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {modalAdicional.estado === 'abierto' ? (
                    <button onClick={cerrarAdicional} className="btn btn-warn btn-sm"><Lock size={12} /> Cerrar</button>
                  ) : (
                    <button onClick={reabrirAdicional} className="btn btn-secondary btn-sm"><Unlock size={12} /> Reabrir</button>
                  )}
                  <button onClick={() => setModalAdicional(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 4 }}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {modalAdicional.estado === 'abierto' && (
                  <div style={{ width: 'min(240px, 40vw)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', marginBottom: 8 }}>Agregar ítem</div>
                      <div style={{ position: 'relative', marginBottom: 7 }}>
                        <Search size={11} style={{ position: 'absolute', left: 7, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                        <input className="input" style={{ paddingLeft: 24, fontSize: 11 }} placeholder="Buscar..."
                          value={busquedaAdic} onChange={e => setBusquedaAdic(e.target.value)} />
                      </div>
                      <select className="input" style={{ fontSize: 11 }} value={catAdic || ''} onChange={e => setCatAdic(e.target.value || null)}>
                        <option value="">Todos los rubros</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.numero}. {c.nombre}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {itemsAdicFiltrados.slice(0, 80).map(item => (
                        <div key={item.id}
                          style={{ padding: '6px 12px', borderBottom: '1px solid rgba(46,46,56,0.5)', cursor: 'pointer', fontSize: 11 }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => agregarItemAlAdicional(item)}>
                          <div style={{ lineHeight: 1.3 }}>{item.nombre}</div>
                          <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--mono)', marginTop: 1 }}>{item.codigo}</div>
                        </div>
                      ))}
                      <div style={{ padding: 10 }}>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => setShowLibreAdic(true)}>
                          <Plus size={11} /> Ítem libre
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {(!modalAdicional.rubros || modalAdicional.rubros.flatMap(r => r.lineas).length === 0) ? (
                      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
                        Sin ítems aún<br />
                        <span style={{ fontSize: 11 }}>Seleccioná del catálogo a la izquierda</span>
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                            <th style={th}>Ítem</th>
                            <th style={{ ...th, textAlign: 'center' }}>Unid</th>
                            <th style={{ ...th, textAlign: 'right' }}>Cant</th>
                            <th style={{ ...th, textAlign: 'right', color: 'var(--ejec)' }}>Ejec</th>
                            <th style={{ ...th, textAlign: 'right', color: 'var(--precio)' }}>Precio</th>
                            <th style={{ ...th, width: 24 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {modalAdicional.rubros?.map(rubro => (
                            <React.Fragment key={rubro.numero}>
                              <tr>
                                <td colSpan={6} style={{ padding: '5px 12px', background: 'var(--surface2)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: 0.8 }}>
                                  {rubro.numero} — {rubro.nombre}
                                </td>
                              </tr>
                              {rubro.lineas?.map(linea => (
                                <tr key={linea.id} style={{ borderBottom: '1px solid rgba(46,46,56,0.4)' }}>
                                  <td style={{ ...td, fontSize: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span
                                        style={{ cursor: linea.tipo === 'catalogo' && modalAdicional.estado === 'abierto' ? 'pointer' : 'default',
                                          color: lineaSeleccionadaAdic?.id === linea.id ? 'var(--accent2)' : 'inherit' }}
                                        onClick={() => {
                                          if (linea.tipo === 'catalogo' && modalAdicional.estado === 'abierto') {
                                            setLineaSeleccionadaAdic(lineaSeleccionadaAdic?.id === linea.id ? null : linea);
                                          }
                                        }}>
                                        {linea.nombre_override || linea.nombre_item || linea.nombre_libre}
                                      </span>
                                      {linea.tipo === 'catalogo' && modalAdicional.estado === 'abierto' && (
                                        <span style={{ fontSize: 11, color: lineaSeleccionadaAdic?.id === linea.id ? 'var(--accent2)' : 'var(--border2)', cursor: 'pointer' }}
                                          onClick={() => setLineaSeleccionadaAdic(lineaSeleccionadaAdic?.id === linea.id ? null : linea)}>⚙</span>
                                      )}
                                    </div>
                                    {linea.tipo === 'libre' && <div style={{ fontSize: 9, color: 'var(--accent2)', fontFamily: 'var(--mono)' }}>subcontrato</div>}
                                  </td>
                                  <td style={{ ...td, textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{linea.unidad_item || linea.unidad_libre}</td>
                                  <td style={{ ...td, textAlign: 'right' }}>
                                    <input type="number" min="0" step="0.01" defaultValue={linea.cantidad}
                                      disabled={modalAdicional.estado === 'cerrado'}
                                      style={{ width: 55, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 4, padding: '2px 5px', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: 11, textAlign: 'right' }}
                                      onBlur={e => handleCantidadAdicional(linea.id, e.target.value)} />
                                  </td>
                                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ejec)' }}>{fmt(linea.total_ejecucion)}</td>
                                  <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)', fontWeight: 600 }}>{fmt(linea.precio_venta_con_iva)}</td>
                                  <td style={td}>
                                    {modalAdicional.estado === 'abierto' && (
                                      <button onClick={() => eliminarLineaAdicional(linea.id)}
                                        style={{ background: 'none', border: 'none', color: 'var(--border2)', fontSize: 14, cursor: 'pointer' }}
                                        onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                                        onMouseLeave={e => e.currentTarget.style.color = 'var(--border2)'}>×</button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(167,139,250,0.05)' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Total adicional c/IVA</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 700, color: 'var(--accent2)' }}>{fmt(modalAdicional.total_precio_con_iva)}</span>
                  </div>
                </div>

                {lineaSeleccionadaAdic && (
                  <div style={{ width: 'min(380px, 50vw)', borderLeft: '1px solid var(--border)', overflow: 'hidden' }}>
                    <PanelAnalisis
                      presupuestoId={modalAdicional.id}
                      linea={lineaSeleccionadaAdic}
                      onClose={() => setLineaSeleccionadaAdic(null)}
                      onCostoChange={() => cargarAdicionales()}
                    />
                  </div>
                )}
              </div>

              {showLibreAdic && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
                  onClick={() => setShowLibreAdic(false)}>
                  <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 'min(400px, 90vw)' }}>
                    <h2>Ítem libre — Adicional</h2>
                    <div className="form-group">
                      <label>Descripción *</label>
                      <input className="input" value={itemLibreAdic.nombre_libre} onChange={e => setItemLibreAdic(p => ({ ...p, nombre_libre: e.target.value }))} placeholder="Ej: Trabajo adicional" />
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Unidad</label>
                        <input className="input" value={itemLibreAdic.unidad_libre} onChange={e => setItemLibreAdic(p => ({ ...p, unidad_libre: e.target.value }))} />
                      </div>
                      <div className="form-group" style={{ flex: 1 }}>
                        <label>Cantidad</label>
                        <input className="input input-mono" type="number" min="0" step="0.01" value={itemLibreAdic.cantidad} onChange={e => setItemLibreAdic(p => ({ ...p, cantidad: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Costo directo *</label>
                      <input className="input input-mono" type="number" min="0" value={itemLibreAdic.costo_directo_libre} onChange={e => setItemLibreAdic(p => ({ ...p, costo_directo_libre: e.target.value }))} placeholder="0" />
                    </div>
                    <div className="modal-actions">
                      <button className="btn btn-secondary" onClick={() => setShowLibreAdic(false)}>Cancelar</button>
                      <button className="btn btn-primary" onClick={agregarLibreAlAdicional}>Agregar</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <PrintPresupuesto data={data} modo={printMode} />
    </>
  );
}

const th = { padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
const td = { padding: '8px 12px', verticalAlign: 'middle' };
