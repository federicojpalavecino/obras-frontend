// Normalización para búsquedas: ignora mayúsculas, acentos/tildes y espacios.
// Así "mamposteria" encuentra "Mampostería", "durlock" → "Durlock",
// "placadeyeso" → "placa de yeso", "yeso tabique" → "Tabique ... yeso", etc.
export const norm = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes/diacríticos
    .replace(/ñ/g, "n")              // ñ y n se tratan igual
    .replace(/\s+/g, " ")
    .trim();

const sinEspacios = (s) => norm(s).replace(/\s+/g, "");

// ¿El texto coincide con la búsqueda? Tolerante a acentos, mayúsculas,
// espacios y orden de palabras:
//  1) coincide ignorando espacios por completo ("placa de yeso" == "placadeyeso")
//  2) o cada palabra de la búsqueda aparece en el texto (orden libre)
// El catálogo abrevia: "MAMPOST. ELEVACIÓN LADRILLO 18". Quien busca escribe
// la palabra entera, "mampostería", y no encontraba nada — 17 ítems invisibles,
// y la conclusión de que el catálogo no los tiene. Si el token completo no
// aparece, se prueba con su raíz, acortando de a una letra hasta cinco. Menos
// de cinco no: ahí cualquier cosa matchea.
const tokenEnTexto = (t, tok) => {
  if (t.includes(tok)) return true;
  for (let n = tok.length - 1; n >= 5; n--) {
    if (t.includes(tok.slice(0, n))) return true;
  }
  return false;
};

export const coincide = (texto, busqueda) => {
  const t = norm(texto);
  const b = norm(busqueda);
  if (!b) return true;
  if (sinEspacios(t).includes(sinEspacios(b))) return true;
  return b.split(" ").every((tok) => tokenEnTexto(t, tok));
};
