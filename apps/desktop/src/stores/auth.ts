import { useSyncExternalStore } from 'react';
import { createAuthApi, DesktopAuthController } from '../services/auth';
import { desktopPlatform, secureTokenStore } from '../services/auth-platform';

export const authController = new DesktopAuthController({
  api: createAuthApi(() => secureTokenStore.getAccessToken()),
  tokens: secureTokenStore,
  platform: desktopPlatform,
});

export function useAuthStore() {
  return useSyncExternalStore(
    authController.subscribe,
    authController.getSnapshot,
    authController.getSnapshot,
  );
}
