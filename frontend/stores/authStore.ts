'use client';

import { create } from 'zustand';
import type { AuthOrg, AuthRole, AuthSession, AuthUser } from '../lib/auth';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthStore {
  status: AuthStatus;
  hydrated: boolean;
  bootstrapped: boolean;
  accessToken: string | null;
  user: AuthUser | null;
  org: AuthOrg | null;
  role: AuthRole | null;
  setHydrated: (hydrated: boolean) => void;
  setStatus: (status: AuthStatus) => void;
  setSession: (session: AuthSession) => void;
  setBootstrapped: (bootstrapped: boolean) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  status: 'idle',
  hydrated: false,
  bootstrapped: false,
  accessToken: null,
  user: null,
  org: null,
  role: null,
  setHydrated: (hydrated) => set({ hydrated }),
  setStatus: (status) => set({ status }),
  setSession: (session) => set({
    accessToken: session.accessToken,
    user: session.user,
    org: session.org,
    role: session.role,
    status: 'authenticated',
    hydrated: true,
    bootstrapped: true,
  }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  clearSession: () => set({
    accessToken: null,
    user: null,
    org: null,
    role: null,
    status: 'unauthenticated',
    hydrated: true,
    bootstrapped: true,
  }),
}));
