"use client";

import * as React from "react";
import { AlertTriangle, Check, Cloud, CloudOff, HardDrive, LockKeyhole, RefreshCw, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { onColaCambia, type EstadoCola } from "@/lib/store/queued";

function fechaBreve(iso?: string) {
  if (!iso) return "Aún no hay envío confirmado";
  const minutos = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (minutos < 1) return "Ahora mismo";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(iso));
}

export function AccountHealth({ cloud, backupAt }: { cloud: boolean; backupAt?: string }) {
  const online = useOnlineStatus();
  const [cola, setCola] = React.useState<EstadoCola>({ pendientes: 0, requiereAtencion: false, sincronizando: false, detalles: [] });
  React.useEffect(() => onColaCambia(setCola), []);
  const necesitaAtencion = cola.requiereAtencion || !online;

  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-secondary/25">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", necesitaAtencion ? "bg-warning-wash text-warning-ink" : "bg-primary/10 text-primary")}>
            {necesitaAtencion ? <AlertTriangle className="size-4" /> : <Check className="size-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold">{necesitaAtencion ? "Revisa la conexión" : "Cuenta protegida y al día"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{cola.requiereAtencion ? "Un cambio necesita revisión" : cola.pendientes ? `${cola.pendientes} cambio${cola.pendientes > 1 ? "s" : ""} esperando` : "No hay cambios pendientes"}</p>
          </div>
        </div>
        <span className={cn("inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg px-2.5 text-xs font-semibold sm:self-auto", online ? "bg-card text-primary" : "bg-warning-wash text-warning-ink")}>
          {online ? <Cloud className="size-3.5" /> : <CloudOff className="size-3.5" />}{online ? "Con conexión" : "Sin conexión"}
        </span>
      </div>
      <div className="grid border-t border-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0 divide-border/70">
        <HealthCell icon={cola.sincronizando ? RefreshCw : Cloud} label="Sincronización" value={cloud ? fechaBreve(cola.ultimaSincronizacion) : "Solo en este dispositivo"} spin={cola.sincronizando} />
        <HealthCell icon={HardDrive} label="Copia local" value={backupAt ? fechaBreve(backupAt) : "Pendiente de crear"} />
        <HealthCell icon={LockKeyhole} label="Privacidad" value="Datos de salud privados" />
      </div>
    </div>
  );
}

function HealthCell({ icon: Icon, label, value, spin = false }: { icon: typeof Cloud; label: string; value: string; spin?: boolean }) {
  return <div className="flex min-w-0 items-center gap-2.5 border-t border-border/70 px-4 py-3 first:border-t-0 sm:border-t-0">
    <Icon className={cn("size-4 shrink-0 text-primary", spin && "motion-safe:animate-spin")} />
    <div className="min-w-0"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-xs font-medium">{value}</p></div>
  </div>;
}

export function PrivacyMap({ externalNutrition }: { externalNutrition: boolean }) {
  const pasos = [
    { icon: HardDrive, title: "Este dispositivo", detail: "Borradores, preferencias y copia de rescate" },
    { icon: Cloud, title: "Tu cuenta RITMO", detail: "Perfil, días, comidas y mediciones" },
    { icon: Route, title: "Servicios externos", detail: externalNutrition ? "Solo la descripción que decides analizar" : "Ningún dato nutricional sale de RITMO" },
  ];
  return <div className="overflow-hidden rounded-xl border border-border/80" aria-label="Ruta de tus datos">
    <div className="grid sm:grid-cols-3">
      {pasos.map(({ icon: Icon, title, detail }, index) => <div key={title} className="relative border-b border-border/70 px-4 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
        <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/9 text-primary"><Icon className="size-3.5" /></span><p className="text-xs font-semibold">{title}</p></div>
        <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">{detail}</p>
        {index < pasos.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden size-4 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-[0.55rem] text-muted-foreground sm:grid">→</span>}
      </div>)}
    </div>
  </div>;
}
