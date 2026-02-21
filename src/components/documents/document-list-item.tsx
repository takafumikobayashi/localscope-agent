import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";

interface DocumentListItemProps {
  municipalityId: string;
  id: string;
  title: string;
  speechCount: number;
  summaryPreview?: string | null;
  topics: string[];
  fiscalYear?: number | null;
  sessionName?: string | null;
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
      </Card>
    </Link>
  );
}
