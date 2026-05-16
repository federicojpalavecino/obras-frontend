"""
fix_app_footer_soporte.py
Agrega al menú principal:
- Footer con derechos reservados
- Módulo de soporte técnico con mail y WhatsApp
"""

path = r'C:\obras-frontend\src\App.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add soporte to modules list
old_modules = '''    { id:"config", path:"/config", icon:"⚙️", label:"Configuración", desc:"Logo, nombre y datos del estudio", color:C.muted },
  ];'''

new_modules = '''    { id:"config", path:"/config", icon:"⚙️", label:"Configuración", desc:"Logo, nombre y datos del estudio", color:C.muted },
    { id:"soporte", path:"/soporte", icon:"💬", label:"Soporte técnico", desc:"Contacto, ayuda y sugerencias", color:C.blue },
  ];'''

content = content.replace(old_modules, new_modules, 1)

# 2. Add footer and soporte route to the home screen
old_home_end = '''            </div>
          </div>
        }/>'''

new_home_end = '''            </div>

            {/* Footer */}
            <div style={{marginTop:"clamp(32px, 6vw, 48px)", paddingTop:20, borderTop:"1px solid " + C.border, textAlign:"center"}}>
              <div style={{fontSize:11, color:C.muted, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.5px"}}>
                © 2026 FAIM OBRAS · by FIMA Arquitectura · Todos los derechos reservados
              </div>
            </div>
          </div>
        }/>
        <Route path="/soporte" element={<PaginaSoporte />}/>'''

content = content.replace(old_home_end, new_home_end, 1)

# 3. Add PaginaSoporte component before AppInner
soporte_component = '''// ── Soporte técnico ──────────────────────────────────────────────────────────
function PaginaSoporte() {
  const MAIL = "faimobras@gmail.com";
  const WHATSAPP = "5493625305155";
  const WHATSAPP_MSG = encodeURIComponent("Hola, tengo una consulta sobre FAIM OBRAS.");

  return (
    <div style={{maxWidth:600, margin:"0 auto", padding:"clamp(24px, 5vw, 48px) clamp(16px, 4vw, 24px)", fontFamily:"'Syne', sans-serif"}}>
      <div style={{marginBottom:28}}>
        <div style={{fontSize:"clamp(20px, 5vw, 26px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:6}}>Soporte técnico</div>
        <div style={{fontSize:14, color:"#6b7280"}}>Contactanos por cualquier problema, pregunta o sugerencia.</div>
      </div>

      {/* Tarjetas de contacto */}
      <div style={{display:"flex", flexDirection:"column", gap:12, marginBottom:32}}>

        {/* WhatsApp */}
        <a href={"https://wa.me/" + WHATSAPP + "?text=" + WHATSAPP_MSG} target="_blank" rel="noreferrer"
          style={{background:"#ffffff", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(16px, 4vw, 20px)", display:"flex", alignItems:"center", gap:16, textDecoration:"none", color:"#1a1a2e", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", cursor:"pointer"}}>
          <div style={{width:48, height:48, borderRadius:10, background:"#f0fdf4", border:"1px solid #bbf7d0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0}}>💬</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:3}}>WhatsApp</div>
            <div style={{fontSize:13, color:"#6b7280"}}>Respuesta rápida en horario de oficina</div>
          </div>
          <div style={{color:"#25D366", fontSize:14, fontWeight:700}}>Escribir →</div>
        </a>

        {/* Email */}
        <a href={"mailto:" + MAIL + "?subject=Soporte FAIM OBRAS"}
          style={{background:"#ffffff", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(16px, 4vw, 20px)", display:"flex", alignItems:"center", gap:16, textDecoration:"none", color:"#1a1a2e", boxShadow:"0 1px 3px rgba(0,0,0,0.06)", cursor:"pointer"}}>
          <div style={{width:48, height:48, borderRadius:10, background:"#eff6ff", border:"1px solid #bfdbfe", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0}}>✉️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:3}}>Email</div>
            <div style={{fontSize:13, color:"#6b7280"}}>{MAIL}</div>
          </div>
          <div style={{color:"#3b82f6", fontSize:14, fontWeight:700}}>Enviar →</div>
        </a>
      </div>

      {/* Info */}
      <div style={{background:"#f8f9fa", border:"1px solid #e0e0e8", borderRadius:12, padding:"clamp(14px, 3vw, 20px)"}}>
        <div style={{fontSize:13, fontWeight:700, marginBottom:12, color:"#1a1a2e"}}>Preguntas frecuentes</div>
        {[
          ["¿Cómo agrego un presupuesto?", "Desde el Cotizador → botón '+ Nuevo presupuesto'."],
          ["¿Cómo actualizo precios del catálogo?", "Desde Cotizador → Materiales, Mano de obra o Maquinaria."],
          ["¿Cómo agrego usuarios al estudio?", "Desde Configuración → Usuarios del estudio."],
          ["¿Cómo accede mi cliente al portal?", "Desde Accesos de clientes → Nuevo acceso."],
        ].map(([q, a]) => (
          <div key={q} style={{marginBottom:12, paddingBottom:12, borderBottom:"1px solid #e0e0e8"}}>
            <div style={{fontSize:13, fontWeight:600, marginBottom:3}}>{q}</div>
            <div style={{fontSize:12, color:"#6b7280"}}>{a}</div>
          </div>
        ))}
        <div style={{fontSize:11, color:"#9ca3af", marginTop:4}}>¿No encontrás lo que buscás? Escribinos.</div>
      </div>

      {/* Footer */}
      <div style={{marginTop:32, textAlign:"center", fontSize:11, color:"#9ca3af", fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.5px"}}>
        © 2026 FAIM OBRAS · by FIMA Arquitectura · Todos los derechos reservados
      </div>
    </div>
  );
}

'''

old_appinner = '// ── Main app (identical to FIMA) ──────────────────────────────────────────────'
content = content.replace(old_appinner, soporte_component + old_appinner, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done: footer + soporte added to App.js")
print("IMPORTANTE: reemplazar el número de WhatsApp en PaginaSoporte (WHATSAPP = ...)")
