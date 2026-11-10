/** Only a confirmed absent key is a missing photo; permission/outage/bucket failures are not. */
export function isMissingObject(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  return value.code === "NoSuchKey" ||
    (!value.code && (value.status === 404 || value.statusCode === "404"));
}
