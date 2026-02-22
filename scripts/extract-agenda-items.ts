import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { extractAgendaItems } from "../src/lib/summarization/summarizer";
import { Prisma } from "../src/generated/prisma/client";

// JSON nullable フィールドを DB NULL でフィルターする
const DB_NULL = Prisma.DbNull;

const WAIT_MS = 10_000;

async function main() {
  console.log("=== Extract Agenda Items ===");

  const targetDocId = process.argv[2] ?? undefined;

  const docs = await prisma.document.findMany({
    where: {
      status: "parsed",
      summary: { is: { agendaItems: { equals: DB_NULL } } },
      ...(targetDocId ? { id: targetDocId } : {}),
    },
    include: {
      session: { select: { sessionType: true } },
      summary: { select: { agendaItems: true } },
      speeches: {
        orderBy: { sequence: "asc" },
        take: 100,
        select: { speakerNameRaw: true, speechText: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${docs.length} document(s) to process.`);

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

    const sessionType = doc.session?.sessionType ?? "other";

    try {
      console.log(
        `  PROCESSING: ${doc.title} [${sessionType}] (${doc.speeches.length} speeches sampled)`,
      );
      const items = await extractAgendaItems(
        doc.speeches.map((s) => ({ speakerNameRaw: s.speakerNameRaw, speechText: s.speechText })),
        sessionType,
      );

      await prisma.documentSummary.update({
        where: { documentId: doc.id },
        data: { agendaItems: items as unknown as Prisma.InputJsonValue },
      });

      console.log(`    OK: ${items.length} agenda item(s)`);
      for (const item of items) {
        const result = item.result ? ` [${item.result}]` : "";
        console.log(`      - ${item.title}${result}`);
      }

      processed++;

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
  console.error("extract-agenda-items failed:", err);
  process.exit(1);
});
