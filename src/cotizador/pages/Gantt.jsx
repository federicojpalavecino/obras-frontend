import '../index.css';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, BarChart2 } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { tenantNombre, localidadYFecha } from '../tenant';
import BarraDeshacer from '../BarraDeshacer';
import { registrar, limpiar, deshacerUltima, useAtajoDeshacer } from '../deshacer';

import api from '../api';

import { imprimirHTML } from '../../utils/imprimir';
const COLORES = ['#6ee7b7','#a78bfa','#38bdf8','#fbbf24','#f87171','#fb923c','#e879f9','#a3e635','#34d399','#60a5fa'];

const addDias = (fecha, dias) => {
  if (!fecha) return new Date().toISOString().split('T')[0];
  try {
    const d = new Date(fecha + 'T12:00:00');
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  } catch(e) { return new Date().toISOString().split('T')[0]; }
};

const diasEntre = (a, b) => {
  const da = new Date(a + 'T12:00:00');
  const db = new Date(b + 'T12:00:00');
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
};

const fmt = n => '$ ' + Math.round(n || 0).toLocaleString('es-AR');
const fmtFecha = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—';
const fmtFechaLarga = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// getDay() de JS es domingo=0..sábado=6; el motor usa weekday() de Python,
// lunes=0..domingo=6. Esta tabla traduce, y de paso da la inicial del día.
const A_WEEKDAY = [6, 0, 1, 2, 3, 4, 5];
const DIA_LETRA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export default function Gantt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [presupuesto, setPresupuesto] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [tareas, setTareas] = useState([]);
  // El avance real de la obra, por linea del presupuesto. La barra se pinta con
  // esto y no con el `progreso` que se cargaba a mano en la tarea: lo que se
  // certifico o se midio es la verdad, y tener dos numeros para lo mismo
  // garantiza que uno quede viejo.
  const [avanceObra, setAvanceObra] = useState(null);
  // El estado real de cada linea: quien la ejecuta, cuanto se le certifico y
  // cuanto se le pago. Es lo que convierte al Gantt en un tablero de decision
  // durante la obra, en vez de solo un calendario.
  const [estadoLineas, setEstadoLineas] = useState({});
  // La plata de la obra sobre la misma linea de tiempo del plazo: lo cobrado,
  // lo pagado, y lo que se espera. Mirando el Gantt se ve que pasa con la caja
  // si una tarea se corre.
  const [plata, setPlata] = useState(null);
  const [cargarAvanceEn, setCargarAvanceEn] = useState(null);   // tarea abierta
  const [pctNuevo, setPctNuevo] = useState("");
  // Los dias que la obra no avanzo. Se pintan en la grilla y corren el plazo.
  const [diasPerdidos, setDiasPerdidos] = useState([]);
  const [panelDias, setPanelDias] = useState(false);
  const [formDia, setFormDia] = useState({ desde: "", hasta: "", motivo: "lluvia", nota: "" });
  const perdidoPorFecha = Object.fromEntries(diasPerdidos.map(d => [d.fecha, d]));

  const guardarDiasPerdidos = async () => {
    if (!formDia.desde) return;
    try {
      await api.post(`/presupuestos/${id}/dias-no-trabajados`, formDia);
      setFormDia({ desde: "", hasta: "", motivo: "lluvia", nota: "" });
      await cargar();
    } catch (e) { alert(e?.response?.data?.detail || 'No se pudo guardar'); }
  };

  const borrarDiaPerdido = async (did) => {
    await api.delete(`/presupuestos/${id}/dias-no-trabajados/${did}`);
    await cargar();
  };

  // Suspender una tarea no es lo mismo que un dia de lluvia: la lluvia para la
  // obra entera, esto para una sola. Al retomarla, los dias que estuvo parada se
  // suman a su duracion y todo lo que dependia de ella se corre solo.
  // Los formularios de partir y suspender van adentro del panel de la tarea.
  // Nada de window.prompt: no se puede escribir una fecha en un cuadro del
  // navegador, y encima corta la pantalla del sistema.
  const [suspendiendo, setSuspendiendo] = useState(false);
  const [formSuspender, setFormSuspender] = useState(null);   // { motivo }
  const [formPartir, setFormPartir] = useState(null);         // { pct, fecha }
  const [avisoTarea, setAvisoTarea] = useState("");

  const alternarSuspension = async (tarea, motivo = "") => {
    const parar = !tarea.suspendida;
    setSuspendiendo(true);
    try {
      const r = await api.patch(`/presupuestos/${id}/gantt/tareas/${tarea.id}/suspender`,
        { suspender: parar, motivo });
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data);
      await refrescarPlan();
      setFormSuspender(null);
      setCargarAvanceEn(t.data.find(x => x.id === tarea.id) || null);
      setAvisoTarea(parar ? "Tarea suspendida." :
        `Retomada. Estuvo parada ${r.data?.dias_parada || 0} día${r.data?.dias_parada !== 1 ? "s" : ""}, que se sumaron al plazo.`);
    } catch (e) { setAvisoTarea(e.response?.data?.detail || "No se pudo"); }
    setSuspendiendo(false);
  };

  // Partir no es suspender. Suspender es la tarea entera parada un tiempo;
  // partir es hacer un pedazo ahora y el resto más adelante. Sigue siendo UNA
  // tarea, una sola fila: lo que se corta es la barra.
  const partirTarea = async (tarea, pct, fecha) => {
    const n = parseFloat(pct);
    if (!(n > 0 && n < 100)) { setAvisoTarea("La parte hecha tiene que estar entre 1 y 99%."); return; }
    if (!fecha) { setAvisoTarea("Falta la fecha en la que se retoma."); return; }
    try {
      const r = await api.post(`/presupuestos/${id}/gantt/tareas/${tarea.id}/dividir`,
        { pct_hecho: n, fecha_reanuda: fecha });
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data);
      await refrescarPlan();
      setFormPartir(null);
      setAvisoTarea('');
      setCargarAvanceEn(null);
      showToast(`✂ Partida: ${r.data.dias_hecho} día(s) ahora y ${r.data.dias_resto} desde el ${fmtFechaLarga(fecha)}`);
    } catch (e) { setAvisoTarea(e.response?.data?.detail || "No se pudo partir"); }
  };

  // Correr la fecha en que se retoma: es lo unico de una tarea partida que se
  // toca seguido, porque la obra se destraba antes o despues de lo previsto.
  const moverTramo = async (tarea, idx, fecha) => {
    if (!fecha) return;
    try {
      await api.post(`/presupuestos/${id}/gantt/tareas/${tarea.id}/dividir`,
        { mover_tramo: idx, fecha });
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data);
      await refrescarPlan();
      setCargarAvanceEn(t.data.find(x => x.id === tarea.id) || null);
      setAvisoTarea(`Se retoma el ${fmtFechaLarga(fecha)}.`);
    } catch (e) { setAvisoTarea(e.response?.data?.detail || "No se pudo mover"); }
  };

  const unirTarea = async (tarea) => {
    try {
      await api.post(`/presupuestos/${id}/gantt/tareas/${tarea.id}/dividir`, { unir: true });
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data);
      await refrescarPlan();
      setCargarAvanceEn(t.data.find(x => x.id === tarea.id) || null);
      setAvisoTarea("La tarea vuelve a ir de corrido.");
    } catch (e) { setAvisoTarea(e.response?.data?.detail || "No se pudo"); }
  };

  // Qué fecha proponer para retomar. Para una tarea que ya está en curso, hoy;
  // para una que todavía no arrancó, hoy no significa nada: lo que corresponde
  // es el día en que seguiría de largo si no se partiera, y desde ahí el
  // estudio la reprograma.
  const fechaQueSigue = (tarea, pct) => {
    const partido = tarea?.tramos?.length > 1;
    const desde = partido ? tarea.tramos[tarea.tramos.length - 1].inicio : (tarea?.fecha_inicio || hoy);
    const dur = partido ? (tarea.tramos[tarea.tramos.length - 1].dias || 1)
                        : (tarea?.dur_calc || tarea?.duracion_dias || 1);
    const n = parseFloat(pct);
    const hecho = Math.max(1, Math.round((dur * (isNaN(n) ? 50 : n)) / 100));
    // Día siguiente al que termina la parte que se hace ahora, salteando lo
    // que no se trabaja.
    let d = addDias(desde, diasCalendarioDeTramo({ inicio: desde, dias: hecho }));
    for (let i = 0; i < 30 && !esLaborable(d); i++) d = addDias(d, 1);
    // Si la tarea ya venía corriendo, lo natural es retomarla de hoy en más.
    return d > hoy ? d : hoy;
  };

  // Un gasto de obra cargado desde el Gantt. Va como compra pagada atada a la
  // línea del ítem, así que entra sola al control financiero del período y
  // queda imputada a la tarea que la generó.
  const guardarGasto = async () => {
    const monto = parseFloat(String(gastoForm.monto).replace(',', '.'));
    if (!(monto > 0)) { showToast('⚠ Poné cuánto se gastó'); return; }
    setGuardandoGasto(true);
    try {
      const r = await api.post(`/presupuestos/${id}/compras`, {
        proveedor_nombre: gastoForm.proveedor || 'Gasto de obra',
        fecha_pedido: hoy,
        estado: 'pagado',
        monto_total: monto,
        monto_pagado: monto,
        nota: gastoForm.nota || `Cargado desde el Gantt · ${gastoEn?.nombre || ''}`,
        destino: 'compra',
        lineas_ids: gastoEn?.linea_id ? [gastoEn.linea_id] : [],
      });
      setGastoEn(null);
      setGastoForm({ monto: '', proveedor: '', nota: '' });
      showToast(r.data?.en_control_financiero
        ? `✓ $ ${Math.round(monto).toLocaleString('es-AR')} · ya está en el control financiero`
        : `✓ Gasto guardado por $ ${Math.round(monto).toLocaleString('es-AR')}`);
      cargar();
    } catch (e) {
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo guardar el gasto'));
    }
    setGuardandoGasto(false);
  };

  const guardarAvanceLinea = async () => {
    if (!cargarAvanceEn?.linea_id) return;
    try {
      await api.post(`/presupuestos/${id}/avance`, {
        lineas: [{ linea_id: cargarAvanceEn.linea_id, pct: parseFloat(pctNuevo) || 0 }],
        nota: `Cargado desde el Gantt · ${cargarAvanceEn.nombre}`,
      });
      const r = await api.get(`/presupuestos/${id}/avance`);
      setAvanceObra(r.data);
      setCargarAvanceEn(null);
    } catch (e) {
      alert(e?.response?.data?.detail || 'No se pudo guardar el avance');
    }
  };

  const avancePorLinea = Object.fromEntries(
    ((avanceObra && avanceObra.por_linea) || []).map(a => [a.linea_id, a.pct]));
  // laborables: días de la semana que se trabajan, en índices de getDay() de JS
  // corridos a lunes=0 (igual que weekday() de Python, que es lo que usa el motor).
  const [config, setConfig] = useState({
    horas_dia: 8, fecha_inicio_obra: new Date().toISOString().split('T')[0],
    sabado: false, domingo: false, laborables: [0, 1, 2, 3, 4],
  });
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [toast, setToast] = useState('');
  const [generando, setGenerando] = useState(false);
  // Dependencias entre tareas
  const [vinculos, setVinculos] = useState([]);
  const [plan, setPlan] = useState(null);          // fechas + holguras + camino crítico
  const [errorPlan, setErrorPlan] = useState('');
  // En un celular el diagrama de barras no se puede usar: la obra se mira y se
  // carga desde una lista. El diagrama queda a un toque para el que lo quiera.
  const [esCelular, setEsCelular] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const f = e => setEsCelular(e.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  const [verDiagrama, setVerDiagrama] = useState(false);
  const [gastoEn, setGastoEn] = useState(null);      // tarea a la que se le carga
  const [gastoForm, setGastoForm] = useState({ monto: '', proveedor: '', nota: '' });
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const [panelFalta, setPanelFalta] = useState(false);
  const [planificando, setPlanificando] = useState(null);
  const [modoVincular, setModoVincular] = useState(false);
  const [predSel, setPredSel] = useState(null);    // tarea elegida como predecesora
  const [verCritico, setVerCritico] = useState(true);
  const [panelVinculos, setPanelVinculos] = useState(false);
  // En una obra de 40 items la lista entera de vinculos es ilegible. Se filtra
  // por tarea, y si se llego tocando una flecha arranca mostrando solo los de
  // esa tarea.
  const [filtroVinc, setFiltroVinc] = useState('');
  const [soloDeLaTarea, setSoloDeLaTarea] = useState(true);
  const [vinculoSel, setVinculoSel] = useState(null);   // el resaltado al tocar la flecha
  const [arrastre, setArrastre] = useState(null);   // {id, dx} mientras se arrastra
  const scrollRef = useRef(null);
  // Al abrir el Gantt de una obra larga, la vista arrancaba en el primer día
  // del plan y había que arrastrar semanas para llegar a donde está la obra.
  const colHoyRef = useRef(null);
  const yaCentre = useRef(false);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // ── Deshacer (Ctrl+Z) ──────────────────────────────────────────────────────
  const [avisoUndo, setAvisoUndo] = useState('');
  const avisar = (msg) => setAvisoUndo(msg);
  // La pila es de esta pantalla y de este presupuesto: no tiene sentido
  // deshacer algo de otra obra.
  useEffect(() => { limpiar(); return limpiar; }, [id]);
  const hacerDeshacer = async () => {
    const r = await deshacerUltima();
    setAvisoUndo('');
    if (r.ok) return showToast(`↶ Deshecho: ${r.etiqueta}`);
    if (r.motivo === 'cambio') return showToast('⚠ Eso cambió desde entonces — no se deshizo para no pisar el cambio');
    if (r.motivo === 'error') return showToast('⚠ No se pudo deshacer');
  };
  useAtajoDeshacer(hacerDeshacer);

  // El ancho de un día era fijo en 28 px, así que un plan de seis meses medía
  // cinco metros: había que arrastrar y arrastrar, y nunca se veía la obra
  // entera. Ahora se elige la escala, y «Entra todo» la calcula para que el
  // plan completo entre en el ancho que hay.
  const [escala, setEscala] = useState(() => localStorage.getItem('obras_gantt_escala') || 'entra');
  const [anchoUtil, setAnchoUtil] = useState(900);
  const elegirEscala = (e) => { setEscala(e); localStorage.setItem('obras_gantt_escala', e); };
  const ROW_H = 40;
  const LABEL_W = esCelular ? 130 : 260;

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    // Sale del mismo registro que usa el resumen, el portal y la curva.
    api.get(`/presupuestos/${id}/avance`).then(r => setAvanceObra(r.data)).catch(() => {});
    api.get(`/presupuestos/${id}/dias-no-trabajados`).then(r => setDiasPerdidos(r.data || [])).catch(() => {});
    setLoading(true);
    try {
      // Ojo con el orden: estas cuatro se desestructuran por posición. La plata
      // y el estado por línea NO van acá — se pisaban con el plan y `planRes`
      // quedaba undefined: la carga explotaba justo antes de setear el plan y
      // el Gantt se dibujaba con las fechas guardadas en vez de las calculadas.
      api.get(`/presupuestos/${id}/plata`).then(r => setPlata(r.data)).catch(() => {});
      api.get(`/presupuestos/${id}/lineas/estado`).then(r => {
        setEstadoLineas(Object.fromEntries((r.data?.lineas || []).map(l => [l.linea_id, l])));
      }).catch(() => {});
      const [pRes, tRes, cRes, vRes, planRes] = await Promise.all([
        api.get(`/presupuestos/${id}`).then(r => r.data),
        api.get(`/presupuestos/${id}/gantt/tareas`).then(r => ({data: r.data})),
        api.get(`/presupuestos/${id}/gantt/config`).catch(() => ({data: {}})),
        api.get(`/presupuestos/${id}/gantt/vinculos`).catch(() => ({data: []})),
        api.get(`/presupuestos/${id}/gantt/plan`).catch(e => ({data: null, err: e})),
      ]);
      setPresupuesto(pRes);
      // Extraer lineas desde rubros
      const todasLineas = (pRes.rubros || []).flatMap(r => r.lineas || []);
      setLineas(todasLineas);
      setTareas(Array.isArray(tRes.data) ? tRes.data : []);
      if (cRes.data && Object.keys(cRes.data).length) setConfig(c => ({...c, ...cRes.data}));
      setVinculos(Array.isArray(vRes.data) ? vRes.data : []);
      setPlan(planRes?.data || null);
      setErrorPlan(planRes?.data ? '' : (planRes?.err?.response?.data?.detail || ''));
    } catch (e) {
      console.error(e);
      setErrorPlan('No se pudo cargar el Gantt. Recargá la página.');
    }
    setLoading(false);
  };

  useEffect(() => {
    const medir = () => {
      if (scrollRef.current) setAnchoUtil(Math.max(240, scrollRef.current.clientWidth - 4));
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [esCelular]);

  useEffect(() => {
    if (yaCentre.current || !scrollRef.current || !colHoyRef.current) return;
    const cont = scrollRef.current;
    const x = colHoyRef.current.offsetLeft - cont.clientWidth / 3;
    cont.scrollLeft = Math.max(0, x);
    yaCentre.current = true;
  });

  // Recalcula el plan (fechas, holguras, camino crítico) sin recargar todo
  const refrescarPlan = async () => {
    try {
      const r = await api.get(`/presupuestos/${id}/gantt/plan`);
      setPlan(r.data); setErrorPlan('');
    } catch (e) {
      setPlan(null);
      setErrorPlan(e.response?.data?.detail || 'No se pudo calcular la planificación.');
    }
  };

  const crearVinculo = async (predId, sucId) => {
    try {
      await api.post(`/presupuestos/${id}/gantt/vinculos`, {
        predecesora_id: predId, sucesora_id: sucId, tipo: 'FS', lag: 0,
      });
      const v = await api.get(`/presupuestos/${id}/gantt/vinculos`);
      setVinculos(v.data || []);
      await refrescarPlan();
      // Una tarea fijada con el chinche no se pega a su predecesora: el
      // vínculo queda hecho pero no mueve nada, y parece que falló.
      const suc = tareas.find(x => x.id === sucId);
      if (suc?.no_antes_de) {
        showToast(`✓ Vinculadas · «${suc.nombre}» está fijada 📌 — soltala para que se acomode sola`);
      } else {
        showToast('✓ Tareas vinculadas');
      }
    } catch (e) {
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo vincular'));
    }
  };

  const borrarVinculo = async (vid) => {
    const prev = vinculos.find(v => v.id === vid);
    try {
      await api.delete(`/presupuestos/${id}/gantt/vinculos/${vid}`);
      setVinculos(vs => vs.filter(v => v.id !== vid));
      await refrescarPlan();
      if (prev) {
        registrar({
          etiqueta: 'Vínculo eliminado',
          deshacer: async () => {
            await api.post(`/presupuestos/${id}/gantt/vinculos`, {
              predecesora_id: prev.predecesora_id, sucesora_id: prev.sucesora_id,
              tipo: prev.tipo || 'FS', lag: prev.lag || 0,
            });
            const v = await api.get(`/presupuestos/${id}/gantt/vinculos`);
            setVinculos(v.data || []);
            await refrescarPlan();
          },
        });
      }
      avisar('Vínculo eliminado');
    } catch (e) { showToast('⚠ No se pudo eliminar'); }
  };

  const borrarTodosLosVinculos = async () => {
    if (!window.confirm(`Se van a soltar los ${vinculos.length} vínculos de este Gantt. ¿Seguir?`)) return;
    const previos = [...vinculos];
    try {
      for (const v of previos) await api.delete(`/presupuestos/${id}/gantt/vinculos/${v.id}`);
      setVinculos([]);
      await refrescarPlan();
      registrar({
        etiqueta: `${previos.length} vínculos eliminados`,
        deshacer: async () => {
          for (const v of previos) {
            await api.post(`/presupuestos/${id}/gantt/vinculos`, {
              predecesora_id: v.predecesora_id, sucesora_id: v.sucesora_id,
              tipo: v.tipo || 'FS', lag: v.lag || 0,
            });
          }
          const nv = await api.get(`/presupuestos/${id}/gantt/vinculos`);
          setVinculos(nv.data || []);
          await refrescarPlan();
        },
      });
      avisar(`${previos.length} vínculos eliminados`);
    } catch (e) { showToast('⚠ No se pudieron eliminar todos'); }
  };

  const cambiarVinculo = async (vid, campos) => {
    try {
      await api.patch(`/presupuestos/${id}/gantt/vinculos/${vid}`, campos);
      const v = await api.get(`/presupuestos/${id}/gantt/vinculos`);
      setVinculos(v.data || []);
      await refrescarPlan();
    } catch (e) { showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo actualizar')); }
  };

  const encadenarTodo = async () => {
    if (!window.confirm('Se van a reemplazar todos los vínculos actuales por una cadena en orden (cada tarea después de la anterior). ¿Seguir?')) return;
    try {
      await api.post(`/presupuestos/${id}/gantt/vincular-cadena`);
      await cargar();
      showToast('✓ Tareas encadenadas');
    } catch (e) { showToast('⚠ ' + (e.response?.data?.detail || 'Error')); }
  };

  const aplicarPlan = async () => {
    try {
      await api.post(`/presupuestos/${id}/gantt/replanificar`);
      await cargar();
      showToast('✓ Fechas recalculadas según las dependencias');
    } catch (e) { showToast('⚠ ' + (e.response?.data?.detail || 'Error')); }
  };

  const soltarTarea = async (tareaId) => {
    try {
      await api.post(`/presupuestos/${id}/gantt/soltar-tarea/${tareaId}`);
      await cargar();
      showToast('✓ La tarea vuelve a regirse por sus dependencias');
    } catch (e) { showToast('⚠ Error'); }
  };

  // ── Arrastrar una barra para cambiarle la fecha ────────────────────────────
  // Se calcula el corrimiento en días sobre la grilla y se manda al backend,
  // que reacomoda las sucesoras.
  const iniciarArrastre = (e, tarea) => {
    if (modoVincular || tarea.es_resumen) return;
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX;
    const inicio0 = tarea.fecha_inicio;
    setArrastre({ id: tarea.id, dx: 0 });
    const mover = (ev) => setArrastre({ id: tarea.id, dx: ev.clientX - x0 });
    const soltar = async (ev) => {
      document.removeEventListener('mousemove', mover);
      document.removeEventListener('mouseup', soltar);
      setArrastre(null);
      const dias = Math.round((ev.clientX - x0) / PX_DIA);
      if (!dias) return;
      const nueva = addDias(inicio0, dias);
      try {
        const r = await api.post(`/presupuestos/${id}/gantt/mover`, { tarea_id: tarea.id, fecha_inicio: nueva });
        setPlan(r.data); setErrorPlan('');
        const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
        setTareas(t.data || []);
        showToast('✓ Tarea movida — las siguientes se reacomodaron');
      } catch (err) {
        showToast('⚠ ' + (err.response?.data?.detail || 'No se pudo mover'));
      }
    };
    document.addEventListener('mousemove', mover);
    document.addEventListener('mouseup', soltar);
  };

  const cambiarCuadrilla = async (tareaId, personas, horas = 0, esDeshacer = false) => {
    const antes = (tareas.find(t => t.id === tareaId) || {}).personas ?? 1;
    try {
      const r = await api.patch(`/presupuestos/${id}/gantt/tareas/${tareaId}/cuadrilla`, { personas });
      setPlan(r.data); setErrorPlan('');
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data || []);
      if (!esDeshacer && antes !== personas) {
        registrar({
          etiqueta: `Cuadrilla ${antes} → ${personas}`,
          verificar: async () => {
            const act = ((await api.get(`/presupuestos/${id}/gantt/tareas`)).data || [])
              .find(x => x.id === tareaId);
            return !!act && (act.personas ?? 1) === personas;
          },
          deshacer: async () => { await cambiarCuadrilla(tareaId, antes, horas, true); },
        });
      }
      // Sin horas la duración es fija, así que sumar gente no acorta nada. Se
      // avisa en vez de dejar al usuario tocando un botón que no hace nada.
      if (!(horas > 0)) showToast(`👷 ${personas} — para que el plazo se recalcule, tocá “⏱ Horas”`);
    } catch (e) { showToast('⚠ ' + (e.response?.data?.detail || 'Error')); }
  };

  const cargarHoras = async () => {
    try {
      const r = await api.post(`/presupuestos/${id}/gantt/cargar-horas`);
      await cargar();
      const { actualizadas = 0, sin_analisis = 0 } = r.data || {};
      showToast(`✓ ${actualizadas} tarea(s) con horas del análisis` + (sin_analisis ? ` · ${sin_analisis} sin datos` : ''));
    } catch (e) { showToast('⚠ ' + (e.response?.data?.detail || 'Error')); }
  };

  // ── Jerarquía: indentar y desindentar ─────────────────────────────────────
  // Indentar cuelga la tarea de la de arriba, que pasa a ser tarea resumen y
  // toma sus fechas de las hijas. Desindentar la vuelve a dejar suelta.
  // esDeshacer evita que la propia reversión registre otra entrada y se arme un
  // ida y vuelta infinito en la pila.
  const cambiarPadre = async (tarea, padreId, esDeshacer = false) => {
    try {
      await api.put(`/presupuestos/${id}/gantt/tareas/${tarea.id}`, {
        nombre: tarea.nombre,
        fecha_inicio: tarea.fecha_inicio,
        duracion_dias: tarea.duracion_dias,
        color: tarea.color,
        orden: tarea.orden,
        progreso: tarea.progreso || 0,
        padre_id: padreId,
      });
      const antes = tarea.padre_id ?? null;
      if (!esDeshacer) {
        registrar({
          etiqueta: padreId ? `«${tarea.nombre}» pasó a subtarea` : `«${tarea.nombre}» quedó suelta`,
          verificar: async () => {
            const t = (await api.get(`/presupuestos/${id}/gantt/tareas`)).data || [];
            const act = t.find(x => x.id === tarea.id);
            return !!act && (act.padre_id ?? null) === (padreId ?? null);
          },
          deshacer: async () => { await cambiarPadre({ ...tarea, padre_id: padreId }, antes, true); },
        });
      }
      await cargar();
      avisar(padreId ? 'Ahora es subtarea' : 'Tarea suelta');
    } catch (e) {
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo mover'));
    }
  };

  // La tarea de arriba es la candidata a padre. No se puede colgar de una
  // subtarea (un solo nivel) ni de sí misma.
  const padreCandidato = (t, lista) => {
    const i = lista.findIndex(x => x.id === t.id);
    for (let j = i - 1; j >= 0; j--) {
      if (!lista[j].padre_id) return lista[j];
    }
    return null;
  };

  // Vincular con dos clicks: primero la predecesora, después la sucesora.
  const clickVincular = (t) => {
    if (!predSel) { setPredSel(t); showToast('Ahora tocá la tarea que va DESPUÉS'); return; }
    if (predSel.id === t.id) { setPredSel(null); return; }
    crearVinculo(predSel.id, t.id);
    setPredSel(null);
  };

  const guardarConfig = async (cfg) => {
    const data = { ...cfg, presupuesto_id: parseInt(id) };
    const r = await api.put(`/presupuestos/${id}/gantt/config`, data);
    // El backend devuelve los días laborables que quedaron: se usan tal cual
    // para pintar la grilla, así la pantalla nunca discrepa de la planificación.
    setConfig({ ...cfg, laborables: r.data?.laborables || cfg.laborables });
    await refrescarPlan();
    showToast('✓ Configuración guardada');
  };

  // Cambiar sábado o domingo se guarda solo: es un interruptor, no un formulario.
  const cambiarFinDeSemana = async (campo, valor) => {
    const cfg = { ...config, [campo]: valor };
    setConfig(cfg);
    try {
      await guardarConfig(cfg);
      const t = await api.get(`/presupuestos/${id}/gantt/tareas`);
      setTareas(t.data || []);
    } catch (e) {
      setConfig(config);   // vuelve atrás si no se pudo guardar
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo guardar'));
    }
  };

  const exportarAlPlanner = async () => {
    try {
      const res = await api.post(`/planner/desde-gantt/${id}`);
      const creadas = res.data?.creadas ?? 0;
      if (creadas === 0) {
        alert('Las tareas del Gantt ya estaban en el Planner.');
      } else {
        alert(`✓ ${creadas} tarea${creadas !== 1 ? 's' : ''} exportada${creadas !== 1 ? 's' : ''} al Planner.`);
      }
    } catch (e) {
      alert('Error al exportar: ' + (e.response?.data?.detail || e.message));
    }
  };

  // Regenerar rehace el Gantt desde el presupuesto: borra las tareas y con
  // ellas los vínculos, las tareas partidas y las fechas movidas a mano. Por
  // eso pregunta una vez antes, en el mismo botón.
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
  const generarDesdePresupuesto = async () => {
    if (!confirmarRegenerar && tareas.length) {
      setConfirmarRegenerar(true);
      showToast('⚠ Rehace el plan desde cero: se pierden los vínculos y las fechas movidas a mano. Tocá otra vez para confirmar.');
      setTimeout(() => setConfirmarRegenerar(false), 6000);
      return;
    }
    setConfirmarRegenerar(false);
    setGenerando(true);
    try {
      const r = await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      const nv = r.data?.vinculos_borrados || 0;
      showToast(`✓ ${r.data?.tareas_generadas || 0} tareas generadas` +
                (nv ? ` · se borraron ${nv} vínculo${nv !== 1 ? 's' : ''}` : ''));
    } catch(e) {
      showToast('⚠ No se pudo regenerar: ' + (e.response?.data?.detail || e.message));
    }
    setGenerando(false);
  };

  const guardarTarea = async (tarea) => {
    const data = { ...tarea };
    try {
      if (tarea.id) {
        await api.put(`/presupuestos/${id}/gantt/tareas/${tarea.id}`, data);
        showToast('✓ Guardado');
      } else if (data.es_adicional) {
        // No es una barra más: crea la línea en el adicional de la obra y ata
        // la tarea a esa línea, así el trabajo ya tiene precio y viaja a la
        // curva, a los certificados y al control financiero.
        const r = await api.post(`/presupuestos/${id}/gantt/tareas/adicional`, {
          nombre: data.nombre,
          fecha_inicio: data.fecha_inicio,
          color: data.color,
          item_global_id: data.item_global_id || null,
          cantidad: parseFloat(data.cantidad) || 1,
          unidad_libre: data.unidad_libre || 'un',
          costo_directo_libre: parseFloat(data.costo_directo_libre) || 0,
          sin_precio: !!data.sin_precio,
        });
        showToast(r.data?.sin_precio
          ? `✓ Adicional cargado sin precio — queda para valorizar en «${r.data.adicional_nombre}»`
          : `✓ Adicional cargado en «${r.data.adicional_nombre}»`);
      } else {
        const res = await api.post(`/presupuestos/${id}/gantt/tareas`, { ...data, presupuesto_id: parseInt(id) });
        tarea.id = res.data.id;
        showToast('✓ Guardado');
      }
      setEditando(null);
      cargar();
    } catch (e) {
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo guardar'));
    }
  };

  const eliminarTarea = async (tid) => {
    // Se guarda la tarea entera antes de borrarla: deshacer la vuelve a crear.
    // El id cambia (lo asigna el servidor), así que los vínculos que tuviera se
    // pierden — se avisa para no prometer más de lo que se devuelve.
    const prev = tareas.find(t => t.id === tid);
    const tenia = vinculos.some(v => v.predecesora_id === tid || v.sucesora_id === tid);
    await api.delete(`/presupuestos/${id}/gantt/tareas/${tid}`);
    if (prev) {
      registrar({
        etiqueta: `Tarea «${prev.nombre}» eliminada`,
        deshacer: async () => {
          await api.post(`/presupuestos/${id}/gantt/tareas`, {
            presupuesto_id: parseInt(id), linea_id: prev.linea_id,
            nombre: prev.nombre, fecha_inicio: prev.fecha_inicio,
            duracion_dias: prev.duracion_dias, color: prev.color, orden: prev.orden,
            progreso: prev.progreso || 0, padre_id: prev.padre_id,
            horas_totales: prev.horas_totales, personas: prev.personas,
          });
          await cargar();
        },
      });
    }
    avisar(`Tarea eliminada${tenia ? ' (sus vínculos no se recuperan)' : ''}`);
    cargar();
  };

  // ¿Se trabaja ese día? Misma regla que usa el motor para planificar.
  const esLaborable = (fecha) => {
    const lab = config.laborables || [0, 1, 2, 3, 4];
    return lab.includes(A_WEEKDAY[new Date(fecha + 'T12:00:00').getDay()]);
  };

  // Cuántos días de calendario ocupa un tramo de N días de trabajo: la grilla
  // va en días corridos y la duración en hábiles, así que un tramo de 3 días
  // que arranca un viernes se dibuja de viernes a martes.
  const diasCalendarioDeTramo = (tr) => {
    const habilesPedidos = Math.max(1, tr.dias || 1);
    const d = new Date(tr.inicio + 'T12:00:00');
    let habiles = 0, corridos = 0;
    while (corridos < 400) {
      const iso = d.toISOString().slice(0, 10);
      corridos++;
      if (esLaborable(iso)) habiles++;
      if (habiles >= habilesPedidos) break;
      d.setDate(d.getDate() + 1);
    }
    return Math.max(1, corridos);
  };

  // Lo que está presupuestado pero todavía no está en el plan. Incluye los
  // ítems de los adicionales de la obra: un adicional aprobado vive en otro
  // presupuesto y si no, no aparecería nunca en el Gantt.
  const lineasConTarea = new Set(tareas.map(t => t.linea_id).filter(Boolean));
  const faltaPlanificar = Object.values(estadoLineas)
    .filter(l => !lineasConTarea.has(l.linea_id))
    .sort((a, b) => (b.es_adicional ? 1 : 0) - (a.es_adicional ? 1 : 0));

  const vinculoSelObj = vinculos.find(v => v.id === vinculoSel);
  const tareaDelVinculoSel = vinculoSelObj
    ? tareas.find(t => t.id === vinculoSelObj.predecesora_id) || null : null;
  const vinculosVisibles = (() => {
    const q = filtroVinc.trim().toLowerCase();
    const nom = i => ((tareas.find(t => t.id === i) || {}).nombre || '').toLowerCase();
    let lista = vinculos;
    if (soloDeLaTarea && tareaDelVinculoSel) {
      const tid2 = tareaDelVinculoSel.id;
      lista = lista.filter(v => v.predecesora_id === tid2 || v.sucesora_id === tid2);
    }
    if (q) lista = lista.filter(v => nom(v.predecesora_id).includes(q) || nom(v.sucesora_id).includes(q));
    return lista;
  })();

  const planificarLinea = async (l) => {
    setPlanificando(l.linea_id);
    try {
      const r = await api.post(`/presupuestos/${id}/gantt/tareas/desde-linea`, { linea_id: l.linea_id });
      await cargar();
      showToast(`✓ «${r.data.nombre}» entró al plan · ${r.data.duracion_dias} día${r.data.duracion_dias !== 1 ? 's' : ''}`);
    } catch (e) {
      showToast('⚠ ' + (e.response?.data?.detail || 'No se pudo planificar'));
    }
    setPlanificando(null);
  };

  // ── CÁLCULOS DEL GANTT ──
  if (loading) return <div style={{ background: 'var(--bg)', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--sans)' }}>Cargando...</div>;

  // El plan del backend manda: trae las fechas que salen de las dependencias,
  // más holgura y camino crítico. Si falla (p.ej. dependencia circular), caemos
  // a las fechas guardadas para que el Gantt siga siendo usable.
  const planPorId = {};
  (plan?.tareas || []).forEach(x => { planPorId[x.id] = x; });
  const filas = tareas.map(t => {
    const p = planPorId[t.id];
    return {
      ...t,
      fecha_inicio: p?.inicio || t.fecha_inicio,
      fecha_fin: p?.fin || addDias(t.fecha_inicio, (t.duracion_dias || 1) - 1),
      critica: !!p?.critica,
      holgura: p?.holgura ?? null,
      es_hito: p?.es_hito || (t.duracion_dias || 1) === 0,
      es_resumen: !!p?.es_resumen,
      padre_id: p?.padre_id ?? t.padre_id ?? null,
      personas: p?.personas ?? t.personas ?? 1,
      horas_totales: p?.horas_totales ?? t.horas_totales ?? 0,
      dur_calc: p?.duracion ?? t.duracion_dias,
      // En las tareas resumen el progreso es el promedio de las hijas.
      progreso: p?.progreso ?? t.progreso ?? 0,
    };
  });
  const porId = {};
  filas.forEach((f, i) => { porId[f.id] = { ...f, fila: i }; });

  const fechaMin = filas.reduce((a, t) => t.fecha_inicio < a ? t.fecha_inicio : a, filas[0]?.fecha_inicio || config.fecha_inicio_obra);
  const fechaMax = filas.reduce((a, t) => t.fecha_fin > a ? t.fecha_fin : a, addDias(fechaMin, 30));
  const totalDias = Math.max(30, diasEntre(fechaMin, fechaMax) + 7);


  // Generar cabecera de fechas
  // Cuántos píxeles mide un día según la escala elegida.
  const PX_DIA = (() => {
    if (escala === 'dia') return 28;
    if (escala === 'semana') return 10;
    if (escala === 'mes') return 4;
    // «Entra todo»: el plan completo en el ancho disponible, con un mínimo
    // para que no se vuelva una raya y un máximo para que no quede ridículo.
    return Math.max(2.2, Math.min(28, anchoUtil / Math.max(1, totalDias)));
  })();
  // Con días muy finitos no se puede dibujar una columna por día: ni se ven,
  // ni el navegador aguanta miles de divs por fila.
  const detalleDiario = PX_DIA >= 14;

  const diasHeader = [];
  for (let i = 0; i <= totalDias; i++) {
    diasHeader.push(addDias(fechaMin, i));
  }

  const hoy = new Date().toISOString().split('T')[0];

  // ── IMPRIMIR ───────────────────────────────────────────────────────────────
  // Se arma un HTML propio en vez de imprimir la pantalla: el Gantt vive dentro
  // de un contenedor con scroll horizontal y al imprimirlo salía cortado en el
  // ancho de la ventana. Acá la escala se calcula para que la obra entera entre
  // en el ancho de una hoja apaisada.
  const imprimirGantt = () => {
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const dias = diasEntre(fechaMin, fechaMax) + 1;
    // Presupuesto de ancho de una A4 apaisada a 96 dpi (277 mm útiles ≈ 1045 px)
    // menos las columnas fijas de la izquierda. Si la obra es muy larga el día
    // baja hasta 3 px: sigue entrando en la hoja, sin números pero con las barras.
    const W_NOMBRE = 200, W_DATO = 40, W_FIJO = W_NOMBRE + 4 * W_DATO;
    const anchoDia = Math.max(3, Math.min(22, Math.floor((1045 - W_FIJO) / dias)));
    const anchoTabla = W_FIJO + dias * anchoDia;
    // Con table-layout:fixed manda la PRIMERA fila, y la primera es la de los
    // meses (toda colspan). Sin colgroup las columnas se encogen solas y las
    // barras, que van en px, terminan desbordando la tabla.
    const colgroup = `<colgroup><col style="width:${W_NOMBRE}px">`
      + `<col style="width:${W_DATO}px">`.repeat(4)
      + `<col style="width:${anchoDia}px">`.repeat(dias) + `</colgroup>`

    // Cabecera: los meses arriba, los días abajo (los días solo si entran).
    const meses = [];
    let mesActual = null;
    for (let i = 0; i < dias; i++) {
      const f = addDias(fechaMin, i);
      const d = new Date(f + 'T12:00:00');
      const clave = d.getFullYear() + '-' + d.getMonth();
      if (!mesActual || mesActual.clave !== clave) {
        // Solo la inicial en mayúscula: con text-transform:capitalize salía
        // "Septiembre De 2026".
        const l = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        mesActual = { clave, n: 0, label: l.charAt(0).toUpperCase() + l.slice(1) };
        meses.push(mesActual);
      }
      mesActual.n++;
    }
    const thMeses = meses.map(m =>
      `<th colspan="${m.n}" class="mes">${esc(m.label)}</th>`).join('');
    const thDias = Array.from({ length: dias }, (_, i) => {
      const f = addDias(fechaMin, i);
      const d = new Date(f + 'T12:00:00');
      const cls = !esLaborable(f) ? ' franco' : (f === hoy ? ' hoy' : '');
      return `<th class="dia${cls}">${anchoDia >= 11 ? d.getDate() : ''}</th>`;
    }).join('');

    const filasHTML = filas.map(t => {
      const ini = diasEntre(fechaMin, t.fecha_inicio);
      const largo = Math.max(1, diasEntre(t.fecha_inicio, t.fecha_fin) + 1);
      const celdas = Array.from({ length: dias }, (_, i) => {
        const f = addDias(fechaMin, i);
        const cls = !esLaborable(f) ? ' franco' : '';
        if (i !== ini) return `<td class="c${cls}"></td>`;
        const barra = t.es_hito
          ? `<div class="hito"></div>`
          : `<div class="barra${t.critica ? ' crit' : ''}" style="width:${largo * anchoDia - 2}px">`
            + (t.progreso > 0 ? `<div class="prog" style="width:${Math.min(100, t.progreso)}%"></div>` : '')
            + `</div>`;
        return `<td class="c${cls}" style="position:relative">${barra}</td>`;
      }).join('');
      return `<tr>
        <td class="nm${t.es_resumen ? ' res' : ''}${t.padre_id ? ' hija' : ''}">${esc(t.nombre)}</td>
        <td class="d">${fmtFecha(t.fecha_inicio)}</td>
        <td class="d">${fmtFecha(t.fecha_fin)}</td>
        <td class="d">${t.dur_calc ?? t.duracion_dias}</td>
        <td class="d">${t.horas_totales > 0 ? (t.personas || 1) : '—'}</td>
        ${celdas}</tr>`;
    }).join('');

    const trabaja = ['lunes a viernes'];
    if (config.sabado) trabaja.push('sábados');
    if (config.domingo) trabaja.push('domingos');

    imprimirHTML(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gantt — ${esc(presupuesto?.nombre_obra || '')}</title>
<style>
  @page{size:A4 landscape;margin:10mm}
  /* Los navegadores tiran los fondos al imprimir para ahorrar tinta, y un Gantt
     sin el color de sus barras no es un Gantt: es una tabla de fechas. Esto se
     lo pide explicitamente, y hay que ponerlo en TODO lo que tenga fondo, no
     solo en el body — si no, la regla no baja a los hijos en Chrome. */
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;
    color-adjust:exact !important}
  body{font-family:Arial,Helvetica,sans-serif;font-size:9pt;color:#111;margin:0}
  h1{font-size:13pt;margin:0 0 2px}
  .sub{font-size:9pt;color:#555;margin-bottom:3px}
  .cal{font-size:8.5pt;color:#555;margin-bottom:10px}
  .cal b{color:#111}
  table{border-collapse:collapse;table-layout:fixed;width:${anchoTabla}px}
  /* Ojo: nada de overflow:hidden en td.c — las barras van en position:absolute
     y se recortarían al ancho de un solo día. */
  th,td{border:1px solid #d8d8d8;padding:0}
  th.mes{font-size:8pt;background:#efefef;padding:2px 4px;text-align:left;white-space:nowrap;overflow:hidden}
  th.dia{font-size:6.5pt;font-weight:400;color:#666;background:#fafafa;padding:1px 0;text-align:center}
  th.franco,td.franco{background:#ececec}
  th.hoy{background:#d1fae5;color:#065f46;font-weight:700}
  th.hd{background:#efefef;font-size:8pt;padding:3px 5px;text-align:left;white-space:nowrap}
  td.nm{font-size:8.5pt;padding:2px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  td.nm.res{font-weight:700;text-transform:uppercase}
  td.nm.hija{padding-left:18px}
  td.d{font-size:7.5pt;text-align:center;color:#555;font-family:monospace}
  td.c{height:17px}
  .barra{position:absolute;left:1px;top:3px;height:11px;border-radius:2px;background:#059669;overflow:hidden}
  .barra.crit{background:#dc2626}
  .prog{height:100%;background:rgba(0,0,0,.28)}
  .hito{position:absolute;left:2px;top:4px;width:9px;height:9px;background:#111;transform:rotate(45deg)}
  .ref{margin-top:10px;font-size:8pt;color:#555;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
  .sw{display:inline-block;width:16px;height:8px;border-radius:2px;vertical-align:middle;margin-right:4px}
  footer{margin-top:12px;border-top:1px solid #ccc;padding-top:5px;font-size:7.5pt;color:#888;display:flex;justify-content:space-between}
</style></head><body>
<h1>${esc(presupuesto?.nombre_obra || 'Obra')}</h1>
<div class="sub">Plan de trabajos${plan ? ` — ${fmtFechaLarga(plan.inicio)} al ${fmtFechaLarga(plan.fin)} · ${plan.duracion_dias} días hábiles` : ''}</div>
<div class="cal">Calendario: se trabaja <b>${trabaja.join(', ')}</b> · <b>${config.horas_dia} h</b> por día${vinculos.length ? ` · <b>${vinculos.length}</b> vínculos entre tareas` : ''}</div>
<table>
  ${colgroup}
  <thead>
    <tr><th class="hd" colspan="5">Tarea</th>${thMeses}</tr>
    <tr><th class="hd">Nombre</th><th class="hd">Inicio</th><th class="hd">Fin</th><th class="hd">Días</th><th class="hd">Pers.</th>${thDias}</tr>
  </thead>
  <tbody>${filasHTML}</tbody>
</table>
<div class="ref">
  <span><span class="sw" style="background:#059669"></span>Tarea</span>
  <span><span class="sw" style="background:#dc2626"></span>Camino crítico</span>
  <span><span class="sw" style="background:#ececec;border:1px solid #d8d8d8"></span>No se trabaja</span>
  <span><span class="sw" style="background:rgba(0,0,0,.28)"></span>Avance</span>
</div>
<footer><span>${esc(tenantNombre())}</span><span>${localidadYFecha(new Date().toLocaleDateString('es-AR'))}</span></footer>
</body></html>`, { titulo: 'Gantt' });
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100dvh', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
      {/* HEADER */}
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => navigate('/')}>{(()=>{try{const s=JSON.parse(localStorage.getItem('obras_session')||'{}');if(s?.tenant?.nombre)return s.tenant.nombre;const t=JSON.parse(localStorage.getItem('obras_tenant')||'null');if(t?.nombre)return t.nombre;}catch(e){}return 'FAIM OBRAS'})()}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/cotizador/presupuesto/${id}`)}>
            ← Volver
          </button>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{presupuesto?.nombre_obra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Diagrama de Gantt</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {tareas.length > 0 && (
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
              {[['entra', 'Entra todo'], ['mes', 'Mes'], ['semana', 'Semana'], ['dia', 'Día']].map(([v, l]) => (
                <button key={v} onClick={() => elegirEscala(v)}
                  title={v === 'entra' ? 'Que la obra entera entre en la pantalla' : `Escala por ${l.toLowerCase()}`}
                  style={{ padding: '4px 9px', fontSize: 11, border: 'none', cursor: 'pointer',
                           fontFamily: 'inherit', fontWeight: escala === v ? 700 : 400,
                           background: escala === v ? 'var(--accent)' : 'transparent',
                           color: escala === v ? '#fff' : 'var(--muted)' }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {esCelular && tareas.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setVerDiagrama(v => !v)}
              title={verDiagrama ? 'Volver a la lista' : 'Ver el diagrama de barras'}>
              {verDiagrama ? '☰ Lista' : '▤ Diagrama'}
            </button>
          )}
          <div className="header-actions-desktop" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditando({})}>+ Tarea</button>
            {faltaPlanificar.length > 0 && (
              <button className={`btn btn-sm ${faltaPlanificar.some(l => l.es_adicional) ? 'btn-warn' : 'btn-secondary'}`}
                onClick={() => setPanelFalta(true)}
                title="Ítems del presupuesto y de los adicionales que todavía no están en el plan">
                📋 Falta planificar ({faltaPlanificar.length})
              </button>
            )}
            {tareas.length > 1 && (
              <button className={`btn btn-sm ${modoVincular ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setModoVincular(m => !m); setPredSel(null); }}
                title="Vincular dos tareas: tocá primero la que va antes y después la que va después">
                🔗 {modoVincular ? (predSel ? 'Elegí la de después…' : 'Elegí la primera…') : 'Vincular'}
              </button>
            )}
            {tareas.length > 1 && (
              <button className="btn btn-secondary btn-sm" onClick={cargarHoras}
                title="Trae las horas de mano de obra desde el análisis de costos para calcular la duración por cuadrilla">⏱ Horas</button>
            )}
            {tareas.length > 1 && (
              <button className="btn btn-secondary btn-sm" onClick={encadenarTodo}
                title="Encadena todas las tareas en orden (cada una después de la anterior)">⛓ Encadenar</button>
            )}
            {vinculos.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={aplicarPlan}
                title="Recalcula y guarda las fechas según las dependencias">↻ Recalcular</button>
            )}
            <button className={`btn btn-sm ${diasPerdidos.length ? 'btn-warn' : 'btn-secondary'}`}
              onClick={() => setPanelDias(true)} title="Días de lluvia, feriados, paros">
              ☂ Días perdidos{diasPerdidos.length ? ` (${diasPerdidos.length})` : ''}
            </button>
            {vinculos.length > 0 && (
              <button className={`btn btn-sm ${verCritico ? 'btn-warn' : 'btn-secondary'}`}
                onClick={() => setVerCritico(v => !v)} title="Resaltar el camino crítico">
                ▲ Crítico
              </button>
            )}
            {tareas.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? 'Generando...' : '⚡ Generar'}
              </button>
            )}
            {tareas.length > 0 && (
              <button className="btn btn-warn btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? '...' : confirmarRegenerar ? '¿Seguro?' : '↺ Regenerar'}
              </button>
            )}
            {tareas.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={exportarAlPlanner} title="Copiar tareas del Gantt al Planner">
                Exportar al Planner
              </button>
            )}
          </div>
          <MobileMenu actions={[
            { label: 'Nueva tarea', icon: '+', onClick: () => setEditando({}) },
            ...(tareas.length > 1 ? [
              { label: 'Traer horas del análisis', icon: '⏱', onClick: cargarHoras },
              { label: 'Encadenar tareas en orden', icon: '⛓', onClick: encadenarTodo },
            ] : []),
            ...(vinculos.length > 0 ? [
              { label: 'Recalcular fechas', icon: '↻', onClick: aplicarPlan },
            ] : []),
            ...(tareas.length > 0 ? [
              { label: 'Imprimir el Gantt', icon: '🖨', onClick: imprimirGantt },
              { label: 'Exportar al Planner', icon: <Calendar size={16} strokeWidth={1.5} />, onClick: exportarAlPlanner },
            ] : []),
            tareas.length === 0
              ? { label: 'Generar desde presupuesto', icon: '⚡', onClick: generarDesdePresupuesto, disabled: generando }
              : { label: 'Regenerar Gantt', icon: '↺', onClick: generarDesdePresupuesto, disabled: generando, color: 'var(--warn)' },
          ]} />
        </div>
      </div>

      {/* Las horas hay que traerlas a mano y nadie lo sabía: sin ellas el plazo
          es fijo y sumar gente a la cuadrilla no cambia nada. Se avisa una vez,
          con el botón al lado. */}
      {tareas.length > 0 && !tareas.some(t => (t.horas_totales || 0) > 0) && (
        <div style={{ background: 'rgba(251,191,36,.10)', borderBottom: '1px solid rgba(251,191,36,.3)', padding: '8px 20px', fontSize: 12, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>⏱ Todavía no trajiste las horas de mano de obra. Sin ellas el plazo es fijo y sumar gente no lo acorta.</span>
          <button className="btn btn-secondary btn-sm" onClick={cargarHoras}>Traer horas del análisis</button>
        </div>
      )}

      {/* Aviso si la planificación no cierra (p. ej. dependencia circular) */}
      {errorPlan && (
        <div style={{ background: 'rgba(248,113,113,.12)', borderBottom: '1px solid rgba(248,113,113,.35)', padding: '8px 20px', fontSize: 12, color: '#f87171', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚠ {errorPlan}</span>
          <span style={{ color: 'var(--muted)' }}>— mientras tanto se muestran las fechas guardadas.</span>
        </div>
      )}

      {/* Resumen del plan */}
      {plan && vinculos.length > 0 && (
        <div style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)', padding: '7px 20px', display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 11, alignItems: 'center' }}>
          <span style={{ color: 'var(--muted)' }}>Inicio <b style={{ color: 'var(--text)' }}>{fmtFechaLarga(plan.inicio)}</b></span>
          <span style={{ color: 'var(--muted)' }}>Fin <b style={{ color: 'var(--text)' }}>{fmtFechaLarga(plan.fin)}</b></span>
          <span style={{ color: 'var(--muted)' }}>Duración <b style={{ color: 'var(--text)' }}>{plan.duracion_dias} días hábiles</b></span>
          <span style={{ color: '#f87171' }}>▲ {plan.criticas?.length || 0} tarea(s) en camino crítico</span>
          {/* Los vínculos se dibujaban como flechas y no había forma de sacarlos:
              borrarVinculo existía en el código pero sin nada que lo llamara. */}
          <button onClick={() => setPanelVinculos(v => !v)}
            title="Ver los vínculos y desvincular tareas"
            style={{ background: 'none', border: '1px solid var(--border2)', borderRadius: 12, color: 'var(--text)', cursor: 'pointer', fontSize: 11, padding: '2px 10px', fontFamily: 'inherit' }}>
            🔗 {vinculos.length} vínculo(s) {panelVinculos ? '▴' : '▾'}
          </button>
        </div>
      )}

      {/* Panel de vínculos: cambiar el tipo, el desfasaje o desvincular */}
      {panelVinculos && vinculos.length > 0 && (
        <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Vínculos entre tareas</span>
            <input value={filtroVinc} onChange={e => { setFiltroVinc(e.target.value); setSoloDeLaTarea(false); }}
              placeholder="Filtrar por tarea…"
              style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6,
                       color: 'var(--text)', fontSize: 11, padding: '4px 9px', fontFamily: 'inherit', width: 190 }} />
            {tareaDelVinculoSel && (
              <button onClick={() => setSoloDeLaTarea(v => !v)}
                style={{ background: soloDeLaTarea ? 'rgba(110,231,183,.14)' : 'none',
                         border: '1px solid var(--border2)', borderRadius: 12, color: 'var(--text)',
                         cursor: 'pointer', fontSize: 10.5, padding: '3px 10px', fontFamily: 'inherit' }}>
                {soloDeLaTarea ? `Solo «${tareaDelVinculoSel.nombre}» · ver todos` : 'Ver solo la tarea elegida'}
              </button>
            )}
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              También podés desvincular abriendo la tarea: te muestra de qué depende y qué la sigue.
            </span>
            <div style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={borrarTodosLosVinculos}
              style={{ fontSize: 10 }}>Desvincular todo</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
            {vinculosVisibles.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--muted)', padding: '6px 2px' }}>
                Ningún vínculo con ese nombre.
              </div>
            )}
            {vinculosVisibles.map(v => {
              const a = porId[v.predecesora_id], b = porId[v.sucesora_id];
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, background: vinculoSel === v.id ? 'rgba(110,231,183,.10)' : 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px' }}>
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {a?.nombre || '—'} <span style={{ color: 'var(--muted)' }}>→</span> {b?.nombre || '—'}
                  </span>
                  <select value={v.tipo || 'FS'} onChange={e => cambiarVinculo(v.id, { tipo: e.target.value })}
                    title="Tipo de dependencia"
                    style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 10, padding: '2px 4px', fontFamily: 'var(--mono)' }}>
                    {['FS', 'SS', 'FF', 'SF'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="number" value={v.lag ?? 0} title="Días de espera (+) o de solape (−)"
                    onChange={e => cambiarVinculo(v.id, { lag: parseInt(e.target.value) || 0 })}
                    style={{ width: 48, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontSize: 10, padding: '2px 4px', fontFamily: 'var(--mono)', textAlign: 'right' }} />
                  <button onClick={() => borrarVinculo(v.id)} title="Desvincular estas dos tareas"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '0 3px' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--danger)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--muted)'}>×</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CONFIG BAR */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Inicio obra</label>
          <input type="date" value={config.fecha_inicio_obra} onChange={e => setConfig(c => ({ ...c, fecha_inicio_obra: e.target.value }))}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12, fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Hs/día</label>
          <input type="number" value={config.horas_dia} onChange={e => setConfig(c => ({ ...c, horas_dia: e.target.value }))}
            style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', fontSize: 12, width: 60, fontFamily: 'inherit' }} />
        </div>
        {/* Fin de semana: de lunes a viernes siempre se trabaja; el sábado y el
            domingo se definen por obra. Cambia la duración de todo el plan. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Se trabaja</label>
          {[['sabado', 'Sáb'], ['domingo', 'Dom']].map(([campo, label]) => (
            <button key={campo} onClick={() => cambiarFinDeSemana(campo, !config[campo])}
              title={config[campo] ? `Se trabaja el ${campo}. Tocá para dejar de contarlo.` : `No se trabaja el ${campo}. Tocá para sumarlo al plan.`}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
                border: `1px solid ${config[campo] ? 'var(--accent)' : 'var(--border2)'}`,
                background: config[campo] ? 'rgba(110,231,183,.14)' : 'var(--surface2)',
                color: config[campo] ? 'var(--accent)' : 'var(--muted)', fontSize: 11, fontFamily: 'inherit' }}>
              {config[campo] ? '✓' : '—'} {label}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => guardarConfig(config)}>Guardar config</button>
        {tareas.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={imprimirGantt} title="Imprimir el diagrama con su calendario">🖨 Imprimir</button>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {tareas.length} tareas · {fmtFechaLarga(fechaMin)} → {fmtFechaLarga(fechaMax)}
        </div>
      </div>

      {/* GANTT */}
      {tareas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <BarChart2 size={40} strokeWidth={1} style={{ marginBottom: 16, color: 'var(--muted)' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Sin tareas en el Gantt</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Generá automáticamente desde el presupuesto o agregá tareas manualmente</div>
          <button className="btn btn-primary" onClick={generarDesdePresupuesto} disabled={generando}>
            {generando ? 'Generando...' : '⚡ Generar desde presupuesto'}
          </button>
        </div>
      ) : esCelular && !verDiagrama ? (
        /* ── EN EL CELULAR: LA OBRA COMO LISTA ──────────────────────────────
           Un diagrama de barras en una pantalla de 6 pulgadas no se puede
           usar: no entra, no se lee y no se toca. En obra lo que hace falta es
           ver qué tarea viene, cuánto lleva, y poder cargar el gasto en el
           momento, parado en la obra. El diagrama queda a un toque. */
        <div style={{ padding: '10px 12px 90px' }}>
          {filas.map(t => {
            const avLinea = t.linea_id && avancePorLinea[t.linea_id];
            const pct = Math.min(100, Math.max(0, avLinea != null ? avLinea : (t.progreso || 0)));
            const e = estadoLineas[t.linea_id];
            const arrancada = t.fecha_inicio <= hoy;
            const terminada = t.fecha_fin < hoy;
            const enCurso = arrancada && !terminada;
            return (
              <div key={t.id}
                style={{ background: enCurso ? 'rgba(16,185,129,.06)' : 'var(--surface)',
                         border: `1px solid ${enCurso ? 'var(--accent)' : t.critica && verCritico ? '#f8717188' : 'var(--border)'}`,
                         borderLeft: `4px solid ${t.color}`, borderRadius: 12, padding: '12px 14px', marginBottom: 10 }}>
                <div onClick={() => {
                    if (t.linea_id) {
                      setCargarAvanceEn(t);
                      setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                    } else setEditando(t);
                  }}>
                  <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.3 }}>
                    {t.nombre}
                    {t.es_adicional && (
                      <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                                     background: 'rgba(251,146,60,.18)', color: '#c2410c',
                                     border: '1px solid rgba(251,146,60,.5)', verticalAlign: 'middle' }}>AD</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>{fmtFecha(t.fecha_inicio)} → {fmtFecha(t.fecha_fin)}</span>
                    <span>{t.dur_calc ?? t.duracion_dias} días</span>
                    {t.tramos?.length > 1 && <span>✂ {t.tramos.length} partes</span>}
                    {t.suspendida && <span style={{ color: '#d97706', fontWeight: 700 }}>suspendida</span>}
                    {t.critica && verCritico && <span style={{ color: '#f87171', fontWeight: 700 }}>crítica</span>}
                  </div>
                  {/* Barra de avance: es lo único del diagrama que sí sirve acá */}
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--surface2)', marginTop: 9, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: t.color, transition: 'width .3s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11 }}>
                    <span style={{ color: terminada && pct < 100 ? '#d97706' : enCurso ? 'var(--accent)' : 'var(--muted)',
                                   fontWeight: enCurso ? 700 : 400 }}>
                      {terminada && pct < 100 ? 'debería estar terminada'
                        : enCurso ? 'HOY se trabaja acá'
                        : arrancada ? 'en curso' : 'no arrancó'}
                    </span>
                    <span style={{ fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(pct)}%</span>
                  </div>
                  {e?.subcontrato && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                      {e.subcontrato.contratista}
                      {e.subcontrato.pendiente > 0 && (
                        <b style={{ color: '#d97706' }}> · le debés {fmt(e.subcontrato.pendiente)}</b>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <button onClick={() => { setGastoEn(t); setGastoForm({ monto: '', proveedor: '', nota: '' }); }}
                    style={{ flex: 1, padding: '11px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                             fontSize: 13.5, fontWeight: 700, background: 'var(--accent)', border: 'none', color: '#fff' }}>
                    Cargar gasto
                  </button>
                  {t.linea_id && (
                    <button onClick={() => {
                        setCargarAvanceEn(t);
                        setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                      }}
                      style={{ flex: 1, padding: '11px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                               fontSize: 13.5, fontWeight: 700, background: 'transparent',
                               border: '1px solid var(--border)', color: 'var(--text)' }}>
                      Avance
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', overflow: 'hidden' }}>
          {/* Labels */}
          <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tarea
            </div>
            {filas.map(t => (
              <div key={t.id} style={{ height: ROW_H, borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, cursor: 'pointer' }}
                onClick={() => {
                  if (t.linea_id) {
                    setCargarAvanceEn(t);
                    setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                  } else setEditando(t);
                }}>
                {/* Indentar / desindentar: arma la jerarquía sin salir de la pantalla */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0, marginRight: 1 }}>
                    <button
                      title={t.padre_id ? 'Sacar de la tarea resumen' : 'Colgar de la tarea de arriba'}
                      disabled={!t.padre_id && !padreCandidato(t, filas)}
                      onClick={e => { e.stopPropagation();
                        cambiarPadre(t, t.padre_id ? null : padreCandidato(t, filas)?.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 11, lineHeight: 1, color: 'var(--muted)',
                        opacity: (!t.padre_id && !padreCandidato(t, filas)) ? 0.25 : 1 }}>
                      {t.padre_id ? '⇤' : '⇥'}
                  </button>
                </div>
                {t.padre_id && <span style={{ width: 14, flexShrink: 0 }} />}
                {/* Acceso visible al panel de la tarea. Antes solo se abria con
                    boton derecho sobre la barra, que no lo encuentra nadie. */}
                {t.linea_id ? (
                  <button title="Avance, quién la ejecuta, dividir o suspender"
                    onClick={e => { e.stopPropagation();
                      setCargarAvanceEn(t);
                      setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0))); }}
                    style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, cursor: 'pointer',
                             border: '1px solid var(--border)', background: 'var(--surface2)',
                             color: 'var(--muted)', fontSize: 11, lineHeight: 1, padding: 0,
                             display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
                ) : <span style={{ width: 18, flexShrink: 0 }} />}
                <div style={{ width: 10, height: 10, borderRadius: t.es_resumen ? 0 : 2, background: t.critica && verCritico ? '#f87171' : t.color, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }} onClick={() => {
                    if (modoVincular) return clickVincular(t);
                    if (t.linea_id) {
                      setCargarAvanceEn(t);
                      setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                      return;
                    }
                    setEditando(t);
                  }}>
                  <div style={{ fontSize: 12, fontWeight: t.es_resumen ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: t.es_resumen ? 'uppercase' : 'none', letterSpacing: t.es_resumen ? 0.4 : 0 }}>
                    {t.nombre}
                    {/* Arrastrar la barra fija la tarea. El chinche la suelta
                        y la devuelve al mando de sus dependencias. */}
                    {t.tramos?.length > 1 && (
                      <span title={`Se hace en ${t.tramos.length} partes`}
                        style={{ marginLeft: 5, fontSize: 9.5, color: 'var(--muted)' }}>
                        ✂ {t.tramos.length} partes
                      </span>
                    )}
                    {t.es_adicional && (
                      <span title="Adicional — no estaba en el contrato original"
                        style={{ marginLeft: 5, fontSize: 8.5, fontWeight: 800, letterSpacing: .5,
                                 padding: '1px 4px', borderRadius: 4, verticalAlign: 'middle',
                                 background: 'rgba(251,146,60,.18)', color: '#c2410c',
                                 border: '1px solid rgba(251,146,60,.5)' }}>AD</span>
                    )}
                    {t.no_antes_de && (
                      <span role="button" tabIndex={0}
                        title={`Fijada al ${fmtFecha(t.no_antes_de)} — tocá para soltarla y que vuelva a seguir sus dependencias`}
                        onClick={e => { e.stopPropagation(); soltarTarea(t.id); }}
                        onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); soltarTarea(t.id); } }}
                        style={{ marginLeft: 4, fontSize: 9, cursor: 'pointer' }}>📌</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.horas_totales > 0
                      ? `${Math.round(t.horas_totales)} h${t.holgura ? ` · holgura ${t.holgura}d` : ''}`
                      : (t.holgura ? `holgura ${t.holgura}d` : '')}
                  </div>
                </div>
                {/* Cuadrilla: cuántas personas trabajan.
                    Antes solo aparecía si la tarea tenía horas cargadas, y como
                    las horas hay que traerlas a mano con "⏱ Horas", en la
                    práctica no lo veía nadie. Ahora se muestra siempre: con
                    horas, mover la cuadrilla recalcula la duración; sin horas,
                    el número igual queda guardado. */}
                {!t.es_resumen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: t.horas_totales > 0 ? 1 : 0.55 }}
                    title={t.horas_totales > 0
                      ? `${t.personas || 1} persona(s) · ${Math.round(t.horas_totales)} h — cambiar la cuadrilla recalcula la duración`
                      : 'Personas en esta tarea. Para que el plazo se recalcule solo, traé las horas con “⏱ Horas”.'}>
                    <button onClick={e => { e.stopPropagation(); cambiarCuadrilla(t.id, Math.max(1, (t.personas || 1) - 1), t.horas_totales); }}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 3, width: 16, height: 16, fontSize: 11, cursor: 'pointer', lineHeight: 1, padding: 0 }}>−</button>
                    <span style={{ fontSize: 10, fontFamily: 'var(--mono)', minWidth: 14, textAlign: 'center' }}>👷{t.personas || 1}</span>
                    <button onClick={e => { e.stopPropagation(); cambiarCuadrilla(t.id, (t.personas || 1) + 1, t.horas_totales); }}
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--muted)', borderRadius: 3, width: 16, height: 16, fontSize: 11, cursor: 'pointer', lineHeight: 1, padding: 0 }}>+</button>
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0, minWidth: 22, textAlign: 'right' }}>{t.dur_calc ?? t.duracion_dias}d</div>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div style={{ flex: 1, minWidth: 0 }}>
          {plata && plata.eventos.length > 0 && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '6px 10px',
                          fontSize: 10.5, borderBottom: '1px solid var(--border)',
                          background: 'var(--surface2)', color: 'var(--muted)' }}>
              <span>Las marcas verticales son plata, en su fecha:</span>
              <span style={{ color: '#10b981' }}>▎cobrado {fmt(plata.totales.cobrado)}</span>
              <span style={{ color: '#10b981', opacity: .75 }}>┊ por cobrar {fmt(plata.totales.por_cobrar)}</span>
              <span style={{ color: '#f87171' }}>▎pagado {fmt(plata.totales.pagado)}</span>
              <span style={{ color: '#f87171', opacity: .75 }}>┊ por pagar {fmt(plata.totales.por_pagar)}</span>
            </div>
          )}
          <div ref={scrollRef} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ width: totalDias * PX_DIA, position: 'relative' }}>
              {/* Header fechas */}
              <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'flex-end', position: 'sticky', top: 0, zIndex: 10 }}>
                {/* Con la escala achicada no entra un cartelito por día: se
                    muestran los meses, que es lo que sirve para ubicarse. */}
                {!detalleDiario && (() => {
                  const meses = [];
                  diasHeader.forEach((dia, i) => {
                    const d = new Date(dia + 'T12:00:00');
                    const clave = d.getFullYear() + '-' + d.getMonth();
                    const ult = meses[meses.length - 1];
                    if (!ult || ult.clave !== clave) meses.push({ clave, desde: i, dias: 1, d });
                    else ult.dias++;
                  });
                  return (
                    <div style={{ position: 'absolute', left: 0, top: 0, height: 50, display: 'flex' }}>
                      {meses.map(m => (
                        <div key={m.clave} style={{ width: m.dias * PX_DIA, flexShrink: 0, height: '100%',
                                                    borderLeft: '1px solid var(--border)', overflow: 'hidden',
                                                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                                                    padding: '0 4px 6px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {m.dias * PX_DIA > 42
                              ? m.d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
                              : m.d.toLocaleDateString('es-AR', { month: 'narrow' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                {detalleDiario && diasHeader.map((dia) => {
                  const d = new Date(dia + 'T12:00:00');
                  const esLunes = d.getDay() === 1;
                  const franco = !esLaborable(dia);
                  const esHoyDia = dia === hoy;
                  return (
                    <div key={dia} ref={esHoyDia ? colHoyRef : null}
                      style={{ width: PX_DIA, flexShrink: 0, height: '100%', position: 'relative',
                        borderLeft: esHoyDia ? '2px solid var(--accent)' : esLunes ? '1px solid #3a3a48' : '1px solid #2e2e3822',
                        background: esHoyDia ? 'rgba(16,185,129,.20)' : franco ? 'rgba(74,74,88,.3)' : 'transparent',
                        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 2px 4px' }}>
                      {/* Sin este cartel hay que contar columnas para saber dónde
                          está uno parado. */}
                      {esHoyDia && (
                        <div style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
                                      background: 'var(--accent)', color: '#fff', fontSize: 8.5, fontWeight: 800,
                                      letterSpacing: .6, padding: '1px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>
                          HOY
                        </div>
                      )}
                      {esLunes && !esHoyDia && <div style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</div>}
                      <div style={{ fontSize: 9, fontWeight: esHoyDia ? 800 : 400,
                                    color: esHoyDia ? 'var(--accent)' : franco ? '#4a4a58' : 'var(--muted2, #4a4a58)' }}>
                        {DIA_LETRA[d.getDay()]}{d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>



              {/* ── LA PLATA, ubicada en su fecha sobre la planificacion ──
                  No va en una banda aparte: son marcas verticales que cruzan las
                  barras, para ver contra que tarea cae cada cobro y cada pago. */}
              {plata && plata.eventos.length > 0 && (() => {
                const porDia = {};
                plata.eventos.forEach(e => { (porDia[e.fecha] = porDia[e.fecha] || []).push(e); });
                return (
                  <div style={{ position: 'absolute', top: 50, bottom: 0, left: 0, right: 0,
                                pointerEvents: 'none', zIndex: 4 }}>
                    {Object.entries(porDia).map(([fecha, evs]) => {
                      const off = diasEntre(fechaMin, fecha);
                      if (off < 0 || off >= totalDias) return null;
                      const entra = evs.filter(e => e.tipo === 'cobro').reduce((a, e) => a + e.monto, 0);
                      const sale  = evs.filter(e => e.tipo === 'pago').reduce((a, e) => a + e.monto, 0);
                      const soloPrevisto = evs.every(e => e.estado === 'previsto');
                      const color = entra >= sale ? '#10b981' : '#f87171';
                      const detalle = evs.map(e =>
                        `${e.tipo === 'cobro' ? '+' : '−'} $${Math.round(e.monto).toLocaleString('es-AR')}  ${e.concepto}` +
                        (e.estado === 'previsto' ? '  (previsto)' : '')).join('\n');
                      const neto = entra - sale;
                      return (
                        <div key={fecha} title={`${fecha}\n${detalle}`}
                          style={{ position: 'absolute', left: off * PX_DIA + PX_DIA / 2 - 1, top: 0, bottom: 0,
                                   width: 2, background: soloPrevisto
                                     ? `repeating-linear-gradient(180deg, ${color} 0 5px, transparent 5px 10px)`
                                     : color,
                                   opacity: soloPrevisto ? .65 : .85, pointerEvents: 'auto', cursor: 'help' }}>
                          <div style={{ position: 'absolute', top: 2, left: 4, whiteSpace: 'nowrap',
                                        fontSize: 9.5, fontWeight: 700, color,
                                        fontFamily: "'IBM Plex Mono',monospace",
                                        background: 'var(--surface)', padding: '1px 5px', borderRadius: 4,
                                        border: `1px solid ${color}`, opacity: soloPrevisto ? .8 : 1 }}>
                            {neto >= 0 ? '+' : '−'}{Math.abs(Math.round(neto)).toLocaleString('es-AR')}
                            {soloPrevisto ? '?' : ''}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Filas */}
              {filas.map(t => {
                const offsetDias = diasEntre(fechaMin, t.fecha_inicio || fechaMin);
                // La grilla son días corridos y la duración está en días hábiles:
                // la barra tiene que ir de inicio a fin del plan, no inicio + duración,
                // o queda corrida respecto de la fecha de fin real.
                const anchoDias = Math.max(1, diasEntre(t.fecha_inicio, t.fecha_fin) + 1);
                const left = offsetDias * PX_DIA;
                const width = anchoDias * PX_DIA - 2;
                // Si la linea tiene avance registrado, ese manda. El progreso
                // cargado a mano queda como respaldo para las tareas que no
                // corresponden a ningun item del presupuesto.
                const avLinea = t.linea_id && avancePorLinea[t.linea_id];
                const pct = Math.min(100, Math.max(0, avLinea != null ? avLinea : (t.progreso || 0)));
                return (
                  <div key={t.id} style={{ height: ROW_H, borderBottom: '1px solid var(--border2)', position: 'relative', display: 'flex', alignItems: 'center' }}>
                    {/* Columnas de fondo. Con la escala achicada se pinta el
                        fondo de una sola vez: mil divs por fila no se ven y
                        dejan el navegador de rodillas. */}
                    {!detalleDiario && (
                      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
                                    background: `repeating-linear-gradient(90deg,
                                      transparent 0 ${PX_DIA * 7}px,
                                      rgba(74,74,88,.13) ${PX_DIA * 7}px ${PX_DIA * 7 + Math.max(1, PX_DIA * 2)}px)` }} />
                    )}
                    {detalleDiario && diasHeader.map(dia => {
                      const d = new Date(dia + 'T12:00:00');
                      // Se sombrea lo que NO se trabaja según la configuración,
                      // no el fin de semana fijo: si la obra trabaja los sábados,
                      // el sábado tiene que verse como día de trabajo.
                      const franco = !esLaborable(dia);
                      const esHoyDia = dia === hoy;
                      // Un dia perdido se ve distinto de un domingo: el domingo
                      // no se trabaja nunca, el perdido si se iba a trabajar.
                      const perdido = perdidoPorFecha[dia];
                      return <div key={dia} title={perdido ? `${perdido.motivo}${perdido.nota ? ' · ' + perdido.nota : ''}` : undefined}
                        style={{ width: PX_DIA, height: '100%', flexShrink: 0,
                          background: perdido ? 'rgba(217,119,6,.22)' : esHoyDia ? 'rgba(110,231,183,.04)' : franco ? 'rgba(74,74,88,.15)' : 'transparent',
                          borderLeft: d.getDay() === 1 ? '1px solid #3a3a4844' : '1px solid transparent' }} />;
                    })}
                    {/* Barra de tarea */}
                    {t.es_hito ? (
                      // Hito: rombo, no ocupa tiempo
                      <div title={`${t.nombre} — hito ${fmtFechaLarga(t.fecha_inicio)}`}
                        onClick={() => modoVincular ? clickVincular(t) : setEditando(t)}
                        style={{ position: 'absolute', left: left + PX_DIA / 2 - 8, top: ROW_H / 2 - 8, width: 16, height: 16,
                          background: t.critica && verCritico ? '#f87171' : t.color, transform: 'rotate(45deg)',
                          cursor: 'pointer', zIndex: 4, border: predSel?.id === t.id ? '2px solid #fff' : 'none' }} />
                    ) : (() => {
                    // Una tarea que se hace por partes sigue siendo una sola
                    // fila: se dibuja un pedazo de barra por tramo, con el hueco
                    // de los días en que no se trabajó y una línea punteada que
                    // los une para que se lea como la misma tarea.
                    const tramos = Array.isArray(t.tramos) && t.tramos.length > 1 ? t.tramos : null;
                    // Si una dependencia corrió la tarea, el plan manda: los
                    // tramos se mueven todos juntos, manteniendo los huecos.
                    // Si no, la barra queda dibujada en un lado y la flecha
                    // apuntando a otro.
                    const desfase = tramos ? diasEntre(tramos[0].inicio, t.fecha_inicio) : 0;
                    const segs = tramos
                      ? tramos.map(tr => ({
                          left: (diasEntre(fechaMin, tr.inicio) + desfase) * PX_DIA,
                          width: diasCalendarioDeTramo(tr) * PX_DIA - 2,
                          hecho: !!tr.hecho,
                        }))
                      : [{ left, width }];
                    const iAncho = segs.reduce((m, s, i2) => s.width > segs[m].width ? i2 : m, 0);
                    return <>
                    {tramos && (
                      <div style={{ position: 'absolute', left: segs[0].left + segs[0].width,
                                    width: segs[segs.length - 1].left - (segs[0].left + segs[0].width),
                                    top: ROW_H / 2 - 1, height: 2, zIndex: 3, pointerEvents: 'none',
                                    background: `repeating-linear-gradient(90deg, ${t.color}88 0 4px, transparent 4px 8px)` }} />
                    )}
                    {segs.map((s, si) => (
                    <div key={si} title={`${t.nombre}\n${fmtFechaLarga(t.fecha_inicio)} → ${fmtFechaLarga(t.fecha_fin)}${tramos ? `\n✂ Se hace en ${tramos.length} partes` : ''}${t.holgura != null ? `\nHolgura: ${t.holgura} día(s)` : ''}${t.critica ? '\n⚠ Camino crítico' : ''}${t.no_antes_de ? `\n📌 Fijada al ${fmtFecha(t.no_antes_de)}` : ''}`}
                      style={{ position: 'absolute', left: s.left, top: 6, width: s.width, height: ROW_H - 12, borderRadius: 6,
                        background: (t.critica && verCritico ? '#f87171' : t.color) + (tramos && !s.hecho ? '1a' : '33'),
                        border: predSel?.id === t.id ? '2px solid #fff'
                              : `${t.es_adicional ? '1px dashed' : '1px solid'} ${(t.critica && verCritico ? '#f87171' : t.color)}${t.critica && verCritico ? 'cc' : (t.es_adicional ? 'cc' : '66')}`,
                        cursor: 'pointer', overflow: 'hidden', zIndex: 4,
                        boxShadow: modoVincular ? '0 0 0 1px rgba(255,255,255,.15)' : 'none' }}
                      onMouseDown={e => { if (!tramos) iniciarArrastre(e, t); }}
                      onContextMenu={e => {
                        // Boton derecho sobre la barra: cargar avance sin salir
                        // del Gantt, que es donde se mira como viene la obra.
                        if (!t.linea_id) return;
                        e.preventDefault();
                        setCargarAvanceEn(t);
                        setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                      }}
                      onClick={e => {
                        if (modoVincular) return clickVincular(t);
                        // Alt+click hace lo mismo que el boton derecho, para
                        // el que usa trackpad.
                        // El click izquierdo abre el panel completo de la
                        // tarea. Antes abria solo el formulario de editar, y
                        // todo lo demas —avance, contratista, dividir,
                        // suspender— quedaba escondido en el boton derecho.
                        if (t.linea_id) {
                          setCargarAvanceEn(t);
                          setPctNuevo(String(Math.round(avancePorLinea[t.linea_id] ?? t.progreso ?? 0)));
                          return;
                        }
                        setEditando(t);
                      }}>
                      {/* Progreso */}
                      <div style={{ width: `${pct}%`, height: '100%', background: t.color + '55', transition: 'width .3s' }} />
                      {/* Label */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 8px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: t.color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {si === iAncho && s.width > 60 ? t.nombre : ''}
                          {si === iAncho && pct > 0 && s.width > 80 ? ` (${pct}%)` : ''}
                        </span>
                      </div>
                    </div>
                    ))}
                    </>;
                    })()}
                  </div>
                );
              })}

              {/* Flechas de dependencia — se dibujan encima de las barras */}
              <svg style={{ position: 'absolute', left: 0, top: 50, width: totalDias * PX_DIA, height: filas.length * ROW_H, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
                <defs>
                  <marker id="flecha" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill="var(--muted)" />
                  </marker>
                  <marker id="flechaCrit" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                    <polygon points="0 0, 7 3.5, 0 7" fill="#f87171" />
                  </marker>
                </defs>
                {vinculos.map(v => {
                  const a = porId[v.predecesora_id], b = porId[v.sucesora_id];
                  if (!a || !b) return null;
                  const critico = verCritico && a.critica && b.critica;
                  const col = critico ? '#f87171' : 'var(--muted)';
                  // Punto de salida y de llegada según el tipo de vínculo
                  const finA = (diasEntre(fechaMin, a.fecha_fin) + 1) * PX_DIA;
                  const iniA = diasEntre(fechaMin, a.fecha_inicio) * PX_DIA;
                  const finB = (diasEntre(fechaMin, b.fecha_fin) + 1) * PX_DIA;
                  const iniB = diasEntre(fechaMin, b.fecha_inicio) * PX_DIA;
                  const x1 = (v.tipo === 'SS' || v.tipo === 'SF') ? iniA : finA;
                  const x2 = (v.tipo === 'FF' || v.tipo === 'SF') ? finB : iniB;
                  const y1 = a.fila * ROW_H + ROW_H / 2;
                  const y2 = b.fila * ROW_H + ROW_H / 2;
                  // Ruta en L: sale, baja y entra. El codo se separa un poco para
                  // que dos flechas a la misma tarea no se pisen.
                  const sale = x1 + 10;
                  const entra = x2 - 10;
                  const codo = Math.max(sale, entra);
                  const d = `M ${x1} ${y1} H ${codo} V ${y2} H ${x2}`;
                  const sel = vinculoSel === v.id;
                  return (
                    <g key={v.id}>
                      {/* Franja invisible y ancha para poder acertarle a la flecha:
                          el trazo real es de 1,4 px y es imposible de tocar. */}
                      <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                        onClick={() => { setVinculoSel(v.id); setPanelVinculos(true); setSoloDeLaTarea(true); setFiltroVinc(''); }}>
                        <title>{`${a.nombre} → ${b.nombre} — tocá para ver o desvincular`}</title>
                      </path>
                      <path d={d} fill="none" stroke={sel ? '#6ee7b7' : col} strokeWidth={sel ? 2.6 : (critico ? 2 : 1.4)}
                        strokeDasharray={v.tipo === 'FS' ? '' : '4 3'}
                        markerEnd={`url(#${critico ? 'flechaCrit' : 'flecha'})`}
                        opacity={sel ? 1 : (critico ? 0.95 : 0.55)}
                        style={{ pointerEvents: 'none' }} />
                      {v.tipo !== 'FS' && (
                        <text x={codo + 3} y={(y1 + y2) / 2} fontSize="9" fill={col} opacity="0.9">{v.tipo}</text>
                      )}
                      {v.lag !== 0 && (
                        <text x={codo + 3} y={(y1 + y2) / 2 + 10} fontSize="9" fill={col} opacity="0.9">
                          {v.lag > 0 ? `+${v.lag}d` : `${v.lag}d`}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Línea de hoy */}
              {hoy >= fechaMin && hoy <= fechaMax && (
                <>
                  {!detalleDiario && (
                    <div style={{ position: 'absolute', left: diasEntre(fechaMin, hoy) * PX_DIA, top: 2,
                                  transform: 'translateX(-50%)', zIndex: 12, background: 'var(--accent)',
                                  color: '#fff', fontSize: 8.5, fontWeight: 800, letterSpacing: .6,
                                  padding: '1px 5px', borderRadius: 4, pointerEvents: 'none' }}>HOY</div>
                  )}
                  {/* La columna de hoy, pintada de arriba abajo. */}
                  <div style={{ position: 'absolute', left: diasEntre(fechaMin, hoy) * PX_DIA, top: 50, bottom: 0,
                                width: PX_DIA, background: 'rgba(16,185,129,.10)', pointerEvents: 'none', zIndex: 1 }} />
                  <div style={{ position: 'absolute', left: diasEntre(fechaMin, hoy) * PX_DIA + PX_DIA / 2 - 1, top: 0, bottom: 0,
                                width: 2, background: 'var(--accent)', opacity: .85, pointerEvents: 'none', zIndex: 7 }} />
                </>
              )}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREA */}
      {/* Cargar avance desde el Gantt */}
      {cargarAvanceEn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setCargarAvanceEn(null); setFormPartir(null); setFormSuspender(null); setAvisoTarea(''); }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 22, width: 'min(430px,100%)',
                        maxHeight: '88vh', overflowY: 'auto',
                        border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              {cargarAvanceEn.nombre}
              {cargarAvanceEn.es_adicional && (
                <span style={{ marginLeft: 7, fontSize: 9, fontWeight: 800, letterSpacing: .5,
                               padding: '2px 5px', borderRadius: 4, verticalAlign: 'middle',
                               background: 'rgba(251,146,60,.18)', color: '#c2410c',
                               border: '1px solid rgba(251,146,60,.5)' }}>ADICIONAL</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {fmtFechaLarga(cargarAvanceEn.fecha_inicio)} → {fmtFechaLarga(cargarAvanceEn.fecha_fin)}
              {cargarAvanceEn.horas_totales ? ` · ${cargarAvanceEn.horas_totales} h` : ''}
              {cargarAvanceEn.personas ? ` · ${cargarAvanceEn.personas} personas` : ''}
            </div>

            {cargarAvanceEn.suspendida && (
              <div style={{ marginTop: 12, padding: '10px 13px', borderRadius: 9, fontSize: 12.5,
                            background: 'rgba(217,119,6,.12)', border: '1px solid rgba(217,119,6,.4)', color: '#b45309' }}>
                <b>Suspendida</b> desde el {fmtFechaLarga(cargarAvanceEn.suspendida_desde)}
                {cargarAvanceEn.motivo_suspension ? ` · ${cargarAvanceEn.motivo_suspension}` : ''}
              </div>
            )}

            {(() => {
              const e = estadoLineas[cargarAvanceEn.linea_id];
              if (!e) return null;
              const sc = e.subcontrato;
              return (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10,
                              background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12.5 }}>
                  {sc ? (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 5 }}>Lo ejecuta {sc.contratista}</div>
                      <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
                        Contrato ${Math.round(sc.monto).toLocaleString('es-AR')} ·
                        pagado ${Math.round(sc.pagado).toLocaleString('es-AR')}
                        {sc.pendiente > 0 && <> · <b style={{ color: '#d97706' }}>le debés ${Math.round(sc.pendiente).toLocaleString('es-AR')}</b></>}
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--muted)' }}>Sin contratista asignado — lo hace el estudio.</div>
                  )}
                  {e.certificado > 0 && (
                    <div style={{ color: 'var(--muted)', marginTop: 5 }}>
                      Certificado al cliente: ${Math.round(e.certificado).toLocaleString('es-AR')}
                    </div>
                  )}
                </div>
              );
            })()}

            <button onClick={() => { const t = cargarAvanceEn; setCargarAvanceEn(null); setEditando(t); }}
              style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                       fontFamily: 'inherit', fontSize: 13, fontWeight: 600, background: 'transparent',
                       border: '1px solid var(--border)', color: 'var(--muted)' }}>
              Editar nombre, fechas y color
            </button>

            {(() => {
              const antes = vinculos.filter(v => v.sucesora_id === cargarAvanceEn.id);
              const despues = vinculos.filter(v => v.predecesora_id === cargarAvanceEn.id);
              if (!antes.length && !despues.length) return null;
              const nom = i => (tareas.find(t => t.id === i) || {}).nombre || 'otra tarea';
              const fila = (v, txt) => (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <span style={{ flex: 1, minWidth: 0, color: 'var(--muted)', overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{txt}</span>
                  <button onClick={() => borrarVinculo(v.id)} title="Desvincular"
                    style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                             fontFamily: 'inherit', fontSize: 11.5, background: 'transparent',
                             border: '1px solid rgba(239,68,68,.45)', color: '#ef4444' }}>
                    Desvincular
                  </button>
                </div>
              );
              return (
                <div style={{ marginTop: 12, padding: '11px 13px', borderRadius: 10, fontSize: 12.5,
                              background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 2 }}>Depende de / la siguen</div>
                  {antes.map(v => fila(v, `Va después de «${nom(v.predecesora_id)}»`))}
                  {despues.map(v => fila(v, `Antes de «${nom(v.sucesora_id)}»`))}
                </div>
              );
            })()}

            {avisoTarea && (
              <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, fontSize: 12.5,
                            background: 'rgba(5,150,105,.1)', border: '1px solid rgba(5,150,105,.35)', color: 'var(--accent)' }}>
                {avisoTarea}
              </div>
            )}

            {/* Partir la tarea — el formulario va acá adentro, no en un cuadro
                del navegador: hay que poder elegir una fecha en un calendario. */}
            {!cargarAvanceEn.suspendida && !formSuspender && (
              formPartir ? (
                <div style={{ marginTop: 10, padding: '13px 14px', borderRadius: 10,
                              background: 'var(--surface2)', border: '1px solid var(--accent)' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>
                    {cargarAvanceEn.tramos?.length > 1 ? 'Partir otra vez lo que queda' : 'Hacer una parte ahora y el resto después'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 11, lineHeight: 1.5 }}>
                    {cargarAvanceEn.tramos?.length > 1
                      ? `Se parte la última parte, la de ${cargarAvanceEn.tramos[cargarAvanceEn.tramos.length - 1].dias} día${cargarAvanceEn.tramos[cargarAvanceEn.tramos.length - 1].dias !== 1 ? 's' : ''}. Las anteriores no se tocan.`
                      : 'Sigue siendo la misma tarea: la barra queda cortada, con el hueco de los días en que se para.'}
                  </div>
                  <div style={{ display: 'flex', gap: 9 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        {cargarAvanceEn.tramos?.length > 1 ? 'De eso se hace' : 'Se hace ahora'}
                      </div>
                      <div style={{ position: 'relative' }}>
                        <input type="number" min="1" max="99" value={formPartir.pct} autoFocus
                          onChange={e => setFormPartir(f => ({
                            ...f, pct: e.target.value,
                            fecha: f.tocada ? f.fecha : fechaQueSigue(cargarAvanceEn, e.target.value),
                          }))}
                          style={{ width: '100%', padding: '8px 26px 8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                                   background: 'var(--surface)', color: 'var(--text)', fontFamily: "'IBM Plex Mono',monospace",
                                   fontSize: 14, textAlign: 'right' }} />
                        <span style={{ position: 'absolute', right: 9, top: 9, fontSize: 12, color: 'var(--muted)' }}>%</span>
                      </div>
                    </div>
                    <div style={{ flex: 1.3 }}>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                        Se retoma el{!formPartir.tocada && <span style={{ opacity: .7 }}> · seguido</span>}
                      </div>
                      <input type="date" value={formPartir.fecha} min={cargarAvanceEn.fecha_inicio}
                        onChange={e => setFormPartir({ ...formPartir, fecha: e.target.value, tocada: true })}
                        style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                                 background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => setFormPartir(null)}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                               fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                      Cancelar
                    </button>
                    <button onClick={() => partirTarea(cargarAvanceEn, formPartir.pct, formPartir.fecha)}
                      style={{ flex: 1.4, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                               fontSize: 13, fontWeight: 700, background: 'var(--accent)', border: 'none', color: '#fff' }}>
                      Partir la tarea
                    </button>
                  </div>
                </div>
              ) : cargarAvanceEn.tramos?.length > 1 ? (<>
                <div style={{ marginTop: 10, padding: '11px 13px', borderRadius: 10, fontSize: 12.5,
                              background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, marginBottom: 3 }}>Se hace en {cargarAvanceEn.tramos.length} partes</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                    Las partes con ✓ ya se hicieron y quedan como fueron. Si sumás gente
                    a la tarea, se acorta lo que falta, no lo que ya pasó.
                  </div>
                  {cargarAvanceEn.tramos.map((tr, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ color: 'var(--muted)', flexShrink: 0 }}>
                        {tr.hecho ? '✓' : '○'} {i + 1}ª · {tr.dias} día{tr.dias !== 1 ? 's' : ''}
                      </span>
                      {i === 0 ? (
                        <span style={{ color: 'var(--muted)' }}>desde el {fmtFechaLarga(tr.inicio)}</span>
                      ) : (
                        // La fecha de retomar se edita acá nomás: es la que da
                        // el juego para reacomodar el plan.
                        <input type="date" defaultValue={tr.inicio} key={tr.inicio}
                          onChange={e => moverTramo(cargarAvanceEn, i, e.target.value)}
                          title="Cambiar la fecha en que se retoma"
                          style={{ flex: 1, padding: '6px 9px', border: '1px solid var(--accent)', borderRadius: 7,
                                   background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5 }} />
                      )}
                    </div>
                  ))}
                  <button onClick={() => unirTarea(cargarAvanceEn)}
                    style={{ marginTop: 9, width: '100%', padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                             fontFamily: 'inherit', fontSize: 12.5, background: 'transparent',
                             border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    Volver a hacerla de corrido
                  </button>
                </div>
                {/* Una obra se puede frenar una vez o cinco: no hay tope de
                    partes. Lo que se parte siempre es lo que queda. */}
                {cargarAvanceEn.tramos[cargarAvanceEn.tramos.length - 1].dias > 1 && (
                  <button onClick={() => { setAvisoTarea(''); setFormPartir({ pct: '50', fecha: fechaQueSigue(cargarAvanceEn, 50) }); }}
                    style={{ marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                             fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: 'transparent',
                             border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                    Partir otra vez lo que queda
                  </button>
                )}
              </>) : (
                <button onClick={() => { setAvisoTarea(''); setFormPartir({ pct: '50', fecha: fechaQueSigue(cargarAvanceEn, 50) }); }}
                  style={{ marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                           fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: 'transparent',
                           border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  Hacer una parte y reprogramar el resto
                </button>
              )
            )}

            {/* Suspender: el motivo también se escribe acá. */}
            {formSuspender ? (
              <div style={{ marginTop: 10, padding: '13px 14px', borderRadius: 10,
                            background: 'var(--surface2)', border: '1px solid #d97706' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 3 }}>Suspender la tarea</div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>
                  Queda parada hasta que la retomes. Los días que esté parada se suman al plazo y se corre todo lo que depende de ella.
                </div>
                <input value={formSuspender.motivo} autoFocus
                  placeholder="Falta material, decisión del cliente, se cayó el contratista…"
                  onChange={e => setFormSuspender({ motivo: e.target.value })}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8,
                           background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                  <button onClick={() => setFormSuspender(null)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                             fontSize: 13, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                    Cancelar
                  </button>
                  <button onClick={() => alternarSuspension(cargarAvanceEn, formSuspender.motivo)} disabled={suspendiendo}
                    style={{ flex: 1.4, padding: '9px 0', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit',
                             fontSize: 13, fontWeight: 700, background: '#d97706', border: 'none', color: '#fff' }}>
                    {suspendiendo ? '…' : 'Suspender'}
                  </button>
                </div>
              </div>
            ) : !formPartir && (
              <button
                onClick={() => {
                  setAvisoTarea('');
                  if (cargarAvanceEn.suspendida) alternarSuspension(cargarAvanceEn);
                  else setFormSuspender({ motivo: '' });
                }}
                disabled={suspendiendo}
                style={{ marginTop: 8, width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                         fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                         border: `1px solid ${cargarAvanceEn.suspendida ? 'var(--accent)' : '#d97706'}`,
                         background: 'transparent',
                         color: cargarAvanceEn.suspendida ? 'var(--accent)' : '#d97706' }}>
                {suspendiendo ? '…' : cargarAvanceEn.suspendida ? 'Retomar la tarea' : 'Suspender la tarea'}
              </button>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Avance acumulado</div>
                <input type="number" min="0" max="100" value={pctNuevo} autoFocus
                  onChange={e => setPctNuevo(e.target.value)}
                  style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 8,
                           background: 'var(--surface2)', color: 'var(--text)', fontFamily: "'IBM Plex Mono',monospace",
                           fontSize: 15, textAlign: 'right' }} />
              </div>
              <button onClick={guardarAvanceLinea}
                style={{ padding: '10px 18px', background: 'var(--accent)', color: '#fff', border: 'none',
                         borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Guardar
              </button>
            </div>
            {(() => {
              const a = (avanceObra?.por_linea || []).find(x => x.linea_id === cargarAvanceEn.linea_id);
              const deCert = a && a.origen === 'certificado';
              const deSub = a && a.origen === 'subcontrato';
              return (
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.55 }}>
                  {deCert && <>Lo que se ve hoy sale del <b>último certificado</b> ({a.fecha}). Lo que cargues acá manda a partir de su fecha, sin tocar el certificado.<br /></>}
                  {deSub && <>Lo que se ve hoy sale de <b>lo certificado a un contratista</b>. Lo que cargues acá lo pisa.<br /></>}
                  Se registra en el avance de la obra: es el mismo número que ven el resumen, la
                  curva y el cliente en su portal.
                  {avanceObra?.metodologia === 'certificacion'
                    ? ' Cuando emitas el próximo certificado, va a partir de acá.'
                    : ' Las etapas pactadas se miden con este mismo avance.'}
                </div>
              );
            })()}
          </div>
        </div>
      )}


      {/* Dias que la obra no avanzo */}
      {panelDias && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPanelDias(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 22, width: 'min(520px,100%)',
                        maxHeight: '85vh', overflowY: 'auto', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Días que no se trabajó</div>
              <button onClick={() => setPanelDias(false)}
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
              Lluvia, feriado, paro o falta de material. El plazo se corre solo y el cliente ve la
              fecha nueva.
            </div>

            <div style={{ display: 'flex', gap: 7, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>Desde</div>
                <input type="date" value={formDia.desde} onChange={e => setFormDia(f => ({ ...f, desde: e.target.value }))}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                           background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5 }} />
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>Hasta (opcional)</div>
                <input type="date" value={formDia.hasta} onChange={e => setFormDia(f => ({ ...f, hasta: e.target.value }))}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                           background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5 }} />
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 4 }}>Motivo</div>
                <select value={formDia.motivo} onChange={e => setFormDia(f => ({ ...f, motivo: e.target.value }))}
                  style={{ padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
                           background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 12.5 }}>
                  <option value="lluvia">Lluvia</option>
                  <option value="feriado">Feriado</option>
                  <option value="paro">Paro</option>
                  <option value="material">Falta de material</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <button onClick={guardarDiasPerdidos} disabled={!formDia.desde}
                style={{ padding: '9px 16px', background: 'var(--accent)', color: '#fff', border: 'none',
                         borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                         fontFamily: 'inherit', opacity: formDia.desde ? 1 : .5 }}>Marcar</button>
            </div>

            <div style={{ marginTop: 18 }}>
              {diasPerdidos.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Todavía no se marcó ningún día.</div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
                    {diasPerdidos.length} día{diasPerdidos.length !== 1 ? 's' : ''} perdido{diasPerdidos.length !== 1 ? 's' : ''}
                  </div>
                  {diasPerdidos.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10,
                                             padding: '7px 0', borderBottom: '1px solid var(--border2)', fontSize: 12.5 }}>
                      <span>{fmtFecha(d.fecha)} · <span style={{ color: 'var(--warn)' }}>{d.motivo}</span>
                        {d.nota ? ` · ${d.nota}` : ''}</span>
                      <button onClick={() => borrarDiaPerdido(d.id)}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 15 }}>×</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {gastoEn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 320,
                      display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setGastoEn(null)}>
          {/* Pegado abajo: en obra se usa con una mano y el pulgar no llega
              arriba de la pantalla. */}
          <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', padding: '20px 18px 26px',
                        width: 'min(520px, 100%)', maxHeight: '90dvh', overflowY: 'auto',
                        border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Cargar un gasto</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, marginBottom: 16, lineHeight: 1.5 }}>
              Se imputa a «{gastoEn.nombre}» y entra hoy mismo al control financiero.
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Cuánto</div>
            <div style={{ position: 'relative', marginBottom: 13 }}>
              <span style={{ position: 'absolute', left: 13, top: 13, fontSize: 18, color: 'var(--muted)' }}>$</span>
              <input type="number" inputMode="decimal" min="0" step="any" autoFocus
                value={gastoForm.monto} onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                style={{ width: '100%', padding: '12px 12px 12px 30px', border: '1px solid var(--border)',
                         borderRadius: 10, background: 'var(--surface2)', color: 'var(--text)',
                         fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, textAlign: 'right' }} />
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>A quién</div>
            <input value={gastoForm.proveedor} placeholder="Corralón, ferretería, flete…"
              onChange={e => setGastoForm(f => ({ ...f, proveedor: e.target.value }))}
              style={{ width: '100%', padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 10,
                       background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
                       marginBottom: 13, boxSizing: 'border-box' }} />

            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Detalle (opcional)</div>
            <input value={gastoForm.nota} placeholder="20 bolsas de cemento"
              onChange={e => setGastoForm(f => ({ ...f, nota: e.target.value }))}
              style={{ width: '100%', padding: '11px 12px', border: '1px solid var(--border)', borderRadius: 10,
                       background: 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 14,
                       boxSizing: 'border-box' }} />

            <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
              <button onClick={() => setGastoEn(null)}
                style={{ flex: 1, padding: '13px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                         fontSize: 14, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                Cancelar
              </button>
              <button onClick={guardarGasto} disabled={guardandoGasto}
                style={{ flex: 1.6, padding: '13px 0', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                         fontSize: 14, fontWeight: 700, background: 'var(--accent)', border: 'none', color: '#fff' }}>
                {guardandoGasto ? 'Guardando…' : 'Guardar gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {panelFalta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 300,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPanelFalta(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 22, width: 'min(520px,100%)',
                        maxHeight: '88vh', overflowY: 'auto', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Falta planificar</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3, marginBottom: 14, lineHeight: 1.5 }}>
              Está presupuestado pero todavía no tiene lugar en el plan. Tocá para meterlo,
              con las horas y la duración que le corresponden.
            </div>
            {faltaPlanificar.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Está todo planificado.</div>
            )}
            {faltaPlanificar.map(l => (
              <div key={l.linea_id}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 7,
                         borderRadius: 9, background: 'var(--surface2)',
                         border: `1px solid ${l.es_adicional ? 'rgba(251,146,60,.5)' : 'var(--border)'}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.nombre}
                    {l.es_adicional && (
                      <span style={{ marginLeft: 6, fontSize: 8.5, fontWeight: 800, letterSpacing: .5,
                                     padding: '1px 4px', borderRadius: 4, verticalAlign: 'middle',
                                     background: 'rgba(251,146,60,.18)', color: '#c2410c',
                                     border: '1px solid rgba(251,146,60,.5)' }}>AD</span>
                    )}
                  </div>
                  {l.subcontrato && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      Lo ejecuta {l.subcontrato.contratista}
                    </div>
                  )}
                </div>
                <button onClick={() => planificarLinea(l)} disabled={planificando === l.linea_id}
                  style={{ padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                           fontSize: 12.5, fontWeight: 700, background: 'var(--accent)', border: 'none', color: '#fff' }}>
                  {planificando === l.linea_id ? '…' : 'Al plan'}
                </button>
              </div>
            ))}
            <button onClick={() => setPanelFalta(false)}
              style={{ marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 9, cursor: 'pointer',
                       fontFamily: 'inherit', fontSize: 13, background: 'transparent',
                       border: '1px solid var(--border)', color: 'var(--muted)' }}>
              Cerrar
            </button>
          </div>
        </div>
      )}

      {editando !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
                        maxHeight: '90dvh', overflowY: 'auto', border: '1px solid #e0e0e8', color: '#1a1a2e' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{editando.id ? 'Editar tarea' : 'Nueva tarea'}</div>
              <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 22 }}>×</button>
            </div>
            <EditarTarea tarea={editando} onSave={guardarTarea} onDelete={editando.id ? () => { eliminarTarea(editando.id); setEditando(null); } : null} presupuestoId={parseInt(id)} />
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#222228', border: '1px solid #3a3a48', borderRadius: 20, padding: '10px 20px', fontSize: 13, color: 'var(--text)', zIndex: 400 }}>{toast}</div>}

      <BarraDeshacer mensaje={avisoUndo} onDeshacer={hacerDeshacer} onCerrar={() => setAvisoUndo('')} />
    </div>
  );
}

function EditarTarea({ tarea, onSave, onDelete, presupuestoId }) {
  const [form, setForm] = useState({
    nombre: '', duracion_dias: 1,
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: new Date().toISOString().split('T')[0],
    color: COLORES[0], progreso: 0,
    presupuesto_id: presupuestoId,
    ...tarea
  });
  const upd = (k, v) => {
    const f = { ...form, [k]: v };
    // Recalcular fecha_fin al cambiar duración o fecha_inicio
    if (k === 'duracion_dias' || k === 'fecha_inicio') {
      const dur = k === 'duracion_dias' ? parseInt(v) || 1 : parseInt(form.duracion_dias) || 1;
      const fi = k === 'fecha_inicio' ? v : form.fecha_inicio;
      f.fecha_fin = addDias(fi, dur - 1);
    }
    // Recalcular duración al cambiar fecha_fin
    if (k === 'fecha_fin' && form.fecha_inicio) {
      f.duracion_dias = Math.max(1, diasEntre(form.fecha_inicio, v) + 1);
    }
    setForm(f);
  };

  // Buscador del catálogo, para que un adicional se cotice con su análisis de
  // precio y no a ojo.
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState([]);
  useEffect(() => {
    if (!form.es_adicional || busca.trim().length < 3) { setResultados([]); return; }
    const t = setTimeout(() => {
      api.get(`/maestros/items?q=${encodeURIComponent(busca.trim())}`)
        .then(r => setResultados((r.data || []).slice(0, 8)))
        .catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busca, form.es_adicional]);

  const inpStyle = { background: '#f8f9fa', border: '1px solid #e0e0e8', borderRadius: 8, color: '#1a1a2e', padding: '8px 12px', fontSize: 13, fontFamily: 'inherit', width: '100%', outline: 'none', boxSizing: 'border-box' };

  const lblStyle = { fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={lblStyle}>Nombre *</label>
          <input style={inpStyle} value={form.nombre} onChange={e => upd('nombre', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Fecha inicio</label>
          <input style={inpStyle} type="date" value={form.fecha_inicio} onChange={e => upd('fecha_inicio', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Duración (días)</label>
          <input style={inpStyle} type="number" min={1} value={form.duracion_dias} onChange={e => upd('duracion_dias', e.target.value)} />
        </div>
        <div>
          <label style={lblStyle}>Fecha fin</label>
          <input style={inpStyle} type="date" value={form.fecha_fin} onChange={e => upd('fecha_fin', e.target.value)} />
        </div>
        <div>
          {/* El campo del backend es `progreso`. Se llamaba `completado` acá y
              por eso el avance que se cargaba nunca se guardaba. */}
          <label style={lblStyle}>% completado</label>
          <input style={inpStyle} type="number" min={0} max={100} value={form.progreso}
            onChange={e => upd('progreso', e.target.value)} />
        </div>
        {/* En obra sale algo que no estaba presupuestado. Se carga acá, donde
            uno está parado, y el presupuesto se entera solo: la tarea nace
            atada a una línea del adicional, con plata adentro. */}
        {!tarea.id && (
          <div style={{ gridColumn: 'span 2', padding: '12px 14px', borderRadius: 10,
                        background: form.es_adicional ? 'rgba(251,146,60,.10)' : '#f8f9fa',
                        border: `1px solid ${form.es_adicional ? '#fb923c' : '#e0e0e8'}` }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={!!form.es_adicional}
                onChange={e => upd('es_adicional', e.target.checked)} style={{ width: 16, height: 16 }} />
              Esto es un adicional — se le cobra al cliente
            </label>
            {form.es_adicional && (
              <>
                <div style={{ fontSize: 11.5, color: '#6b7280', margin: '7px 0 11px', lineHeight: 1.5 }}>
                  Se suma al adicional en borrador de esta obra. Cuando lo quieras cobrar,
                  lo cerrás y lo mandás a aprobar como cualquier presupuesto.
                </div>
                {/* Del catalogo sale con su analisis de precio y sus horas de
                    mano de obra: el adicional queda cotizado igual que el
                    contrato, no a ojo. */}
                {form.item_global_id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px',
                                borderRadius: 8, background: '#fff7ed', border: '1px solid #fdba74',
                                marginBottom: 11 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, overflow: 'hidden',
                                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.item_nombre}</div>
                      <div style={{ fontSize: 11, color: '#6b7280' }}>
                        Del catálogo · se cotiza con su análisis de precio
                      </div>
                    </div>
                    <button onClick={() => { const f = { ...form }; f.item_global_id = null; f.item_nombre = ''; setForm(f); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18 }}>×</button>
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginBottom: 11 }}>
                    <label style={lblStyle}>Buscar en el catálogo</label>
                    <input style={inpStyle} value={busca} placeholder="mampostería, contrapiso, pintura…"
                      onChange={e => setBusca(e.target.value)} />
                    {resultados.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5,
                                    maxHeight: 190, overflowY: 'auto', background: '#fff',
                                    border: '1px solid #e0e0e8', borderRadius: 8, marginTop: 3,
                                    boxShadow: '0 6px 18px rgba(0,0,0,.12)' }}>
                        {resultados.map(it => (
                          <div key={it.id} onClick={() => {
                              const f = { ...form, item_global_id: it.id, item_nombre: it.nombre,
                                          unidad_libre: it.unidad_ejecucion || 'un' };
                              if (!f.nombre) f.nombre = it.nombre;
                              setForm(f); setBusca(''); setResultados([]);
                            }}
                            style={{ padding: '8px 11px', cursor: 'pointer', fontSize: 12.5,
                                     borderBottom: '1px solid #f1f3f5' }}>
                            <div style={{ fontWeight: 600 }}>{it.nombre}</div>
                            <div style={{ fontSize: 10.5, color: '#6b7280' }}>
                              {it.codigo} · {it.unidad_ejecucion} · {it.categoria_nombre}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
                      O dejalo vacío y cargalo a mano acá abajo.
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: form.item_global_id ? '1fr 1fr' : '1fr 1fr 1.4fr', gap: 9 }}>
                  <div>
                    <label style={lblStyle}>Cantidad</label>
                    <input style={inpStyle} type="number" min="0" step="any" value={form.cantidad ?? 1}
                      onChange={e => upd('cantidad', e.target.value)} />
                  </div>
                  <div>
                    <label style={lblStyle}>Unidad</label>
                    <input style={{ ...inpStyle, opacity: form.item_global_id ? .55 : 1 }}
                      disabled={!!form.item_global_id}
                      value={form.unidad_libre ?? 'un'} placeholder="m2, un, gl"
                      onChange={e => upd('unidad_libre', e.target.value)} />
                  </div>
                  {!form.item_global_id && <div>
                    <label style={lblStyle}>Costo por unidad</label>
                    <input style={{ ...inpStyle, opacity: form.sin_precio ? .45 : 1 }} type="number" min="0" step="any"
                      disabled={form.sin_precio} value={form.sin_precio ? '' : (form.costo_directo_libre ?? '')}
                      onChange={e => upd('costo_directo_libre', e.target.value)} />
                  </div>}
                </div>
                {!form.item_global_id && <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                                fontSize: 12, color: '#6b7280', marginTop: 10 }}>
                  <input type="checkbox" checked={!!form.sin_precio}
                    onChange={e => upd('sin_precio', e.target.checked)} />
                  Todavía no sé cuánto — lo valorizo después
                </label>}
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 7 }}>
                  {form.item_global_id
                    ? 'La duración sale de las horas de mano de obra del análisis del ítem.'
                    : 'El costo va sin gastos generales, beneficio ni IVA: se le aplican los mismos de la obra.'}
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ gridColumn: 'span 2' }}>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Color</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORES.map(c => (
              <button key={c} onClick={() => upd('color', c)} style={{ width: 24, height: 24, borderRadius: 4, background: c, border: form.color === c ? '3px solid #e8e8f0' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {onDelete && <button onClick={onDelete} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,.3)', background: 'transparent', color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>}
        <div style={{ flex: 1 }} />
        <button onClick={() => onSave(form)} disabled={!form.nombre} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: '#6ee7b7', color: '#0f0f11', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !form.nombre ? .5 : 1 }}>Guardar</button>
      </div>
    </div>

  );
}
