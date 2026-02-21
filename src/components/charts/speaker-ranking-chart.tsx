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

interface SpeakerRankingChartProps {
  data: { name: string; role: string; count: number }[];
}

export function SpeakerRankingChart({ data }: SpeakerRankingChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground font-mono">
        No speaker data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
        <XAxis type="number" stroke="#666" fontSize={10} fontFamily="monospace" />
        <YAxis
          type="category"
          dataKey="name"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
          width={60}
        />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 12,
          }}
          labelStyle={{ color: "#ededed" }}
          itemStyle={{ color: "#00ff88" }}
        />
        <Bar dataKey="count" radius={[0, 2, 2, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill="#00ff88" fillOpacity={1 - i * 0.04} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
