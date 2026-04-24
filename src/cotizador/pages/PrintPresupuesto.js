import React from 'react';

const fmt = (n) => {
  if (!n && n !== 0) return '—';
  if (n === 0) return '$ 0';
  return '$ ' + Math.round(n).toLocaleString('es-AR');
};

const fmtPct = (n) => n != null ? n.toFixed(1) + '%' : '—';

export default function PrintPresupuesto({ data, modo }) {
  if (!data) return null;
  const { totales, coeficientes, rubros } = data;
  const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  const cerrado = data.estado === 'cerrado';
  const esComercial = modo === 'comercial';

  return (
    <div className="print-container" style={{ background: 'white', color: '#111', fontFamily: 'Arial, sans-serif' }}>

      {/* ENCABEZADO */}
      <div className="print-header">
        <div className="print-header-top">
          <div>
            <div className="print-empresa">Fima Arquitectura</div>
            <div className="print-titulo">
              {esComercial ? 'Presupuesto' : 'Presupuesto de ejecución (uso interno)'}
            </div>
          </div>
          <div className="print-fecha">
            <div>Resistencia, {hoy}</div>
            {cerrado && data.fecha_cierre && (
              <div style={{ marginTop: 4, fontSize: 9, color: '#888' }}>
                Cerrado: {new Date(data.fecha_cierre).toLocaleDateString('es-AR')}
              </div>
            )}
          </div>
        </div>
        <div className="print-datos">
          <strong>Obra:</strong> {data.nombre_obra}
          {data.ubicacion && <> &nbsp;·&nbsp; <strong>Ubicación:</strong> {data.ubicacion}</>}
        </div>
      </div>

      {/* TABLA */}
      <table className="print-table">
        <thead>
          <tr>
            {!esComercial && <th style={{ width: 50 }}>Cód.</th>}
            <th>Ítem</th>
            <th style={{ width: 50, textAlign: 'center' }}>Unid.</th>
            <th className="right" style={{ width: 55 }}>Cant.</th>
            {!esComercial && <>
              <th className="right" style={{ width: 90 }}>Mat × Cant</th>
              <th className="right" style={{ width: 90 }}>MO × Cant</th>
              <th className="right" style={{ width: 80 }}>Maq × Cant</th>
              <th className="right" style={{ width: 95 }}>Total Ejec</th>
            </>}
            <th className="right" style={{ width: 100 }}>P. Unitario</th>
            <th className="right" style={{ width: 110 }}>Total</th>
            {!esComercial && <th className="right" style={{ width: 45 }}>%</th>}
          </tr>
        </thead>
        <tbody>
          {rubros?.map(rubro => (
            <React.Fragment key={rubro.numero}>
              <tr className="print-row-rubro">
                <td colSpan={esComercial ? 6 : 11}>{rubro.numero} — {rubro.nombre}</td>
              </tr>
              {rubro.lineas?.map(linea => {
                const precioUnitario = linea.cantidad > 0
                  ? linea.precio_venta_con_iva / linea.cantidad
                  : linea.precio_venta_con_iva;
                return (
                  <tr key={linea.id} className="print-row-item">
                    {!esComercial && <td className="print-code">{linea.tipo === 'libre' ? '—' : linea.item_obra_id}</td>}
                    <td>
                      {linea.nombre_item || linea.nombre_libre}
                      {linea.tipo === 'libre' && !esComercial && <span style={{ fontSize: 8, color: '#888', marginLeft: 4 }}>(subcontrato)</span>}
                    </td>
                    <td style={{ textAlign: 'center', color: '#666' }}>{linea.unidad_item || linea.unidad_libre}</td>
                    <td className="print-num">{linea.cantidad}</td>
                    {!esComercial && <>
                      <td className="print-num">{linea.costo_mat ? fmt(linea.costo_mat) : '—'}</td>
                      <td className="print-num">{linea.costo_mo ? fmt(linea.costo_mo) : '—'}</td>
                      <td className="print-num">{linea.costo_maq ? fmt(linea.costo_maq) : '—'}</td>
                      <td className="print-num print-col-ejec">{fmt(linea.total_ejecucion)}</td>
                    </>}
                    <td className="print-num print-col-precio">{fmt(precioUnitario)}</td>
                    <td className="print-num print-col-precio" style={{ fontWeight: 700 }}>{fmt(linea.precio_venta_con_iva)}</td>
                    {!esComercial && (
                      <td className="print-num" style={{ color: '#888' }}>
                        {totales?.total_precio_con_iva > 0
                          ? fmtPct(linea.precio_venta_con_iva / totales.total_precio_con_iva * 100)
                          : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
              <tr className="print-row-subtotal">
                <td colSpan={esComercial ? 4 : 8} style={{ color: '#666', fontSize: 9 }}>
                  Subtotal {rubro.numero} — {rubro.nombre}
                </td>
                {!esComercial && <td className="print-num print-col-ejec">{fmt(rubro.subtotal_ejecucion)}</td>}
                <td></td>
                <td className="print-num print-col-precio">{fmt(rubro.subtotal_precio)}</td>
                {!esComercial && <td></td>}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>

      {/* TOTALES */}
      <div className="print-totales">
        <div className="print-totales-header">
          {esComercial ? 'Total del presupuesto' : 'Resumen económico'}
        </div>
        <div className="print-totales-body">
          {!esComercial && (
            <>
              <div className="print-total-block">
                <div className="print-total-label">Costo ejecución</div>
                <div className="print-total-val print-total-ejec">{fmt(totales?.total_ejecucion)}</div>
              </div>
              <div className="print-total-block">
                <div className="print-total-label">Margen</div>
                <div className="print-total-val print-total-margen">{fmtPct(totales?.margen_pct)}</div>
              </div>
            </>
          )}
          <div className="print-total-block">
            <div className="print-total-label">Subtotal s/IVA</div>
            <div className="print-total-val print-total-precio">{fmt(totales?.total_precio_sin_iva)}</div>
          </div>
          <div className="print-total-block">
            <div className="print-total-label">IVA ({coeficientes?.iva_porcentaje}%)</div>
            <div className="print-total-val" style={{ color: '#555' }}>{fmt(totales?.total_iva)}</div>
          </div>
          <div className="print-total-block">
            <div className="print-total-label">TOTAL</div>
            <div className="print-total-val print-total-precio" style={{ fontSize: 20 }}>{fmt(totales?.total_precio_con_iva)}</div>
          </div>
        </div>
      </div>

      {/* COEFICIENTES — solo versión interna */}
      {!esComercial && (
        <div className="print-coefs">
          <span style={{ fontWeight: 700, color: '#333' }}>Coeficientes:</span>
          {[
            ['K Mat', coeficientes?.k_materiales],
            ['K MO', coeficientes?.k_mano_obra],
            ['K Maq', coeficientes?.k_maquinaria],
            ['GG', coeficientes?.gg_porcentaje + '%'],
            ['Beneficios', coeficientes?.ben_porcentaje + '%'],
            ['Coef GG+BEN', totales?.coef_gg_ben?.toFixed(4)],
            ['IVA', coeficientes?.iva_porcentaje + '%'],
          ].map(([l, v]) => (
            <span key={l} className="print-coef-item">
              <span className="print-coef-label">{l}:</span>
              <span className="print-coef-val">{v}</span>
            </span>
          ))}
        </div>
      )}

      {/* FIRMA — solo versión comercial */}
      {esComercial && (
        <div style={{ marginTop: 48, display: 'flex', justifyContent: 'flex-end', background: 'white' }}>
          <div style={{ textAlign: 'center', width: 200, background: 'white' }}>
            <div style={{ borderTop: '1px solid #333', paddingTop: 8, fontSize: 10, color: '#555', background: 'white' }}>
              Firma y sello
            </div>
          </div>
        </div>
      )}

      {/* PIE */}
      <div className="print-footer" style={{ background: 'white', color: '#888' }}>
        <span>Fima Arquitectura — {hoy}</span>
        <span>{data.nombre_obra}{data.ubicacion ? ` · ${data.ubicacion}` : ''}</span>
      </div>
    </div>
  );
}
