import { supabase } from "../../lib/supabase";
import { type FormEvent, useEffect, useState } from "react";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function InvitationPanel() {
  const [email, setEmail] = useState(""),
    [invite, setInvite] = useState<
      { id: string; version: number; invitation_token?: string } | null
    >(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase().rpc("invitation_status").then(({ data }) => {
      if (active && data) setInvite(data);
    });
    return () => {
      active = false;
    };
  }, []);
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const data = await executeCommand(
        prepareCommand("invitation.create", { recipient_email: email }),
      );
      setInvite(data);
      setMessage("Lời mời có hiệu lực 48 giờ. Gửi mã qua kênh riêng.");
    } catch {
      setMessage(
        "Không thể tạo lời mời. Có thể đã có lời mời hoặc đủ hai thành viên.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function revoke() {
    if (!invite) return;
    try {
      await executeCommand(
        prepareCommand("invitation.revoke", {
          id: invite.id,
          expected_version: invite.version,
        }),
      );
      setInvite(null);
      setMessage("Đã thu hồi lời mời.");
    } catch {
      setMessage("Không thể thu hồi. Vui lòng tải lại.");
    }
  }
  return (
    <section className="card">
      <h2>Mời người thương</h2>
      <form onSubmit={create} className="grid gap-3">
        <label>
          Email người nhận<input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <button disabled={busy || !!invite} className="primary">
          Tạo lời mời
        </button>
      </form>
      {invite && (
        <div className="my-4 grid gap-3">
          {invite.invitation_token && (
            <>
              <label>
                Mã chỉ hiện một lần<input
                  readOnly
                  value={invite.invitation_token}
                />
              </label>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(invite.invitation_token!)
                    .then(() => setMessage("Đã sao chép."), () =>
                      setMessage("Vui lòng sao chép mã thủ công."));
                }}
              >
                Sao chép mã
              </button>
            </>
          )}
          <button
            onClick={() =>
              void revoke()}
          >
            Thu hồi
          </button>
        </div>
      )}
      {message && (
        <StatePanel
          kind={message.startsWith("Kh\u00f4ng") ? "error" : "success"}
          message={message}
        />
      )}
    </section>
  );
}
