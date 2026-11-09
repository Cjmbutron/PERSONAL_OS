import { areaColor } from "@/lib/constants/areas";

/** Barras sencillas de varias semanas; la última (semana en curso) va más marcada. Incluye texto para lectores de pantalla. */
export function MiniBars({
  title,
  area,
  values,
  labels,
  format,
}: {
  title: string;
  area: string;
  values: number[];
  labels: string[];
  format: (n: number) => string;
}) {
  const max = Math.max(...values, 1);
  const summary = values.map((v, i) => `${labels[i]}: ${format(v)}`).join("; ");
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <div role="img" aria-label={`${title}. ${summary}`} className="flex h-20 items-end gap-2">
        {values.map((v, i) => (
          <div key={labels[i]} className="flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-md"
              style={{
                height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%`,
                backgroundColor: areaColor(area),
                opacity: i === values.length - 1 ? 1 : 0.45,
              }}
            />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1 flex gap-2 text-center text-[11px] text-muted-foreground">
        {values.map((v, i) => (
          <span key={labels[i]} className="min-w-0 flex-1 tabular-nums">
            {format(v)}
          </span>
        ))}
      </div>
      <div aria-hidden className="flex gap-2 text-center text-[11px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l} className="min-w-0 flex-1 truncate">
            {l}
          </span>
        ))}
      </div>
    </figure>
  );
}
