"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const STORAGE_KEY = "localscope-disclaimer-dismissed";

export function DisclaimerBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-card-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl flex items-center gap-4 px-4 py-3">
        <p className="font-mono text-[11px] text-muted-foreground flex-1 leading-relaxed">
          本サービスは各地方公共団体の公開議事録を取得・構造化・表示するものです。
          表示内容は AI 処理を含むため不正確な場合があります。発言統計はデータの記述であり、個人・活動の評価を目的としません。
          <Link href="/disclaimer" className="text-accent hover:underline ml-1">
            免責事項
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors border border-card-border rounded px-2 py-1"
          aria-label="閉じる"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
