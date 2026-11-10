import { useEffect, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { coupleToday, elapsedDays } from "../../lib/relationshipDates";
export function useRelationshipCounter(start: string, zone: string) {
  const [today, setToday] = useState(() => coupleToday(zone));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      setToday(coupleToday(zone));
      const now = Temporal.Now.zonedDateTimeISO(zone);
      const midnight = now.toPlainDate().add({ days: 1 }).toZonedDateTime(zone);
      timer = setTimeout(
        refresh,
        Math.max(
          100,
          Number(midnight.epochMilliseconds - now.epochMilliseconds) + 50,
        ),
      );
    };
    const visible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        refresh();
      }
    };
    refresh();
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [zone]);
  return { today, days: elapsedDays(start, today) };
}
