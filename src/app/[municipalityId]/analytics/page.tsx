import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsSummary } from "@/components/charts/analytics-summary";
import { GeneralQuestionBlocksChart } from "@/components/charts/general-question-blocks-chart";
import { TopicTrendLineChart } from "@/components/charts/topic-trend-line-chart";
import { SessionIntensityChart } from "@/components/charts/session-intensity-chart";
import { RoleDistributionChart } from "@/components/charts/role-distribution-chart";
import { SpeakerStyleScatterChart } from "@/components/charts/speaker-style-scatter-chart";
import {
  getTopicTrends,
  getSessionIntensity,
  getRoleDistribution,
  getSpeakerStyles,
  getGeneralQuestionBlocks,
} from "@/lib/db/analytics";

interface Props {
  params: Promise<{ municipalityId: string }>;
}

export default async function AnalyticsPage({ params }: Props) {
  const { municipalityId } = await params;

  const [
    citizenTopicTrends,
    sessionIntensity,
    roleDistribution,
    speakerStyles,
    generalQuestionBlocks,
  ] = await Promise.all([
    getTopicTrends(municipalityId, /* filterProcedural */ true),
    getSessionIntensity(municipalityId),
    getRoleDistribution(municipalityId),
    getSpeakerStyles(municipalityId),
    getGeneralQuestionBlocks(municipalityId),
  ]);

  // ── ① サマリー bullet points を既存データから計算 ──────────────
  const summaryBullets: string[] = [];

  // 直近会期の議論量
  if (sessionIntensity.length > 0) {
    const latest = sessionIntensity[sessionIntensity.length - 1];
    const avg =
      sessionIntensity.reduce((a, s) => a + s.totalChars, 0) / sessionIntensity.length;
    const pct = Math.round(((latest.totalChars - avg) / avg) * 100);
    const trend =
      pct > 10 ? `過去平均比 +${pct}%` : pct < -10 ? `過去平均比 ${pct}%` : "過去平均並み";
    summaryBullets.push(
      `直近会期（${latest.label}）の議論量：${(latest.totalChars / 10000).toFixed(1)}万文字（${trend}）`,
    );
  }

  // 一般質問 最多議論テーマ
  if (generalQuestionBlocks.length > 0) {
    const top = generalQuestionBlocks[0];
    const reiwa = top.fiscalYear - 2018;
    const num = top.sessionName.match(/第(\d+)回/)?.[1] ?? "?";
    summaryBullets.push(
      `一般質問 最多議論：「${top.topic}」${top.speechCount}発言・${top.totalChars.toLocaleString()}文字（${top.questioner} / R${reiwa}-${num}回）`,
    );
  }

  // 議員発言比率
  const totalSpeeches = roleDistribution.reduce((a, r) => a + r.count, 0);
  const councilorSpeeches = roleDistribution.find((r) => r.role === "councilor")?.count ?? 0;
  if (totalSpeeches > 0) {
    const pct = Math.round((councilorSpeeches / totalSpeeches) * 100);
    summaryBullets.push(
      `議員発言比率：${pct}%（全 ${totalSpeeches.toLocaleString()} 発言中）`,
    );
  }

  // 最長発言者（市長・議員のみ）
  const ranked = speakerStyles
    .filter((s) => s.role === "mayor" || s.role === "councilor")
    .sort((a, b) => b.avgLength - a.avgLength);
  if (ranked.length > 0) {
    const top = ranked[0];
    summaryBullets.push(
      `最長発言者：${top.name}（平均 ${top.avgLength.toLocaleString()} 文字/発言）`,
    );
  }

  return (
    <>
      <PageHeader
        title="Analytics"
        description="議会データ分析 — 量・関係性・スタイルの多角的可視化"
      />

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">

        {/* ① 今期のまとめ */}
        <Card className="md:col-span-6 animate-fade-in">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            📌 議会データ サマリー
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            直近データをもとに自動算出
          </p>
          <AnalyticsSummary bullets={summaryBullets} />
        </Card>

        {/* ② 何が議論されたか */}
        <Card className="md:col-span-6 animate-fade-in delay-1">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            一般質問 発言ブロック数ランキング
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            各一般質問テーマで交わされた発言数（質問者の発言開始〜次の質問者の発言開始まで）。
            ホバーで文字数・市長答弁数も確認できます
          </p>
          <GeneralQuestionBlocksChart data={generalQuestionBlocks} />
        </Card>

        {/* ③ どれだけ議論されたか */}
        <Card className="md:col-span-6 animate-fade-in delay-2">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            会期別 熱量チャート
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            棒グラフ＝総発言文字数（議論の深さ）、折れ線＝ユニーク発言者数（参加の広さ）
          </p>
          <SessionIntensityChart data={sessionIntensity} />
        </Card>

        {/* ④ 誰が話したか（横並び） */}
        <Card className="md:col-span-3 animate-fade-in delay-3">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            立場別 発言比率
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            議員・市長・行政職員など立場ごとの発言件数の割合
          </p>
          <RoleDistributionChart data={roleDistribution} />
        </Card>

        <Card className="md:col-span-3 animate-fade-in delay-3">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            発言スタイル分析
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            X軸＝発言件数、Y軸＝1発言あたりの平均文字数。点の位置で発言スタイルの違いが分かる
          </p>
          <SpeakerStyleScatterChart data={speakerStyles} />
        </Card>

        {/* ⑤ 何が増減しているか */}
        <Card className="md:col-span-6 animate-fade-in delay-4">
          <h2 className="font-mono text-sm font-bold text-foreground mb-1">
            市民関心キーワード推移（上位5トピック）
          </h2>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            議会運営語（補正予算・議事手続き等）を除いた市民関心テーマの出現頻度推移
          </p>
          <TopicTrendLineChart
            data={citizenTopicTrends.data}
            topics={citizenTopicTrends.topics}
          />
        </Card>

      </div>
    </>
  );
}
