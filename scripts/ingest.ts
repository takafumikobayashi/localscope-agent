import "dotenv/config";
import { YEAR_PAGES } from "../src/lib/ingestion/config";
import { scrapeMinutesPage } from "../src/lib/ingestion/scraper";
import { downloadPdf, sleep } from "../src/lib/ingestion/downloader";
import {
  upsertMunicipality,
  upsertSource,
  createIngestionRun,
  finalizeIngestionRun,
  upsertDocument,
  upsertDocumentAsset,
  updateDocumentStatus,
} from "../src/lib/ingestion/db";
import type { IngestionContext } from "../src/lib/ingestion/types";

// CLI引数パース
function parseArgs(): { year: string } {
  const yearArg = process.argv.find((a) => a.startsWith("--year="));
  const year = yearArg ? yearArg.split("=")[1] : "R6";
  return { year };
}

async function main() {
  const { year } = parseArgs();
  const pageUrl = YEAR_PAGES[year];

  if (!pageUrl) {
    console.error(
      `Unknown year: ${year}. Available: ${Object.keys(YEAR_PAGES).join(", ")}`,
    );
    process.exit(1);
  }

  console.log(`=== Ingestion: ${year} ===`);
  console.log(`Page URL: ${pageUrl}`);

  // シードデータ確認
  const municipalityId = await upsertMunicipality("広島県", "安芸高田市");
  const sourceId = await upsertSource(
    municipalityId,
    "安芸高田市議会 会議録",
    "https://www.akitakata.jp/ja/parliament/gikai201/",
  );

  const ctx: IngestionContext = {
    municipalityId,
    sourceId,
    runId: await createIngestionRun(municipalityId, "manual"),
  };

  console.log(`Ingestion run: ${ctx.runId}`);

  // スクレイプ
  console.log("Scraping PDF links...");
  const links = await scrapeMinutesPage(pageUrl, year);
  console.log(`Found ${links.length} PDF link(s).`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ url: string; error: string }> = [];

  for (const link of links) {
    try {
      // ドキュメントupsert
      const doc = await upsertDocument({
        municipalityId: ctx.municipalityId,
        sourceId: ctx.sourceId,
        url: link.url,
        title: link.title,
        sectionKind: link.sectionKind,
      });

      // 既にダウンロード済みならスキップ
      if (doc.status === "downloaded" || doc.status === "extracted" || doc.status === "parsed") {
        console.log(`  SKIP: ${link.title} (already ${doc.status})`);
        skipped++;
        continue;
      }

      // ダウンロード
      console.log(`  DOWNLOADING: ${link.title}`);
      const result = await downloadPdf(link.url);

      // アセット保存
      await upsertDocumentAsset({
        documentId: doc.id,
        storagePath: result.storagePath,
        sha256: result.sha256,
        bytes: result.bytes,
      });

      // ステータス更新
      await updateDocumentStatus(doc.id, "downloaded");

      console.log(
        `  OK: ${link.title} (${result.bytes} bytes, sha256: ${result.sha256.slice(0, 12)}...)`,
      );
      downloaded++;

      // ポライトアクセス
      await sleep();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${link.title} - ${msg}`);
      errors.push({ url: link.url, error: msg });
      failed++;
    }
  }

  // Run完了
  const status = failed === 0 ? "success" : downloaded > 0 ? "partial" : "failed";
  await finalizeIngestionRun(ctx.runId, status, {
    year,
    total: links.length,
    downloaded,
    skipped,
    failed,
    errors,
  });

  // サマリー
  console.log("\n=== Summary ===");
  console.log(`Total:      ${links.length}`);
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped:    ${skipped}`);
  console.log(`Failed:     ${failed}`);
  console.log(`Status:     ${status}`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
