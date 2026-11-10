import { useEffect, useRef, useState } from "react";
import {
  executeCommand,
  type PendingCommand,
  prepareCommand,
} from "../../lib/commands";
import { prepareImage } from "../../lib/prepareImage";
import { registerPrivateCleanup } from "../../lib/privateSession";
import { uploadPreparedFile } from "../../lib/uploadTransport";
type Job = {
  id: string;
  name: string;
  file?: File;
  state:
    | "preparing"
    | "waiting"
    | "uploading"
    | "finalizing"
    | "saved"
    | "failed";
  progress: number;
  message?: string;
  path?: string;
  fileId?: string;
  staged?: boolean;
  finalize?: PendingCommand;
  invalid?: boolean;
};
type Reservation = {
  batch_id: string;
  reservation_id: string;
  files: { client_file_id: string; file_id: string; path: string }[];
};
export function useUploads(onSaved: () => void) {
  const [rows, setRows] = useState<Job[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [closed, setClosed] = useState(false);
  const jobs = useRef<Job[]>([]),
    batch = useRef<Reservation | undefined>(undefined),
    reserve = useRef<PendingCommand | undefined>(undefined),
    closing = useRef<PendingCommand | undefined>(undefined),
    generation = useRef(0),
    running = useRef(false),
    controller = useRef<AbortController | undefined>(undefined),
    isClosed = useRef(false),
    savedCallback = useRef(onSaved);
  savedCallback.current = onSaved;
  const refresh = () => setRows(jobs.current.map((job) => ({ ...job })));
  useEffect(() => {
    const clear = () => {
      generation.current++;
      controller.current?.abort();
      jobs.current = [];
      batch.current = undefined;
      reserve.current = undefined;
      closing.current = undefined;
      running.current = false;
      isClosed.current = false;
      setRows([]);
      setBusy(false);
      setClosed(false);
      setError("");
    };
    const off = registerPrivateCleanup(clear);
    return () => {
      off();
      generation.current++;
      controller.current?.abort();
      jobs.current = [];
    };
  }, []);
  async function close(run = generation.current) {
    if (!batch.current || isClosed.current) return;
    closing.current ??= prepareCommand("upload.close", {
      batch_id: batch.current.batch_id,
    });
    await executeCommand(closing.current);
    if (run !== generation.current) return;
    isClosed.current = true;
    setClosed(true);
    for (const job of jobs.current) job.file = undefined;
    refresh();
  }
  async function process(run: number) {
    if (run !== generation.current || isClosed.current) return;
    let changed = false;
    try {
      const selected = jobs.current.filter((job) => job.file && !job.invalid);
      if (!selected.length) return;
      if (!batch.current) {
        reserve.current ??= prepareCommand("upload.reserve", {
          files: selected.map((job) => ({
            client_file_id: job.id,
            size: job.file!.size,
            declared_type: job.file!.type,
          })),
        });
        const result = await executeCommand(reserve.current) as Reservation;
        if (run !== generation.current) return;
        batch.current = result;
        for (const job of selected) {
          const file = result.files.find((file) =>
            file.client_file_id === job.id
          );
          if (!file) throw new Error("RESERVATION_FAILED");
          job.path = file.path;
          job.fileId = file.file_id;
        }
      }
      for (const job of selected) {
        if (run !== generation.current) return;
        if (job.state === "saved") continue;
        try {
          if (!job.staged) {
            job.state = "uploading";
            job.message = undefined;
            refresh();
            controller.current = new AbortController();
            await uploadPreparedFile(job.path!, job.file!, (value) => {
              if (run === generation.current) {
                job.progress = value;
                refresh();
              }
            }, controller.current.signal);
            if (run !== generation.current) return;
            job.staged = true;
          }
          job.state = "finalizing";
          job.progress = 95;
          refresh();
          job.finalize ??= prepareCommand("upload.finalize", {
            batch_id: batch.current.batch_id,
            reservation_id: batch.current.reservation_id,
            file_ids: [job.fileId!],
          });
          const result = await executeCommand(job.finalize);
          if (run !== generation.current) return;
          job.finalize = undefined;
          if (result?.files?.[0]?.state !== "ready") {
            const code = result?.files?.[0]?.error_code;
            if (code === "NOT_UPLOADED") job.staged = false;
            job.invalid = code === "INVALID_IMAGE";
            throw new Error("FINALIZATION_FAILED");
          }
          job.state = "saved";
          job.progress = 100;
          job.file = undefined;
          job.message = undefined;
          changed = true;
        } catch {
          if (run !== generation.current) return;
          job.state = "failed";
          job.message = job.invalid
            ? "Ảnh không hợp lệ; hãy chọn ảnh khác trong đợt mới."
            : "Chưa lưu được ảnh. Hãy thử lại khi kết nối ổn định.";
        }
        refresh();
      }
      if (
        jobs.current.filter((job) => job.fileId).every((job) =>
          job.state === "saved"
        )
      ) await close(run);
    } catch {
      if (run === generation.current) {
        setError(
          "Không thể hoàn tất đợt tải. Dữ liệu chờ vẫn ở đây; thử lại hoặc kiểm tra dung lượng.",
        );
      }
    } finally {
      if (run === generation.current) {
        running.current = false;
        setBusy(false);
        if (changed) savedCallback.current();
      }
    }
  }
  async function start(files: File[]) {
    if (running.current) return;
    if (batch.current && !isClosed.current) {
      setError("Hãy hoàn tất đợt tải trước khi chọn ảnh mới.");
      return;
    }
    if (!files.length) return;
    if (files.length > 20) {
      setError("Mỗi đợt chỉ chọn tối đa 20 ảnh.");
      return;
    }
    const run = ++generation.current;
    running.current = true;
    setBusy(true);
    setError("");
    setClosed(false);
    isClosed.current = false;
    batch.current = undefined;
    reserve.current = undefined;
    closing.current = undefined;
    jobs.current = files.map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      state: "preparing",
      progress: 0,
    }));
    refresh();
    for (let index = 0; index < files.length; index++) {
      try {
        const prepared = await prepareImage(files[index]);
        if (run !== generation.current) return;
        jobs.current[index].file = prepared.file;
        jobs.current[index].state = "waiting";
      } catch {
        if (run !== generation.current) return;
        Object.assign(jobs.current[index], {
          state: "failed",
          invalid: true,
          message: "Chọn JPEG, PNG hoặc WebP tối đa 10 MiB / 24 MP.",
        });
      }
      refresh();
    }
    await process(run);
    if (run === generation.current) {
      running.current = false;
      setBusy(false);
    }
  }
  async function retry() {
    if (running.current || isClosed.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    await process(generation.current);
  }
  async function finish() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await close();
    } catch {
      setError("Chưa thể đóng đợt tải. Hãy thử lại.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    rows,
    busy,
    error,
    closed,
    start,
    retry,
    finish,
    hasBatch: !!batch.current,
    retryable: rows.some((job) => job.state === "failed" && !job.invalid) ||
      !!error,
  };
}
