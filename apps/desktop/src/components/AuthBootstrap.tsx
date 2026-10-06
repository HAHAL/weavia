import { useEffect } from 'react';
import { authController } from '../stores/auth';
import { desktopPlatform } from '../services/auth-platform';

export function AuthBootstrap() {
  useEffect(() => {
    void authController.restoreSession();
    let disposed = false;
    let stop: (() => void) | undefined;
    void desktopPlatform
      .onDeepLink((url) => {
        void authController.handleCallback(url);
      })
      .then((unlisten) => {
        if (disposed) unlisten();
        else stop = unlisten;
      });
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  return null;
}
