path = r'C:\obras-frontend\src\cotizador\pages\Presupuesto.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the place just before ${firma} in the HTML template to add adicionales
old = '${firma}\n<footer>'
new = '''${adicionales.length > 0 ? adicionales.map(adic => {
      const adicRubros = (adic.rubros || []);
      const adicTotal = adic.totales?.total_precio_con_iva || 0;
      const adicFilas = adicRubros.map(rubro => {
        const filas = (rubro.lineas || []).map(linea => {
          const precioUnit = linea.cantidad > 0 ? linea.precio_venta_con_iva / linea.cantidad : linea.precio_venta_con_iva;
          return `<tr>
            ${!esComercial ? `<td class="cod">${linea.tipo === 'libre' ? '—' : ''}</td>` : ''}
            <td>${linea.nombre_override || linea.nombre_item || linea.nombre_libre || ''}</td>
            <td class="c">${linea.unidad_item || linea.unidad_libre || ''}</td>
            <td class="r">${linea.cantidad}</td>
            ${!esComercial ? `<td class="r">${linea.costo_mat ? fmt(linea.costo_mat) : '—'}</td><td class="r">${linea.costo_mo ? fmt(linea.costo_mo) : '—'}</td><td class="r">—</td><td class="r ejec">${fmt(linea.total_ejecucion)}</td>` : ''}
            <td class="r precio">${fmt(precioUnit)}</td>
            <td class="r precio bold">${fmt(linea.precio_venta_con_iva)}</td>
            ${!esComercial ? '<td></td>' : ''}
          </tr>`;
        }).join('');
        return `<tr class="rubro"><td colspan="${esComercial ? 6 : 11}">${rubro.numero} — ${rubro.nombre}</td></tr>${filas}`;
      }).join('');
      return `<div style="margin-top:24px;page-break-before:auto">
        <div style="font-size:11pt;font-weight:900;border-bottom:2px solid #333;padding-bottom:6px;margin-bottom:10px">${adic.nombre_obra}</div>
        <table><thead><tr>${!esComercial ? '<th>Cód.</th>' : ''}<th>Ítem</th><th class="c">Unid.</th><th class="r">Cant.</th>${!esComercial ? '<th>Mat×Cant</th><th>MO×Cant</th><th>Maq×Cant</th><th class="r">Total Ejec</th>' : ''}<th class="r">P. Unitario</th><th class="r">Total</th>${!esComercial ? '<th class="r">%</th>' : ''}</tr></thead>
        <tbody>${adicFilas}</tbody></table>
        <div class="totales"><div class="totales-h">Total Adicional</div>
        <div class="totales-b"><div class="blk"><div class="lbl">TOTAL ADICIONAL</div><div class="val precio" style="font-size:14pt">${fmt(adicTotal)}</div></div></div></div>
      </div>`;
    }).join('') : ''}
${firma}
<footer>'''

if old in content:
    content = content.replace(old, new)
    print("Fixed: adicionales added to print")
else:
    old_w = old.replace('\n', '\r\n')
    new_w = new.replace('\n', '\r\n')
    if old_w in content:
        content = content.replace(old_w, new_w)
        print("Fixed (CRLF)")
    else:
        print("ERROR: not found - trying alternate")
        # Find the firma variable and add before it in the html template
        old2 = '${firma}\r\n<footer>'
        if old2 in content:
            content = content.replace(old2, new.replace('\n', '\r\n'))
            print("Fixed alternate")
        else:
            print("Pattern not found at all")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
