import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { extractText } from "../src/lib/ingestion/extractor";
import { parseAttendees } from "../src/lib/ingestion/attendee-parser";
import { parseSpeeches } from "../src/lib/ingestion/parser";
import { SpeakerResolver } from "../src/lib/ingestion/speaker-resolver";
import {
  upsertAttendees,
  loadAliasMap,
  deleteSpeeches,
  createSpeech,
  updateDocumentStatus,
} from "../src/lib/ingestion/db";

/**
 * 再パーススクリプト
 *
 * 1. parsed ドキュメントを downloaded に戻す
 * 2. 全 downloaded ドキュメントを新ロジックで再パース（SpeakerResolver使用）
 *
 * 注: 孤立speaker削除は行わない（マスタ蓄積方針）
 */

const CONFIDENCE_MAP = { high: 1.0, medium: 0.7, low: 0.3 } as const;

async function main() {
  console.log("=== Reparse: Speaker Alias Migration ===\n");

  // Step 1: parsed → downloaded に戻す
  const resetResult = await prisma.document.updateMany({
    where: { status: "parsed" },
    data: { status: "downloaded" },
  });
  console.log(`Step 1: Reset ${resetResult.count} document(s) from parsed → downloaded`);

  // Step 2: 全 downloaded ドキュメントを再パース
  const docs = await prisma.document.findMany({
    where: { status: "downloaded" },
    include: { asset: true },
  });
  console.log(`Step 2: Found ${docs.length} document(s) to reparse\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const doc of docs) {
    try {
      if (!doc.asset) {
        console.log(`  SKIP: ${doc.title} (no asset)`);
        skipped++;
        continue;
      }

      const filePath = doc.asset.storagePath;
      console.log(`  PROCESSING: ${doc.title}`);

      // テキスト抽出
      const pages = await extractText(filePath);

      // 出席者リスト抽出
      const attendees = parseAttendees(pages);
      console.log(`    Attendees: ${attendees.length}`);

      // 出席者を speakers テーブルに upsert（alias も自動登録）
      const attendeeMap = await upsertAttendees(
        doc.municipalityId,
        attendees,
      );

      // alias マップ読み込み
      const aliasMap = await loadAliasMap(doc.municipalityId);

      // SpeakerResolver 構築
      const resolver = new SpeakerResolver(attendeeMap, aliasMap);

      // パース（純粋なテキストパーサー）
      const speeches = parseSpeeches(pages);
      console.log(`    Speeches: ${speeches.length}`);

      if (speeches.length === 0) {
        console.log(`    WARN: No speeches found, skipping`);
        skipped++;
        continue;
      }

      // 既存の発言を削除
      await deleteSpeeches(doc.id);

      // 発言者解決 & 発言登録
      let seq = 0;
      let matched = 0;
      let unmatched = 0;
      for (const speech of speeches) {
        const result = resolver.resolve(speech.speakerName, speech.speakerRole);

        if (result.speakerId) {
          matched++;
        } else {
          unmatched++;
        }

        await createSpeech({
          documentId: doc.id,
          speakerId: result.speakerId,
          speakerNameRaw: speech.speakerNameRaw,
          sequence: seq++,
          speechText: speech.speechText,
          pageStart: speech.pageStart,
          pageEnd: speech.pageEnd,
          confidence: CONFIDENCE_MAP[result.confidence],
        });
      }
      totalMatched += matched;
      totalUnmatched += unmatched;
      if (unmatched > 0) {
        console.log(`    WARN: ${unmatched}/${speeches.length} unmatched`);
      }

      await updateDocumentStatus(doc.id, "parsed");
      console.log(`    OK`);
      processed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${doc.title} - ${msg}`);
      failed++;
    }
  }

  // サマリー
  console.log("\n=== Summary ===");
  console.log(`Documents: ${docs.length}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failed}`);

  const totalSpeeches = totalMatched + totalUnmatched;
  if (totalSpeeches > 0) {
    const matchRate = ((totalMatched / totalSpeeches) * 100).toFixed(1);
    console.log(`\nMatch rate: ${totalMatched}/${totalSpeeches} (${matchRate}%)`);
  }

  // 最終的な speakers 数を確認
  const speakerCount = await prisma.speaker.count();
  const aliasCount = await prisma.speakerAlias.count();
  console.log(`\nSpeakers in DB: ${speakerCount}`);
  console.log(`Aliases in DB: ${aliasCount}`);
}

main()
  .catch((err) => {
    console.error("Reparse failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
