import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentFilters } from "@/components/documents/document-filters";
import { DocumentListItem } from "@/components/documents/document-list-item";
import {
  getDocumentList,
  getAvailableFiscalYears,
  getAvailableSessionTypes,
} from "@/lib/db/documents";

interface Props {
  searchParams: Promise<{ year?: string; type?: string }>;
}

export default async function DocumentsPage({ searchParams }: Props) {
  const params = await searchParams;
  const fiscalYear = params.year ? parseInt(params.year, 10) : undefined;
  const sessionType = params.type || undefined;

  const [documents, fiscalYears, sessionTypes] = await Promise.all([
    getDocumentList({ fiscalYear, sessionType }),
    getAvailableFiscalYears(),
    getAvailableSessionTypes(),
  ]);

  return (
    <>
      <PageHeader
        title="Documents"
        description={`議事録一覧 — ${documents.length}件`}
      />

      <Suspense>
        <DocumentFilters
          fiscalYears={fiscalYears}
          sessionTypes={sessionTypes}
        />
      </Suspense>

      <div className="space-y-3 animate-fade-in">
        {documents.map((doc) => (
          <DocumentListItem
            key={doc.id}
            id={doc.id}
            title={doc.title}
            speechCount={doc._count.speeches}
            summaryPreview={doc.summary?.summaryText ?? null}
            topics={(doc.summary?.topics ?? []) as string[]}
            fiscalYear={doc.session?.fiscalYear}
            sessionName={doc.session?.sessionName}
          />
        ))}
        {documents.length === 0 && (
          <p className="font-mono text-sm text-muted-foreground py-8 text-center">
            該当するドキュメントがありません
          </p>
        )}
      </div>
    </>
  );
}
