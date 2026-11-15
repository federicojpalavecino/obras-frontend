import React, { useEffect, useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArrowRight, Check, ChevronRight, FileText, Layers, MessageCircle,
  Package, Plus, Printer, RotateCcw, Search, SlidersHorizontal, Trash2, Undo2, X } from 'lucide-react';
import PrintPresupuesto from '../cotizador/pages/PrintPresupuesto';
import { parseNum } from '../cotizador/num';
import { imprimirHTML } from '../utils/imprimir';
import { calcular, CATALOGO, crearEjemplo, restaurarEjemplo, ESCENARIOS, MATERIALES, MANO_OBRA, EQUIPOS, dinero, cantidad } from './modelo';
import { medir, enlaceRegistro } from './medicion';
import './DemoPresupuesto.css';

const EMPRESA = { nombre: 'ESTUDIO DE EJEMPLO', logo_url: null };
const PASOS = [
  { id: 'presupuesto', nombre: 'Armá el presupuesto', breve: 'Cantidades', icono: Layers },
  { id: 'ajustes', nombre: 'Usá tus valores', breve: 'Tus valores', icono: SlidersHorizontal },
  { id: 'documento', nombre: 'Presentalo al cliente', breve: 'Resultado', icono: FileText },
];
const STORAGE = 'faim_demo_v2_presupuesto';
function estadoInicial() {
  try { return restaurarEjemplo(JSON.parse(sessionStorage.getItem(STORAGE))); }
  catch { return crearEjemplo(); }
}

function Numero({ value, onChange, label, min = 0, max = 10000000, className = '' }) {
  const [texto, setTexto] = useState(String(value).replace('.', ','));
  useEffect(() => setTexto(String(value).replace('.', ',')), [value]);
  const valido = t => /^[\d.,\s]+$/.test(t) && parseNum(t) >= min && parseNum(t) <= max;
  return <input className={`dv-number ${className}`} type="text" inputMode="decimal" aria-label={label}
    value={texto} onFocus={e => e.target.select()} onChange={e => {
      setTexto(e.target.value);
      if (valido(e.target.value)) onChange(parseNum(e.target.value));
    }} onBlur={() => { if (!valido(texto)) setTexto(String(value).replace('.', ',')); }}
    aria-invalid={texto !== '' && !valido(texto)} />;
}

