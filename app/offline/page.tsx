import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-secondary">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <div className="max-w-sm">
        <h1 className="font-display text-2xl font-bold tracking-tight">Sin conexión</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No hay red ahora mismo. Cuando vuelvas a tener conexión, RITMO se
          recargará y sincronizará tus datos.
        </p>
      </div>
    </div>
  );
}
