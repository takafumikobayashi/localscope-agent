"use client";

import { useState } from "react";
import type { GeneralQuestionMatrix } from "@/lib/db/analytics";

interface Props {
  data: GeneralQuestionMatrix;
}

export function GeneralQuestionHeatmap({ data }: Props) {
  const [hovered, setHovered] = useState<{ q: number; t: number } | null>(null);

  if (data.questioners.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground text-center py-8">
        一般質問データがありません
        <br />
        <span className="text-[10px]">（npm run extract-questions を実行してください）</span>
      </p>
    );
  }

  const maxVal = Math.max(...data.matrix.flat(), 1);

  // グリッドセルをフラット配列で構築
  const cells: React.ReactNode[] = [];

  // ヘッダー行
  cells.push(<div key="header-empty" />);
  data.topics.forEach((topic) => {
    cells.push(
      <div key={`h-${topic}`} className="flex items-end justify-center pb-1" style={{ height: 88 }}>
        <span
          className="font-mono text-[9px] text-muted-foreground leading-tight"
          style={{ writingMode: "vertical-rl", maxHeight: 84, overflow: "hidden" }}
        >
          {topic}
        </span>
      </div>,
    );
  });

  // データ行
  data.questioners.forEach((questioner, qi) => {
    // 議員名セル
    cells.push(
      <div key={`q-${qi}`} className="flex items-center pr-2">
        <span className="font-mono text-[11px] text-foreground truncate">{questioner}</span>
      </div>,
    );

    // データセル
    data.topics.forEach((topic, ti) => {
      const val = data.matrix[qi][ti];
      const ratio = val / maxVal;
      const isHovered = hovered?.q === qi && hovered?.t === ti;
      const bg =
        val === 0
          ? "rgba(255,255,255,0.03)"
          : `rgba(0, 255, 136, ${0.15 + ratio * 0.75})`;

      cells.push(
        <div
          key={`c-${qi}-${ti}`}
          className="relative flex items-center justify-center cursor-default transition-all duration-150"
          style={{ height: 30, background: bg, outline: isHovered ? "1px solid #00ff88" : "none" }}
          onMouseEnter={() => setHovered({ q: qi, t: ti })}
          onMouseLeave={() => setHovered(null)}
        >
          {val > 0 && (
            <span className="font-mono text-[10px] text-accent font-bold">{val}</span>
          )}
          {isHovered && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 whitespace-nowrap bg-[#111] border border-card-border rounded px-2 py-1 pointer-events-none">
              <p className="font-mono text-[10px] text-foreground">{questioner}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{topic}</p>
              <p className="font-mono text-[10px] text-accent">{val}件</p>
            </div>
          )}
        </div>,
      );
    });
  });

  return (
    <div className="w-full">
      {/* 凡例: 右上 */}
      <div className="flex items-center gap-1.5 justify-end mb-3">
        <span className="font-mono text-[10px] text-muted">少</span>
        {[0.15, 0.35, 0.55, 0.75, 0.9].map((o) => (
          <div key={o} className="w-3 h-3 rounded-sm" style={{ background: `rgba(0, 255, 136, ${o})` }} />
        ))}
        <span className="font-mono text-[10px] text-muted">多</span>
      </div>

      {/* グリッド本体 */}
      <div
        className="w-full grid gap-px"
        style={{ gridTemplateColumns: `140px repeat(${data.topics.length}, 1fr)` }}
      >
        {cells}
      </div>
    </div>
  );
}
