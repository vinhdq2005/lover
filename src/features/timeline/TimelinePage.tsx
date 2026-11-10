import { MemoryPhotos } from "./MemoryPhotos";
import { AuthorName } from "../settings/AuthorName";
import { type FormEvent, useState } from "react";
import { type Memory, useMemories } from "./useMemories";
import { MemoryForm } from "./MemoryForm";
import { useSession } from "../../app/SessionProvider";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
import { ConfirmDialog } from "../../components/ConfirmDialog";
export function TimelinePage({ coupleId }: { coupleId: string }) {
  const { session } = useSession();
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [filter, setFilter] = useState({ from: "", to: "" });
  const [filterError, setFilterError] = useState(false),
    [edit, setEdit] = useState<Memory>(),
    [remove, setRemove] = useState<Memory | null>(null),
    [failure, setFailure] = useState(false);
  const list = useMemories(coupleId, filter.from, filter.to);
  function search(e: FormEvent) {
    e.preventDefault();
    if (from && to && from > to) {
      setFilterError(true);
      return;
    }
    setFilterError(false);
    setFilter({ from, to });
  }
  async function destroy() {
    if (!remove) return;
    try {
      await executeCommand(
        prepareCommand("memory.delete", {
          id: remove.id,
          expected_version: remove.version,
        }),
      );
      setRemove(null);
      await list.reload();
    } catch {
      setFailure(true);
      setRemove(null);
    }
  }
  return (
    <div className="grid gap-6">
      <h1>Dòng kỷ niệm</h1>
      <MemoryForm
        key={edit?.id ?? "new"}
        memory={edit}
        coupleId={coupleId}
        onSaved={() => {
          setEdit(undefined);
          void list.reload();
        }}
        onCancel={edit ? () => setEdit(undefined) : undefined}
      />
      <form onSubmit={search} className="card flex flex-wrap items-end gap-3">
        <label>
          Từ ngày<input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Đến ngày<input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button className="primary">Lọc kỷ niệm</button>
      </form>
      {filterError && (
        <StatePanel
          kind="error"
          message="Ngày kết thúc phải sau hoặc cùng ngày bắt đầu."
        />
      )}
      {(list.error || failure) && (
        <StatePanel
          kind="error"
          message="Không thể hoàn thành. Vui lòng tải lại."
          onRetry={() => {
            setFailure(false);
            void list.reload();
          }}
        />
      )}
      {list.loading && (
        <StatePanel kind="loading" message="Đang tải kỷ niệm..." />
      )}
      {!list.loading && !list.items.length && (
        <StatePanel
          kind="empty"
          message="Chưa có kỷ niệm trong khoảng ngày này. Hãy lưu câu chuyện đầu tiên."
        />
      )}
      {list.items.map((memory, index) => (
        <article key={memory.id}>
          {(index === 0 ||
            memory.event_date.slice(0, 7) !==
              list.items[index - 1].event_date.slice(0, 7)) && (
            <h2 className="mt-4 font-serif">
              {new Intl.DateTimeFormat("vi-VN", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(memory.event_date + "T12:00:00Z"))}
            </h2>
          )}
          <section className="card">
            <time className="eyebrow">{memory.event_date}</time>
            <h2>{memory.title}</h2>
            <p className="whitespace-pre-wrap break-words">
              {memory.description}
            </p>
            <p className="mt-3 text-sm">
              <AuthorName userId={memory.creator_id} fallback={memory.creator_id === session?.user.id ? "Bạn" : "Người thương"} />
            </p>
            <MemoryPhotos memoryId={memory.id} version={memory.version} />
            {memory.creator_id === session?.user.id && (
              <div className="mt-4 flex gap-3">
                <button onClick={() => setEdit(memory)}>Sửa</button>
                <button
                  onClick={() =>
                    setRemove(memory)}
                >
                  Xóa
                </button>
              </div>
            )}
          </section>
        </article>
      ))}
      {list.more && (
        <button
          disabled={list.loading}
          onClick={() => void list.next()}
        >
          Xem thêm
        </button>
      )}
      <ConfirmDialog
        open={!!remove}
        title="Xóa kỷ niệm này?"
        onConfirm={() => void destroy()}
        onCancel={() => setRemove(null)}
      >
        <p>Ảnh trong thư viện sẽ được giữ lại.</p>
      </ConfirmDialog>
    </div>
  );
}
