import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
export type Notice = {
  id: string;
  actor_id: string;
  actor_name: string;
  category: string;
  action: string;
  created_at: string;
  read_at: string | null;
  delivery_state: string;
  retry_allowed: boolean;
  upload_summary: {
    batch_id: string;
    success_count: number;
    failure_count: number;
    status: string;
  } | null;
};
export function useNotifications(userId: string) {
  const [items, setItems] = useState<Notice[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [more, setMore] = useState(false);
  const [preference, setPreference] = useState({
    email_enabled: false,
    version: 0,
  });
  const sequence = useRef(0);
  const load = useCallback(async (last?: Notice) => {
    const request = ++sequence.current;
    setLoading(true);
    setError(false);
    try {
      const [notices, prefs] = await Promise.all([
        supabase().rpc("notification_inbox", {
          page_size: 30,
          before_time: last?.created_at ?? null,
          before_id: last?.id ?? null,
        }),
        supabase().from("notification_preferences").select(
          "email_enabled,version",
        ).eq("user_id", userId).maybeSingle(),
      ]);
      if (request !== sequence.current) return;
      if (notices.error || prefs.error) setError(true);
      else {
        setItems((old) => last ? [...old, ...notices.data] : notices.data);
        setMore(notices.data.length === 30);
        setPreference(prefs.data ?? { email_enabled: false, version: 0 });
      }
    } catch {
      if (request === sequence.current) setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const resume = () => {
      if (timer) clearInterval(timer);
      if (document.visibilityState === "visible") {
        void load();
        timer = setInterval(() => void load(), 60000);
      }
    };
    resume();
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    const off = registerPrivateCleanup(() => {
      sequence.current++;
      if (timer) clearInterval(timer);
      setItems([]);
      setPreference({ email_enabled: false, version: 0 });
      setLoading(false);
    });
    return () => {
      sequence.current++;
      if (timer) clearInterval(timer);
      off();
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [load]);
  return {
    items,
    loading,
    error,
    more,
    preference,
    reload: () => load(),
    next: () => load(items.at(-1)),
  };
}
