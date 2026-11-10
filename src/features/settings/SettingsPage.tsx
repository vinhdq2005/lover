import { MilestoneSettings } from "./MilestoneSettings";
import { useState } from "react";
import { useCouple } from "../home/useCouple";
import { RelationshipSettings } from "./RelationshipSettings";
import { StatePanel } from "../../components/StatePanel";
import { ProfileForm } from "./ProfileForm";
import { SharedProfileForm } from "./SharedProfileForm";
import { useSettings } from "./useSettings";
import { useSession } from "../../app/SessionProvider";
import { RetentionHelp } from "./RetentionHelp";
export function SettingsPage({ coupleId }: { coupleId: string }) {
  const { couple, error, reload } = useCouple(coupleId);
  const settings = useSettings(), { session } = useSession();
  const own = settings.profiles.find((profile) =>
    profile.user_id === session?.user.id
  );
  const [saved, setSaved] = useState(false);
  if (error || !couple) {
    return (
      <StatePanel
        kind={error ? "error" : "loading"}
        message={error ? "Không thể tải cài đặt." : "Đang tải..."}
        onRetry={error ? () => void reload() : undefined}
      />
    );
  }
  return (
    <div className="grid gap-6">
      {saved && <StatePanel kind="success" message="Đã lưu." />}
      <h1>Cài đặt của chúng mình</h1>
      {settings.error && (
        <StatePanel
          kind="error"
          message="Chưa thể tải hồ sơ."
          onRetry={() => void settings.reload()}
        />
      )}
      {own
        ? (
          <ProfileForm
            profile={own}
            actorId={session!.user.id}
            coupleId={coupleId}
            onSaving={() => setSaved(false)}
            onSaved={async () => {
              await settings.reload();
              setSaved(true);
            }}
            onReload={settings.reload}
          />
        )
        : <StatePanel kind="loading" message="Đang tải hồ sơ..." />}
      <SharedProfileForm
        couple={couple}
        onSaving={() => setSaved(false)}
        onSaved={async () => {
          await reload();
          setSaved(true);
        }}
        onReload={reload}
      />
      <RelationshipSettings
        key={couple.id}
        couple={couple}
        onSaving={() => setSaved(false)}
        onReload={reload}
        onSaved={async () => {
          setSaved(true);
          await reload();
        }}
      />
      <MilestoneSettings coupleId={coupleId} />
      <RetentionHelp />
    </div>
  );
}
