// Normalización para búsquedas: ignora mayúsculas, acentos/tildes y espacios
// de más. Así "mamposteria" encuentra "Mampostería", "durlock" → "Durlock", etc.
export const norm = (s) =>
  (s == null ? "" : String(s))
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

// ¿El texto contiene la búsqueda? (tolerante a acentos y mayúsculas)
export const coincide = (texto, busqueda) => norm(texto).includes(norm(busqueda));
