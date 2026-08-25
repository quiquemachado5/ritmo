'use client';

import { useOnlineStatus } from '@/lib/hooks/useOnlineStatus';
import { AlertCircle, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
    } else {
      /* Ocultar después de 2 segundos cuando se conecta */
      const timer = setTimeout(() => setShow(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
        isOnline
          ? 'bg-weight/10 text-weight'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="size-4" />
          Conexión restaurada
        </>
      ) : (
        <>
          <AlertCircle className="size-4" />
          Sin conexión — los cambios se guardarán cuando vuelvas a conectar
        </>
      )}
    </div>
  );
}
