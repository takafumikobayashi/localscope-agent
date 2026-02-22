/**
 * 既存ドキュメントの title を URL から導出した会議名でバックフィルするスクリプト
 * Usage: npm run backfill-titles
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deriveMeetingTitle } from "../src/lib/ingestion/db";

async function main() {
  const docs = await prisma.document.findMany({
    select: { id: true, url: true, title: true },
  });

  console.log(`Found ${docs.length} document(s)`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const derived = deriveMeetingTitle(doc.url);
    if (!derived) {
      console.log(`  SKIP: "${doc.title}" — パターン不一致`);
      skipped++;
      continue;
    }
    if (doc.title === derived) {
      skipped++;
      continue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { title: derived },
    });
    console.log(`  OK: "${doc.title}" → "${derived}"`);
    updated++;
  }

  console.log(`\nDone. updated=${updated}, skipped=${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
