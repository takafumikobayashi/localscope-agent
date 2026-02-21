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

interface TopicFrequencyChartProps {
  data: { topic: string; count: number }[];
}

export function TopicFrequencyChart({ data }: TopicFrequencyChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground font-mono">
        No topic data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <XAxis type="number" stroke="#666" fontSize={10} fontFamily="monospace" />
        <YAxis
          type="category"
          dataKey="topic"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
          width={80}
          tickFormatter={(v: string) =>
            v.length > 10 ? v.slice(0, 10) + "..." : v
          }
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
            <Cell key={i} fill={i === 0 ? "#00ff88" : "#00cc6a"} fillOpacity={1 - i * 0.04} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
