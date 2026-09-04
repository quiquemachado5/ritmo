import type { AuditoriaModelo } from "./types";
import { validarAuditoriaImportada } from "./import";

const memoria = new Map<string, AuditoriaModelo>();
const key = (userId: string) => `ritmo:model-audit:v1:${userId}`;
const vacio = (): AuditoriaModelo => ({ configuraciones: [], predicciones: [] });

export function leerAuditoriaLocal(userId: string): AuditoriaModelo {
  const conocido = memoria.get(userId);
  if (conocido) return conocido;
  if (typeof window === "undefined") return vacio();
  const raw = localStorage.getItem(key(userId));
  if (!raw) return vacio();
  const data: unknown = JSON.parse(raw);
  if (!validarAuditoriaImportada(data)) throw new Error("La copia local del historial del modelo no se puede leer. Conecta para recuperarla.");
  memoria.set(userId, data);
  return data;
}

export function guardarAuditoriaLocal(userId: string, data: AuditoriaModelo) {
  memoria.set(userId, data);
  localStorage.setItem(key(userId), JSON.stringify(data));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ritmo:model-audit", { detail: userId }));
}

export function limpiarAuditoriaLocal(userId: string) {
  memoria.delete(userId);
  localStorage.removeItem(key(userId));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ritmo:model-audit", { detail: userId }));
}
