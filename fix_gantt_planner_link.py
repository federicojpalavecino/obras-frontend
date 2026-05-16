"""
fix_gantt_planner_link.py
1. Agrega boton "Exportar al Planner" en Gantt.jsx
2. Actualiza Planner.jsx para:
   - Cargar presupuestos reales como proyectos
   - Mostrar presupuesto vinculado en tarjeta de tarea
   - Campo presupuesto en modal de tarea
   - Proyectos del Planner = presupuestos + clientes existentes
"""

import os

# ── FIX GANTT.JSX ─────────────────────────────────────────────────────────────
gantt_path = r'C:\obras-frontend\src\cotizador\pages\Gantt.jsx'
with open(gantt_path, 'r', encoding='utf-8') as f:
    gantt = f.read()

# Add exportar function after generarDesdePresupuesto
old_generar = '''  const generarDesdePresupuesto = async () => {'''
export_fn = '''  const exportarAlPlanner = async () => {
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

  const generarDesdePresupuesto = async () => {'''

if old_generar in gantt and 'exportarAlPlanner' not in gantt:
    gantt = gantt.replace(old_generar, export_fn, 1)
    print("Added exportarAlPlanner function to Gantt.jsx")

# Add export button next to the regenerar button
old_btn_area = '''            {tareas.length > 0 && (
              <button className="btn btn-warn btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? '...' : '↺ Regenerar'}
              </button>
            )}'''

new_btn_area = '''            {tareas.length > 0 && (
              <button className="btn btn-warn btn-sm" onClick={generarDesdePresupuesto} disabled={generando}>
                {generando ? '...' : '↺ Regenerar'}
              </button>
            )}
            {tareas.length > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={exportarAlPlanner} title="Copiar tareas del Gantt al Planner">
                📅 Exportar al Planner
              </button>
            )}'''

if old_btn_area in gantt and 'Exportar al Planner' not in gantt:
    gantt = gantt.replace(old_btn_area, new_btn_area, 1)
    print("Added export button to Gantt.jsx toolbar")

with open(gantt_path, 'w', encoding='utf-8') as f:
    f.write(gantt)
print(f"Gantt.jsx updated ({len(gantt)} chars)")

# ── FIX PLANNER.JSX ───────────────────────────────────────────────────────────
planner_path = r'C:\obras-frontend\src\pages\Planner.jsx'
with open(planner_path, 'r', encoding='utf-8') as f:
    planner = f.read()

# 1. Add presupuestos state
old_state = '''  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);'''

new_state = '''  const [tareas, setTareas] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [presupuestos, setPresupuestos] = useState([]);'''

if old_state in planner:
    planner = planner.replace(old_state, new_state, 1)
    print("Added presupuestos state to Planner")

# 2. Load presupuestos in cargar()
old_cargar = '''  const cargar = async () => {
    setLoading(true);
    const [tr, pr] = await Promise.all([
      fetch(`${API}/planner/tareas`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/planner/proyectos`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]);
    setTareas(Array.isArray(tr) ? tr : []);
    setProyectos(Array.isArray(pr) ? pr : []);
    setLoading(false);
  };'''

new_cargar = '''  const cargar = async () => {
    setLoading(true);
    const [tr, pr, pres] = await Promise.all([
      fetch(`${API}/planner/tareas`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/planner/proyectos`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API}/planner/presupuestos`, { headers: authH() }).then((r) => r.ok ? r.json() : []).catch(() => []),
    ]);
    setTareas(Array.isArray(tr) ? tr : []);
    setProyectos(Array.isArray(pr) ? pr : []);
    setPresupuestos(Array.isArray(pres) ? pres : []);
    setLoading(false);
  };'''

if old_cargar in planner:
    planner = planner.replace(old_cargar, new_cargar, 1)
    print("Updated cargar() to load presupuestos")

# 3. Update ModalTarea to include presupuesto field
old_modal_state = '''  const [form, setForm] = useState(tarea || { titulo: "", descripcion: "", estado: "pendiente", prioridad: "normal", proyecto_id: "", fecha_inicio: hoy(), fecha_fin: "", hora_inicio: "", hora_fin: "", asignado_a: "" });'''

