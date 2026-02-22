"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const COLORS = [
  "#00ff88",
  "#00cc6a",
  "#0088ff",
  "#ff6600",
  "#ff0088",
  "#8800ff",
  "#ffcc00",
  "#00cccc",
];

interface TopicTrendLineChartProps {
  data: Record<string, number | string>[];
  topics: string[];
}

export function TopicTrendLineChart({ data, topics }: TopicTrendLineChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        トピックデータがありません
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="year"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
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
        />
        <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }} />
        {topics.map((topic, i) => (
          <Line
            key={topic}
            type="monotone"
            dataKey={topic}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
