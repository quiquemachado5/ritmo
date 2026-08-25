"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";
import { useState } from "react";

const providers = [
  {
    name: "Google",
    id: "google",
    icon: "🔍",
  },
  {
    name: "GitHub",
    id: "github",
    icon: "🐙",
  },
];

export function SocialLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: "google" | "github") {
    setLoading(provider);
    setError(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${params.get("next") || "/"}`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
        },
      });

      if (oauthError) throw oauthError;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Error al conectar con el proveedor. Intenta de nuevo.");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-destructive bg-destructive/5 border border-destructive/30 p-2 rounded">
          {error}
        </div>
      )}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            variant="outline"
            onClick={() => handleOAuth(provider.id as "google" | "github")}
            disabled={loading !== null}
            className="gap-2"
          >
            {loading === provider.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <span>{provider.icon}</span>
            )}
            {provider.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
