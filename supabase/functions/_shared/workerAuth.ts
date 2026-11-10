import { HttpError } from "./http.ts";
export function requireWorker(request: Request, secret: string | undefined) {
  if (request.method !== "POST") throw new HttpError(400);
  if (!secret) throw new HttpError(503);
  const supplied = request.headers.get("x-worker-secret") ?? "";
  let difference = supplied.length ^ secret.length;
  for (let index = 0; index < secret.length; index++) {
    difference |= (supplied.charCodeAt(index) || 0) ^ secret.charCodeAt(index);
  }
  if (difference !== 0) throw new HttpError(403);
}
