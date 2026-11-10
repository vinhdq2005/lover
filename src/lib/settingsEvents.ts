const eventName = "lover:settings-changed";
export function notifySettingsChanged() {
  window.dispatchEvent(new Event(eventName));
}
export function watchSettings(callback: () => void) {
  const refresh = () => {
    if (document.visibilityState === "visible") callback();
  };
  window.addEventListener(eventName, refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  return () => {
    window.removeEventListener(eventName, refresh);
    window.removeEventListener("focus", refresh);
    document.removeEventListener("visibilitychange", refresh);
  };
}
