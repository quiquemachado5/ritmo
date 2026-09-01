"use client";

import { Plane, X } from "lucide-react";
import { guardarModoViaje, useModoViaje } from "@/lib/travel-mode";
import { useRitmo } from "@/lib/store/provider";

export function TravelBanner() {
  const { userId } = useRitmo();
  const viaje = useModoViaje(userId);
  if (!viaje.activo) return null;
  return <div className="border-b border-habit-border bg-habit-wash px-4 py-2 text-habit-ink md:pl-64"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-medium"><Plane className="size-3.5" />{viaje.etiqueta}{viaje.hasta ? ` · hasta ${viaje.hasta}` : " · modo contextual activo"}</span><button type="button" onClick={() => guardarModoViaje({ ...viaje, activo: false }, userId)} aria-label="Finalizar modo viaje" className="grid size-11 place-items-center rounded-full hover:bg-habit/10 md:size-8"><X className="size-3.5" /></button></div></div>;
}
