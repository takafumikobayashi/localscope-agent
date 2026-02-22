"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from "recharts";

interface SpeakerStyleItem {
  name: string;
  role: string;
  speechCount: number;
  avgLength: number;
  totalLength: number;
}

interface SpeakerStyleScatterChartProps {
  data: SpeakerStyleItem[];
}

const ROLE_COLOR: Record<string, string> = {
  councilor: "#00ff88",
  mayor:     "#0088ff",
  executive: "#ff6600",
  chair:     "#ffcc00",
  staff:     "#888",
  unknown:   "#444",
};

const ROLE_LABEL: Record<string, string> = {
  councilor: "議員",
  mayor:     "市長",
  executive: "副市長等",
  chair:     "議長",
  staff:     "行政職員",
  unknown:   "不明",
};

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: SpeakerStyleItem;
}

function CustomDot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined || !payload) return null;
  const color = ROLE_COLOR[payload.role] ?? "#555";
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={color}
      fillOpacity={0.8}
      stroke={color}
      strokeWidth={1}
    />
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: SpeakerStyleItem }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#111",
        border: "1px solid #1a1a1a",
        borderRadius: 4,
        padding: "8px 10px",
        fontFamily: "monospace",
        fontSize: 11,
      }}
    >
      <p style={{ color: ROLE_COLOR[d.role] ?? "#ededed", fontWeight: "bold", marginBottom: 4 }}>
        {d.name}
        <span style={{ color: "#888", marginLeft: 6, fontWeight: "normal" }}>
          {ROLE_LABEL[d.role] ?? d.role}
        </span>
      </p>
      <p style={{ color: "#ededed" }}>発言件数：{d.speechCount.toLocaleString()} 件</p>
      <p style={{ color: "#ededed" }}>平均文字数：{d.avgLength} 文字</p>
    </div>
  );
}

export function SpeakerStyleScatterChart({ data }: SpeakerStyleScatterChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        データがありません
      </p>
    );
  }

  const medianCount = data
    .map((d) => d.speechCount)
    .sort((a, b) => a - b)[Math.floor(data.length / 2)];
  const medianAvg = data
    .map((d) => d.avgLength)
    .sort((a, b) => a - b)[Math.floor(data.length / 2)];

  // 役職ごとにグループ化して凡例表示
  const roles = [...new Set(data.map((d) => d.role))].filter(
    (r) => ROLE_COLOR[r],
  );

  return (
    <div className="space-y-3">
      {/* 凡例 */}
      <div className="flex flex-wrap gap-4 px-1">
        {roles.map((role) => (
          <div key={role} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: ROLE_COLOR[role] }}
            />
            <span className="font-mono text-[10px] text-muted-foreground">
              {ROLE_LABEL[role] ?? role}
            </span>
          </div>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart margin={{ top: 16, right: 24, left: 0, bottom: 24 }}>
          <XAxis
            type="number"
            dataKey="speechCount"
            name="発言件数"
            stroke="#666"
            fontSize={10}
            fontFamily="monospace"
          >
            <Label
              value="← 発言件数（少）　　　発言件数（多） →"
              position="insideBottom"
              offset={-16}
              style={{ fill: "#555", fontSize: 9, fontFamily: "monospace" }}
            />
          </XAxis>
          <YAxis
            type="number"
            dataKey="avgLength"
            name="平均文字数"
            stroke="#666"
            fontSize={10}
            fontFamily="monospace"
          >
            <Label
              value="平均文字数"
              angle={-90}
              position="insideLeft"
              offset={12}
              style={{ fill: "#555", fontSize: 9, fontFamily: "monospace" }}
            />
          </YAxis>
          <Tooltip content={<CustomTooltip />} />
          {/* 中央値の十字線で象限を示す */}
          <ReferenceLine
            x={medianCount}
            stroke="#333"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={medianAvg}
            stroke="#333"
            strokeDasharray="4 4"
          />
          <Scatter data={data} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>

      {/* 象限の解説 */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground px-1">
        <div className="border border-card-border rounded p-2">
          <span className="text-foreground font-bold">右上</span>　発言多 × 文字長 → 中心的論客
        </div>
        <div className="border border-card-border rounded p-2">
          <span className="text-foreground font-bold">左上</span>　発言少 × 文字長 → 少数精鋭型
        </div>
        <div className="border border-card-border rounded p-2">
          <span className="text-foreground font-bold">右下</span>　発言多 × 文字短 → 手続き・進行型
        </div>
        <div className="border border-card-border rounded p-2">
          <span className="text-foreground font-bold">左下</span>　発言少 × 文字短 → 限定参加型
        </div>
      </div>
    </div>
  );
}
