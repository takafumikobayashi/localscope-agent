"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { ReactNode } from "react";

interface SpeechCountChartProps {
  data: { label: string; fullName?: string; count: number }[];
}

export function SpeechCountChart({ data }: SpeechCountChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        発言データがありません
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 24 }}>
        <XAxis
          dataKey="label"
          stroke="#666"
          fontSize={9}
          fontFamily="monospace"
          angle={-45}
          textAnchor="end"
          interval={0}
        />
        <YAxis stroke="#666" fontSize={10} fontFamily="monospace" />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 11,
          }}
          labelStyle={{ color: "#ededed" }}
          itemStyle={{ color: "#00ff88" }}
          labelFormatter={(label: ReactNode) => {
            const key = typeof label === "string" ? label : String(label ?? "");
            const row = data.find((d) => d.label === key);
            return row?.fullName ?? key;
          }}
          formatter={(value: number | undefined) => [
            value != null ? value.toLocaleString() : "-",
            "発言数",
          ]}
        />
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#00ff88" fillOpacity={0.8} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
