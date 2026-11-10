import { FeaturedPhoto } from "./FeaturedPhoto";
import { RecentMemories } from "./RecentMemories";
import { useEffect, useState } from "react";
import { type Couple, useCouple } from "./useCouple";
import { useRelationshipCounter } from "./useRelationshipCounter";
import { supabase } from "../../lib/supabase";
import { registerPrivateCleanup } from "../../lib/privateSession";
import {
  type CustomMilestone,
  elapsedDays,
  upcomingMilestones,
} from "../../lib/relationshipDates";
import { MilestoneList } from "./MilestoneList";
import { StatePanel } from "../../components/StatePanel";
import { useSettings } from "../settings/useSettings";
import { PrivateImage } from "../../components/PrivateImage";
import { watchSettings } from "../../lib/settingsEvents";
function Story({ couple }: { couple: Couple }) {
  const { today, days } = useRelationshipCounter(
    couple.start_date,
    couple.timezone,
  );
  const [milestones, setMilestones] = useState<CustomMilestone[]>([]);
  const { profiles } = useSettings();
  useEffect(() => {
    let active = true;
    const load = () => {
      void supabase().from("milestones").select("id,label,original_date").eq(
        "couple_id",
        couple.id,
      ).then(({ data }) => {
        if (active) setMilestones(data ?? []);
      });
    };
    load();
    const stop = watchSettings(load);
    const off = registerPrivateCleanup(() => {
      setMilestones([]);
    });
    return () => {
      active = false;
      off();
      stop();
    };
  }, [couple.id]);
  return (
    <div className="grid gap-6">
      <section className="card text-center">
        <p className="eyebrow">MỖI NGÀY LÀ MỘT KỶ NIỆM</p>
        <h1>{couple.name}</h1>
        <div className="my-4 flex flex-wrap justify-center gap-4">
          {profiles.map((profile) => (
            <div key={profile.user_id} className="grid max-w-32 gap-2">
              {profile.avatar
                ? (
                  <PrivateImage
                    eager
                    path={profile.avatar.storage_path}
                    alt={`Ảnh đại diện ${profile.display_name}`}
                  />
                )
                : <p className="text-sm">Chưa có ảnh đại diện</p>}
              <p>{profile.display_name}</p>
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="text-4xl text-rose-300">♡</div>
        <p
          className="my-4 font-serif text-7xl text-rose-800"
          aria-label="Số ngày yêu nhau"
        >
          {days}
        </p>
        <p>ngày bên nhau</p>
        <time className="mt-3 block text-sm">Từ {couple.start_date}</time>
        {couple.first_meeting_date && (
          <p className="mt-3 text-sm">
            Gặp lần đầu: {elapsedDays(couple.first_meeting_date, today)} ngày
          </p>
        )}
      </section>
      <MilestoneList
        items={upcomingMilestones(
          couple.start_date,
          couple.first_meeting_date,
          milestones,
          today,
        )}
      />
      <RecentMemories coupleId={couple.id} />
      <FeaturedPhoto photoId={couple.featured_photo_id} />
    </div>
  );
}
export function HomePage({ coupleId }: { coupleId: string }) {
  const { couple, error, reload } = useCouple(coupleId);
  if (error) {
    return (
      <StatePanel
        kind="error"
        message="Không thể tải câu chuyện."
        onRetry={() => void reload()}
      />
    );
  }
  if (!couple) return <StatePanel kind="loading" message="Đang tải..." />;
  return <Story couple={couple} />;
}
