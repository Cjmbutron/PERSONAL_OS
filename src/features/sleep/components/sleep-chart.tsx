"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type SleepChartDatum = {
  date: string;
  /** "dd/mm" ya formateado en el servidor. */
  label: string;
  hours: number | null;
};

/**
 * Duración del sueño por día con la meta como línea de referencia (D-29).
 * Los colores salen de los tokens del tema, así sigue el modo claro/oscuro.
 * Los mismos datos se muestran en la lista de registros (RNF-09).
 */
export function SleepChart({ data, goalHours }: { data: SleepChartDatum[]; goalHours: number }) {
  const recorded = data.filter((d) => d.hours !== null).length;
  const top = Math.max(goalHours, ...data.map((d) => d.hours ?? 0));

  return (
    <div
      role="img"
      aria-label={`Gráfico de barras con las horas dormidas por día. ${recorded} de ${data.length} días con registro. Meta: ${goalHours} horas.`}
      className="h-60 w-full"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 240 }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <YAxis
            domain={[0, Math.ceil(top + 1)]}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            tickFormatter={(h: number) => `${h} h`}
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
            formatter={(value) => [typeof value === "number" ? `${value} h` : "Sin registro", "Dormido"]}
            labelFormatter={(label) => `Día ${String(label)}`}
          />
          <ReferenceLine
            y={goalHours}
            stroke="var(--warning)"
            strokeDasharray="5 4"
            label={{ value: `Meta ${goalHours} h`, position: "insideTopRight", fill: "var(--warning)", fontSize: 12 }}
          />
          <Bar dataKey="hours" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
