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
  params: Promise<{ municipalityId: string }>;
  searchParams: Promise<{ year?: string; type?: string; topic?: string; gq_topic?: string }>;
}

export default async function DocumentsPage({ params, searchParams }: Props) {
  const { municipalityId } = await params;
  const sp = await searchParams;
  const fiscalYear = sp.year ? parseInt(sp.year, 10) : undefined;
  const sessionType = sp.type || undefined;
  const topic = sp.topic || undefined;
  const gqTopic = sp.gq_topic || undefined;

  const [documents, fiscalYears, sessionTypes] = await Promise.all([
    getDocumentList(municipalityId, { fiscalYear, sessionType, topic, gqTopic }),
    getAvailableFiscalYears(municipalityId),
    getAvailableSessionTypes(municipalityId),
  ]);

  return (
    <>
      <PageHeader
        title="Documents"
        description={`議事録一覧 — ${documents.length}件`}
      />

      <Suspense>
        <DocumentFilters
          municipalityId={municipalityId}
          fiscalYears={fiscalYears}
          sessionTypes={sessionTypes}
        />
      </Suspense>

      <div className="space-y-3 animate-fade-in">
        {documents.map((doc) => (
          <DocumentListItem
            key={doc.id}
            municipalityId={municipalityId}
            id={doc.id}
            title={doc.title}
            speechCount={doc._count.speeches}
            summaryPreview={doc.summary?.summaryText ?? null}
            topics={(doc.summary?.topics ?? []) as string[]}
            fiscalYear={doc.session?.fiscalYear}
            sessionName={doc.session?.sessionName}
            sessionType={doc.session?.sessionType ?? null}
            generalQuestions={
              (doc.summary?.generalQuestions ?? null) as
                | { questioner: string; topic: string }[]
                | null
            }
            agendaItems={
              (doc.summary?.agendaItems ?? null) as
                | { title: string; result?: string; notes?: string }[]
                | null
            }
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
