import { GalleryPage } from "../features/gallery/GalleryPage";
import { DiaryPage } from "../features/diary/DiaryPage";
import { SettingsProvider } from "../features/settings/useSettings";
import { InboxPage } from "../features/notifications/InboxPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { HomePage } from "../features/home/HomePage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { useSession } from "./SessionProvider";
import { supabase } from "../lib/supabase";
import {
  clearPrivateSession,
  registerPrivateCleanup,
} from "../lib/privateSession";
import { StatePanel } from "../components/StatePanel";
import { LoginPage } from "../features/auth/LoginPage";
import { SetupPage } from "../features/auth/SetupPage";
import { InvitePage } from "../features/auth/InvitePage";
import { InvitationPanel } from "../features/auth/InvitationPanel";
export function Router() {
  const { session, loading, error } = useSession();
  const [logoutState, setLogoutState] = useState<"idle" | "pending" | "failed">("idle");
  async function logout() {
    setLogoutState("pending");
    clearPrivateSession();
    try {
      const result = await supabase().auth.signOut();
      setLogoutState(result.error ? "failed" : "idle");
    } catch {
      setLogoutState("failed");
    }
  }
  const [member, setMember] = useState<
      { couple_id: string; slot: number } | null
    >(null),
    [checking, setChecking] = useState(true),
    [failed, setFailed] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() =>
    registerPrivateCleanup(() => {
      setMember(null);
      setChecking(true);
    }), []);
  useEffect(() => {
    let active = true;
    if (!session) return;
    setChecking(true);
    void supabase().from("memberships").select("couple_id,slot").eq(
      "user_id",
      session.user.id,
    ).maybeSingle().then(({ data, error }) => {
      if (active) {
        setMember(data);
        setFailed(!!error);
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [session, revision]);
  if (logoutState !== "idle") {
    return <StatePanel
      kind={logoutState === "pending" ? "loading" : "error"}
      message={logoutState === "pending" ? "Đang đăng xuất..." : "Chưa thể đăng xuất. Vui lòng thử lại."}
      onRetry={logoutState === "failed" ? () => void logout() : undefined}
    />;
  }
  if (error) {
    return (
      <StatePanel
        kind="error"
        message="Cấu hình ứng dụng chưa sẵn sàng. Vui lòng liên hệ người thiết lập."
      />
    );
  }
  if (loading || session && checking) {
    return <StatePanel kind="loading" message="Đang mở không gian riêng..." />;
  }
  return (
    <BrowserRouter>
      {!session ? <LoginPage /> : (
        <>
          <header className="mb-8 flex items-center justify-between">
            <span className="font-serif text-xl">Lover / Our Story</span>
            <button
              onClick={() => void logout()}
            >
              Đăng xuất
            </button>
          </header>
          {failed
            ? (
              <StatePanel
                kind="error"
                message="Không thể tải không gian."
                onRetry={() => setRevision((v) => v + 1)}
              />
            )
            : !member
            ? (
              <>
                <SetupPage onComplete={() => setRevision((v) => v + 1)} />
                <InvitePage onComplete={() => setRevision((v) => v + 1)} />
              </>
            )
            : (
              <>
                <nav
                  className="mb-6 flex flex-wrap gap-3"
                  aria-label="Điều hướng chính"
                >
                  <Link to="/">Câu chuyện</Link>
                  <Link to="/gallery">Thư viện ảnh</Link>
                  <Link to="/timeline">Kỷ niệm</Link>
                  <Link to="/diary">Nhật ký và thư</Link>
                  <Link to="/settings">Cài đặt</Link>
                  <Link to="/notifications">Thông báo</Link>
                </nav>
                <SettingsProvider coupleId={member.couple_id}><Routes>
                  <Route path="/notifications" element={<InboxPage />} />
                  <Route path="/diary" element={<DiaryPage coupleId={member.couple_id} />} />
                  <Route
                    path="/gallery"
                    element={<GalleryPage coupleId={member.couple_id} />}
                  />
                  <Route
                    path="/timeline"
                    element={<TimelinePage coupleId={member.couple_id} />}
                  />
                  <Route
                    path="/settings"
                    element={<SettingsPage coupleId={member.couple_id} />}
                  />
                  <Route
                    path="*"
                    element={<HomePage coupleId={member.couple_id} />}
                  />
                </Routes></SettingsProvider>
                {member.slot === 1 && <InvitationPanel />}
              </>
            )}
        </>
      )}
    </BrowserRouter>
  );
}
