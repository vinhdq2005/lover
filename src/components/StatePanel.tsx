type Props = {
  kind: "loading" | "empty" | "success" | "error";
  message: string;
  onRetry?: () => void;
};
export function StatePanel({ kind, message, onRetry }: Props) {
  return (
    <section
      role={kind === "error" ? "alert" : "status"}
      aria-live={kind === "error" ? "assertive" : "polite"}
      aria-busy={kind === "loading"}
      className="rounded-2xl border border-rose-100 bg-white p-5"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-rose-300 px-4 py-2"
        >
          Thử lại
        </button>
      )}
    </section>
  );
}
