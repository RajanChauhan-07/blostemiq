'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  isAccessTokenExpired,
  loadSessionFromAccessToken,
  refreshAccessToken,
  signOutRequest,
} from '../auth';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

export function useAuthBootstrap() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const setHydrated = useAuthStore((state) => state.setHydrated);
  const setStatus = useAuthStore((state) => state.setStatus);
  const setSession = useAuthStore((state) => state.setSession);
  const setBootstrapped = useAuthStore((state) => state.setBootstrapped);
  const clearSession = useAuthStore((state) => state.clearSession);

  useEffect(() => {
    setHydrated(true);

    if (bootstrapped) {
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      setStatus('loading');

      try {
        let nextAccessToken = accessToken;

        if (!nextAccessToken || isAccessTokenExpired(nextAccessToken)) {
          nextAccessToken = await refreshAccessToken();
        }

        const session = await loadSessionFromAccessToken(nextAccessToken);
        if (!cancelled) {
          setSession(session);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setBootstrapped(true);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    bootstrapped,
    clearSession,
    setBootstrapped,
    setHydrated,
    setSession,
    setStatus,
  ]);
}

export function useRequireAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((state) => state.status);
  const hydrated = useAuthStore((state) => state.hydrated);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const org = useAuthStore((state) => state.org);
  const role = useAuthStore((state) => state.role);

  useAuthBootstrap();

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    if (status === 'unauthenticated') {
      const target = pathname ? `/signin?next=${encodeURIComponent(pathname)}` : '/signin';
      router.replace(target);
    }
  }, [bootstrapped, pathname, router, status]);

  return {
    status,
    hydrated,
    bootstrapped,
    ready: hydrated && bootstrapped,
    isAuthenticated: status === 'authenticated',
    accessToken,
    user,
    org,
    role,
  };
}

export function useRedirectAuthenticated() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const bootstrapped = useAuthStore((state) => state.bootstrapped);

  useAuthBootstrap();

  useEffect(() => {
    if (bootstrapped && status === 'authenticated') {
      router.replace('/dashboard');
    }
  }, [bootstrapped, router, status]);
}

export function useSignOut() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);

  return useCallback(async () => {
    try {
      await signOutRequest();
    } catch {
      // Ignore signout request failures and clear local state anyway.
    }

    useNotificationStore.getState().clear();
    clearSession();
    router.replace('/signin');
  }, [clearSession, router]);
}
