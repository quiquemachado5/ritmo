"use client";

import * as React from "react";
import type { Estado } from "@/lib/model/types";
import type { PrediccionEmitida } from "@/lib/model-audit/types";
import { evaluarCicloModelos } from "@/lib/model-audit/lifecycle";
import { useExperimentos, type ExperimentosRitmo } from "@/lib/experiments";
import { applyWeightModelMode, DEFAULT_PLATFORM_CONFIG, type PlatformConfig } from "@/lib/platform/config";

const PlatformContext = React.createContext<PlatformConfig>(DEFAULT_PLATFORM_CONFIG);

export function PlatformProvider({ config, children }: { config: PlatformConfig; children: React.ReactNode }) {
  return <PlatformContext.Provider value={config}>{children}</PlatformContext.Provider>;
}

export function usePlatformConfig() {
  return React.useContext(PlatformContext);
}

export function useReleasedExperiments(userId?: string | null): ExperimentosRitmo {
  const local = useExperimentos(userId);
  const { features } = usePlatformConfig();
  return React.useMemo(() => ({
    interfazViva: local.interfazViva && features.interfaz_viva,
    rescateAutomatico: local.rescateAutomatico && features.rescate_automatico,
    detectorAvanzado: local.detectorAvanzado && features.detector_avanzado,
    escenarios: local.escenarios && features.escenarios,
    memoriaCorporal: local.memoriaCorporal && features.memoria_corporal,
    modoInvisible: local.modoInvisible && features.modo_invisible,
  }), [features, local]);
}

export function useWeightModelCycle(estado: Estado, predictions: PrediccionEmitida[], today: string) {
  const { weightModelMode } = usePlatformConfig();
  return React.useMemo(
    () => applyWeightModelMode(evaluarCicloModelos(estado, predictions, today), weightModelMode),
    [estado, predictions, today, weightModelMode],
  );
}
