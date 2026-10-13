import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { callApi, type ApiResult } from './lib/api';

export type User = { sub: string; name?: string; email?: string; picture?: string };
type AuthState = {
  user: User | null;
  loading: boolean;
  // the failed session check, when it failed for any reason other than "not signed in"
  failure: ApiResult | null;
  retry: () => void;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  failure: null,
  retry: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({ user: null as User | null, loading: true, failure: null as ApiResult | null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    callApi('/api/me').then((r) => {
      if (!live) return;
      if (r.ok) setState({ user: r.body as User, loading: false, failure: null });
      // 401 just means signed out; everything else is a real failure worth showing
      else setState({ user: null, loading: false, failure: r.status === 401 ? null : r });
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    setAttempt((n) => n + 1);
  }, []);

  return <AuthContext.Provider value={{ ...state, retry }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
