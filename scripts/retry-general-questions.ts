/**
 * 一般質問抽出が失敗した（generalQuestions = null）ドキュメントを再処理する。
 * チャンクサイズを小さく（4,000 tokens）して全チャンクを順番に試す。
 *
 * Usage: npm run retry-questions
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { extractGeneralQuestionsAllChunks } from "../src/lib/summarization/summarizer";
import { Prisma } from "../src/generated/prisma/client";

const WAIT_BETWEEN_DOCS_MS = 15_000;

async function main() {
  console.log("=== Retry General Questions (failed docs only) ===");

  // 定例会ドキュメントを全件取得し、JS 側で generalQuestions = null のものを絞り込む
  const allDocs = await prisma.document.findMany({
    where: {
      status: "parsed",
      session: { sessionType: "regular" },
      summary: { isNot: null },
    },
    include: {
      summary: { select: { generalQuestions: true } },
      speeches: {
        orderBy: { sequence: "asc" },
        select: { speakerNameRaw: true, speechText: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // null（抽出未実施）と空配列（チャンク1のみ処理されて質問が見つからなかった偽陰性）の両方をリトライ対象にする
  const docs = allDocs.filter((d) => {
    const gq = d.summary?.generalQuestions;
    return gq === null || (Array.isArray(gq) && (gq as unknown[]).length === 0);
  });

  console.log(`Found ${docs.length} document(s) with generalQuestions = null or [].`);

  if (docs.length === 0) {
    console.log("Nothing to retry.");
    return;
  }

  let processed = 0;
  let failed = 0;

  for (const doc of docs) {
    if (doc.speeches.length === 0) {
      console.log(`  SKIP: ${doc.title} (no speeches)`);
      continue;
    }

    console.log(`  PROCESSING: ${doc.title} (${doc.speeches.length} speeches)`);

    try {
      const questions = await extractGeneralQuestionsAllChunks(
        doc.speeches.map((s) => ({ speakerNameRaw: s.speakerNameRaw, speechText: s.speechText })),
      );

      await prisma.documentSummary.update({
        where: { documentId: doc.id },
        data: { generalQuestions: questions as unknown as Prisma.InputJsonValue },
      });

      console.log(`    OK: ${questions.length} general question(s)`);
      for (const q of questions) {
        console.log(`      - ${q.questioner}: ${q.topic}`);
      }

      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${doc.title} - ${msg}`);
      failed++;
    }

    if (processed + failed < docs.length) {
      await new Promise((r) => setTimeout(r, WAIT_BETWEEN_DOCS_MS));
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total:     ${docs.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed:    ${failed}`);
}

main().catch((err) => {
  console.error("retry-general-questions failed:", err);
  process.exit(1);
});
