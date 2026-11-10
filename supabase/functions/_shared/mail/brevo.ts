import type { MailProvider } from "./provider.ts";
export function brevoProvider(
  config: { apiKey: string; from: string; name: string; appOrigin: string },
  fetcher: typeof fetch = fetch,
): MailProvider {
  return {
    async sendNotification(input) {
      if (
        !/^[0-9a-f-]{36}$/i.test(input.eventKey) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.recipientVerifiedEmail)
      ) return { state: "rejected", retryable: false, code: "INVALID_TARGET" };
      try {
        const origin = new URL(config.appOrigin);
        if (origin.protocol !== "https:") return { state: "disabled" };
        const response = await fetcher("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            "api-key": config.apiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            sender: { email: config.from, name: config.name },
            subject: "Lover - Có cập nhật từ người thương",
            textContent:
              "Người thương vừa cập nhật không gian chung. Đăng nhập để xem: " +
              origin.origin + "/notifications",
            messageVersions: [{
              to: [{ email: input.recipientVerifiedEmail }],
            }],
            headers: { idempotencyKey: input.eventKey },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          const id = data.messageIds?.[0] ?? data.messageId;
          return typeof id === "string"
            ? { state: "accepted", providerId: id.slice(0, 500) }
            : { state: "unknown" };
        }
        if (
          data.code === "duplicate_parameter" || response.status >= 500
        ) return { state: "unknown" };
        return {
          state: "rejected",
          retryable: response.status === 429 || response.status === 408,
          code: response.status === 429
            ? "PROVIDER_QUOTA"
            : "PROVIDER_REJECTED",
        };
      } catch {
        return { state: "unknown" };
      }
    },
  };
}
