"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#00ff88", "#00cc6a", "#0088ff", "#ff6600",
  "#ff0088", "#8800ff", "#ffcc00", "#00cccc",
];

interface TopicTrendChartProps {
  data: Record<string, number | string>[];
  topics: string[];
}

export function TopicTrendChart({ data, topics }: TopicTrendChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        No trend data available.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <XAxis dataKey="year" stroke="#666" fontSize={10} fontFamily="monospace" />
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
        />
        <Legend
          wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }}
        />
        {topics.map((topic, i) => (
          <Bar
            key={topic}
            dataKey={topic}
            stackId="a"
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.8}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
