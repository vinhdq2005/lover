import { publicConfiguration, supabase } from "./supabase";
/** Direct, reservation-scoped upload. Progress never requires a privileged key. */
export async function uploadPreparedFile(
  path: string,
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal,
) {
  const { url, key } = publicConfiguration(import.meta.env);
  const { data, error } = await supabase().auth.getSession();
  if (error || !data.session || signal.aborted) {
    throw new Error("SESSION_EXPIRED");
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    xhr.open(
      "POST",
      url + "/storage/v1/object/staging/" +
        path.split("/").map(encodeURIComponent).join("/"),
    );
    xhr.setRequestHeader(
      "authorization",
      "Bearer " + data.session!.access_token,
    );
    xhr.setRequestHeader("apikey", key);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=0");
    xhr.timeout = 30000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        progress(Math.round(event.loaded / event.total * 90));
      }
    };
    xhr.onload = () => {
      let code = "";
      try {
        const body = JSON.parse(xhr.responseText);
        code = body.code ?? body.statusCode ?? "";
      } catch { /* fixed UI error only */ }
      // An upload response may be lost. Never overwrite; the finalizer revalidates existing bytes.
      if (
        xhr.status >= 200 && xhr.status < 300 || xhr.status === 409 ||
        code === "ResourceAlreadyExists" || code === "409"
      ) finish();
      else finish(new Error("UPLOAD_FAILED"));
    };
    xhr.onerror = () => finish(new Error("UPLOAD_FAILED"));
    xhr.ontimeout = () => finish(new Error("UPLOAD_TIMEOUT"));
    xhr.onabort = () => finish(new Error("UPLOAD_ABORTED"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) {
      finish(new Error("UPLOAD_ABORTED"));
      return;
    }
    xhr.send(file);
  });
}
