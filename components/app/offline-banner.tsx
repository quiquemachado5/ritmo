'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { AlertCircle, RefreshCw, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { onColaCambia } from '@/lib/store/queued';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => onColaCambia(setPendientes), []);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else {
      /* Al reconectar, mantener visible mientras se sincroniza la cola. */
      if (pendientes > 0) {
        setShow(true);
        return;
      }
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendientes]);

  if (!show) return null;

  const sincronizando = isOnline && pendientes > 0;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
        sincronizando
          ? 'bg-warning/10 text-warning-ink'
          : isOnline
            ? 'bg-weight/10 text-weight'
            : 'bg-destructive/10 text-destructive'
      }`}
    >
      {sincronizando ? (
        <>
          <RefreshCw className="size-4 animate-spin" />
          Sincronizando {pendientes} cambio{pendientes > 1 ? 's' : ''}…
        </>
      ) : isOnline ? (
        <>
          <Wifi className="size-4" />
          Conexión restaurada
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
