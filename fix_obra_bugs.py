import re

# ── FIX 1: Obra.jsx — eliminar tabs y bloques duplicados ─────────────────────
with open(r"C:\obras-frontend\src\pages\Obra.jsx", "r", encoding="utf-8") as f:
    c = f.read()

# Eliminar tab duplicado (línea 272)
old_tabs = '''          <TabBtn id="certificados" label="📜 Certificados" />
          <TabBtn id="certificados" label="📜 Certificados" />'''
new_tabs = '          <TabBtn id="certificados" label="📜 Certificados" />'
if old_tabs in c:
    c = c.replace(old_tabs, new_tabs)
    print("OK tab duplicado eliminado")
else:
    print("FAIL tab dup")

# Encontrar el segundo bloque {tab === "certificados" && ( y eliminarlo
# El primero empieza en línea 515, el segundo en línea 620
marker = '{tab === "certificados" && ('
first = c.find(marker)
second = c.find(marker, first + 1)
if second > 0:
    # Encontrar el cierre del segundo bloque (buscar el )} que cierra ese if)
    # El bloque termina con "        )}\n" después de todo el contenido
    # Buscamos desde second hacia adelante el cierre del tab content
    # Estrategia: buscar el siguiente tab === que venga después, o el cierre del div principal
    end_marker = "\n      </div>\n\n      {/* \u2500\u2500 MODAL"
    end_pos = c.find(end_marker, second)
    if end_pos < 0:
        end_marker2 = "\n      </div>\n\n      {/* ── MODAL"
        end_pos = c.find(end_marker2, second)

    if end_pos > 0:
        # El segundo bloque va desde second-10 hasta end_pos
        # Encontrar inicio exacto del segundo bloque (desde la línea anterior)
        block_start = c.rfind("\n", 0, second) + 1
        # El bloque termina justo antes del end_marker
        # Pero el end_marker es parte del bloque del primer certificados también
        # Así que eliminamos desde block_start hasta el cierre )} del segundo bloque

        # Contar niveles de {} para encontrar el cierre
        depth = 0
        pos = second
        in_block = False
        block_end = -1
        for i in range(second, min(second + 10000, len(c))):
            ch = c[i]
            if ch == '{':
                depth += 1
                in_block = True
            elif ch == '}':
                depth -= 1
                if in_block and depth == 0:
                    block_end = i + 1
                    break

        if block_end > 0:
            # Incluir el newline después
            while block_end < len(c) and c[block_end] in '\n\r':
                block_end += 1
            c = c[:block_start] + c[block_end:]
            print("OK segundo bloque certificados eliminado")
        else:
            print("FAIL no encontró cierre del segundo bloque")
    else:
        print("FAIL no encontró end_marker")
else:
    print("No hay segundo bloque de certificados")

# Fix monto_periodo — el cert devuelve total_periodo no monto_periodo
c = c.replace("cert.monto_periodo", "cert.total_periodo || cert.monto_periodo")
c = c.replace("(cert.monto_periodo || 0) - montoCobrado", "(cert.total_periodo || cert.monto_periodo || 0) - montoCobrado")
c = c.replace("pendiente > 0 ? pendiente : cert.monto_periodo", "pendiente > 0 ? pendiente : (cert.total_periodo || cert.monto_periodo)")
print("OK fix campo monto_periodo → total_periodo")

with open(r"C:\obras-frontend\src\pages\Obra.jsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Obra.jsx OK\n")

# ── FIX 2: Presupuesto.js — destacar botón Obra ──────────────────────────────
with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "r", encoding="utf-8") as f:
    c = f.read()

old_obra_btn = '''                  <button className="btn btn-secondary btn-sm" style={{ borderRadius: 0, borderLeft: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)}>
                    🏗️ Obra
                  </button>'''

new_obra_btn = '''                  <button style={{ borderRadius: 0, borderLeft: '2px solid var(--accent)', padding: '4px 12px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.3)', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)}>
                    🏗️ Gestión de obra
                  </button>'''

if old_obra_btn in c:
    c = c.replace(old_obra_btn, new_obra_btn)
    print("OK botón Obra destacado en Presupuesto.js")
else:
    # Try with different spacing
    old2 = "navigate(`/cotizador/presupuesto/${id}/obra`)}\n                    >\n                    \U0001F3D7\uFE0F Obra"
    print("FAIL botón - buscando alternativa...")
    idx = c.find("/obra`)")
    if idx > 0:
        print(repr(c[idx-200:idx+50]))

with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "w", encoding="utf-8") as f:
    f.write(c)
print("Presupuesto.js OK")
