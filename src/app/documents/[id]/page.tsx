import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { PageHeader } from "@/components/ui/page-header";
import { SpeechTimeline } from "@/components/documents/speech-timeline";
import { SpeakerBreakdown } from "@/components/documents/speaker-breakdown";
import { getDocumentDetail, getDocumentSpeakerBreakdown } from "@/lib/db/documents";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DocumentDetailPage({ params }: Props) {
  const { id } = await params;
  const [doc, speakerBreakdown] = await Promise.all([
    getDocumentDetail(id),
    getDocumentSpeakerBreakdown(id),
  ]);

  if (!doc) return notFound();

  const topics = (doc.summary?.topics ?? []) as string[];
  const keyPoints = (doc.summary?.keyPoints ?? []) as string[];

  return (
    <>
      <PageHeader title={doc.title} />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* AI Summary */}
        {doc.summary && (
          <Card className="md:col-span-4 animate-fade-in">
            <h2 className="font-mono text-sm font-bold text-foreground mb-3">
              AI 要約
            </h2>
            <p className="font-sans text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {doc.summary.summaryText}
            </p>

            {keyPoints.length > 0 && (
              <div className="mt-4">
                <h3 className="font-mono text-xs font-bold text-muted-foreground mb-2">
                  Key Points
                </h3>
                <ul className="space-y-1">
                  {keyPoints.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 font-sans text-xs text-muted-foreground"
                    >
                      <span className="text-accent mt-0.5">-</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {topics.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            )}

            <p className="mt-3 font-mono text-[10px] text-muted">
              model: {doc.summary.modelId} / tokens: {doc.summary.tokenCount}
            </p>
          </Card>
        )}

        {/* Document Info */}
        <Card className="md:col-span-2 animate-fade-in delay-1">
          <h2 className="font-mono text-sm font-bold text-foreground mb-3">
            ドキュメント情報
          </h2>
          <dl className="space-y-2 font-mono text-xs">
            <div>
              <dt className="text-muted-foreground">ステータス</dt>
              <dd className="text-foreground">{doc.status}</dd>
            </div>
            {doc.session && (
              <>
                <div>
                  <dt className="text-muted-foreground">年度</dt>
                  <dd className="text-foreground">
                    R{doc.session.fiscalYear - 2018}（{doc.session.fiscalYear}）
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">会議</dt>
                  <dd className="text-foreground">{doc.session.sessionName}</dd>
                </div>
              </>
            )}
            <div>
              <dt className="text-muted-foreground">発言数</dt>
              <dd className="text-accent font-bold">{doc.speeches.length}</dd>
            </div>
          </dl>
        </Card>

        {/* Speaker Breakdown */}
        <Card className="md:col-span-3 animate-fade-in delay-2">
          <h2 className="font-mono text-sm font-bold text-foreground mb-3">
            発言者内訳
          </h2>
          <SpeakerBreakdown data={speakerBreakdown} />
        </Card>

        {/* Speech Timeline */}
        <Card className="md:col-span-3 animate-fade-in delay-3">
          <h2 className="font-mono text-sm font-bold text-foreground mb-3">
            発言タイムライン ({doc.speeches.length}件)
          </h2>
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <SpeechTimeline speeches={doc.speeches} />
          </div>
        </Card>
      </div>
    </>
  );
}
