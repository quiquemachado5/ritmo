import type { Composicion, Dia, Perfil } from "@/lib/model/types";

export interface StoreData {
  perfil: Perfil;
  dias: Record<string, Dia>;
  composicion: Composicion[];
}

export type Modo = "nube" | "local";

/** Contrato común de persistencia. Idéntico para local y para la nube. */
export interface Adapter {
  hydrationSource?: "cloud" | "backup";
  load(): Promise<StoreData>;
  guardarDia(dia: Dia): Promise<void>;
  borrarDia(fecha: string): Promise<void>;
  guardarMedicion(m: Composicion): Promise<void>;
  borrarMedicion(fecha: string): Promise<void>;
  guardarPerfil(perfil: Perfil): Promise<void>;
  borrarTodo?(): Promise<void>;
  /** Sube en bloque (migración / importación). */
  sembrar?(data: StoreData): Promise<void>;
  /** Cambios llegados de otra pestaña o dispositivo. */
  subscribe?(cb: () => void): () => void;
  /** Libera listeners locales al cerrar sesión o cambiar de cuenta. */
  dispose?(): void;
}
