import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
import { watchSettings } from "../../lib/settingsEvents";
export type Couple = {
  id: string;
  name: string;
  start_date: string;
  first_meeting_date: string | null;
  timezone: string;
  version: number;
  featured_photo_id: string | null;
};
export function useCouple(id: string) {
  const sequence = useRef(0);
  const [couple, setCouple] = useState<Couple | null>(null),
    [error, setError] = useState(false);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    const { data, error } = await supabase().from("couples").select(
      "id,name,start_date,first_meeting_date,timezone,version,featured_photo_id",
    ).eq("id", id).single();
    if (request !== sequence.current) return;
    setError(!!error);
    if (!error) {
      setCouple((old) => old && old.version > data.version ? old : data);
    }
  }, [id]);
  useEffect(() => {
    void reload();
    const off = watchSettings(() => void reload());
    const clear = registerPrivateCleanup(() => {
      sequence.current++;
      setCouple(null);
    });
    return () => {
      sequence.current++;
      off();
      clear();
    };
  }, [reload]);
  return { couple, error, reload };
}
