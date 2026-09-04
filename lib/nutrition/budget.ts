import { createClient } from "@supabase/supabase-js";
import type { AnalisisNutricional } from "./types";
import { EXTERNAL_NUTRITION_ENABLED } from "./policy";

export type NutritionClaim = { status: "go"; lease: string } | { status: "cached"; result: AnalisisNutricional }
  | { status: "disabled" | "ineligible" | "limited" | "busy" | "unavailable" };
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(5000) }) } });
}
export async function claimNutrition(userId: string, hash: string): Promise<NutritionClaim> {
  if (!EXTERNAL_NUTRITION_ENABLED || process.env.NUTRITION_AI_ENABLED !== "true") return { status: "disabled" };
  const db = admin();
  if (!db) return { status: "unavailable" };
  try {
    const { data, error } = await db.rpc("claim_nutrition_request", { p_user: userId, p_hash: hash });
    if (error || !data || !["go", "cached", "disabled", "ineligible", "limited", "busy"].includes(data.status)) return { status: "unavailable" };
    return data as NutritionClaim;
  } catch { return { status: "unavailable" }; }
}
export async function finishNutrition(userId: string, hash: string, lease: string, result: AnalisisNutricional) {
  const db = admin();
  if (!db) return;
  const { error } = await db.from("nutrition_requests").update({ result, expires_at: new Date(Date.now() + 10 * 60000).toISOString() })
    .eq("user_id", userId).eq("hash", hash).eq("lease", lease);
  if (error) throw new Error("nutrition_cache_write_failed");
}
