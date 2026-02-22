import type { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "免責事項",
};

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <NavBar />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="font-mono text-2xl font-bold text-foreground mb-8 tracking-tight">
          免責事項
        </h1>

        <div className="space-y-8 font-sans text-sm text-muted-foreground leading-relaxed">

          <section>
            <h2 className="font-mono text-xs text-accent tracking-widest mb-3">
              公開情報の利用について
            </h2>
            <p>
              本サービスが表示する議事録・発言内容・発言者氏名はすべて、各地方公共団体が公式に公開している会議録に基づいています。
              掲載情報は地方自治法第123条および各地方公共団体の会議録公開規程に基づき公開されたものです。
            </p>
          </section>

          <section>
            <h2 className="font-mono text-xs text-accent tracking-widest mb-3">
              AI 処理による誤りの可能性
            </h2>
            <p>
              要約・トピック抽出・議題分析・一般質問テーマの抽出は AI（GPT-4o）による自動処理を含みます。
              処理結果には誤りや不正確な情報が含まれる場合があります。
              正確な情報については必ず原典（各地方公共団体公式サイトの会議録）をご確認ください。
            </p>
          </section>

          <section>
            <h2 className="font-mono text-xs text-accent tracking-widest mb-3">
              政治的中立性
            </h2>
            <p>
              本サービスが提供する発言数・発言量・トピック分布などの統計はデータの記述であり、
              議員・行政職員・政党の活動を評価・批判・推薦するものではありません。
              何を「良い議会活動」とするかは価値判断であり、本サービスのスコープ外です。
            </p>
          </section>

          <section>
            <h2 className="font-mono text-xs text-accent tracking-widest mb-3">
              免責
            </h2>
            <p>
              本サービスの情報を利用したことにより生じた損害・不利益について、運営者は責任を負いかねます。
              掲載情報の削除・修正に関するご要望は{" "}
              <a
                href="https://github.com/takafumikobayashi/localscope-agent/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                GitHub Issue
              </a>{" "}
              よりご連絡ください。
            </p>
          </section>

          <section>
            <h2 className="font-mono text-xs text-accent tracking-widest mb-3">
              著作権
            </h2>
            <p>
              会議録の著作権は各地方公共団体に帰属します。本サービスは情報の可視化・分析を目的とした非営利の公益的利用を意図しています。
            </p>
          </section>

        </div>

        <div className="mt-12 border-t border-card-border pt-6">
          <Link
            href="/"
            className="font-mono text-xs text-accent hover:underline"
          >
            ← トップへ戻る
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
