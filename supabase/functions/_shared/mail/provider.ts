export type MailInput = { eventKey: string; recipientVerifiedEmail: string };
export type MailResult =
  | { state: "disabled" }
  | { state: "accepted"; providerId: string }
  | { state: "rejected"; retryable: boolean; code: string }
  | { state: "unknown" };
export interface MailProvider {
  sendNotification(input: MailInput): Promise<MailResult>;
}
