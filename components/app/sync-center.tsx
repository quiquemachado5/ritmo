"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { onColaCambia, reintentarCola, type EstadoCola } from "@/lib/store/queued";
import { capitalizar, fmtFechaCorta } from "@/lib/format";

const EMPTY_QUEUE: EstadoCola = { pendientes: 0, requiereAtencion: false, sincronizando: false, detalles: [] };

export function useSyncStatus() {
  const [estado, setEstado] = React.useState<EstadoCola>(EMPTY_QUEUE);
  React.useEffect(() => onColaCambia(setEstado), []);
  return estado;
}

function detalleFecha(fecha?: string) {
  if (!fecha) return "Perfil de la cuenta";
  return capitalizar(fmtFechaCorta(fecha));
}

export function SyncCenter() {
  const online = useOnlineStatus();
  const cola = useSyncStatus();
  const Icon = !online ? CloudOff : cola.requiereAtencion ? AlertTriangle : cola.pendientes ? RefreshCw : CheckCircle2;
  const titulo = !online ? "Trabajando sin conexión" : cola.requiereAtencion ? "Hay un cambio que revisar" : cola.pendientes ? "Sincronizando cambios" : "Todo sincronizado";
  const detalle = !online
    ? "RITMO conserva cada cambio en este dispositivo y lo enviará al recuperar la conexión."
    : cola.requiereAtencion
      ? "Otro dispositivo pudo modificar el mismo registro. Tú decides cuándo volver a enviarlo."
      : cola.pendientes
        ? `${cola.pendientes} cambio${cola.pendientes > 1 ? "s" : ""} guardado${cola.pendientes > 1 ? "s" : ""} localmente.`
        : cola.ultimaSincronizacion
          ? `Última confirmación ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cola.ultimaSincronizacion))}.`
          : "Los próximos cambios se guardarán en tu cuenta y en una copia local.";

  async function reintentar(id?: string) {
    try {
      await reintentarCola(id);
      toast.success("Cambio sincronizado");
    } catch {
      toast.error("No se pudo sincronizar todavía. El cambio sigue guardado aquí.");
    }
  }

  return (
    <div id="sincronizacion" className="overflow-hidden rounded-xl border border-border/80 bg-secondary/25">
      <div className="flex items-start gap-3 p-3.5">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-card ring-1 ring-border/70 ${cola.requiereAtencion ? "text-warning" : online ? "text-primary" : "text-muted-foreground"}`}>
          <Icon className={cola.sincronizando ? "size-4 motion-safe:animate-spin" : "size-4"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{titulo}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detalle}</p>
        </div>
        {cola.requiereAtencion && <Button type="button" variant="secondary" size="sm" className="h-9 shrink-0 rounded-lg" onClick={() => void reintentar()}>Reintentar todo</Button>}
      </div>
      {cola.detalles.length > 0 && (
        <ul className="divide-y divide-border border-t border-border bg-card/65" aria-label="Cambios pendientes">
          {cola.detalles.map((item) => (
            <li key={item.id} className="flex min-h-11 items-center gap-3 px-3.5 py-2 text-xs">
              <Cloud className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1"><span className="font-medium text-foreground">{capitalizar(item.tipo)}</span><span className="ml-1.5 text-muted-foreground">{detalleFecha(item.fecha)}</span></span>
              <span className={item.bloqueada ? "font-medium text-warning-ink" : "text-muted-foreground"}>{item.bloqueada ? "Revisar" : "Pendiente"}</span>
              {item.bloqueada && <button type="button" onClick={() => void reintentar(item.id)} className="min-h-9 rounded-lg px-2 font-semibold text-primary hover:bg-primary/8">Reenviar</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
