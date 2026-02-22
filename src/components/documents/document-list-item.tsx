import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

interface GeneralQuestion {
  questioner: string;
  topic: string;
}

interface AgendaItem {
  title: string;
  result?: string;
  notes?: string;
}

interface DocumentListItemProps {
  municipalityId: string;
  id: string;
  title: string;
  speechCount: number;
  summaryPreview?: string | null;
  topics: string[];
  fiscalYear?: number | null;
  sessionName?: string | null;
  sessionType?: string | null;
  generalQuestions?: GeneralQuestion[] | null;
  agendaItems?: AgendaItem[] | null;
}

export function DocumentListItem({
  municipalityId,
  id,
  title,
  speechCount,
  summaryPreview,
  topics,
  fiscalYear,
  sessionName,
  sessionType,
  generalQuestions,
  agendaItems,
}: DocumentListItemProps) {
  return (
    <Link href={`/${municipalityId}/documents/${id}`}>
      <Card className="hover:border-accent/30 transition-colors group">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-mono text-sm font-bold text-foreground group-hover:text-accent transition-colors truncate">
              {title}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              {fiscalYear && (
                <span className="font-mono text-[10px] text-muted">
                  R{fiscalYear - 2018}
                </span>
              )}
              {sessionName && (
                <span className="font-mono text-[10px] text-muted">
                  {sessionName}
                </span>
              )}
              <span className="font-mono text-[10px] text-muted">
                {speechCount} speeches
              </span>
            </div>
            {summaryPreview && (
              <p className="mt-2 font-sans text-xs text-muted-foreground line-clamp-2">
                {summaryPreview}
              </p>
            )}
          </div>
        </div>
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {topics.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
          </div>
        )}
        {sessionType === "regular" && generalQuestions && generalQuestions.length > 0 && (
          <div className="mt-3 border-t border-card-border pt-3">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">
              一般質問
            </p>
            <ul className="space-y-0.5">
              {generalQuestions.slice(0, 5).map((q, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground shrink-0">
                    {q.questioner}
                  </span>
                  <span className="font-mono text-[11px] text-foreground">
                    {q.topic}
                  </span>
                </li>
              ))}
              {generalQuestions.length > 5 && (
                <li className="font-mono text-[11px] text-muted">
                  他{generalQuestions.length - 5}件
                </li>
              )}
            </ul>
          </div>
        )}
        {agendaItems && agendaItems.length > 0 && (
          <div className="mt-3 border-t border-card-border pt-3">
            <p className="font-mono text-[10px] text-muted uppercase tracking-wider mb-1.5">
              審議事項
            </p>
            <ul className="space-y-0.5">
              {agendaItems.slice(0, 5).map((item, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] text-foreground flex-1 min-w-0">
                    {item.title}
                  </span>
                  {item.result && (
                    <span
                      className={`font-mono text-[11px] shrink-0 ${
                        item.result === "否決"
                          ? "text-red-400"
                          : "text-accent"
                      }`}
                    >
                      {item.result}
                    </span>
                  )}
                </li>
              ))}
              {agendaItems.length > 5 && (
                <li className="font-mono text-[11px] text-muted">
                  他{agendaItems.length - 5}件
                </li>
              )}
            </ul>
          </div>
        )}
      </Card>
    </Link>
  );
}