function Modal({ titulo, children, cerrar, ancho = '' }) {
  const ref = useRef(null);
  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;
  useEffect(() => {
    const dialogo = ref.current;
    const anterior = document.activeElement;
    dialogo.showModal();
    return () => { dialogo.close(); if (anterior?.isConnected) anterior.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} className={`dv-modal ${ancho}`} aria-label={titulo}
    onCancel={e => { e.preventDefault(); cerrarRef.current(); }}
    onClick={e => { if (e.target === e.currentTarget) cerrarRef.current(); }}>
    <div className="dv-modal-head"><div><span className="dv-eyebrow">FAIM · DEMOSTRACIÓN</span><h2>{titulo}</h2></div>
      <button className="dv-icon" onClick={cerrar} aria-label="Cerrar ventana"><X size={20} /></button></div>
    <div className="dv-modal-body">{children}</div>
  </dialog>;
}

export default function DemoPresupuesto() {
  const [ejemplo, setEjemplo] = useState(estadoInicial);
  const [paso, setPaso] = useState('presupuesto');
  const [vista, setVista] = useState('cliente');
  const [modal, setModal] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [historial, setHistorial] = useState([]);
  const [acciones, setAcciones] = useState({});
  const [materialActivo, setMaterialActivo] = useState('latex');
  const encabezado = useRef(null);
  const datos = useMemo(() => calcular(ejemplo), [ejemplo]);
  const inicial = useMemo(() => calcular(crearEjemplo(ejemplo.escenario)), [ejemplo.escenario]);
  const escenario = ESCENARIOS[ejemplo.escenario];
  const lineaAnalisis = modal?.tipo === 'analisis' ? datos.lineas.find(l => l.id === modal.id) : null;
  const materialesUsados = datos.materiales;
  const materialSeleccionado = materialesUsados.find(m => m.id === materialActivo) || materialesUsados[0];
  const catalogoFiltrado = CATALOGO.filter(i => i.nombre.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(
    busqueda.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')));

  useEffect(() => {
    const anterior = document.title;
    document.title = 'Probá cómo presupuestar | FAIM OBRAS';
    medir('demo_v2_visita', ejemplo.escenario);
    return () => { document.title = anterior; };
    // La visita se cuenta una vez por pestaña, aunque cambie el escenario.
  }, []);
  useEffect(() => { try { sessionStorage.setItem(STORAGE, JSON.stringify(ejemplo)); } catch { /* no impide usar la demo */ } }, [ejemplo]);

  function registrarAccion(tipo) {
    setAcciones(a => ({ ...a, [tipo]: true }));
    medir(`demo_v2_${tipo}`, ejemplo.escenario);
  }
  function modificar(nuevo, aviso, tipo) {
    setHistorial(h => [...h.slice(-19), ejemplo]);
    setEjemplo(nuevo);
    setMensaje(aviso);
    if (tipo) registrarAccion(tipo);
  }
  function ir(nuevo) {
    setPaso(nuevo);
    if (nuevo === 'documento') registrarAccion('documento');
    requestAnimationFrame(() => {
      encabezado.current?.focus({ preventScroll: true });
      if (window.matchMedia('(max-width: 800px)').matches) {
        encabezado.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    });
  }
  function cambiarPrecio(id, precio) {
    if (precio === ejemplo.precios[id]) return;
    const usos = datos.materiales.find(m => m.id === id)?.usos || 0;
    modificar({ ...ejemplo, precios: { ...ejemplo.precios, [id]: precio } },
      `${MATERIALES[id].nombre}: se actualizaron ${usos} ítems y el presupuesto.`, 'material');
  }
  function reiniciar(escenarioNuevo) {
    setEjemplo(crearEjemplo(escenarioNuevo)); setHistorial([]); setAcciones({});
    setPaso('presupuesto'); setModal(null); setMensaje('Ejemplo restaurado. Podés empezar de nuevo.');
  }
  function imprimir() {
    registrarAccion('pdf');
    const contenido = renderToStaticMarkup(<><p className="dv-print-aviso">DEMOSTRACIÓN · Valores ilustrativos. No constituye una cotización.</p>
      <PrintPresupuesto data={datos} modo="comercial" empresa={EMPRESA} /><p className="dv-print-alcance">{escenario.alcance}</p></>);
    imprimirHTML(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Presupuesto de ejemplo · FAIM</title>
      <style>body{font:12px Arial,sans-serif;color:#1a1a2e;padding:28px}table{width:100%;border-collapse:collapse}th,td{padding:9px 7px;border-bottom:1px solid #e1e6e3;text-align:left}th{font-size:10px;text-transform:uppercase;background:#f1f5f3}.right,.print-num{text-align:right;white-space:nowrap}.print-header{padding:16px 0;border-bottom:2px solid #059669}.print-header-top,.print-totales-body,.print-footer{display:flex;justify-content:space-between;gap:16px}.print-empresa{font-size:21px;font-weight:bold}.print-titulo,.print-datos{margin-top:8px}.print-fecha{font-size:11px}.print-row-rubro{font-weight:bold;background:#eff6f2}.print-row-subtotal{font-weight:bold}.print-totales{margin-top:24px}.print-totales-header{font-weight:bold;padding-bottom:14px}.print-total-label{font-size:10px}.print-total-val{font-size:18px;margin-top:6px}.print-footer{margin-top:40px;font-size:9px;color:#666}.dv-print-aviso{color:#047857;border:1px solid #a7d6c1;padding:10px;font-size:10px}.dv-print-alcance{font-size:10px;color:#555}tr{break-inside:avoid}thead{display:table-header-group}@page{size:A4;margin:14mm}@media print{body{padding:0}}</style></head><body>${contenido}</body></html>`, { titulo: 'Presupuesto de ejemplo' });
  }
  const mensajeWhatsApp = `Hola, probé la demo de FAIM con el ejemplo de ${escenario.nombre.toLowerCase()}. Quiero coordinar una videollamada para ver cómo presupuestar una obra mía.`;
  const wa = `https://wa.me/5493625548783?text=${encodeURIComponent(mensajeWhatsApp)}`;

  return <div className="dv">
    <header className="dv-topbar"><a className="dv-brand" href="/" aria-label="FAIM Obras, inicio"><span className="dv-brand-icon"><Layers size={22} /></span><span>FAIM<span className="dv-brand-sub">OBRAS</span></span></a>
      <span className="dv-live"><span /> DEMO INTERACTIVA</span>
      <a className="dv-top-link" href="/">Ingresar a mi cuenta <ArrowRight size={15} /></a></header>
    <main className="dv-main">
      <div className="dv-intro"><div><span className="dv-eyebrow">MENOS PLANILLA. MÁS PRESUPUESTO.</span>
        <h1>Probá lo fácil que es <span>presupuestar.</span></h1>
        <p>Ya elegimos algunos trabajos. Cambiá una cantidad, usá tus precios y mirá el resultado.</p></div>
        <div className="dv-demo-note"><Check size={17} /><span>Sin registro.<br /><strong>Podés tocar todo el ejemplo.</strong></span></div></div>

      <div className="dv-workspace">
        <aside className="dv-guide"><span className="dv-guide-label">TU PRIMER PRESUPUESTO</span>
          <div className="dv-steps">{PASOS.map((p, i) => <button key={p.id} onClick={() => ir(p.id)}
            className={`dv-step ${paso === p.id ? 'is-active' : ''}`} aria-current={paso === p.id ? 'step' : undefined}>
            <span className="dv-step-number">{(i === 0 && acciones.cantidad) || (i === 1 && acciones.material) || (i === 2 && acciones.documento) ? <Check size={15} /> : `0${i + 1}`}</span>
            <span><strong>{p.nombre}</strong><small>{['Elegí trabajos y cantidades', 'Mirá de dónde sale el precio', 'Un documento, sin recargar'][i]}</small></span><ChevronRight size={14} /></button>)}</div>
          <div className="dv-guide-tip"><span className="dv-tip-mark">↗</span><h3>{paso === 'presupuesto' ? 'El trabajo pesado ya está hecho.' : paso === 'ajustes' ? 'Un precio. Todo actualizado.' : 'Lo cargaste una sola vez.'}</h3>
            <p>{paso === 'presupuesto' ? 'Cada trabajo tiene su análisis cargado. Vos elegís qué hacer y cuánto.' : paso === 'ajustes' ? 'El mismo material alimenta los análisis y el listado de compras. No lo repetís en cada ítem.' : 'Del mismo presupuesto salen la presentación al cliente y los materiales que necesitás comprar.'}</p></div>
          <a className="dv-guide-contact" href={wa} target="_blank" rel="noreferrer" onClick={() => registrarAccion('whatsapp')}><MessageCircle size={17} /><span>¿Lo vemos con una obra tuya?</span><ArrowRight size={15} /></a>
        </aside>

        <section className="dv-app" aria-label="Presupuesto interactivo">
          <div className="dv-app-top"><div className="dv-scenario-picker" aria-label="Elegir ejemplo">{Object.entries(ESCENARIOS).map(([id, s]) =>
            <button key={id} className={ejemplo.escenario === id ? 'is-active' : ''} aria-pressed={ejemplo.escenario === id}
              onClick={() => { if (id !== ejemplo.escenario) setModal({ tipo: 'reinicio', escenario: id }); }}>{s.etiqueta}</button>)}</div>
            <button className="dv-reset" aria-label="Reiniciar ejemplo" onClick={() => setModal({ tipo: 'reinicio', escenario: ejemplo.escenario })}><RotateCcw size={14} /><span>Reiniciar</span></button></div>
          <div className="dv-app-title"><div><span className="dv-eyebrow">PRESUPUESTO DE EJEMPLO</span><h2 ref={encabezado} tabIndex={-1}>{ejemplo.nombre}</h2></div>
            <span className="dv-saved"><span /> Cambios en esta pestaña</span></div>

          {paso === 'presupuesto' && <>
            <div className="dv-task-hint"><span className="dv-hint-number">1</span><span><strong>Probá cambiar una cantidad.</strong> El precio y los materiales se recalculan al instante.</span></div>
            <div className="dv-budget-head"><span>TRABAJOS SELECCIONADOS <b>{datos.lineas.length}</b></span>
              <button className="dv-button dv-button-small" onClick={() => { setBusqueda(''); setModal({ tipo: 'catalogo' }); }} disabled={datos.lineas.length >= 30}><Plus size={15} /> Agregar trabajo</button></div>
            <div className="dv-table-wrap"><table className="dv-budget"><thead><tr><th>Trabajo</th><th>Cantidad</th><th className="dv-unit-col">Unidad</th><th className="dv-price-col">P. unitario</th><th>Importe</th><th><span className="dv-sr-only">Acciones</span></th></tr></thead>
              <tbody>{datos.lineas.map(l => <tr key={l.id}>
                <td><button className="dv-work-name" onClick={() => { setModal({ tipo: 'analisis', id: l.id }); registrarAccion('analisis'); }}>{l.item.nombre}<span>Ver análisis <ArrowRight size={11} /></span></button></td>
                <td><Numero value={l.cantidad} min={.01} max={10000} label={`Cantidad de ${l.item.nombre}`} onChange={n => {
                  if (n !== l.cantidad) modificar({ ...ejemplo, lineas: ejemplo.lineas.map(x => x.id === l.id ? { ...x, cantidad: n } : x) }, 'Cantidad actualizada. El presupuesto y los materiales ya se recalcularon.', 'cantidad');
                }} /><span className="dv-mobile-unit">{l.item.unidad}</span></td><td className="dv-unit-col">{l.item.unidad}</td>
                <td className="dv-price-col">{dinero(l.precio_venta_con_iva / l.cantidad)}</td><td className="dv-line-total">{dinero(l.precio_venta_con_iva)}</td>
                <td><button className="dv-icon dv-remove" aria-label={`Quitar ${l.item.nombre}`} disabled={datos.lineas.length === 1}
                  onClick={() => modificar({ ...ejemplo, lineas: ejemplo.lineas.filter(x => x.id !== l.id) }, 'Trabajo quitado del ejemplo. Podés deshacer el cambio.')}><Trash2 size={14} /></button></td>
              </tr>)}</tbody></table></div>
            <div className="dv-scope">{escenario.alcance}</div>
          </>}

          {paso === 'ajustes' && <div className="dv-adjustments">
            <div className="dv-task-hint"><span className="dv-hint-number">2</span><span><strong>Probá actualizar un material.</strong> No tenés que corregir cada trabajo por separado.</span></div>
            <div className="dv-adjust-grid"><div className="dv-material-editor"><span className="dv-eyebrow">EL VALOR QUE USÁS VOS</span><h3>¿Subió la pintura?</h3>
              <label htmlFor="dv-material">Material del ejemplo</label><select id="dv-material" value={materialSeleccionado?.id || ''} onChange={e => setMaterialActivo(e.target.value)}>
                {materialesUsados.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              {materialSeleccionado && <><label>Precio por {materialSeleccionado.unidad}</label><div className="dv-edit-price"><span>$</span><Numero label={`Precio de ${materialSeleccionado.nombre}`} value={ejemplo.precios[materialSeleccionado.id]} onChange={n => cambiarPrecio(materialSeleccionado.id, n)} /></div>
                <button className="dv-button dv-button-green" onClick={() => cambiarPrecio(materialSeleccionado.id, Math.round(ejemplo.precios[materialSeleccionado.id] * 1.1))}>Probar una suba del 10% <ArrowRight size={15} /></button>
                <p className="dv-affected"><Check size={14} /> Este material se usa en {materialSeleccionado.usos} {materialSeleccionado.usos === 1 ? 'trabajo' : 'trabajos'}.</p></>}
            </div><div className="dv-breakdown"><span className="dv-eyebrow">TU CRITERIO, EN EL PRESUPUESTO</span><h3>Configurá cómo cotizás</h3><p>Los gastos generales y el beneficio se calculan sobre el precio de venta, igual que en el cotizador.</p>
              <label>Gastos generales <span><Numero label="Gastos generales, porcentaje" value={ejemplo.gg} max={94 - ejemplo.beneficio} onChange={n => modificar({ ...ejemplo, gg: n }, 'Gastos generales actualizados.')} /> %</span></label>
              <label>Beneficio <span><Numero label="Beneficio, porcentaje" value={ejemplo.beneficio} max={94 - ejemplo.gg} onChange={n => modificar({ ...ejemplo, beneficio: n }, 'Beneficio actualizado.')} /> %</span></label>
              <label htmlFor="dv-iva">IVA <select id="dv-iva" value={ejemplo.iva} onChange={e => modificar({ ...ejemplo, iva: Number(e.target.value) }, 'IVA actualizado.')}><option value={0}>Sin IVA</option><option value={10.5}>10,5%</option><option value={21}>21%</option></select></label>
              <p className="dv-labor-note">Mano de obra de ejemplo con {ejemplo.cargasSociales}% de cargas sociales. Podés ver el desglose tocando un trabajo.</p>
            </div></div>
            <div className="dv-change-result"><div><span>Presupuesto inicial del ejemplo</span><strong>{dinero(inicial.totales.total_precio_con_iva)}</strong></div><ArrowRight size={20} /><div><span>Con tus cambios</span><strong data-testid="total-ajustado">{dinero(datos.totales.total_precio_con_iva)}</strong></div><span className="dv-change-note">Cantidades, precios e impuestos actualizados.</span></div>
          </div>}

          {paso === 'documento' && <div className="dv-results">
            <div className="dv-task-hint"><span className="dv-hint-number">3</span><span><strong>Tu presupuesto ya tiene salida.</strong> El documento y la compra salen de los mismos datos.</span></div>
            <div className="dv-result-toolbar"><div className="dv-result-tabs" role="tablist" aria-label="Entregables" onKeyDown={e => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
                e.preventDefault();
                const siguiente = e.key === 'Home' ? 'cliente' : e.key === 'End' ? 'materiales' : vista === 'cliente' ? 'materiales' : 'cliente';
                setVista(siguiente); if (siguiente === 'materiales') registrarAccion('materiales');
                requestAnimationFrame(() => document.getElementById(`dv-tab-${siguiente}`)?.focus());
              }
            }}>
              <button id="dv-tab-cliente" role="tab" aria-controls="dv-panel-cliente" tabIndex={vista === 'cliente' ? 0 : -1} aria-selected={vista === 'cliente'} className={vista === 'cliente' ? 'is-active' : ''} onClick={() => setVista('cliente')}><FileText size={15} /> Para el cliente</button>
              <button id="dv-tab-materiales" role="tab" aria-controls="dv-panel-materiales" tabIndex={vista === 'materiales' ? 0 : -1} aria-selected={vista === 'materiales'} className={vista === 'materiales' ? 'is-active' : ''} onClick={() => { setVista('materiales'); registrarAccion('materiales'); }}><Package size={15} /> Materiales</button></div>
              {vista === 'cliente' && <button className="dv-button dv-button-small" onClick={imprimir}><Printer size={15} /> Imprimir / PDF</button>}</div>
            {vista === 'cliente' ? <div id="dv-panel-cliente" className="dv-paper" role="tabpanel" aria-labelledby="dv-tab-cliente"><span className="dv-paper-tag">DEMOSTRACIÓN · VALORES ILUSTRATIVOS</span>
              <PrintPresupuesto data={datos} modo="comercial" empresa={EMPRESA} /><p className="dv-paper-scope">{escenario.alcance} No constituye una cotización.</p></div>
              : <div id="dv-panel-materiales" className="dv-materials-list" role="tabpanel" aria-labelledby="dv-tab-materiales"><div className="dv-materials-intro"><h3>Ya sabés qué necesitás comprar.</h3><p>Sumamos el mismo material entre todos los trabajos, incluido el desperdicio definido en cada análisis.</p></div>
                <table><thead><tr><th>Material</th><th>Cantidad</th><th className="dv-price-col">P. unitario</th><th>Importe</th></tr></thead><tbody>{datos.materiales.map(m => <tr key={m.id}><td>{m.nombre}<small>{m.usos} {m.usos === 1 ? 'trabajo' : 'trabajos'}</small></td><td>{cantidad(m.cantidad)} <span>{m.unidad}</span></td><td className="dv-price-col">{dinero(m.precio)}</td><td>{dinero(m.total)}</td></tr>)}</tbody></table>
                <p className="dv-scope">Cantidades calculadas; ajustá la compra a las presentaciones de tu proveedor. Valores de ejemplo.</p></div>}
          </div>}

          <div className="dv-summary"><div><span>{ejemplo.iva ? `TOTAL CON IVA ${ejemplo.iva}%` : 'TOTAL · SIN IVA'}</span><strong data-testid="demo-total">{dinero(datos.totales.total_precio_con_iva)}</strong></div><div className="dv-summary-detail"><span>{datos.lineas.length} trabajos</span><span>{datos.materiales.length} materiales vinculados</span></div>
            {paso !== 'documento' && <button className="dv-button dv-button-dark" onClick={() => ir(paso === 'presupuesto' ? 'ajustes' : 'documento')}>{paso === 'presupuesto' ? 'Probar con mis valores' : 'Ver el presupuesto listo'}<ArrowRight size={16} /></button>}</div>
        </section>
      </div>

      <div className="dv-feedback"><div role="status" aria-live="polite">{mensaje ? <><Check size={15} />{mensaje}</> : 'Valores ilustrativos para explorar el funcionamiento. No son precios de referencia de mercado.'}</div>
        {historial.length > 0 && <button onClick={() => { setEjemplo(historial[historial.length - 1]); setHistorial(h => h.slice(0, -1)); setMensaje('Cambio deshecho.'); }}><Undo2 size={14} /> Deshacer</button>}</div>

      {paso === 'documento' && <section className="dv-close"><div><span className="dv-eyebrow">AHORA, CON UNA OBRA TUYA</span><h2>Ya viste el recorrido.<br />Llevémoslo a tu forma de trabajar.</h2><p>En una videollamada de 20 minutos te mostramos cómo armar tus presupuestos en FAIM. Si ya querés empezar, creá tu cuenta.</p></div>
        <div className="dv-close-actions"><a className="dv-button dv-button-green" href={wa} target="_blank" rel="noreferrer" onClick={() => registrarAccion('whatsapp')}><MessageCircle size={18} /> Verlo con una obra mía <ArrowRight size={16} /></a>
          <a className="dv-register" href={enlaceRegistro()} onClick={() => registrarAccion('registro')}>Quiero crear mi cuenta <ArrowRight size={15} /></a><span>Suscripción mensual · Sin permanencia</span></div></section>}

      <footer className="dv-footer"><span>FAIM OBRAS <span>·</span> Presupuestá con criterio.</span><a href="/presentacion">Conocer más de FAIM <ArrowRight size={13} /></a></footer>
    </main>

    {lineaAnalisis && <Modal titulo={lineaAnalisis.item.nombre} cerrar={() => setModal(null)}>
      <p className="dv-modal-lead">Este análisis ya viene compuesto. Los valores son ilustrativos y podés cambiar los materiales para probar.</p>
      <div className="dv-analysis-label">MATERIALES POR {lineaAnalisis.item.unidad.toUpperCase()}</div>
      {lineaAnalisis.detalleMateriales.length ? <table className="dv-analysis-table"><thead><tr><th>Insumo</th><th>Consumo</th><th>Precio</th></tr></thead><tbody>{lineaAnalisis.detalleMateriales.map(m => <tr key={m.id}><td>{m.nombre}<small>Desperdicio para compra: {m.desperdicio}%</small></td><td>{cantidad(m.cantidad)} {m.unidad}</td><td><Numero label={`Precio de ${m.nombre}`} value={ejemplo.precios[m.id]} onChange={n => cambiarPrecio(m.id, n)} /></td></tr>)}</tbody></table> : <p className="dv-modal-lead">Este trabajo no utiliza materiales.</p>}
      <div className="dv-analysis-label">MANO DE OBRA POR {lineaAnalisis.item.unidad.toUpperCase()}</div>
      {Object.entries(lineaAnalisis.item.mo).map(([id, horas]) => <div className="dv-analysis-line" key={id}><span>{MANO_OBRA[id].nombre}</span><span>{cantidad(horas)} h × {dinero(MANO_OBRA[id].precio)}</span></div>)}
      <div className="dv-analysis-line dv-muted"><span>Cargas sociales</span><span>{ejemplo.cargasSociales}% sobre mano de obra</span></div>
      {Object.entries(lineaAnalisis.item.equipos).map(([id, horas]) => <div className="dv-analysis-line" key={id}><span>{EQUIPOS[id].nombre}</span><span>{cantidad(horas)} h × {dinero(EQUIPOS[id].precio)}</span></div>)}
      <div className="dv-analysis-total"><span>Costo directo por {lineaAnalisis.item.unidad}<small>Antes de gastos generales, beneficio e IVA.</small></span><strong>{dinero(lineaAnalisis.costoUnitario)}</strong></div>
      <button className="dv-button dv-button-green dv-full" onClick={() => setModal(null)}>Volver al presupuesto <ArrowRight size={16} /></button>
    </Modal>}
    {modal?.tipo === 'catalogo' && <Modal titulo="Agregá un trabajo" cerrar={() => setModal(null)}>
      <p className="dv-modal-lead">Una selección del catálogo para esta demo. Cada trabajo tiene materiales, mano de obra y, cuando corresponde, equipos.</p>
      <label className="dv-search"><Search size={18} /><input autoFocus value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscá pintura, piso, revoque…" aria-label="Buscar trabajo" /></label>
      <div className="dv-catalog">{catalogoFiltrado.map(item => <button key={item.id} onClick={() => {
        const existe = ejemplo.lineas.find(l => l.itemId === item.id);
        const lineas = existe ? ejemplo.lineas.map(l => l.id === existe.id ? { ...l, cantidad: Math.min(10000, l.cantidad + 1) } : l)
          : [...ejemplo.lineas, { id: window.crypto.randomUUID(), itemId: item.id, cantidad: 1 }];
        modificar({ ...ejemplo, lineas }, `${item.nombre}: ${existe ? 'sumamos una unidad' : 'agregado al presupuesto'}. Cambiá la cantidad según tu ejemplo.`, 'catalogo');
        setModal(null);
      }}><span><strong>{item.nombre}</strong><small>{item.rubro} · por {item.unidad}</small></span><Plus size={18} /></button>)}
      {!catalogoFiltrado.length && <p className="dv-modal-lead">No hay coincidencias en esta selección. Probá con “pintura” o “piso”.</p>}</div>
    </Modal>}
    {modal?.tipo === 'reinicio' && <Modal titulo={modal.escenario === ejemplo.escenario ? '¿Reiniciar el ejemplo?' : '¿Probar el otro ejemplo?'} cerrar={() => setModal(null)} ancho="dv-modal-small">
      <p className="dv-modal-lead">Se reemplazan los cambios de esta demo por los valores iniciales de {ESCENARIOS[modal.escenario].etiqueta.toLowerCase()}.</p>
      <div className="dv-modal-actions"><button className="dv-button" onClick={() => setModal(null)}>Seguir con mis cambios</button><button className="dv-button dv-button-green" onClick={() => reiniciar(modal.escenario)}>Cargar ejemplo <ArrowRight size={15} /></button></div>
    </Modal>}
  </div>;
}
