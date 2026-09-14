import type { CicloModelo } from "@/lib/model-audit/lifecycle";
import { VERSION_MODELO_CANDIDATO, VERSION_MODELO_ESTABLE } from "@/lib/model-audit/lifecycle";

export const FEATURE_KEYS = [
  "interfaz_viva",
  "rescate_automatico",
  "detector_avanzado",
  "escenarios",
  "memoria_corporal",
  "modo_invisible",
  "nutrition_engine",
  "nutrition_memory",
  "fluid_context",
  "data_health",
] as const;

export type FeatureKey = typeof FEATURE_KEYS[number];
export type WeightModelMode = "automatic" | "stable" | "candidate";

export interface PlatformConfig {
  features: Record<FeatureKey, boolean>;
  weightModelMode: WeightModelMode;
  announcement: string | null;
  updatedAt: string | null;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformConfig = {
  features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, true])) as Record<FeatureKey, boolean>,
  weightModelMode: "automatic",
  announcement: null,
  updatedAt: null,
};

export function normalizePlatformConfig(value: unknown): PlatformConfig {
  if (!value || typeof value !== "object") return DEFAULT_PLATFORM_CONFIG;
  const raw = value as Record<string, unknown>;
  const flags = raw.features && typeof raw.features === "object" ? raw.features as Record<string, unknown> : {};
  const mode = raw.weightModelMode;
  return {
    features: Object.fromEntries(FEATURE_KEYS.map((key) => [key, flags[key] !== false])) as Record<FeatureKey, boolean>,
    weightModelMode: mode === "stable" || mode === "candidate" ? mode : "automatic",
    announcement: typeof raw.announcement === "string" && raw.announcement.trim() ? raw.announcement.trim() : null,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function applyWeightModelMode(cycle: CicloModelo, mode: WeightModelMode): CicloModelo {
  if (mode === "automatic") return cycle;
  if (mode === "candidate") return {
    ...cycle,
    estado: "activo",
    estrategia: "candidata-conservadora",
    versionActiva: VERSION_MODELO_CANDIDATO,
    motivo: "La administración ha publicado temporalmente el modelo candidato.",
  };
  return {
    ...cycle,
    estado: cycle.estado === "revertido" ? "revertido" : "sombra",
    estrategia: "estable",
    versionActiva: VERSION_MODELO_ESTABLE,
    motivo: "La administración mantiene el modelo estable mientras se valida el candidato.",
  };
}
