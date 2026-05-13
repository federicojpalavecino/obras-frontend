path = r'C:\obras-frontend\src\cotizador\pages\Certificado.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix disabled condition - also enable if gastosExtra has items
old1 = '''                <button className="btn btn-secondary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  💾 Guardar
                </button>
                <button className="btn btn-primary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    imprimirCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  🖨 Guardar e imprimir
                </button>'''

new1 = '''                <button className="btn btn-secondary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0 && gastosExtra.length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  💾 Guardar
                </button>
                <button className="btn btn-primary"
                  disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0 && gastosExtra.length === 0}
                  onClick={async () => {
                    const sel = [...egresos.filter(e => egresosSeleccion[e._key]), ...gastosExtra];
                    const total = sel.reduce((a,b)=>a+(parseFloat(b.monto)||0),0);
                    await guardarCertEgresos(sel, total, egresosVinculadoNum);
                    imprimirCertEgresos(sel, total, egresosVinculadoNum);
                    setShowEgresos(false);
                    setEgresosSeleccion({});
                    setGastosExtra([]);
                  }}>
                  🖨 Guardar e imprimir
                </button>'''

if old1 in content:
    content = content.replace(old1, new1)
    print("Fixed button disabled condition")
else:
    # Try with \r\n
    old1_win = old1.replace('\n', '\r\n')
    if old1_win in content:
        content = content.replace(old1_win, new1)
        print("Fixed button disabled condition (Windows line endings)")
    else:
        # Generic fix
        content = content.replace(
            'disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0}',
            'disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0 && gastosExtra.length === 0}'
        )
        count = content.count('disabled={Object.values(egresosSeleccion).filter(Boolean).length === 0 && gastosExtra.length === 0}')
        print(f"Applied generic fix: {count} occurrences replaced")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
