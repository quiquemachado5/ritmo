import type { Composicion, Dia, Perfil } from "@/lib/model/types";

export interface StoreData {
  perfil: Perfil;
  dias: Record<string, Dia>;
  composicion: Composicion[];
}

export type Modo = "nube" | "local";
export type TipoRegistro = "dia" | "medicion" | "perfil";
/** null exige ausencia del registro; undefined usa la revisión del adaptador. */
export interface CondicionEscritura { revisionEsperada?: string | null }

/** Contrato común de persistencia. Idéntico para local y para la nube. */
export interface Adapter {
  hydrationSource?: "cloud" | "backup";
  load(): Promise<StoreData>;
  /** undefined: aún no leído; null: ausencia comprobada; string: revisión. */
  revisionActual?(tipo: TipoRegistro, fecha?: string): string | null | undefined;
  guardarDia(dia: Dia, condicion?: CondicionEscritura): Promise<void>;
  borrarDia(fecha: string, condicion?: CondicionEscritura): Promise<void>;
  guardarMedicion(m: Composicion, condicion?: CondicionEscritura): Promise<void>;
  borrarMedicion(fecha: string, condicion?: CondicionEscritura): Promise<void>;
  guardarPerfil(perfil: Perfil, condicion?: CondicionEscritura): Promise<void>;
  borrarTodo?(): Promise<void>;
  /** Sube en bloque (migración / importación). */
  sembrar?(data: StoreData): Promise<void>;
  /** Cambios llegados de otra pestaña o dispositivo. */
  subscribe?(cb: () => void): () => void;
  /** Libera listeners locales al cerrar sesión o cambiar de cuenta. */
  dispose?(): void;
}
