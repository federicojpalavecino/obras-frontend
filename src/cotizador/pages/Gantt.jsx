import '../index.css';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, BarChart2 } from 'lucide-react';
import MobileMenu from './MobileMenu';
import { tenantNombre, localidadYFecha } from '../tenant';
import BarraDeshacer from '../BarraDeshacer';
import { registrar, limpiar, deshacerUltima, useAtajoDeshacer } from '../deshacer';

import api from '../api';

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
  const [cargarAvanceEn, setCargarAvanceEn] = useState(null);   // tarea abierta
  const [pctNuevo, setPctNuevo] = useState("");
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
  const [modoVincular, setModoVincular] = useState(false);
  const [predSel, setPredSel] = useState(null);    // tarea elegida como predecesora
  const [verCritico, setVerCritico] = useState(true);
  const [panelVinculos, setPanelVinculos] = useState(false);
  const [vinculoSel, setVinculoSel] = useState(null);   // el resaltado al tocar la flecha
  const [arrastre, setArrastre] = useState(null);   // {id, dx} mientras se arrastra
  const scrollRef = useRef(null);

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

  const PX_DIA = 28;
  const ROW_H = 40;
  const LABEL_W = 260;

  useEffect(() => { cargar(); }, [id]);

  const cargar = async () => {
    // Sale del mismo registro que usa el resumen, el portal y la curva.
    api.get(`/presupuestos/${id}/avance`).then(r => setAvanceObra(r.data)).catch(() => {});
    setLoading(true);
    try {
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
      setPlan(planRes.data || null);
      setErrorPlan(planRes.data ? '' : (planRes.err?.response?.data?.detail || ''));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

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
      showToast('✓ Tareas vinculadas');
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

  const generarDesdePresupuesto = async () => {
    setGenerando(true);
    try {
      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('✓ Tareas generadas');
    } catch(e) {
      alert('Error al generar: ' + (e.response?.data?.detail || e.message));
    }
    setGenerando(false);
  };

  const guardarTarea = async (tarea) => {
    const data = { ...tarea };
    if (tarea.id) {
      await api.put(`/presupuestos/${id}/gantt/tareas/${tarea.id}`, data);
    } else {
      const res = await api.post(`/presupuestos/${id}/gantt/tareas`, { ...data, presupuesto_id: parseInt(id) }); tarea.id = res.data.id;
    }
    setEditando(null);
    showToast('✓ Guardado');
    cargar();
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

  // ── CÁLCULOS DEL GANTT ──
  if (loading) return <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontFamily: 'var(--sans)' }}>Cargando...</div>;

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

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Gantt — ${esc(presupuesto?.nombre_obra || '')}</title>
<style>
  @page{size:A4 landscape;margin:10mm}
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
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--sans)' }}>
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
          <div className="header-actions-desktop" style={{ gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditando({})}>+ Tarea</button>
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
                {generando ? '...' : '↺ Regenerar'}
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
            <button className="btn btn-secondary btn-sm" onClick={borrarTodosLosVinculos}
              style={{ fontSize: 10 }}>Desvincular todo</button>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>FS: una empieza al terminar la otra · el desfasaje son días de espera (+) o de solape (−)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 190, overflowY: 'auto' }}>
            {vinculos.map(v => {
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
      ) : (
        <div style={{ display: 'flex', overflow: 'hidden' }}>
          {/* Labels */}
          <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tarea
            </div>
            {filas.map(t => (
              <div key={t.id} style={{ height: ROW_H, borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, cursor: 'pointer' }}
                onClick={() => setEditando(t)}>
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
                <div style={{ width: 10, height: 10, borderRadius: t.es_resumen ? 0 : 2, background: t.critica && verCritico ? '#f87171' : t.color, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }} onClick={() => modoVincular ? clickVincular(t) : setEditando(t)}>
                  <div style={{ fontSize: 12, fontWeight: t.es_resumen ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: t.es_resumen ? 'uppercase' : 'none', letterSpacing: t.es_resumen ? 0.4 : 0 }}>
                    {t.nombre}
                    {/* Arrastrar la barra fija la tarea. El chinche la suelta
                        y la devuelve al mando de sus dependencias. */}
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
          <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
            <div style={{ width: totalDias * PX_DIA, position: 'relative' }}>
              {/* Header fechas */}
              <div style={{ height: 50, borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'flex-end', position: 'sticky', top: 0, zIndex: 10 }}>
                {diasHeader.map((dia) => {
                  const d = new Date(dia + 'T12:00:00');
                  const esLunes = d.getDay() === 1;
                  const franco = !esLaborable(dia);
                  const esHoyDia = dia === hoy;
                  return (
                    <div key={dia} style={{ width: PX_DIA, flexShrink: 0, height: '100%', borderLeft: esLunes ? '1px solid #3a3a48' : '1px solid #2e2e3822', background: esHoyDia ? 'rgba(110,231,183,.08)' : franco ? 'rgba(74,74,88,.3)' : 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 2px 4px' }}>
                      {esLunes && <div style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</div>}
                      <div style={{ fontSize: 9, color: esHoyDia ? '#6ee7b7' : franco ? '#4a4a58' : 'var(--muted2, #4a4a58)' }}>{DIA_LETRA[d.getDay()]}{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>

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
                    {/* Columnas de fondo */}
                    {diasHeader.map(dia => {
                      const d = new Date(dia + 'T12:00:00');
                      // Se sombrea lo que NO se trabaja según la configuración,
                      // no el fin de semana fijo: si la obra trabaja los sábados,
                      // el sábado tiene que verse como día de trabajo.
                      const franco = !esLaborable(dia);
                      const esHoyDia = dia === hoy;
                      return <div key={dia} style={{ width: PX_DIA, height: '100%', flexShrink: 0, background: esHoyDia ? 'rgba(110,231,183,.04)' : franco ? 'rgba(74,74,88,.15)' : 'transparent', borderLeft: d.getDay() === 1 ? '1px solid #3a3a4844' : '1px solid transparent' }} />;
                    })}
                    {/* Barra de tarea */}
                    {t.es_hito ? (
                      // Hito: rombo, no ocupa tiempo
                      <div title={`${t.nombre} — hito ${fmtFechaLarga(t.fecha_inicio)}`}
                        onClick={() => modoVincular ? clickVincular(t) : setEditando(t)}
                        style={{ position: 'absolute', left: left + PX_DIA / 2 - 8, top: ROW_H / 2 - 8, width: 16, height: 16,
                          background: t.critica && verCritico ? '#f87171' : t.color, transform: 'rotate(45deg)',
                          cursor: 'pointer', zIndex: 4, border: predSel?.id === t.id ? '2px solid #fff' : 'none' }} />
                    ) : (
                    <div title={`${t.nombre}\n${fmtFechaLarga(t.fecha_inicio)} → ${fmtFechaLarga(t.fecha_fin)}${t.holgura != null ? `\nHolgura: ${t.holgura} día(s)` : ''}${t.critica ? '\n⚠ Camino crítico' : ''}${t.no_antes_de ? `\n📌 Fijada al ${fmtFecha(t.no_antes_de)}` : ''}`}
                      style={{ position: 'absolute', left, top: 6, width, height: ROW_H - 12, borderRadius: 6,
                        background: (t.critica && verCritico ? '#f87171' : t.color) + '33',
                        border: predSel?.id === t.id ? '2px solid #fff'
                              : `1px solid ${(t.critica && verCritico ? '#f87171' : t.color)}${t.critica && verCritico ? 'cc' : '66'}`,
                        cursor: 'pointer', overflow: 'hidden', zIndex: 4,
                        boxShadow: modoVincular ? '0 0 0 1px rgba(255,255,255,.15)' : 'none' }}
                      onMouseDown={e => iniciarArrastre(e, t)}
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
                        if (e.altKey && t.linea_id) {
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
                          {width > 60 ? t.nombre : ''}
                          {pct > 0 && width > 80 ? ` (${pct}%)` : ''}
                        </span>
                      </div>
                    </div>
                    )}
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
                        onClick={() => { setVinculoSel(v.id); setPanelVinculos(true); }}>
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
                <div style={{ position: 'absolute', left: diasEntre(fechaMin, hoy) * PX_DIA + PX_DIA / 2, top: 0, bottom: 0, width: 2, background: '#6ee7b7', opacity: .5, pointerEvents: 'none', zIndex: 5 }} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR TAREA */}
      {/* Cargar avance desde el Gantt */}
      {cargarAvanceEn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setCargarAvanceEn(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 22, width: 'min(430px,100%)',
                        border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{cargarAvanceEn.nombre}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
              {fmtFechaLarga(cargarAvanceEn.fecha_inicio)} → {fmtFechaLarga(cargarAvanceEn.fecha_fin)}
              {cargarAvanceEn.horas_totales ? ` · ${cargarAvanceEn.horas_totales} h` : ''}
              {cargarAvanceEn.personas ? ` · ${cargarAvanceEn.personas} personas` : ''}
            </div>

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
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
              Se registra en el avance de la obra: lo ven el resumen, la curva y el cliente en su portal.
            </div>
          </div>
        </div>
      )}

      {editando !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#ffffff', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%', border: '1px solid #e0e0e8', color: '#1a1a2e' }}>
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
