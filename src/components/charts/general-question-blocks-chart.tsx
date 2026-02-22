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
import type { GeneralQuestionBlock } from "@/lib/db/analytics";

interface Props {
  data: GeneralQuestionBlock[];
}

// 会期名を短縮: "令和6年第3回定例会" → "R6-3回"
function shortSession(sessionName: string, fiscalYear: number): string {
  const reiwa = fiscalYear - 2018;
  const match = sessionName.match(/第(\d+)回/);
  const num = match ? match[1] : "?";
  return `R${reiwa}-${num}回`;
}

// Y軸ラベル: "山本数博 / 芸備線の利活用..."（最大20文字）
function formatYLabel(item: GeneralQuestionBlock): string {
  const label = `${item.questioner} / ${item.topic}`;
  return label.length > 22 ? label.slice(0, 21) + "…" : label;
}

// 議員ごとに固定色を割り当て
const PALETTE = [
  "#00ff88", "#00d4ff", "#ff9500", "#ff5f5f", "#c084fc",
  "#34d399", "#60a5fa", "#fbbf24", "#f87171", "#a78bfa",
  "#2dd4bf", "#fb923c",
];

interface TooltipPayload {
  payload?: GeneralQuestionBlock;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-[#111] border border-card-border rounded px-3 py-2 font-mono text-[11px] space-y-0.5">
      <p className="text-foreground font-bold">{d.questioner}</p>
      <p className="text-muted-foreground">{d.topic}</p>
      <p className="text-muted-foreground">{shortSession(d.sessionName, d.fiscalYear)}</p>
      <div className="border-t border-card-border mt-1 pt-1 space-y-0.5">
        <p className="text-accent font-bold">{d.speechCount} 発言</p>
        <p className="text-muted-foreground">{d.totalChars.toLocaleString()} 文字</p>
        {d.mayorResponses > 0 && (
          <p className="text-muted-foreground">市長答弁 {d.mayorResponses} 回</p>
        )}
      </div>
    </div>
  );
}

export function GeneralQuestionBlocksChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground text-center py-8">
        一般質問データがありません
        <br />
        <span className="text-[10px]">（npm run extract-questions を実行してください）</span>
      </p>
    );
  }

  // 議員名リストでカラーインデックスを割り当て
  const questioners = Array.from(new Set(data.map((d) => d.questioner)));
  const colorMap = new Map(questioners.map((q, i) => [q, PALETTE[i % PALETTE.length]]));

  // recharts 用データ（Y軸ラベル付き）
  const chartData = data.map((d) => ({
    ...d,
    label: formatYLabel(d),
  }));

  const barHeight = 28;
  const chartHeight = chartData.length * barHeight + 40;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 32, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            stroke="#444"
            fontSize={10}
            fontFamily="monospace"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#666"
            fontSize={10}
            fontFamily="monospace"
            width={200}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="speechCount" radius={[0, 3, 3, 0]} barSize={18}>
            {chartData.map((d, i) => (
              <Cell key={i} fill={colorMap.get(d.questioner) ?? "#00ff88"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
        {questioners.map((q) => (
          <div key={q} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: colorMap.get(q) }} />
            <span className="font-mono text-[10px] text-muted-foreground">{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
