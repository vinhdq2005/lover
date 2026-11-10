export class HttpError extends Error {
  constructor(public status: number) {
    super("REQUEST_REJECTED");
  }
}
const messages: Record<number, string> = {
  400: "Dữ liệu không hợp lệ.",
  401: "Vui lòng đăng nhập.",
  403: "Bạn không có quyền truy cập.",
  404: "Nội dung không khả dụng.",
  409: "Dữ liệu đã thay đổi. Vui lòng tải lại.",
  413: "Tệp quá lớn.",
  415: "Loại tệp không hỗ trợ.",
  422: "Hình ảnh không hợp lệ.",
  429: "Đã đạt giới hạn. Vui lòng thử lại sau.",
  503: "Dịch vụ chưa sẵn sàng.",
};
export function errorResponse(status: number) {
  return Response.json({
    error: "REQUEST_REJECTED",
    message: messages[status] ?? messages[503],
  }, { status, headers: { "Cache-Control": "no-store" } });
}
export async function parseBody(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 262144) {
        await reader.cancel();
        throw new HttpError(413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    merged.set(c, at);
    at += c.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(merged));
  } catch {
    throw new HttpError(400);
  }
}
export function corsHeaders(origin: string | null, allowed: string) {
  if (origin !== allowed) throw new HttpError(403);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization,content-type,apikey,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}
