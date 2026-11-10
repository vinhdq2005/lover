import { useSettings } from "./useSettings";
export function AuthorName(
  { userId, fallback = "Người thương" }: { userId: string; fallback?: string },
) {
  const { profiles } = useSettings();
  return (
    <span>
      {profiles.find((profile) => profile.user_id === userId)?.display_name ??
        fallback}
    </span>
  );
}
