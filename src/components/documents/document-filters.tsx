"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface DocumentFiltersProps {
  municipalityId: string;
  fiscalYears: number[];
  sessionTypes: string[];
  showEmpty?: boolean;
}

const sessionTypeLabels: Record<string, string> = {
  regular: "定例会",
  extra: "臨時会",
  committee: "委員会",
  budget_committee: "予算委員会",
  other: "その他",
};

export function DocumentFilters({
  municipalityId,
  fiscalYears,
  sessionTypes,
  showEmpty = false,
}: DocumentFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentYear = searchParams.get("year") ?? "";
  const currentType = searchParams.get("type") ?? "";

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`/${municipalityId}/documents?${params.toString()}`);
    },
    [router, searchParams, municipalityId],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <label className="font-mono text-xs text-muted-foreground">Filter:</label>
      <select
        value={currentYear}
        onChange={(e) => updateFilter("year", e.target.value)}
        className="bg-card-bg border border-card-border rounded px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
      >
        <option value="">全年度</option>
        {fiscalYears.map((y) => (
          <option key={y} value={y}>
            R{y - 2018}（{y}）
          </option>
        ))}
      </select>
      <select
        value={currentType}
        onChange={(e) => updateFilter("type", e.target.value)}
        className="bg-card-bg border border-card-border rounded px-2 py-1 font-mono text-xs text-foreground focus:outline-none focus:border-accent"
      >
        <option value="">全種別</option>
        {sessionTypes.map((t) => (
          <option key={t} value={t}>
            {sessionTypeLabels[t] ?? t}
          </option>
        ))}
      </select>

      <button
        onClick={() => updateFilter("show_empty", showEmpty ? "" : "1")}
        className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {/* トグルスイッチ */}
        <span
          className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border transition-colors duration-200 ${
            showEmpty ? "bg-accent border-accent" : "bg-transparent border-card-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full transition-transform duration-200 ${
              showEmpty ? "translate-x-3.5 bg-background" : "translate-x-0.5 bg-muted-foreground"
            }`}
          />
        </span>
        発言なしを表示
      </button>
    </div>
  );
}
