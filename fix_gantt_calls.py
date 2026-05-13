path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Replace FIMA horas-mo fetch with just skipping it (use backend generar endpoint instead)
old1 = """    // Obtener horas reales de MO desde el backend (análisis de costos real)
    let horasPorLinea = {};
    try {
      const res = await fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/horas-mo`);
      if (res.ok) {
        const data = await res.json();
        data.forEach(d => { horasPorLinea[d.linea_id] = d.horas_mo; });
      }
    } catch (e) { console.error('horas-mo:', e); }

    // Eliminar tareas existentes
    // tareas se borran via generar endpoint

    let fechaAcum = fechaInicio;
    const nuevasTareas = [];
    let orden = 0;

    lineas.forEach((linea, i) => {
    showToast('✓ Guardado');
    cargar();
  };"""

new1 = """    // Use backend generar endpoint
    try {
      await api.post(`/presupuestos/${id}/gantt/generar`);
      await cargar();
      showToast('✓ Tareas generadas');
    } catch(e) { 
      alert('Error al generar: ' + (e.response?.data?.detail || e.message));
    }
    setGenerando(false);
  };"""

if old1 in content:
    content = content.replace(old1, new1)
    print("Fixed generarDesdePresupuesto")
else:
    # Try with \r\n
    old1_w = old1.replace('\n', '\r\n')
    new1_w = new1.replace('\n', '\r\n')
    if old1_w in content:
        content = content.replace(old1_w, new1_w)
        print("Fixed generarDesdePresupuesto (CRLF)")
    else:
        # Simpler fix - just replace the fetch line and the broken forEach
        content = content.replace(
            "      const res = await fetch(`https://fima-backend-production.up.railway.app/presupuestos/${id}/horas-mo`);",
            "      // horas-mo not available in OBRAS backend"
        )
        print("Applied minimal fix for horas-mo")

# Fix 2: Remove/stub enviarAlPlanner function that uses supabase
old2 = """      const { data: nuevo } = await sb.from('planner_proyectos').insert({
        nombre: presupuesto?.nombre_obra || `Obra ${id}`,
        color: COLORES[0],
        presupuesto_id: parseInt(id),
      }).select().single();
      proyectoId = nuevo?.id;
    }

    const plannerTareas = tareas.map(t => ({
      proyecto_id: proyectoId,
      titulo: t.nombre,
      descripcion: t.rubro || '',
      estado: t.completado >= 100 ? 'listo' : t.completado > 0 ? 'en_progreso' : 'pendiente',
      fecha_inicio: t.fecha_inicio,
      fecha_fin: t.fecha_fin,
      prioridad: 'normal',
    }));

    await sb.from('planner_tareas').insert(plannerTareas);
    showToast(`✓ ${plannerTareas.length} tareas enviadas al Planner`);"""

new2 = """      proyectoId = null; // Planner integration not available
    }
    showToast('⚠ Integración con Planner no disponible');"""

content = content.replace(old2, new2)
content = content.replace(old2.replace('\n', '\r\n'), new2)

# Fix 3: Also remove sb declaration if still there
content = content.replace(
    "const sb = ",
    "// const sb = "
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    check = f.read()
fima_count = check.count('fima-backend')
sb_count = check.count('await sb.')
print(f"fima-backend remaining: {fima_count}")
print(f"await sb. remaining: {sb_count}")
print("Done")
