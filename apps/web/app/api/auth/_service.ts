import { DevAuthService } from '@weavia/auth-core';

const globalAuth = globalThis as typeof globalThis & { __weaviaDevAuth?: DevAuthService };
export const authService = (globalAuth.__weaviaDevAuth ??= new DevAuthService(
  undefined,
  undefined,
  process.env.WEAVIA_WEB_ORIGIN ?? 'http://localhost:3000',
));
