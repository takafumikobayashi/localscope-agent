import "dotenv/config";
import {
  getUnsummarizedDocuments,
  getAllParsedDocuments,
  upsertDocumentSummary,
} from "../src/lib/summarization/db";
import { summarizeDocument, estimateTokens, formatSpeeches } from "../src/lib/summarization/summarizer";

function parseArgs() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let force = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      limit = parseInt(arg.split("=")[1], 10);
    } else if (arg === "--force") {
      force = true;
    }
  }

  return { limit, force };
}

async function main() {
  const { limit, force } = parseArgs();

  console.log("=== Summarize Documents ===");
  console.log(`Mode: ${force ? "force (regenerate all)" : "incremental (unsummarized only)"}`);
  if (limit) console.log(`Limit: ${limit}`);

  const docs = force
    ? await getAllParsedDocuments()
    : await getUnsummarizedDocuments();

  const target = limit ? docs.slice(0, limit) : docs;
  console.log(`Found ${docs.length} document(s), processing ${target.length}.`);

  if (target.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  let processed = 0;
  let failed = 0;
  let totalTokens = 0;

  for (const doc of target) {
    try {
      if (doc.speeches.length === 0) {
        console.log(`  SKIP: ${doc.title} (no speeches)`);
        continue;
      }

      const estimated = estimateTokens(formatSpeeches(doc.speeches));
      console.log(`  PROCESSING: ${doc.title} (${doc.speeches.length} speeches, ~${estimated} tokens)`);

      const result = await summarizeDocument(doc.speeches);

      await upsertDocumentSummary({
        documentId: doc.id,
        summaryText: result.summary,
        topics: result.topics,
        keyPoints: result.keyPoints,
        modelId: "gpt-4o",
        tokenCount: result.totalTokens,
      });

      totalTokens += result.totalTokens;
      processed++;
      console.log(`    OK: ${result.topics.length} topics, ${result.keyPoints.length} key points, ${result.totalTokens} tokens`);

      // ドキュメント間のウェイト（TPM制限回避）
      await new Promise((r) => setTimeout(r, 5_000));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${doc.title} - ${msg}`);
      failed++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total:     ${target.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Tokens:    ${totalTokens}`);
}

main().catch((err) => {
  console.error("Summarize failed:", err);
  process.exit(1);
});
