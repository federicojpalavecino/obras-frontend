// Parseo robusto de números/montos: acepta coma o punto como separador decimal.
// "1234,56" → 1234.56 · "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "1,5" → 1.5
export function parseNum(v) {
  if (v == null) return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  let s = String(v).trim().replace(/\s/g, "").replace(/[^0-9.,-]/g, "");
  if (!s || s === "-" || s === "." || s === ",") return 0;
  const lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
  if (lc > -1 && ld > -1) {
    // el último separador que aparece es el decimal; el otro es de miles
    if (lc > ld) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lc > -1) {
    // solo coma → es el decimal
    s = s.replace(",", ".");
  }
  // solo punto o sin separador → parseFloat directo
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
