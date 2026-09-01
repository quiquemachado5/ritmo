"use client";

import * as React from "react";
import { APP_CACHE_VERSION } from "@/lib/version";

/** Registra el service worker una vez en cliente. Silencioso: los fallos no
    deben molestar (p. ej. en desarrollo o navegadores sin soporte). */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Solo en producción: en dev el HMR y el SW se pelean.
    if (process.env.NODE_ENV !== "production") return;
    const onLoad = () => {
      navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_CACHE_VERSION)}`).catch(() => {});
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
