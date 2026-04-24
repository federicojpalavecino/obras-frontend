import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const sb = createClient('https://bomxksdisszrhhsctowd.supabase.co','sb_publishable_mMVi2QnQ2kHRY6nwCeg4lQ_aOG9Kvg2');

const C = {
  bg:'#f8f9fa', surface:'#ffffff', surface2:'#f1f3f5',
  border:'#e0e0e8', border2:'#d0d0dc',
  text:'#1a1a2e', muted:'#6b7280',
  accent:'#059669', red:'#ef4444',
};

const inp = {
  background: C.surface2, border: `1px solid ${C.border2}`, borderRadius: 8,
  color: C.text, padding: '8px 12px', fontSize: 13, fontFamily: 'inherit',
  width: '100%', outline: 'none', boxSizing: 'border-box',
};

const COLORES = ['#6ee7b7','#a78bfa','#38bdf8','#fbbf24','#f87171','#fb923c','#e879f9','#a3e635'];

export default function GestorProyectos({ onClose }) {
  const [proyectos, setProyectos] = useState([]);
  const [form, setForm] = useState({ nombre: '', cliente: '', color: COLORES[0] });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => { cargar(); }, []);

  const cargar = async () => {
    const { data } = await sb.from('proyectos').select('*').order('nombre');
    if (data) setProyectos(data);
  };

  const agregar = async () => {
    if (!form.nombre) return;
    await sb.from('proyectos').insert({ ...form });
    setForm({ nombre: '', cliente: '', color: COLORES[0] });
    cargar();
  };

  const guardarEdit = async (id) => {
    await sb.from('proyectos').update(editForm).eq('id', id);
    setEditId(null);
    cargar();
  };

  const toggleActivo = async (p) => {
    await sb.from('proyectos').update({ activo: !p.activo }).eq('id', p.id);
    cargar();
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar proyecto?')) return;
    await sb.from('proyectos').delete().eq('id', id);
    cargar();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.surface, borderRadius: 16, padding: 24, maxWidth: 560, width: '100%', maxHeight: '85vh', overflow: 'auto', border: `1px solid ${C.border2}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Proyectos / Obras</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 22 }}>×</button>
        </div>

        {/* Lista */}
        <div style={{ marginBottom: 20 }}>
          {proyectos.length === 0 && <div style={{ textAlign: 'center', color: C.muted, padding: 20, fontSize: 13 }}>Sin proyectos aún</div>}
          {proyectos.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${C.border2}` }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: p.color || C.accent, flexShrink: 0 }} />
              {editId === p.id ? (
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input style={{ ...inp, padding: '5px 8px' }} value={editForm.nombre || ''} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre" />
                  <input style={{ ...inp, padding: '5px 8px' }} value={editForm.cliente || ''} onChange={e => setEditForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Cliente" />
                </div>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: p.activo ? C.text : C.muted }}>{p.nombre}</div>
                  {p.cliente && <div style={{ fontSize: 11, color: C.muted }}>{p.cliente}</div>}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {editId === p.id ? (
                  <>
                    <button onClick={() => guardarEdit(p.id)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.accent}`, background: 'transparent', color: C.accent, cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setEditId(null)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>×</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(p.id); setEditForm({ nombre: p.nombre, cliente: p.cliente }); }}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.muted, cursor: 'pointer' }}>Editar</button>
                    <button onClick={() => toggleActivo(p)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: p.activo ? C.accent : C.muted, cursor: 'pointer' }}>
                      {p.activo ? 'Activo' : 'Inactivo'}
                    </button>
                    <button onClick={() => eliminar(p.id)}
                      style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(248,113,113,.3)', background: 'transparent', color: C.red, cursor: 'pointer' }}>×</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Nuevo */}
        <div style={{ borderTop: `1px solid ${C.border2}`, paddingTop: 16 }}>
          <div style={{ fontSize: 10, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Nuevo proyecto</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Nombre *</label>
              <input style={inp} value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre del proyecto" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 4 }}>Cliente</label>
              <input style={inp} value={form.cliente} onChange={e => setForm(f => ({ ...f, cliente: e.target.value }))} placeholder="Nombre del cliente" />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.muted, display: 'block', marginBottom: 6 }}>Color</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {COLORES.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: 24, height: 24, borderRadius: 4, background: c, border: form.color === c ? `3px solid ${C.text}` : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>
          <button onClick={agregar} disabled={!form.nombre}
            style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: C.accent, color: '#ffffff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: !form.nombre ? .5 : 1 }}>
            + Agregar proyecto
          </button>
        </div>
      </div>
    </div>
  );
}
