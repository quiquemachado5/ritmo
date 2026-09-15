"use client";

import * as React from "react";
import { APP_CACHE_VERSION } from "@/lib/version";
import { Button } from "@/components/ui/button";
import { useQuickLog } from "./quick-log-provider";
import { useRitmo } from "@/lib/store/provider";
import { onColaCambia } from "@/lib/store/queued";

/** Registra el service worker una vez en cliente. Silencioso: los fallos no
    deben molestar (p. ej. en desarrollo o navegadores sin soporte). */
export function ServiceWorkerRegister() {
  const [waiting, setWaiting] = React.useState<ServiceWorker | null>(null);
  const [pendientes, setPendientes] = React.useState(0);
  const { abierto } = useQuickLog();
  const { sincronizando } = useRitmo();
  React.useEffect(() => onColaCambia(s => setPendientes(s.pendientes)), []);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Solo en producción: en dev el HMR y el SW se pelean.
    if (process.env.NODE_ENV !== "production") return;
    let live = true;
    let registration: ServiceWorkerRegistration | null = null;
    let lastCheck = 0;
    const checkForUpdate = () => {
      if (!registration || !navigator.onLine || document.visibilityState === "hidden") return;
      // Evita duplicar la comprobación cuando focus y visibilitychange llegan
      // juntos. Una sesión larga no queda anclada a una versión antigua.
      if (Date.now() - lastCheck < 30_000) return;
      lastCheck = Date.now();
      void registration.update().catch(() => {});
    };
    const onLoad = () => {
      void navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(APP_CACHE_VERSION)}`, { updateViaCache: "none" }).then(nextRegistration => {
        registration = nextRegistration;
        lastCheck = Date.now();
        if (nextRegistration.waiting && live) setWaiting(nextRegistration.waiting);
        nextRegistration.addEventListener("updatefound", () => {
          const installing = nextRegistration.installing;
          installing?.addEventListener("statechange", () => {
            if (live && installing.state === "installed" && navigator.serviceWorker.controller) setWaiting(nextRegistration.waiting);
          });
        });
      }).catch(() => {});
    };
    const onVisibility = () => { if (document.visibilityState === "visible") checkForUpdate(); };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      live = false;
      window.removeEventListener("load", onLoad);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  if (!waiting || abierto) return null;
  return <div className="fixed bottom-24 left-4 right-4 z-40 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-md sm:left-auto sm:max-w-sm md:bottom-5" role="status">
    <p className="text-sm">Hay una versión nueva de RITMO.</p>
    <Button size="sm" disabled={sincronizando || pendientes > 0} onClick={() => {
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      waiting.postMessage({ type: "ACTIVATE_UPDATE" });
    }}>{pendientes > 0 ? "Sincroniza primero" : "Actualizar"}</Button>
  </div>;
}
