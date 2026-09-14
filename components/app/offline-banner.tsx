'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onColaCambia, reintentarCola, type EstadoCola } from '@/lib/store/queued';
import { toast } from 'sonner';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [cola, setCola] = useState<EstadoCola>({ pendientes: 0, requiereAtencion: false, sincronizando: false, detalles: [] });
  const { pendientes, requiereAtencion } = cola;

  useEffect(() => onColaCambia(setCola), []);

  const show = !isOnline || pendientes > 0;
  if (!show) return null;

  const sincronizando = isOnline && pendientes > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium shadow-lg transition-colors md:right-5 md:bottom-5 ${
        sincronizando
          ? 'border-warning-border bg-card text-warning-ink'
          : 'border-destructive/25 bg-card text-destructive'
      }`}
    >
      {requiereAtencion ? (
        <>
          <AlertCircle className="size-4 shrink-0" />
          <span>Hay cambios locales sin sincronizar</span>
          <button className="min-h-10 shrink-0 underline underline-offset-4" onClick={() => {
            if (window.confirm('Revisa tus cambios. Si otro dispositivo modificó el mismo registro, al reintentar se enviará la versión conservada aquí. ¿Continuar?')) void reintentarCola().catch(() => toast.error('No se pudo reintentar. Conserva tus datos locales.'));
          }}>Revisar</button>
        </>
      ) : sincronizando ? (
        <>
          <RefreshCw className={`size-4 ${cola.sincronizando ? 'motion-safe:animate-spin' : ''}`} />
          {pendientes} cambio{pendientes > 1 ? 's' : ''} pendiente{pendientes > 1 ? 's' : ''}
        </>
      ) : (
        <>
          <AlertCircle className="size-4" />
          {pendientes > 0 ? `Sin conexión · ${pendientes} pendiente${pendientes > 1 ? 's' : ''}` : 'Sin conexión · guardaremos tus cambios'}
        </>
      )}
    </div>
  );
}
