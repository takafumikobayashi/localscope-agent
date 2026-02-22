"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SessionIntensityItem {
  period: string;
  label: string;
  speechCount: number;
  uniqueSpeakers: number;
  totalChars: number;
}

interface SessionIntensityChartProps {
  data: SessionIntensityItem[];
}

export function SessionIntensityChart({ data }: SessionIntensityChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        データがありません
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="label"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
        />
        <YAxis
          yAxisId="chars"
          orientation="left"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
          tickFormatter={(v: number) =>
            v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)
          }
        />
        <YAxis
          yAxisId="speakers"
          orientation="right"
          stroke="#666"
          fontSize={10}
          fontFamily="monospace"
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: "#111",
            border: "1px solid #1a1a1a",
            borderRadius: 4,
            fontFamily: "monospace",
            fontSize: 11,
          }}
          labelStyle={{ color: "#ededed" }}
          formatter={(value: number | undefined, name: string | undefined) => {
            if (value == null) return ["-", name ?? ""];
            if (name === "総文字数") return [value.toLocaleString() + " 文字", name];
            if (name === "発言件数") return [value.toLocaleString() + " 件", name];
            if (name === "ユニーク発言者") return [value + " 名", name];
            return [value, name ?? ""];
          }}
        />
        <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: 10 }} />
        <Bar
          yAxisId="chars"
          dataKey="totalChars"
          name="総文字数"
          fill="#00ff88"
          fillOpacity={0.7}
          radius={[2, 2, 0, 0]}
        />
        <Line
          yAxisId="speakers"
          type="monotone"
          dataKey="uniqueSpeakers"
          name="ユニーク発言者"
          stroke="#0088ff"
          strokeWidth={2}
          dot={{ r: 3, fill: "#0088ff" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
