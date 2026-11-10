import { disabledProvider } from "./disabled.ts";
import { brevoProvider } from "./brevo.ts";
export function configuredProvider(
  env: (name: string) => string | undefined = (name) => Deno.env.get(name),
) {
  const enabled = env("EMAIL_DELIVERY_ENABLED") === "true" &&
    env("EMAIL_SENDER_VERIFIED") === "true" &&
    env("EMAIL_PROVIDER") === "brevo";
  const apiKey = env("BREVO_API_KEY"),
    from = env("BREVO_FROM_EMAIL"),
    appOrigin = env("APP_ORIGIN");
  if (!enabled || !apiKey || !from || !appOrigin?.startsWith("https://")) {
    return { enabled: false, provider: disabledProvider };
  }
  return {
    enabled: true,
    provider: brevoProvider({
      apiKey,
      from,
      name: env("BREVO_FROM_NAME") ?? "Lover",
      appOrigin,
    }),
  };
}
