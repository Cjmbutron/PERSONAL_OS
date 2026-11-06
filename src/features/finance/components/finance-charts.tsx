"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };
const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
};

const money = (v: unknown) => new Intl.NumberFormat("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

export type TrendDatum = { label: string; income: number; expense: number };

/** Ingresos y gastos de los últimos meses. Los mismos datos se listan en una tabla junto al gráfico (RNF-09). */
export function TrendChart({ data, currency }: { data: TrendDatum[]; currency: string }) {
  return (
    <div
      role="img"
      aria-label={`Gráfico de barras con ingresos y gastos en ${currency} de los últimos ${data.length} meses.`}
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height: 256 }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} />
          <YAxis tickLine={false} axisLine={false} tick={axisTick} width={56} tickFormatter={(v) => String(Math.round(Number(v)))} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v, n) => [`${money(v)} ${currency}`, String(n)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="Ingresos" fill="var(--success)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          <Bar dataKey="expense" name="Gastos" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type CategoryDatum = { name: string; total: number };

/** Gastos del mes por categoría (barras horizontales). */
export function CategoryChart({ data, currency }: { data: CategoryDatum[]; currency: string }) {
  const height = Math.max(160, data.length * 36 + 24);
  return (
    <div
      role="img"
      aria-label={`Gráfico de barras con los gastos del mes por categoría, en ${currency}.`}
      style={{ height }}
      className="w-full"
    >
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 640, height }}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--border)" />
          <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(v) => String(Math.round(Number(v)))} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={axisTick} width={110} />
          <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={tooltipStyle} formatter={(v) => [`${money(v)} ${currency}`, "Gastos"]} />
          <Bar dataKey="total" fill="var(--primary)" radius={[0, 3, 3, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
