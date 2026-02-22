"use client";

import { useState } from "react";

interface TopicWordCloudProps {
  data: { topic: string; count: number }[];
}

export function TopicWordCloud({ data }: TopicWordCloudProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground text-center py-8">
        トピックデータがありません
      </p>
    );
  }

  const maxCount = data[0]?.count ?? 1;
  const minCount = data[data.length - 1]?.count ?? 1;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-4 min-h-[160px]">
      {data.map((item, i) => {
        const ratio = (item.count - minCount) / (maxCount - minCount || 1);
        const fontSize = 11 + ratio * 22; // 11px〜33px
        const opacity = hovered
          ? hovered === item.topic
            ? 1
            : 0.25
          : 0.5 + ratio * 0.5;
        const color =
          ratio > 0.65 ? "#00ff88" : ratio > 0.35 ? "#00cc6a" : "#888";
        const delay = `${(i % 20) * 30}ms`;

        return (
          <span
            key={item.topic}
            className="word-cloud-item font-mono cursor-default transition-all duration-200"
            style={{
              fontSize: `${fontSize}px`,
              opacity,
              color,
              animationDelay: delay,
              ["--glow-color" as string]: "rgba(0, 255, 136, 0.7)",
            }}
            title={`${item.topic}: ${item.count}件`}
            onMouseEnter={() => setHovered(item.topic)}
            onMouseLeave={() => setHovered(null)}
          >
            {item.topic}
          </span>
        );
      })}
    </div>
  );
}
