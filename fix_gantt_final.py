path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the entire broken generarDesdePresupuesto function with a clean one
old = r"""  const generarDesdePresupuesto = async () => {
    setGenerando(true);
    const horasDia = parseFloat(config.horas_dia) || 8;
    const diasSemana = parseFloat(config.dias_semana) || 5;
    const fechaInicio = config.fecha_inicio_obra;
    
    // Obtener horas reales de MO desde el backend (análisis de costos real)
    // horas-mo not needed - using backend generar

    // Eliminar tareas existentes
    // tareas se borran via generar endpoint

    let fechaAcum = fechaInicio;
    const nuevasTareas = [];
    let orden = 0;

    lineas.forEach((linea, i) => {
      // Usar horas reales del análisis de costos si están disponibles
      const horasReales = horasPorLinea[linea.id];
      let duracion;
      if (horasReales && horasReales > 0) {
        // Horas reales del análisis → días laborales
        duracion = Math.max(1, Math.ceil(horasReales / horasDia));
      } else {
        // Sin análisis de MO → 1 día por defecto
        duracion = 1;
      }

      const fechaFin = addDias(fechaAcum, duracion - 1);
      
      nuevasTareas.push({
        presupuesto_id: parseInt(id),
        linea_presupuesto_id: linea.id,
        nombre: linea.nombre_item || linea.nombre_libre || `Ítem ${i + 1}`,
        rubro: linea.categoria_nombre || '',
        duracion_dias: duracion,
        fecha_inicio: fechaAcum,
        fecha_fin: fechaFin,
        orden: orden++,
        color: COLORES[i % COLORES.length],
        completado: 0,
      });
      fechaAcum = addDias(fechaFin, 1);
    });

    if (nuevasTareas.length > 0) {
      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('Tareas generadas');
      setGenerando(false);
      return;
    }
    
    await cargar();
    setGenerando(false);
    showToast(`✓ ${nuevasTareas.length} tareas generadas desde análisis de costos`);
  };"""

new = r"""  const generarDesdePresupuesto = async () => {
    setGenerando(true);
    try {
      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('✓ Tareas generadas');
    } catch(e) {
      alert('Error al generar: ' + (e.response?.data?.detail || e.message));
    }
    setGenerando(false);
  };"""

if old in content:
    content = content.replace(old, new)
    print("Fixed generarDesdePresupuesto")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed generarDesdePresupuesto (CRLF)")
    else:
        print("ERROR: function not found exactly")
        # Count lines with horasPorLinea
        count = content.count('horasPorLinea')
        print(f"horasPorLinea occurrences: {count}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

with open(path, 'r', encoding='utf-8') as f:
    check = f.read()
print(f"horasPorLinea remaining: {check.count('horasPorLinea')}")
print("Done")
