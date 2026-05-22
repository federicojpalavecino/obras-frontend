with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "r", encoding="utf-8") as f:
    c = f.read()

# Desktop
old1 = "navigate(`/cotizador/presupuesto/${id}/materiales`)}"
suffix1 = ">\n                    \U0001F4E6 Mat.\n                  </button>\n                </div>"
new_suffix1 = ">\n                    \U0001F4E6 Mat.\n                  </button>\n                  <button className=\"btn btn-secondary btn-sm\" style={{ borderRadius: 0, borderLeft: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)}>\n                    \U0001F3D7\uFE0F Obra\n                  </button>\n                </div>"

target1 = old1 + suffix1
if target1 in c:
    c = c.replace(target1, old1 + new_suffix1)
    print("OK desktop")
else:
    # Try with \r\n
    suffix1b = ">\r\n                    \U0001F4E6 Mat.\r\n                  </button>\r\n                </div>"
    new_suffix1b = ">\r\n                    \U0001F4E6 Mat.\r\n                  </button>\r\n                  <button className=\"btn btn-secondary btn-sm\" style={{ borderRadius: 0, borderLeft: '1px solid var(--border2)' }} onClick={() => navigate(`/cotizador/presupuesto/${id}/obra`)}>\r\n                    \U0001F3D7\uFE0F Obra\r\n                  </button>\r\n                </div>"
    target1b = old1 + suffix1b
    if target1b in c:
        c = c.replace(target1b, old1 + new_suffix1b)
        print("OK desktop (CRLF)")
    else:
        print("FAIL desktop - buscando contexto:")
        idx = c.find("materiales`)")
        if idx >= 0:
            print(repr(c[idx:idx+150]))

# Mobile
old_mob = "{ label: 'Listado de materiales', icon: '\U0001F4E6', onClick: () => navigate(`/cotizador/presupuesto/${id}/materiales`) },"
new_mob = old_mob + "\n                { label: 'Gesti\u00f3n de obra', icon: '\U0001F3D7\uFE0F', onClick: () => navigate(`/cotizador/presupuesto/${id}/obra`) },"

if old_mob in c:
    c = c.replace(old_mob, new_mob)
    print("OK mobile")
else:
    print("FAIL mobile")

with open(r"C:\obras-frontend\src\cotizador\pages\Presupuesto.js", "w", encoding="utf-8") as f:
    f.write(c)

print("Done")
