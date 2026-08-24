"use client";

import * as React from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtPeso, fmtKcal, fmtSigno } from "@/lib/format";

export interface PuntoPeso {
  label: string;
  real: number | null;
  pred: number | null;
  banda?: [number, number] | null;
}

const ejeStyle = { fontSize: 11, fill: "var(--muted-foreground)" };

function CajaTooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {children}
    </div>
  );
}

/** Peso real vs predicho con banda de confianza. */
export function WeightChart({ data, objetivo }: { data: PuntoPeso[]; objetivo?: number | null }) {
  const valores = data.flatMap((d) => [d.real, d.pred, d.banda?.[0], d.banda?.[1]].filter((v): v is number => v != null));
  const min = valores.length ? Math.floor(Math.min(...valores) - 1) : 0;
  const max = valores.length ? Math.ceil(Math.max(...valores) + 1) : 100;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={ejeStyle} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={[min, max]} tick={ejeStyle} tickLine={false} axisLine={false} width={42} />
          {objetivo != null && (
            <ReferenceLine y={objetivo} stroke="var(--weight)" strokeDasharray="4 4" strokeOpacity={0.6} />
          )}
          <Area
            type="monotone"
            dataKey="banda"
            stroke="none"
            fill="var(--weight)"
            fillOpacity={0.12}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="pred"
            stroke="var(--weight)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke="var(--weight)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "var(--weight)", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
            connectNulls
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const real = payload.find((p) => p.dataKey === "real")?.value as number | undefined;
              const pred = payload.find((p) => p.dataKey === "pred")?.value as number | undefined;
              return (
                <CajaTooltip>
                  <p className="mb-1 font-medium text-foreground">{label}</p>
                  {real != null && <p className="text-weight tabular">Real: {fmtPeso(real)} kg</p>}
                  {pred != null && <p className="text-muted-foreground tabular">Estimado: {fmtPeso(pred)} kg</p>}
                </CajaTooltip>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface PuntoBalance {
  label: string;
  balance: number | null;
  imputado?: boolean;
}

/** Balance calórico diario (déficit / superávit). */
export function BalanceChart({ data }: { data: PuntoBalance[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={ejeStyle} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={ejeStyle} tickLine={false} axisLine={false} width={44} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Bar dataKey="balance" radius={[3, 3, 3, 3]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={d.balance == null ? "transparent" : d.balance > 0 ? "var(--energy)" : "var(--weight)"}
                fillOpacity={d.imputado ? 0.45 : 1}
              />
            ))}
          </Bar>
          <Tooltip
            cursor={{ fill: "var(--secondary)", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0]?.value as number | null;
              if (b == null) return null;
              return (
                <CajaTooltip>
                  <p className="mb-1 font-medium text-foreground">{label}</p>
                  <p className={b > 0 ? "text-energy tabular" : "text-weight tabular"}>
                    {fmtSigno(b, 0)} kcal
                  </p>
                </CajaTooltip>
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Serie genérica de medidas/composición. */
export function LineSeries({
  data,
  colorVar = "--body",
  unidad = "",
}: {
  data: { label: string; valor: number | null }[];
  colorVar?: string;
  unidad?: string;
}) {
  const valores = data.map((d) => d.valor).filter((v): v is number => v != null);
  const min = valores.length ? Math.floor(Math.min(...valores) - 1) : 0;
  const max = valores.length ? Math.ceil(Math.max(...valores) + 1) : 10;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={ejeStyle} tickLine={false} axisLine={false} minTickGap={28} />
          <YAxis domain={[min, max]} tick={ejeStyle} tickLine={false} axisLine={false} width={42} />
          <Line
            type="monotone"
            dataKey="valor"
            stroke={`var(${colorVar})`}
            strokeWidth={2.5}
            dot={{ r: 2.5, strokeWidth: 0, fill: `var(${colorVar})` }}
            isAnimationActive={false}
            connectNulls
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const v = payload[0]?.value as number | undefined;
              return (
                <CajaTooltip>
                  <p className="mb-1 font-medium text-foreground">{label}</p>
                  <p className="tabular" style={{ color: `var(${colorVar})` }}>
                    {v != null ? `${v} ${unidad}` : "—"}
                  </p>
                </CajaTooltip>
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
