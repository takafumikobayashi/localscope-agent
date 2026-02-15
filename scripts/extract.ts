import "dotenv/config";
import { extractText } from "../src/lib/ingestion/extractor";
import { parseSpeeches } from "../src/lib/ingestion/parser";
import {
  getDownloadedDocuments,
  upsertSpeaker,
  deleteSpeeches,
  createSpeech,
  updateDocumentStatus,
} from "../src/lib/ingestion/db";

const CONFIDENCE_MAP = { high: 1.0, medium: 0.7, low: 0.3 } as const;

async function main() {
  console.log("=== Extract & Parse ===");

  const docs = await getDownloadedDocuments();
  console.log(`Found ${docs.length} document(s) with status=downloaded.`);

  if (docs.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      if (!doc.asset) {
        console.log(`  SKIP: ${doc.title} (no asset)`);
        skipped++;
        continue;
      }

      const filePath = doc.asset.storagePath;
      console.log(`  PROCESSING: ${doc.title}`);
      console.log(`    File: ${filePath}`);

      // テキスト抽出
      const pages = await extractText(filePath);
      console.log(`    Extracted ${pages.length} page(s)`);

      // パース
      const speeches = parseSpeeches(pages);
      console.log(`    Parsed ${speeches.length} speech(es)`);

      if (speeches.length === 0) {
        console.log(`    WARN: No speeches found, skipping DB insert`);
        skipped++;
        continue;
      }

      // 既存の発言を削除（べき等性）
      const deleted = await deleteSpeeches(doc.id);
      if (deleted > 0) {
        console.log(`    Deleted ${deleted} existing speech(es)`);
      }

      // 発言者upsert & 発言登録
      let seq = 0;
      for (const speech of speeches) {
        const speakerId = await upsertSpeaker(
          doc.municipalityId,
          speech.speakerName,
          speech.speakerRole,
        );

        await createSpeech({
          documentId: doc.id,
          speakerId,
          speakerNameRaw: speech.speakerNameRaw,
          sequence: seq++,
          speechText: speech.speechText,
          pageStart: speech.pageStart,
          pageEnd: speech.pageEnd,
          confidence: CONFIDENCE_MAP[speech.confidence],
        });
      }

      // ステータス更新
      await updateDocumentStatus(doc.id, "parsed");
      console.log(`    OK: ${speeches.length} speeches saved`);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${doc.title} - ${msg}`);
      failed++;
    }
  }

  // サマリー
  console.log("\n=== Summary ===");
  console.log(`Total:     ${docs.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);
}

main().catch((err) => {
  console.error("Extract failed:", err);
  process.exit(1);
});
