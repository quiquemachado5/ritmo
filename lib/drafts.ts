export interface BorradorComida { texto: string; tipo: "desayuno" | "comida" | "cena" | "snack"; at: number }
const prefijo = "ritmo:draft:";
export function claveBorrador(userId: string, fecha: string, id = "nueva") { return `${prefijo}${userId}:${fecha}:${id}`; }
export function leerBorrador(key: string): BorradorComida | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (typeof d.texto !== "string" || d.texto.length > 2500 || !["desayuno", "comida", "cena", "snack"].includes(d.tipo) || !Number.isFinite(d.at) || Date.now() - d.at > 7 * 86400000) return null;
    return d;
  } catch { return null; }
}
export function guardarBorrador(key: string, value: Omit<BorradorComida, "at">) {
  try {
    if (!value.texto.trim()) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }));
  } catch { /* El borrador es auxiliar; el guardado definitivo sí informa del fallo. */ }
}
export function quitarBorrador(key: string) { try { localStorage.removeItem(key); } catch {} }
export function limpiarBorradores(userId: string) {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(`${prefijo}${userId}:`)) localStorage.removeItem(key);
  } catch {}
}
