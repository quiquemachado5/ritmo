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
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
        sincronizando
          ? 'bg-warning/10 text-warning-ink'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {sincronizando ? (
        <>
          <RefreshCw className="size-4 animate-spin" />
          Sincronizando {pendientes} cambio{pendientes > 1 ? 's' : ''}…
        </>
      ) : (
        <>
          <AlertCircle className="size-4" />
          Sin conexión — {pendientes > 0 ? `${pendientes} cambio${pendientes > 1 ? 's' : ''} en cola` : 'los cambios se guardarán al reconectar'}
        </>
      )}
    </div>
  );
}
