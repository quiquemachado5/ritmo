import type { ConfiguracionModeloVersion } from "../model/types";

export interface PrediccionEmitida {
  id: string;
  emitidaEn: string;
  fechaEmision: string;
  fechaObjetivo: string;
  horizonteDias: 1 | 3 | 7 | 30;
  peso: number;
  minimo: number;
  maximo: number;
  pesoBase: number;
  fechaBase: string;
  versionModelo: string;
  configuracionId: string;
  diasUtilizados: number;
  pesajesUtilizados: number;
}

export interface AuditoriaModelo {
  configuraciones: ConfiguracionModeloVersion[];
  predicciones: PrediccionEmitida[];
}

export interface ResultadoPrediccion extends PrediccionEmitida {
  pesoReal: number;
  errorKg: number;
  errorFirmadoKg: number;
  dentroIntervalo: boolean;
}
