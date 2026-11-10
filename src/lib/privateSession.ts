const callbacks = new Set<() => void>();
export function registerPrivateCleanup(callback: () => void) {
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
  };
}
export function clearPrivateSession() {
  for (const callback of callbacks) {
    try {
      callback();
    } catch { /* Cleanup must continue for every private resource. */ }
  }
}
