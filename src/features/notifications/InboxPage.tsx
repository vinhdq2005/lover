import { useState } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "./useNotifications";
import { useSession } from "../../app/SessionProvider";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
const categories: Record<string, string> = {
  memory: "kỷ niệm",
  entry: "nhật ký hoặc thư",
  photo: "ảnh",
  album: "album",
  upload: "đợt tải ảnh",
  profile: "hồ sơ",
  couple: "không gian chung",
  milestone: "ngày đặc biệt",
};
const paths: Record<string, string> = {
  memory: "/timeline",
  entry: "/diary",
  photo: "/gallery",
  album: "/gallery",
  upload: "/gallery",
  profile: "/settings",
  couple: "/settings",
  milestone: "/settings",
};
const statuses: Record<string, string> = {
  disabled: "Email đã tắt",
  pending: "Email đang chờ",
  leased: "Email đang xử lý",
  accepted: "Nhà cung cấp đã nhận; chưa xác nhận giao thư",
  failed: "Email chưa gửi được",
  deferred_quota: "Email chờ hạn mức miễn phí",
  unknown:
    "Chưa xác định kết quả email; không tự gửi lại ngoài thời hạn an toàn",
};
export function InboxPage() {
  const { session } = useSession();
  const [pendingPreference, setPendingPreference] = useState<boolean | null>(null);
  const list = useNotifications(session!.user.id),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function mutate(command: string, payload: Record<string, unknown>) {
    setBusy(true);
    setFailed(false);
    try {
      await executeCommand(prepareCommand(command, payload));
      await list.reload();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-5">
      <h1>Thông báo từ người thương</h1>
      <section className="card grid gap-3">
        <h2>Tùy chọn email của tôi</h2>
        <label className="flex gap-3">
          <input
            type="checkbox"
            disabled={busy || list.loading}
            checked={pendingPreference ?? list.preference.email_enabled}
            onChange={async (e) => {
              const enabled = e.target.checked;
              setPendingPreference(enabled);
              await mutate("notification.preferences", { email_enabled: enabled, expected_version: list.preference.version });
              setPendingPreference(null);
            }}
          />Nhận email tùy chọn từ người thương
        </label>
        <p>
          Thông báo trong ứng dụng luôn hoạt động. Email chỉ gửi khi bạn bật tùy
          chọn và người vận hành đã xác minh dịch vụ gửi miễn phí.
        </p>
      </section>
      {(failed || list.error) && (
        <StatePanel
          kind="error"
          message="Chưa thể cập nhật thông báo. Vui lòng tải lại và thử lại."
          onRetry={() => {
            setFailed(false);
            void list.reload();
          }}
        />
      )}
      {list.loading && (
        <StatePanel kind="loading" message="Đang tải thông báo..." />
      )}
      {!list.loading && !list.error && !list.items.length && (
        <StatePanel kind="empty" message="Chưa có thông báo từ người thương." />
      )}
      {list.items.map((notice) => (
        <article
          className="card grid gap-3"
          key={notice.id}
          aria-label={`Thông báo ${categories[notice.category] ?? "cập nhật"}`}
        >
          <p>
            {notice.actor_name} vừa cập nhật{" "}
            {categories[notice.category] ?? "không gian chung"}.
          </p>
          <time dateTime={notice.created_at}>
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(notice.created_at))}
          </time>
          <p>{notice.read_at ? "Đã đọc" : "Chưa đọc"}</p>
          {notice.upload_summary && (
            <p>
              Đợt tải: {notice.upload_summary.success_count} ảnh đã lưu,{" "}
              {notice.upload_summary.failure_count} ảnh chưa lưu.{" "}
              {notice.upload_summary.status === "open"
                ? "Đang mở"
                : "Đã kết thúc"}.
            </p>
          )}
          <p>{statuses[notice.delivery_state] ?? "Email chưa khả dụng"}</p>
          <Link to={paths[notice.category] ?? "/"}>Mở mục liên quan</Link>
          {!notice.read_at && (
            <button
              disabled={busy}
              onClick={() =>
                void mutate("notification.mark_read", {
                  notification_id: notice.id,
                })}
            >
              Đánh dấu đã đọc
            </button>
          )}
          {notice.retry_allowed && (
            <button
              disabled={busy}
              onClick={() =>
                void mutate("notification.retry_email", {
                  notification_id: notice.id,
                })}
            >
              Thử gửi lại email
            </button>
          )}
        </article>
      ))}
      {list.more && (
        <button
          disabled={list.loading}
          onClick={() => void list.next()}
        >
          Xem thêm thông báo
        </button>
      )}
    </div>
  );
}
