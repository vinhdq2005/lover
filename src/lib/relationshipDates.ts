import { Temporal } from "@js-temporal/polyfill";
export const coupleToday = (zone: string, now = Temporal.Now.instant()) =>
  now.toZonedDateTimeISO(zone).toPlainDate().toString();
export function elapsedDays(start: string, today: string) {
  return Temporal.PlainDate.from(today).since(Temporal.PlainDate.from(start), {
    largestUnit: "days",
  }).days;
}
export type CustomMilestone = {
  id: string;
  label: string;
  original_date: string;
};
export type Occurrence = {
  id: string;
  label: string;
  date: string;
  remaining: number;
  kind: "day" | "anniversary";
};
export function upcomingMilestones(
  start: string,
  meeting: string | null,
  custom: CustomMilestone[],
  today: string,
  limit = 3,
) {
  const date = Temporal.PlainDate.from(today);
  const results: Occurrence[] = [];
  for (const days of [100, 365]) {
    const at = Temporal.PlainDate.from(start).add({ days });
    if (Temporal.PlainDate.compare(at, date) >= 0) {
      results.push({
        id: "day-" + days,
        label: days + " ngày bên nhau",
        date: at.toString(),
        remaining: elapsedDays(today, at.toString()),
        kind: "day",
      });
    }
  }
  const annual = [
    { id: "relationship", label: "Ngày yêu nhau", original_date: start },
    ...(meeting
      ? [{ id: "meeting", label: "Ngày gặp đầu tiên", original_date: meeting }]
      : []),
    ...custom,
  ];
  for (const item of annual) {
    const original = Temporal.PlainDate.from(item.original_date);
    for (
      let year = Math.max(date.year, original.year + 1);
      year < Math.max(date.year, original.year + 1) + limit + 1;
      year++
    ) {
      const at = Temporal.PlainDate.from({
        year,
        month: original.month,
        day: original.day,
      }, { overflow: "constrain" });
      if (Temporal.PlainDate.compare(at, date) >= 0) {
        results.push({
          id: item.id + "-" + year,
          label: item.label,
          date: at.toString(),
          remaining: elapsedDays(today, at.toString()),
          kind: "anniversary",
        });
      }
    }
  }
  return results.sort((a, b) =>
    a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  ).slice(0, limit);
}
