import { supabase } from "./supabase";
import { registerPrivateCleanup } from "./privateSession";
const LIMIT = 32 * 1024 * 1024;
const cache = new Map<string, { blob: Blob; refs: number }>(),
  urls = new Set<string>();
let bytes = 0, generation = 0;
registerPrivateCleanup(() => {
  generation++;
  for (const url of urls) URL.revokeObjectURL(url);
  urls.clear();
  cache.clear();
  bytes = 0;
});
export async function loadPrivateImage(path: string) {
  const run = generation;
  let entry = cache.get(path);
  if (!entry) {
    const result = await supabase().storage.from("media").download(path);
    if (run !== generation) throw new Error("SESSION_EXPIRED");
    if (result.error || !result.data) throw new Error("IMAGE_UNAVAILABLE");
    entry = cache.get(path);
    if (!entry) {
      if (result.data.size > 10485760 || bytes + result.data.size > LIMIT) {
        throw new Error("IMAGE_MEMORY_LIMIT");
      }
      entry = { blob: result.data, refs: 0 };
      cache.set(path, entry);
      bytes += entry.blob.size;
    }
  }
  entry.refs++;
  const url = URL.createObjectURL(entry.blob);
  urls.add(url);
  let released = false;
  return {
    url,
    release() {
      if (released) return;
      released = true;
      URL.revokeObjectURL(url);
      urls.delete(url);
      entry!.refs--;
      if (entry!.refs === 0 && cache.get(path) === entry) {
        cache.delete(path);
        bytes -= entry!.blob.size;
      }
    },
  };
}
