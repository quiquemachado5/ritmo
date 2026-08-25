import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Public aggregate only: the RPC never exposes identities or profile data. */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ritmo_user_count");
  if (error || typeof data !== "number") return NextResponse.json({ count: null }, { status: 200 });
  return NextResponse.json({ count: data }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } });
}
