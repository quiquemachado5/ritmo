'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onColaCambia } from '@/lib/store/queued';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => onColaCambia(setPendientes), []);

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
      {sincronizando ? (
        <>
          <RefreshCw className="size-4 animate-spin" />
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