new_modal_state = '''  const [form, setForm] = useState(tarea || { titulo: "", descripcion: "", estado: "pendiente", prioridad: "normal", proyecto_id: "", presupuesto_id: "", fecha_inicio: hoy(), fecha_fin: "", hora_inicio: "", hora_fin: "", asignado_a: "" });'''

if old_modal_state in planner:
    planner = planner.replace(old_modal_state, new_modal_state, 1)
    print("Updated ModalTarea form state")

# 4. Update ModalTarea signature to accept presupuestos
old_modal_sig = '''function ModalTarea({ tarea, proyectos, onSave, onClose, gcalConnected }) {'''
new_modal_sig = '''function ModalTarea({ tarea, proyectos, presupuestos, onSave, onClose, gcalConnected }) {'''

if old_modal_sig in planner:
    planner = planner.replace(old_modal_sig, new_modal_sig, 1)
    print("Updated ModalTarea signature")

# 5. Add presupuesto field in ModalTarea after proyecto field
old_proy_field = '''          <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Proyecto</label>
            <select style={inp} value={form.proyecto_id || ""} onChange={(e) => setForm((f) => ({ ...f, proyecto_id: e.target.value ? parseInt(e.target.value) : null }))}>
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></div>'''

new_proy_field = '''          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Proyecto</label>
              <select style={inp} value={form.proyecto_id || ""} onChange={(e) => setForm((f) => ({ ...f, proyecto_id: e.target.value ? parseInt(e.target.value) : null }))}>
                <option value="">Sin proyecto</option>
                {proyectos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select></div>
            <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Presupuesto</label>
              <select style={inp} value={form.presupuesto_id || ""} onChange={(e) => setForm((f) => ({ ...f, presupuesto_id: e.target.value ? parseInt(e.target.value) : null }))}>
                <option value="">Sin presupuesto</option>
                {(presupuestos || []).map((p) => <option key={p.id} value={p.id}>{p.nombre_obra}{p.cliente_nombre ? ` — ${p.cliente_nombre}` : ""}</option>)}
              </select></div>
          </div>'''

if old_proy_field in planner:
    planner = planner.replace(old_proy_field, new_proy_field, 1)
    print("Added presupuesto field to ModalTarea")

# 6. Pass presupuestos to ModalTarea
old_modal_call = '''{modalTarea !== null && <ModalTarea tarea={modalTarea?.id ? modalTarea : null} proyectos={proyectos} onSave={guardarTarea} onClose={() => setModalTarea(null)} gcalConnected={gcalConnected} />}'''
new_modal_call = '''{modalTarea !== null && <ModalTarea tarea={modalTarea?.id ? modalTarea : null} proyectos={proyectos} presupuestos={presupuestos} onSave={guardarTarea} onClose={() => setModalTarea(null)} gcalConnected={gcalConnected} />}'''

if old_modal_call in planner:
    planner = planner.replace(old_modal_call, new_modal_call, 1)
    print("Passed presupuestos to ModalTarea")

# 7. Update TareaCard to show presupuesto name
old_tarea_card = '''  const proy = proyectos.find((p) => p.id === t.proyecto_id);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: "pointer" }} onClick={() => onEdit(t)}>
      {proy && <div style={{ fontSize: 10, fontWeight: 700, color: proy.color || C.accent2, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>{proy.nombre}</div>}'''

new_tarea_card = '''  const proy = proyectos.find((p) => p.id === t.proyecto_id);
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, marginBottom: 8, cursor: "pointer" }} onClick={() => onEdit(t)}>
      <div style={{ display: "flex", gap: 6, marginBottom: proy ? 4 : 0, flexWrap: "wrap" }}>
        {proy && <div style={{ fontSize: 10, fontWeight: 700, color: proy.color || C.accent2, textTransform: "uppercase", letterSpacing: "0.5px" }}>{proy.nombre}</div>}
        {t.presupuesto_id && !proy && <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.5px" }}>📋 Presupuesto vinculado</div>}
      </div>'''

if old_tarea_card in planner:
    planner = planner.replace(old_tarea_card, new_tarea_card, 1)
    print("Updated TareaCard to show presupuesto")

