import "dotenv/config";
import { readdirSync, copyFileSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { computeSha256, getFileSize } from "../src/lib/ingestion/downloader";
import { PDF_DIR } from "../src/lib/ingestion/config";
import {
  upsertMunicipality,
  upsertSource,
  createIngestionRun,
  finalizeIngestionRun,
  upsertDocument,
  upsertDocumentAsset,
  updateDocumentStatus,
} from "../src/lib/ingestion/db";

// CLI引数パース
function parseArgs(): { dir: string; year: string } {
  const dirArg = process.argv.find((a) => a.startsWith("--dir="));
  const yearArg = process.argv.find((a) => a.startsWith("--year="));

  if (!dirArg) {
    console.error("Usage: npm run import-local -- --dir=<path> --year=<R6|R7>");
    process.exit(1);
  }

  return {
    dir: dirArg.split("=")[1],
    year: yearArg ? yearArg.split("=")[1] : "R6",
  };
}

/**
 * ファイル名からタイトルを推定
 */
function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ");
}

async function main() {
  const { dir, year } = parseArgs();

  if (!existsSync(dir)) {
    console.error(`Directory not found: ${dir}`);
    process.exit(1);
  }

  // PDFファイル列挙
  const pdfFiles = readdirSync(dir).filter((f) =>
    f.toLowerCase().endsWith(".pdf"),
  );

  if (pdfFiles.length === 0) {
    console.log(`No PDF files found in ${dir}`);
    return;
  }

  console.log(`=== Import Local PDFs: ${year} ===`);
  console.log(`Source dir: ${dir}`);
  console.log(`Found ${pdfFiles.length} PDF file(s).`);

  // シードデータ確認
  const municipalityId = await upsertMunicipality("広島県", "安芸高田市");
  const sourceId = await upsertSource(
    municipalityId,
    "安芸高田市議会 会議録",
    "https://www.akitakata.jp/ja/parliament/gikai201/",
  );

  const runId = await createIngestionRun(municipalityId, "manual");

  mkdirSync(PDF_DIR, { recursive: true });

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ file: string; error: string }> = [];

  for (const filename of pdfFiles) {
    try {
      const srcPath = path.join(dir, filename);
      const destPath = path.join(PDF_DIR, filename);
      const localUrl = `local://${filename}`;

      // ドキュメントupsert
      const doc = await upsertDocument({
        municipalityId,
        sourceId,
        url: localUrl,
        title: titleFromFilename(filename),
        sectionKind: "other",
      });

      // 既にダウンロード済みならスキップ
      if (doc.status === "downloaded" || doc.status === "extracted" || doc.status === "parsed") {
        console.log(`  SKIP: ${filename} (already ${doc.status})`);
        skipped++;
        continue;
      }

      // data/pdfs/ にコピー
      if (!existsSync(destPath)) {
        copyFileSync(srcPath, destPath);
      } else {
        // 既存ファイルとSHA比較
        const srcSha = await computeSha256(srcPath);
        const destSha = await computeSha256(destPath);
        if (srcSha !== destSha) {
          copyFileSync(srcPath, destPath);
        }
      }

      // SHA-256計算 + ファイルサイズ
      const sha256 = await computeSha256(destPath);
      const bytes = await getFileSize(destPath);

      // アセット保存
      await upsertDocumentAsset({
        documentId: doc.id,
        storagePath: destPath,
        sha256,
        bytes,
      });

      // ステータス更新
      await updateDocumentStatus(doc.id, "downloaded");

      console.log(
        `  OK: ${filename} (${bytes} bytes, sha256: ${sha256.slice(0, 12)}...)`,
      );
      imported++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAIL: ${filename} - ${msg}`);
      errors.push({ file: filename, error: msg });
      failed++;
    }
  }

  // Run完了
  const status =
    failed === 0 ? "success" : imported > 0 ? "partial" : "failed";
  await finalizeIngestionRun(runId, status, {
    year,
    trigger: "manual",
    source: dir,
    total: pdfFiles.length,
    imported,
    skipped,
    failed,
    errors,
  });

  // サマリー
  console.log("\n=== Summary ===");
  console.log(`Total:    ${pdfFiles.length}`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped:  ${skipped}`);
  console.log(`Failed:   ${failed}`);
  console.log(`Status:   ${status}`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
