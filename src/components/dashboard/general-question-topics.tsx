import Link from "next/link";
import type { GeneralQuestionRow } from "@/lib/db/dashboard";

interface Props {
  data: GeneralQuestionRow[];
  municipalityId: string;
}

export function GeneralQuestionTopics({ data, municipalityId }: Props) {
  if (data.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground py-4 text-center">
        一般質問データがありません
        <br />
        <span className="text-[10px]">（npm run extract-questions を実行してください）</span>
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {data.map((row, i) => (
        <li key={i}>
          <Link
            href={`/${municipalityId}/documents/${row.documentId}`}
            className="flex items-baseline gap-2 group rounded px-1 py-0.5 -mx-1 hover:bg-card-border/30 transition-colors"
          >
            <span className="font-mono text-[11px] text-muted-foreground shrink-0 w-20 truncate">
              {row.questioner}
            </span>
            <span className="font-mono text-xs text-foreground group-hover:text-accent transition-colors flex-1 truncate">
              {row.topic}
            </span>
            {row.sessionName && (
              <span className="font-mono text-[10px] text-muted shrink-0 hidden md:inline">
                {row.sessionName}
              </span>
            )}
            <span className="font-mono text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
