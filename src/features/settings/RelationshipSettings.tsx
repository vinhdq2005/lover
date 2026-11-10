import { type FormEvent, useEffect, useState } from "react";
import type { Couple } from "../home/useCouple";
import { executeCommand, prepareCommand } from "../../lib/commands";
import { StatePanel } from "../../components/StatePanel";
export function RelationshipSettings(
  { couple, onSaved, onSaving, onReload }: {
    couple: Couple;
    onSaved: () => void | Promise<void>;
    onSaving?: () => void;
    onReload?: () => Promise<void>;
  },
) {
  const [start, setStart] = useState(couple.start_date),
    [meeting, setMeeting] = useState(couple.first_meeting_date ?? ""),
    [zone, setZone] = useState(couple.timezone),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<"success" | "error" | null>(null);
  const [version, setVersion] = useState(couple.version),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setStart(couple.start_date);
      setMeeting(couple.first_meeting_date ?? "");
      setZone(couple.timezone);
      setVersion(couple.version);
    }
  }, [couple, dirty]);
  async function save(e: FormEvent) {
    e.preventDefault();
    onSaving?.();
    setBusy(true);
    setStatus(null);
    try {
      await executeCommand(
        prepareCommand("couple.update", {
          expected_version: version,
          start_date: start,
          first_meeting_date: meeting || null,
          timezone: zone,
        }),
      );
      setStatus("success");
      await onSaved();
      setDirty(false);
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <h2>Ngày bắt đầu của chúng mình</h2>
      <form onSubmit={save} className="grid gap-4">
        <label>
          Ngày yêu nhau<input
            type="date"
            required
            value={start}
            disabled={busy}
            onChange={(e) => {
              setDirty(true);
              setStart(e.target.value);
            }}
          />
        </label>
        <label>
          Ngày gặp đầu tiên<input
            type="date"
            value={meeting}
            disabled={busy}
            onChange={(e) => {
              setDirty(true);
              setMeeting(e.target.value);
            }}
          />
        </label>
        <label>
          Múi giờ<input
            required
            value={zone}
            disabled={busy}
            onChange={(e) => {
              setDirty(true);
              setZone(e.target.value);
            }}
          />
        </label>
        <button className="primary" disabled={busy}>Lưu ngày kỷ niệm</button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            await onReload?.();
            setDirty(false);
            setStatus(null);
          }}
        >
          Tải ngày mới nhất
        </button>
      </form>
      {status === "error" && (
        <StatePanel
          kind={status}
          message={"Kh\u00f4ng th\u1ec3 l\u01b0u. Ki\u1ec3m tra ng\u00e0y, m\u00fai gi\u1edd ho\u1eb7c t\u1ea3i l\u1ea1i khi b\u1ea3n ghi \u0111\u00e3 thay \u0111\u1ed5i."}
        />
      )}
    </section>
  );
}
