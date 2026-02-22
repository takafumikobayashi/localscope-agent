"use client";

interface SessionItem {
  id: string;
  fiscalYear: number;
  sessionName: string;
  sessionType: string;
  startOn: string | null;
  endOn: string | null;
  documentCount: number;
}

interface SessionTimelineChartProps {
  data: SessionItem[];
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; textColor: string }
> = {
  regular: { label: "定例会", color: "#00ff88", textColor: "#000" },
  extra: { label: "臨時会", color: "#0088ff", textColor: "#fff" },
  committee: { label: "委員会", color: "#ffcc00", textColor: "#000" },
  budget_committee: { label: "予算委員会", color: "#ff6600", textColor: "#fff" },
  other: { label: "その他", color: "#666", textColor: "#fff" },
};

function Badge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.other;
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[9px] font-mono font-bold"
      style={{ backgroundColor: cfg.color, color: cfg.textColor }}
    >
      {cfg.label}
    </span>
  );
}

export function SessionTimelineChart({ data }: SessionTimelineChartProps) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-sm text-muted-foreground">
        会期データがありません
      </p>
    );
  }

  // Group by fiscal year
  const byYear = new Map<number, SessionItem[]>();
  for (const s of data) {
    if (!byYear.has(s.fiscalYear)) byYear.set(s.fiscalYear, []);
    byYear.get(s.fiscalYear)!.push(s);
  }
  const years = Array.from(byYear.keys()).sort((a, b) => b - a);

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
      {years.map((year) => (
        <div key={year}>
          <p className="font-mono text-[10px] text-muted-foreground mb-2">
            令和{year - 2018}年度 ({year})
          </p>
          <div className="space-y-2">
            {byYear.get(year)!.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded border border-card-border px-3 py-2 bg-card/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge type={s.sessionType} />
                  <span className="font-mono text-xs text-foreground truncate">
                    {s.sessionName}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  {(s.startOn || s.endOn) && (
                    <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                      {s.startOn ?? "?"} 〜 {s.endOn ?? "?"}
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-accent whitespace-nowrap">
                    {s.documentCount} 件
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
