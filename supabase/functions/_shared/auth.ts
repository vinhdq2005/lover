import { createClient } from "@supabase/supabase-js";
import { HttpError } from "./http.ts";
export async function authenticatedUser(request: Request) {
  const token = request.headers.get("Authorization");
  if (!token?.startsWith("Bearer ")) throw new HttpError(401);
  const url = Deno.env.get("SUPABASE_URL"),
    key = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !key) throw new HttpError(503);
  const client = createClient(url, key, {
    global: { headers: { Authorization: token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.getUser(token.slice(7));
  if (error || !data.user || !data.user.email_confirmed_at) {
    throw new HttpError(401);
  }
  return { user: data.user, client };
}
