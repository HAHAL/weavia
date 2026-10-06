import { create } from 'zustand';
import type { AuthStatus, User } from '@weavia/shared';
interface AuthState { status: AuthStatus; user: User | undefined; beginAuthorization: () => void; signOut: () => void; }
export const useAuthStore = create<AuthState>((set) => ({ status: 'anonymous', user: undefined, beginAuthorization: () => set({ status: 'authorizing' }), signOut: () => set({ status: 'anonymous', user: undefined }) }));
