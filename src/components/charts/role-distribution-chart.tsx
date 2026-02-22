"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface RoleDistributionChartProps {
  data: { role: string; count: number }[];
}

const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  councilor: { label: "議員",     color: "#00ff88" },
  mayor:     { label: "市長",     color: "#0088ff" },
  executive: { label: "副市長等", color: "#ff6600" },
  chair:     { label: "議長",     color: "#ffcc00" },
  staff:     { label: "行政職員", color: "#888" },
  unknown:   { label: "不明",     color: "#444" },
};

function roleLabel(role: string) {
  return ROLE_CONFIG[role]?.label ?? role;
}

function roleColor(role: string) {
  return ROLE_CONFIG[role]?.color ?? "#555";
}

export function RoleDistributionChart({ data }: RoleDistributionChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        データがありません
      </p>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    ...d,
    label: roleLabel(d.role),
    pct: Math.round((d.count / total) * 100),
  }));

  return (
    <div className="space-y-6">
      {/* ドーナツチャート — 全幅・中央配置 */}
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            dataKey="count"
            nameKey="label"
            innerRadius={90}
            outerRadius={150}
            paddingAngle={2}
          >
            {chartData.map((entry) => (
              <Cell key={entry.role} fill={roleColor(entry.role)} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#111",
              border: "1px solid #1a1a1a",
              borderRadius: 4,
              fontFamily: "monospace",
              fontSize: 11,
            }}
            formatter={(value: number | string | undefined, name: string | undefined) => [
              value != null ? `${Number(value).toLocaleString()} 件` : "-",
              name ?? "",
            ]}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 凡例 — 横並び・中央揃え */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3">
        {chartData.map((d) => (
          <div key={d.role} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: roleColor(d.role) }}
            />
            <span className="font-mono text-xs text-foreground">{d.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {d.count.toLocaleString()} 件
            </span>
            <span
              className="font-mono text-xs font-bold"
              style={{ color: roleColor(d.role) }}
            >
              {d.pct}%
            </span>
          </div>
        ))}
      </div>

      {/* 合計 */}
      <p className="font-mono text-[10px] text-muted-foreground text-center">
        合計 {total.toLocaleString()} 件
      </p>
    </div>
  );
}
