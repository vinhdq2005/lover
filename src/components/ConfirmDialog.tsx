import { useEffect, useRef } from "react";
type Props = {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};
export function ConfirmDialog(
  { open, title, children, onConfirm, onCancel }: Props,
) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      if (dialog.open) dialog.close();
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="max-w-md rounded-3xl bg-white p-6 backdrop:bg-stone-900/30"
    >
      <h2 id="confirm-title" className="text-xl font-semibold">{title}</h2>
      {children}
      <div className="mt-5 flex gap-3">
        <button type="button" autoFocus onClick={onCancel}>Hủy</button>
        <button type="button" onClick={onConfirm}>Xác nhận</button>
      </div>
    </dialog>
  );
}
