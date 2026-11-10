import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  clearPrivateSession,
  registerPrivateCleanup,
} from "../lib/privateSession";
type AuthState = { session: Session | null; loading: boolean; error: boolean };
const Context = createContext<AuthState>({
  session: null,
  loading: true,
  error: false,
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    session: null,
    loading: true,
    error: false,
  });
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = (session: Session | null) => {
      if (!active) return;
      if (timer) clearTimeout(timer);
      if (!session) clearPrivateSession();
      setState({ session, loading: false, error: false });
      if (session?.expires_at) {
        timer = setTimeout(() => {
          clearPrivateSession();
          setState({ session: null, loading: false, error: false });
        }, Math.max(0, session.expires_at * 1000 - Date.now()));
      }
    };
    try {
      const client = supabase();
      void client.auth.getSession().then(({ data, error }) => {
        if (error) {
          if (active) setState({ session: null, loading: false, error: true });
          return;
        }
        update(data.session);
      });
      const listener = client.auth.onAuthStateChange((_event, session) =>
        update(session)
      );
      unsubscribe = () => listener.data.subscription.unsubscribe();
    } catch {
      setState({ session: null, loading: false, error: true });
    }
    return () => {
      active = false;
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
export function usePrivateState<T>(initial: T) {
  const [value, setValue] = useState(initial);
  useEffect(() => registerPrivateCleanup(() => setValue(initial)), [initial]);
  return [value, setValue] as const;
}
