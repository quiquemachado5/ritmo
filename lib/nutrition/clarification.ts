export interface AclaracionComida { pregunta: string; opciones: string[]; prefijo: string }
/** Solo pregunta por ambigüedades de alto impacto; no bloquea el registro manual. */
export function aclaracionComida(texto: string): AclaracionComida | null {
  const t = texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/aclaracion:|cantidad orientativa/.test(t)) return null;
  const aceiteConCantidad = /(?:\d+[.,]?\d*|una?|dos|tres|media)\s*(?:ml|g|gramos|cdas?|cucharadas?|cucharaditas?|cdtas?|chorritos?|pulverizaciones?)\s*(?:de\s+)?(?:aceite|aove)\b|\b(?:aceite(?: de oliva(?: virgen extra)?)?|aove)\s*(?:de\s+)?\d+[.,]?\d*\s*(?:ml|g|gramos)\b/g;
  // Una cantidad de pollo no resuelve la cantidad de aceite. Si queda alguna
  // mención sin cuantificar, preguntamos por el total para no sumarla dos veces.
  if (/\b(aceite|aove)\b/.test(t.replace(aceiteConCantidad, ""))) {
    return { pregunta: "¿Cuánto aceite has usado en total?", opciones: ["3 g", "5 g", "10 g"], prefijo: "Aclaración: cantidad total de aceite del plato" };
  }
  const salsaConCantidad = /(?:\d+[.,]?\d*|una?|dos|tres|media)\s*(?:ml|g|gramos|cdas?|cucharadas?|cucharaditas?|cdtas?)\s*(?:de\s+)?(?:mayonesa|alioli|salsa|crema)\b/g;
  if (/\b(mayonesa|alioli|salsa cremosa)\b/.test(t.replace(salsaConCantidad, ""))) {
    return { pregunta: "¿Cuánta salsa o alioli llevaba el plato?", opciones: ["10 g", "20 g", "30 g"], prefijo: "Aclaración: cantidad total de salsa del plato" };
  }
  if (/\b(grande|pequeno|pequena|mediano|mediana)\b/.test(t) && /\b(bol|plato|racion)\b/.test(t)) {
    return { pregunta: "¿Qué tamaño aproximado tenía la ración?", opciones: ["250 g", "350 g", "500 g"], prefijo: "Aclaración: peso aproximado de la ración" };
  }
  return null;
}
