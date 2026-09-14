import versions from "@/config/versions.json";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RuntimeStatus = { databaseVersion?: unknown; nutritionEngine?: unknown };

export async function GET() {
  const build = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("ritmo_public_runtime_status");
    const runtime = data && typeof data === "object" ? data as RuntimeStatus : null;
    const databaseReady = !error && runtime?.databaseVersion === versions.databaseMigration;

    return Response.json({
      status: databaseReady ? "ok" : "degraded",
      service: "ritmo",
      build,
      database: databaseReady ? "ready" : "migration-required",
      nutrition: runtime?.nutritionEngine === false ? "paused" : "ready",
    }, {
      status: databaseReady ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return Response.json({ status: "degraded", service: "ritmo", build, database: "unavailable", nutrition: "unknown" }, {
      status: 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
