/**
 * 既存ドキュメントの published_on を URL から解析してバックフィルするスクリプト
 * Usage: npm run backfill-published-on
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { parseDateFromUrl } from "../src/lib/ingestion/db";

async function main() {
  const docs = await prisma.document.findMany({
    where: { publishedOn: null },
    select: { id: true, url: true, title: true },
  });

  console.log(`Found ${docs.length} document(s) without published_on`);

  let updated = 0;
  let skipped = 0;

  for (const doc of docs) {
    const date = parseDateFromUrl(doc.url);
    if (!date) {
      console.log(`  SKIP: "${doc.title}" — no date pattern in URL`);
      skipped++;
      continue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { publishedOn: date },
    });
    console.log(`  OK: "${doc.title}" → ${date.toISOString().slice(0, 10)}`);
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
