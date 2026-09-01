import { useSyncExternalStore } from 'react';

export function useOnlineStatus() {
  return useSyncExternalStore(
    (actualizar) => {
      window.addEventListener('online', actualizar);
      window.addEventListener('offline', actualizar);
      return () => {
        window.removeEventListener('online', actualizar);
        window.removeEventListener('offline', actualizar);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}
