import { type FormEvent, useState } from "react";
import { supabase } from "../../lib/supabase";
import { StatePanel } from "../../components/StatePanel";
export function LoginPage() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const { error } = await supabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) setError(true);
      else setPassword("");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card">
      <p className="eyebrow">CHỈ DÀNH CHO HAI NGƯỜI</p>
      <h1>
        Lover <span className="font-normal italic">Our Story</span>
      </h1>
      <p className="my-4">Một nơi nhỏ, giữ lại những điều thương.</p>
      <form onSubmit={submit} className="grid gap-4">
        <label>
          Email<input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Mật khẩu<input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button disabled={busy} className="primary">
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
      {error && (
        <StatePanel
          kind="error"
          message="Không thể đăng nhập. Vui lòng kiểm tra thông tin hoặc liên hệ người thiết lập."
        />
      )}
      <p className="mt-6 text-sm">
        Tài khoản chỉ được cấp cho hai thành viên. Không có đăng ký công khai.
      </p>
    </section>
  );
}
