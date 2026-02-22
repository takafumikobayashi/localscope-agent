import "dotenv/config";
import { extractText } from "../src/lib/ingestion/extractor";
import { parseAttendees } from "../src/lib/ingestion/attendee-parser";
import { parseSpeeches } from "../src/lib/ingestion/parser";
import { SpeakerResolver } from "../src/lib/ingestion/speaker-resolver";
import {
  getDownloadedDocuments,
  upsertAttendees,
  loadAliasMap,
  upsertSpeakerAlias,
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

      // 出席者リスト抽出
      const attendees = parseAttendees(pages);
      console.log(`    Found ${attendees.length} attendee(s) in preamble`);

      // 出席者を speakers テーブルに upsert（alias も自動登録）
      const attendeeMap = await upsertAttendees(
        doc.municipalityId,
        attendees,
      );
      console.log(`    Upserted ${attendeeMap.byFullName.size} speaker(s) from attendees`);

      // alias マップ読み込み
      const aliasMap = await loadAliasMap(doc.municipalityId);
      console.log(`    Loaded ${aliasMap.size} alias(es)`);

      // SpeakerResolver 構築
      const resolver = new SpeakerResolver(attendeeMap, aliasMap);

      // パース（純粋なテキストパーサー）
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
          // 未解決の発言者名を alias として登録（speech_derived）
          await upsertSpeakerAlias(
            doc.municipalityId,
            "", // speakerId が不明なので登録しない
            speech.speakerName,
            "speech_derived",
            0.3,
          ).catch(() => {
            // speakerId が空なので alias 登録はスキップ
          });
        }

        await createSpeech({
          documentId: doc.id,
          sessionId: doc.sessionId,
          speakerId: result.speakerId,
          speakerNameRaw: speech.speakerNameRaw,
          sequence: seq++,
          speechText: speech.speechText,
          pageStart: speech.pageStart,
          pageEnd: speech.pageEnd,
          confidence: CONFIDENCE_MAP[result.confidence],
        });
      }
      if (unmatched > 0) {
        console.log(`    WARN: ${unmatched}/${speeches.length} speeches unmatched (speaker_id=NULL)`);
      }

      // ステータス更新
      await updateDocumentStatus(doc.id, "parsed");
      console.log(`    OK: ${speeches.length} speeches saved (matched: ${matched}, unmatched: ${unmatched})`);
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
