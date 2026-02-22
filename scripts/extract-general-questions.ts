import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { extractGeneralQuestions } from "../src/lib/summarization/summarizer";
import { Prisma } from "../src/generated/prisma/client";

const WAIT_MS = 10_000;

async function main() {
  console.log("=== Extract General Questions ===");

  // 定例会 + parsed + summary あり のドキュメントを全件取得
  const docs = await prisma.document.findMany({
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

  console.log(`Found ${docs.length} regular session document(s).`);

  if (docs.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    if (doc.speeches.length === 0) {
      console.log(`  SKIP: ${doc.title} (no speeches)`);
      skipped++;
      continue;
    }

    try {
      console.log(`  PROCESSING: ${doc.title} (${doc.speeches.length} speeches)`);
      const questions = await extractGeneralQuestions(
        doc.speeches.map((s) => ({ speakerNameRaw: s.speakerNameRaw, speechText: s.speechText })),
      );

      await prisma.documentSummary.update({
        where: { documentId: doc.id },
        data: { generalQuestions: questions as unknown as Prisma.InputJsonValue },
      });

      console.log(`    OK: ${questions.length} general question(s)`);
      if (questions.length > 0) {
        for (const q of questions) {
          console.log(`      - ${q.questioner}: ${q.topic}`);
        }
      }

      processed++;

      // ドキュメント間のウェイト（レート制限対応）
      if (processed < docs.length) {
        await new Promise((r) => setTimeout(r, WAIT_MS));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${doc.title} - ${msg}`);
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total:     ${docs.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
}

main().catch((err) => {
  console.error("extract-general-questions failed:", err);
  process.exit(1);
});
