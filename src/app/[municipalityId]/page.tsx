import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Tag } from "@/components/ui/tag";
import { PageHeader } from "@/components/ui/page-header";
import { SpeakerRankingChart } from "@/components/charts/speaker-ranking-chart";
import { SpeechCountChart } from "@/components/charts/speech-count-chart";
import { TopicWordCloud } from "@/components/charts/topic-word-cloud";
import { GeneralQuestionTopics } from "@/components/dashboard/general-question-topics";
import {
  getDashboardStats,
  getRecentDocuments,
  getTopicFrequencies,
  getSpeakerRanking,
  getGeneralQuestionTopics,
} from "@/lib/db/dashboard";
import { getSpeechCountByDocument } from "@/lib/db/analytics";
import { getMunicipalityById } from "@/lib/db/municipalities";

interface Props {
  params: Promise<{ municipalityId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { municipalityId } = await params;
  const municipality = await getMunicipalityById(municipalityId);
  if (!municipality) return {};

  const title = `${municipality.nameJa} Dashboard`;
  const description = `${municipality.nameJa}（${municipality.prefectureJa}）の議会会議録分析ダッシュボード。発言者ランキング・頻出トピック・最新議事録を一覧表示。`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      title,
      description,
    },
  };
}

export default async function DashboardPage({ params }: Props) {
  const { municipalityId } = await params;

  const [stats, recentDocs, topicFreqs, speakerRanking, speechCountByDoc, generalQuestionTopics] =
    await Promise.all([
      getDashboardStats(municipalityId),
      getRecentDocuments(municipalityId),
      getTopicFrequencies(municipalityId),
      getSpeakerRanking(municipalityId),
      getSpeechCountByDocument(municipalityId),
      getGeneralQuestionTopics(municipalityId),
    ]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="市政インテリジェンス基盤 — 議会会議録分析"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 animate-fade-in">
        <StatCard label="総議事録数" value={stats.totalDocuments} />
        <StatCard label="総発言数" value={stats.totalSpeeches} />
        <StatCard label="発言者数" value={stats.totalSpeakers} />
        <StatCard
          label="要約済み"
          value={stats.totalSummaries}
          sub={`${stats.totalDocuments > 0 ? Math.round((stats.totalSummaries / stats.totalDocuments) * 100) : 0}%`}
        />
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Recent Documents */}
        <Card className="md:col-span-3 animate-fade-in delay-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-mono text-sm font-bold text-foreground">
              直近の議事録
            </h2>
            <Link
              href={`/${municipalityId}/documents`}
              className="font-mono text-xs text-accent hover:underline"
            >
              全件表示 →
            </Link>
          </div>
          <ul className="space-y-3">
            {recentDocs.map((doc) => {
              const topics = (doc.summary?.topics ?? []) as string[];
              return (
                <li key={doc.id}>
                  <Link
                    href={`/${municipalityId}/documents/${doc.id}`}
                    className="block group rounded p-2 -mx-2 hover:bg-card-border/30 transition-colors"
                  >
                    <p className="font-mono text-sm text-foreground group-hover:text-accent transition-colors truncate">
                      {doc.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] text-muted">
                        {doc._count.speeches} speeches
                      </span>
                      {topics.slice(0, 3).map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* General Question Topics */}
        <Card className="md:col-span-3 animate-fade-in delay-2">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            一般質問 頻出テーマ
          </h2>
          <GeneralQuestionTopics
            data={generalQuestionTopics}
            municipalityId={municipalityId}
          />
        </Card>

        {/* Topic Word Cloud */}
        <Card className="md:col-span-6 animate-fade-in delay-3">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            頻出トピック
          </h2>
          <TopicWordCloud data={topicFreqs} />
        </Card>

        {/* Speech Count by Document */}
        <Card className="md:col-span-6 animate-fade-in delay-4">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            議事録別発言数
          </h2>
          <SpeechCountChart data={speechCountByDoc} />
        </Card>

        {/* Speaker Ranking */}
        <Card className="md:col-span-6 animate-fade-in delay-4">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            発言者ランキング（上位15名）
          </h2>
          <SpeakerRankingChart data={speakerRanking} />
        </Card>
      </div>
    </>
  );
}
