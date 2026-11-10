import { useState } from "react";
import { EntryForm } from "./EntryForm";
import { AuthorName } from "../settings/AuthorName";
import { type Entry, useEntries } from "./useEntries";
import { useSession } from "../../app/SessionProvider";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
export function DiaryPage({ coupleId }: { coupleId: string }) {
  const { session } = useSession(), list = useEntries(coupleId);
  const [edit, setEdit] = useState<Entry>(),
    [remove, setRemove] = useState<Entry>();
  const [failed, setFailed] = useState(false),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  async function destroy() {
    if (!remove || busy) return;
    setBusy(true);
    setFailed(false);
    setSuccess("");
    try {
      await executeCommand(
        prepareCommand("entry.delete", {
          id: remove.id,
          expected_version: remove.version,
        }),
      );
      if (edit?.id === remove.id) setEdit(undefined);
      setSuccess("Đã xóa bài viết.");
      await list.reload();
    } catch {
      setFailed(true);
    } finally {
      setRemove(undefined);
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-6">
      <h1>Nhật ký và thư tình</h1>
      <EntryForm
        key={edit?.id ?? "new"}
        entry={edit}
        onSaved={() => {
          setEdit(undefined);
          setSuccess("Đã lưu bài viết.");
          void list.reload();
        }}
        onCancel={edit ? () => setEdit(undefined) : undefined}
      />
      {success && <StatePanel kind="success" message={success} />}
      {(list.error || failed) && (
        <StatePanel
          kind="error"
          message="Chưa thể tải hoặc xóa bài viết. Dữ liệu có thể đã thay đổi; hãy tải lại danh sách."
          onRetry={() => {
            setFailed(false);
            void list.reload();
          }}
        />
      )}
      {list.loading && (
        <StatePanel kind="loading" message="Đang mở những dòng yêu thương..." />
      )}
      {!list.loading && !list.error && !list.items.length && (
        <StatePanel
          kind="empty"
          message="Chưa có bài viết. Hãy gửi những dòng đầu tiên cho người thương."
        />
      )}
      {list.items.map((entry) => (
        <article
          key={entry.id}
          className="card grid gap-3"
          aria-label={entry.title}
        >
          <p className="eyebrow">
            {entry.kind === "diary" ? "Nhật ký" : "Thư tình"}
          </p>
          <h2 className="break-words">{entry.title}</h2>
          <time dateTime={entry.event_date}>{entry.event_date}</time>
          <p className="text-sm">
            Tác giả:{" "}
            <AuthorName userId={entry.author_id} fallback={entry.author_id === session?.user.id ? "Bạn" : "Người thương"} />
          </p>
          <details>
            <summary>Đọc bài viết</summary>
            <p className="mt-3 whitespace-pre-wrap break-words">
              {entry.content}
            </p>
          </details>
          {entry.author_id === session?.user.id && (
            <div className="flex gap-3">
              <button
                disabled={busy}
                onClick={() => {
                  setEdit(entry);
                  setSuccess("");
                }}
              >
                Sửa bài viết
              </button>
              <button disabled={busy} onClick={() => setRemove(entry)}>
                Xóa bài viết
              </button>
            </div>
          )}
        </article>
      ))}
      {list.more && (
        <button
          disabled={list.loading}
          onClick={() => void list.next()}
        >
          Xem thêm bài viết
        </button>
      )}
      <ConfirmDialog
        open={!!remove}
        title="Xóa bài viết này?"
        onConfirm={() => void destroy()}
        onCancel={() => setRemove(undefined)}
      >
        <p>Bài viết sẽ không còn hiển thị cho cả hai bạn.</p>
      </ConfirmDialog>
    </div>
  );
}
