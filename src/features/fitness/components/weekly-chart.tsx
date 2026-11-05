"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type WeeklyChartDatum = { label: string; sessions: number };

/** Entrenamientos por semana. Los mismos datos se listan debajo del gráfico (RNF-09). */
export function WeeklyChart({ data }: { data: WeeklyChartDatum[] }) {
  const total = data.reduce((a, d) => a + d.sessions, 0);
  const top = Math.max(1, ...data.map((d) => d.sessions));
  return (
    <div
      role="img"
      aria-label={`Gráfico de barras con los entrenamientos por semana. ${total} en las últimas ${data.length} semanas.`}
      className="h-52 w-full"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 208 }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
          <YAxis
            domain={[0, top + 1]}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--foreground)",
              fontSize: 13,
            }}
            formatter={(v) => [String(v), "Entrenamientos"]}
            labelFormatter={(l) => `Semana del ${String(l)}`}
          />
          <Bar dataKey="sessions" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
