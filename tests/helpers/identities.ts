export const testIdentities = Object.freeze({
  first: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "first@example.test",
  },
  partner: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "partner@example.test",
  },
  outsider: {
    id: "00000000-0000-4000-8000-000000000003",
    email: "outsider@example.test",
  },
});
// Local fixture identity only. Never load into a hosted project.
export function requireLocalUrl(value: string) {
  const url = new URL(value);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Local test environment required");
  }
  return url;
}
