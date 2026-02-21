import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import { Card } from "@/components/ui/card";
import { getMunicipalities } from "@/lib/db/municipalities";

export const metadata: Metadata = {
  title: "LocalScope Agent — 地方議会を、透明に。",
  description:
    "地方議会の会議録を自動収集・AI 要約・可視化するシビックインテリジェンス基盤。誰が・何を・どれだけ話したかを市民の手に届ける。",
  openGraph: {
    title: "LocalScope Agent — 地方議会を、透明に。",
    description:
      "地方議会の会議録を自動収集・AI 要約・可視化するシビックインテリジェンス基盤。誰が・何を・どれだけ話したかを市民の手に届ける。",
    type: "website",
  },
  twitter: {
    title: "LocalScope Agent — 地方議会を、透明に。",
    description:
      "地方議会の会議録を自動収集・AI 要約・可視化するシビックインテリジェンス基盤。誰が・何を・どれだけ話したかを市民の手に届ける。",
  },
};

const FEATURES = [
  {
    label: "自動収集",
    desc: "議事録PDFをスクレイピングで定期取得。テキスト抽出・発言単位の構造化まで全自動。",
  },
  {
    label: "AI 要約",
    desc: "GPT-4o が議事録を要約し、トピック・重要ポイントを抽出。膨大な会議録を数秒で把握。",
  },
  {
    label: "可視化",
    desc: "発言者ランキング・ワードクラウド・トピック推移など、データをインタラクティブに探索。",
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
            地方議会の会議録は公開されているが、検索・分析が難しく市民が実態を把握しにくい。
            LocalScope は議事録 PDF を自動収集・構造化し、AI 要約と統計分析を通じて
            <span className="text-foreground">「誰が・何を・どれだけ話したか」</span>
            を可視化するシビックインテリジェンス基盤です。
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
            自治体を選択
          </h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            分析する地方自治体の議会データを選択してください
          </p>
        </div>

        {municipalities.length === 0 ? (
          <p className="font-mono text-sm text-muted-foreground py-16 text-center">
            登録されている自治体がありません
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
