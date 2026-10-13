import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { ApiError, configureApiClient } from '@/services/apiClient';
import * as authService from '@/services/authService';
import { clearSession, loadSession, saveSession } from '@/services/sessionStorage';
import type { AuthResponse, LoginRequest, SignupRequest, User } from '@/types/api';

import { authIntro } from './authIntro';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: Status;
  user: User | null;
  login: (input: LoginRequest) => Promise<void>;
  signup: (input: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);
  const tokenRef = useRef<string | null>(null);

  const endSession = useCallback(async () => {
    tokenRef.current = null;
    authIntro.reset();
    setUser(null);
    setStatus('signedOut');
    await clearSession();
  }, []);

  const startSession = useCallback(async (session: AuthResponse) => {
    tokenRef.current = session.accessToken;
    await saveSession(session);
    authIntro.reset();
    setUser(session.user);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    configureApiClient({
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        void endSession();
      },
    });
  }, [endSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await loadSession();
      if (cancelled) return;
      if (!stored) {
        setStatus('signedOut');
        return;
      }
      tokenRef.current = stored.accessToken;
      setUser(stored.user);
      setStatus('signedIn');
      try {
        const fresh = await authService.getCurrentUser();
        if (!cancelled) setUser(fresh);
      } catch (error) {
        // A 401 signs the user out through the API client. Network errors keep the session.
        if (!(error instanceof ApiError)) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (input: LoginRequest) => {
      const session = await authService.login({ email: input.email.trim().toLowerCase(), password: input.password });
      await startSession(session);
    },
    [startSession],
  );

  const signup = useCallback(
    async (input: SignupRequest) => {
      const session = await authService.signup({
        displayName: input.displayName.trim(),
        email: input.email.trim().toLowerCase(),
        password: input.password,
      });
      await startSession(session);
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logoutRemote();
    } catch {
      // Local sign-out must always succeed.
    }
    await endSession();
  }, [endSession]);

  const value = useMemo(() => ({ status, user, login, signup, logout }), [status, user, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
