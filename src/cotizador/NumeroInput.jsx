import React from 'react';
import { parseNum } from './num';

// Formatea con separador de miles (.) y decimal (,) al estilo argentino.
// "1000000" -> "1.000.000" · "1234,5" -> "1.234,5"
export function formatMiles(raw) {
  let s = String(raw ?? '');
  // Si todavía no hay coma, un punto seguido de 0, 1 o 2 dígitos es casi
  // siempre el separador decimal que alguien tipeó con el punto del teclado
  // numérico (muy común en celular) — una agrupación de miles real siempre
  // viene de a 3 dígitos exactos. Sin este ajuste ese punto se borraba solo
  // más abajo y el importe terminaba mil veces más chico o más grande sin
  // que se note ("1234.56" pasaba a valer 123.456, no 1234,56).
  if (!s.includes(',')) {
    const ult = s.lastIndexOf('.');
    if (ult > -1) {
      const tras = s.slice(ult + 1).replace(/\D/g, '');
      if (tras.length <= 2) s = s.slice(0, ult).replace(/\./g, '') + ',' + tras;
    }
  }
  s = s.replace(/[^\d,]/g, '');
  const i = s.indexOf(',');
  let ent, dec;
  if (i >= 0) {
    ent = s.slice(0, i).replace(/\D/g, '');
    dec = ',' + s.slice(i + 1).replace(/\D/g, '').slice(0, 2);
  } else {
    ent = s.replace(/\D/g, '');
    dec = '';
  }
  ent = ent.replace(/^0+(?=\d)/, '');           // sin ceros a la izquierda
  ent = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // puntos de miles
  return ent + dec;
}

// Campo numérico controlado que muestra los miles con puntos automáticamente.
// onChange recibe el VALOR NUMÉRICO (number). Acepta tipear con coma o punto.
export default function NumeroInput({ value, onChange, style, className, placeholder, disabled, ...rest }) {
  const desdeValor = (v) => (v === '' || v == null || Number.isNaN(v)) ? '' : formatMiles(String(v).replace('.', ','));
  const [disp, setDisp] = React.useState(() => desdeValor(value));

  React.useEffect(() => {
    // Si el valor externo cambió y no coincide con lo mostrado, resincronizar
    const ext = (value === '' || value == null) ? '' : value;
    if (ext === '' && disp !== '') { setDisp(''); return; }
    if (ext !== '' && parseNum(disp) !== Number(ext)) setDisp(desdeValor(ext));
  }, [value]); // eslint-disable-line

  const handle = (e) => {
    const f = formatMiles(e.target.value);
    setDisp(f);
    onChange(parseNum(f));
  };

  return (
    <input type="text" inputMode="decimal" value={disp} onChange={handle}
      style={style} className={className} placeholder={placeholder} disabled={disabled} {...rest} />
  );
}