# 8. Update guardarTarea to include presupuesto_id
old_guardar_data = '''    const data = { titulo: form.titulo, descripcion: toNull(form.descripcion), estado: form.estado || "pendiente", prioridad: form.prioridad || "normal", proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id) : null, fecha_inicio: form.fecha_inicio || hoy(), fecha_fin: toNull(form.fecha_fin), hora_inicio: toNull(form.hora_inicio), hora_fin: toNull(form.hora_fin), asignado_a: toNull(form.asignado_a), google_event_id: toNull(form.google_event_id) };'''

new_guardar_data = '''    const data = { titulo: form.titulo, descripcion: toNull(form.descripcion), estado: form.estado || "pendiente", prioridad: form.prioridad || "normal", proyecto_id: form.proyecto_id ? parseInt(form.proyecto_id) : null, presupuesto_id: form.presupuesto_id ? parseInt(form.presupuesto_id) : null, fecha_inicio: form.fecha_inicio || hoy(), fecha_fin: toNull(form.fecha_fin), hora_inicio: toNull(form.hora_inicio), hora_fin: toNull(form.hora_fin), asignado_a: toNull(form.asignado_a), google_event_id: toNull(form.google_event_id) };'''

if old_guardar_data in planner:
    planner = planner.replace(old_guardar_data, new_guardar_data, 1)
    print("Updated guardarTarea to include presupuesto_id")

# 9. Update guardarProyecto to create proyecto as presupuesto-linked if presupuesto_id given
old_guardar_proy = '''  const guardarProyecto = async () => {
    if (!formProy.nombre) return;
    await fetch(`${API}/planner/proyectos`, { method: "POST", headers: authH(), body: JSON.stringify(formProy) });
    setModalProyecto(false); setFormProy({ nombre: "", color: "#6ee7b7" }); showToast("✓ Proyecto creado"); cargar();
  };'''

new_guardar_proy = '''  const guardarProyecto = async () => {
    if (!formProy.nombre) return;
    await fetch(`${API}/planner/proyectos`, { method: "POST", headers: authH(), body: JSON.stringify(formProy) });
    setModalProyecto(false); setFormProy({ nombre: "", color: "#6ee7b7", presupuesto_id: null }); showToast("✓ Proyecto creado"); cargar();
  };'''

if old_guardar_proy in planner:
    planner = planner.replace(old_guardar_proy, new_guardar_proy, 1)
    print("Updated guardarProyecto")

# 10. Add presupuesto selector in ModalProyecto
old_modal_proy_content = '''              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Nombre *</label><input style={inp} value={formProy.nombre} onChange={(e) => setFormProy((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del proyecto" /></div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8 }}>Color</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLORES.map((c) => <button key={c} onClick={() => setFormProy((f) => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: 4, background: c, border: formProy.color === c ? `3px solid ${C.text}` : "2px solid transparent", cursor: "pointer" }} />)}
                </div>
              </div>
            </div>'''

new_modal_proy_content = '''              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Nombre *</label><input style={inp} value={formProy.nombre} onChange={(e) => setFormProy((f) => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del proyecto" /></div>
              <div><label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 4 }}>Vincular a presupuesto (opcional)</label>
                <select style={inp} value={formProy.presupuesto_id || ""} onChange={(e) => {
                  const pid = e.target.value ? parseInt(e.target.value) : null;
                  const pres = presupuestos.find(p => p.id === pid);
                  setFormProy((f) => ({ ...f, presupuesto_id: pid, nombre: pid && !f.nombre ? (pres?.nombre_obra || f.nombre) : f.nombre }));
                }}>
                  <option value="">Sin presupuesto</option>
                  {presupuestos.map((p) => <option key={p.id} value={p.id}>{p.nombre_obra}{p.cliente_nombre ? ` — ${p.cliente_nombre}` : ""}</option>)}
                </select></div>
              <div>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 8 }}>Color</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {COLORES.map((c) => <button key={c} onClick={() => setFormProy((f) => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: 4, background: c, border: formProy.color === c ? `3px solid ${C.text}` : "2px solid transparent", cursor: "pointer" }} />)}
                </div>
              </div>
            </div>'''

if old_modal_proy_content in planner:
    planner = planner.replace(old_modal_proy_content, new_modal_proy_content, 1)
    print("Added presupuesto selector to ModalProyecto")

with open(planner_path, 'w', encoding='utf-8') as f:
    f.write(planner)
print(f"Planner.jsx updated ({len(planner)} chars)")
