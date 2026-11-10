import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { clearPrivateSession } from "./privateSession";
let instance: SupabaseClient | undefined;
export function publicConfiguration(env: Record<string, unknown>) {
  const url = String(env.VITE_SUPABASE_URL ?? "");
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "");
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !(parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname))
  ) throw new Error("INVALID_PUBLIC_CONFIGURATION");
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey) {
    try {
      publicKey = JSON.parse(atob(key.split(".")[1])).role === "anon";
    } catch {
      publicKey = false;
    }
  }
  if (!publicKey) throw new Error("INVALID_PUBLIC_CONFIGURATION");
  return { url, key };
}
export function supabase() {
  if (!instance) {
    const config = publicConfiguration(import.meta.env);
    instance = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        storage: window.sessionStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    instance.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") clearPrivateSession();
    });
  }
  return instance;
}
