import policy from "../../config/nutrition.json";

/** La elección sin proveedores externos manda incluso sobre claves antiguas. */
export const EXTERNAL_NUTRITION_ENABLED = policy.externalProvidersEnabled;
