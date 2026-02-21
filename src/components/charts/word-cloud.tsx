"use client";

import { useEffect, useState } from "react";

interface WordData {
  word: string;
  count: number;
}

export function WordCloud() {
  const [words, setWords] = useState<WordData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/word-frequencies")
      .then((r) => r.json())
      .then((data: WordData[]) => {
        setWords(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="font-mono text-xs text-muted animate-pulse">
          Loading word cloud...
        </span>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground text-center py-8">
        ワードデータがありません。
        <br />
        <code className="text-accent text-xs">
          npm run compute-words
        </code>{" "}
        を実行してください。
      </p>
    );
  }

  const maxCount = words[0]?.count ?? 1;
  const minCount = words[words.length - 1]?.count ?? 1;
  const displayed = words.slice(0, 100);

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 p-4">
      {displayed.map((w, i) => {
        const ratio = (w.count - minCount) / (maxCount - minCount || 1);
        const fontSize = 10 + ratio * 28; // 10px - 38px
        const baseOpacity = 0.4 + ratio * 0.6;
        const baseColor =
          ratio > 0.7 ? "#00ff88" : ratio > 0.4 ? "#00cc6a" : "#999";
        // 出現アニメーション用ディレイ（最大600ms）
        const delay = `${(i % 30) * 20}ms`;

        return (
          <span
            key={w.word}
            className="word-cloud-item font-mono cursor-default"
            style={{
              fontSize: `${fontSize}px`,
              opacity: baseOpacity,
              color: baseColor,
              animationDelay: delay,
              // ホバー用CSS変数としてglowカラーを渡す
              ["--glow-color" as string]: "rgba(0, 255, 136, 0.7)",
            }}
            title={`${w.word}: ${w.count}`}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
}
