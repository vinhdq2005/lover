import type { Occurrence } from "../../lib/relationshipDates";
export function MilestoneList({ items }: { items: Occurrence[] }) {
  return (
    <section className="card">
      <h2>Những ngày sắp tới</h2>
      {items.length
        ? (
          <ul className="grid gap-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap justify-between gap-3 border-b border-rose-50 pb-3"
              >
                <div>
                  <p>{item.label}</p>
                  <time className="text-sm text-stone-600">{item.date}</time>
                </div>
                <strong>
                  {item.remaining === 0
                    ? "Hôm nay"
                    : item.remaining + " ngày nữa"}
                </strong>
              </li>
            ))}
          </ul>
        )
        : <p>Thêm ngày kỷ niệm trong cài đặt.</p>}
    </section>
  );
}
