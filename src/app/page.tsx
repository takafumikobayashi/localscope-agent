import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import { Card } from "@/components/ui/card";
import { getMunicipalities } from "@/lib/db/municipalities";

export const metadata: Metadata = {
  title: "LocalScope Agent — 地方議会を、透明に。",
  description:
    "公開されている ≠ 使える。議事録 PDF を発言単位の構造化データに変換し、AI 分析・多角可視化・Agent API を提供するシビックインテリジェンス基盤。",
  twitter: {
    card: "summary_large_image",
    title: "LocalScope Agent — 地方議会を、透明に。",
    description:
      "公開されている ≠ 使える。議事録 PDF を発言単位の構造化データに変換し、AI 分析・多角可視化・Agent API を提供するシビックインテリジェンス基盤。",
  },
};

const FEATURES = [
  {
    label: "構造化",
    desc: "PDF を発言単位のデータへ変換。発言者解決・議題抽出・一般質問分析まで全自動で構造化し、機械可読な形式で保持。",
  },
  {
    label: "AI 分析",
    desc: "GPT-4o が要約・トピック・審議結果・一般質問テーマを抽出。評価でなく事実の記述に特化した設計。",
  },
  {
    label: "Agent 対応",
    desc: "構造化データは人間のダッシュボードだけでなく、AI エージェントが直接クエリできる API 基盤として設計。MCP 対応を準備中。",
  },
];

export default async function LandingPage() {
  const municipalities = await getMunicipalities();

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8">

        {/* Hero */}
        <section className="py-16 md:py-24 animate-fade-in">
          <p className="font-mono text-xs text-accent tracking-widest mb-4">
            CIVIC INTELLIGENCE PLATFORM
          </p>
          <h1 className="font-mono text-3xl md:text-5xl font-bold text-foreground leading-tight tracking-tight">
            地方議会を、<span className="text-accent glow">透明</span>に。
          </h1>
          <p className="mt-6 font-sans text-sm md:text-base text-muted-foreground max-w-2xl leading-relaxed">
            地方議会の会議録を自動収集・AI 要約・可視化するシビックインテリジェンス基盤。
            誰が・何を・どれだけ話したかを市民の手に届ける。
            <span className="text-foreground">公開されているが使えない状態の議事録を、人間にも AI エージェントにも読める構造化データへ。</span>
          </p>

          {/* Feature pills */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`border border-card-border rounded p-4 animate-fade-in delay-${i + 1}`}
              >
                <p className="font-mono text-xs text-accent mb-2">{f.label}</p>
                <p className="font-sans text-xs text-muted-foreground leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-card-border mb-10" />

        <div className="mb-8">
          <h2 className="font-mono text-lg font-bold text-foreground tracking-tight">
            地方公共団体を選択
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            分析する地方公共団体の議会データを選択してください
          </p>
        </div>

        {municipalities.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground py-16 text-center">
            登録されている地方公共団体がありません
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {municipalities.map((m) => (
              <Link key={m.id} href={`/${m.id}`}>
                <Card className="hover:border-accent/30 transition-colors group h-full">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h2 className="font-mono text-base font-bold text-foreground group-hover:text-accent transition-colors">
                        {m.nameJa}
                      </h2>
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {m.prefectureJa}
                      </p>
                    </div>
                    {m.documentCount === 0 && (
                      <span className="shrink-0 font-mono text-[10px] border border-muted-foreground/30 text-muted-foreground rounded px-1.5 py-0.5">
                        準備中
                      </span>
                    )}
                  </div>
                  <dl className="grid grid-cols-2 gap-2 mt-4">
                    <div>
                      <dt className="font-mono text-[10px] text-muted-foreground">
                        議事録
                      </dt>
                      <dd className="font-mono text-sm font-bold text-accent">
                        {m.documentCount.toLocaleString()}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[10px] text-muted-foreground">
                        発言者
                      </dt>
                      <dd className="font-mono text-sm font-bold text-accent">
                        {m.speakerCount.toLocaleString()}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
