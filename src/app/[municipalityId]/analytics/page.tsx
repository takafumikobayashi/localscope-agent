import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { WordCloud } from "@/components/charts/word-cloud";
import { TopicTrendChart } from "@/components/charts/topic-trend-chart";
import { SpeakerRankingChart } from "@/components/charts/speaker-ranking-chart";
import { getTopicTrends, getSpeakerStats } from "@/lib/db/analytics";

interface Props {
  params: Promise<{ municipalityId: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const { municipalityId } = await params;

  const [topicTrends, speakerStats] = await Promise.all([
    getTopicTrends(municipalityId),
    getSpeakerStats(municipalityId),
  ]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="議会データ分析 — ワードクラウド・トピック推移・発言者統計"
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {/* Word Cloud */}
        <Card className="md:col-span-6 animate-fade-in">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            ワードクラウド
          </h2>
          <WordCloud />
        </Card>

        {/* Topic Trends */}
        <Card className="md:col-span-3 animate-fade-in delay-1">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            トピック推移（年度別）
          </h2>
          <TopicTrendChart
            data={topicTrends.data}
            topics={topicTrends.topics}
          />
        </Card>

        {/* Speaker Stats */}
        <Card className="md:col-span-3 animate-fade-in delay-2">
          <h2 className="font-mono text-sm font-bold text-foreground mb-4">
            発言者統計（上位30名）
          </h2>
          <SpeakerRankingChart data={speakerStats} />
        </Card>
      </div>
    </>
  );
}
