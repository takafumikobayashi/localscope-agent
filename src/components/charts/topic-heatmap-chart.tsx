"use client";

import { Fragment } from "react";

interface TopicTrendsData {
  years: (string | number)[];
  topics: string[];
  data: Record<string, number | string>[];
}

interface TopicHeatmapChartProps {
  data: TopicTrendsData;
}

function interpolateColor(value: number, max: number): string {
  if (max === 0) return "#0d1f0d";
  const t = value / max;
  // from #0d1f0d (dark) to #00ff88 (accent)
  const r = Math.round(0x0d + (0x00 - 0x0d) * t);
  const g = Math.round(0x1f + (0xff - 0x1f) * t);
  const b = Math.round(0x0d + (0x88 - 0x0d) * t);
  return `rgb(${r},${g},${b})`;
}

export function TopicHeatmapChart({ data }: TopicHeatmapChartProps) {
  const { years, topics, data: rows } = data;

  if (years.length === 0 || topics.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        トピックデータがありません
      </p>
    );
  }

  // Find max count for color scale
  let max = 0;
  for (const row of rows) {
    for (const t of topics) {
      const v = Number(row[t] ?? 0);
      if (v > max) max = v;
    }
  }

  // rows は getTopicTrends() が返す順序通り（periodKey でソート済み）
  // row.year が表示ラベル（"R6/2月" など）
  const yearLabels = rows.map((r) => String(r.year));

  const rowByYear = new Map<string, Record<string, number | string>>();
  for (const row of rows) {
    rowByYear.set(String(row.year), row);
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid gap-1 text-xs font-mono w-full"
        style={{
          gridTemplateColumns: `minmax(120px, 160px) repeat(${yearLabels.length}, 1fr)`,
        }}
      >
        {/* Header row */}
        <div className="text-muted-foreground px-1 py-1 text-right">トピック</div>
        {yearLabels.map((label) => (
          <div
            key={label}
            className="text-muted-foreground text-center py-1 px-1 truncate"
          >
            {label}
          </div>
        ))}

        {/* Data rows */}
        {topics.map((topic) => (
          <Fragment key={topic}>
            <div
              className="text-foreground px-1 py-1 text-right truncate"
              title={topic}
            >
              {topic}
            </div>
            {yearLabels.map((label) => {
              const row = rowByYear.get(label);
              const count = row ? Number(row[topic] ?? 0) : 0;
              const bg = interpolateColor(count, max);
              return (
                <div
                  key={`${topic}-${label}`}
                  className="flex items-center justify-center py-3 rounded cursor-default transition-opacity hover:opacity-80"
                  style={{ backgroundColor: bg }}
                  title={`${topic} / ${label}: ${count}`}
                >
                  {count > 0 && (
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: count / max > 0.5 ? "#000" : "#ededed" }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
