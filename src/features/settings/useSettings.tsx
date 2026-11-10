import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
import { watchSettings } from "../../lib/settingsEvents";
export type Profile = {
  user_id: string;
  display_name: string;
  avatar_photo_id: string | null;
  version: number;
  avatar: { storage_path: string } | null;
};
type SettingsState = {
  profiles: Profile[];
  loading: boolean;
  error: boolean;
  reload: () => Promise<void>;
};
const Context = createContext<SettingsState>({
  profiles: [],
  loading: true,
  error: false,
  reload: async () => {},
});
export function SettingsProvider(
  { children, coupleId }: { children: ReactNode; coupleId: string },
) {
  const [profiles, setProfiles] = useState<Profile[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await supabase().from("profiles").select(
        "user_id,display_name,avatar_photo_id,version,avatar:photos!own_avatar(storage_path)",
      ).order("created_at");
      if (request !== sequence.current) return;
      setError(!!response.error);
      if (!response.error) {
        setProfiles((old) =>
          (response.data as unknown as Profile[] ?? []).map((profile) => {
            const previous = old.find((p) => p.user_id === profile.user_id);
            return previous && previous.version > profile.version
              ? previous
              : profile;
          })
        );
      }
    } catch {
      if (request === sequence.current) setError(true);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [coupleId]);
  useEffect(() => {
    void reload();
    const off = watchSettings(() => void reload());
    const clear = registerPrivateCleanup(() => {
      sequence.current++;
      setProfiles([]);
      setLoading(false);
      setError(false);
    });
    return () => {
      sequence.current++;
      off();
      clear();
    };
  }, [reload]);
  return (
    <Context.Provider value={{ profiles, loading, error, reload }}>
      {children}
    </Context.Provider>
  );
}
export const useSettings = () => useContext(Context);
