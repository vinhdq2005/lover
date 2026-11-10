import type { MailProvider } from "./provider.ts";
export const disabledProvider: MailProvider = {
  sendNotification: async () => ({ state: "disabled" }),
};
