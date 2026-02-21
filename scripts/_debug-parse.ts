import "dotenv/config";
import { extractText } from "../src/lib/ingestion/extractor";
import { parseAttendees } from "../src/lib/ingestion/attendee-parser";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const docs = await prisma.document.findMany({
    where: { status: "parsed" },
    include: { asset: true },
    take: 5,
  });

  for (const doc of docs) {
    if (!doc.asset) continue;
    console.log("=== Doc:", doc.title, "===");
    const pages = await extractText(doc.asset.storagePath);
    const attendees = parseAttendees(pages);

    // 名前が5文字以上のもの（怪しい）
    const suspicious = attendees.filter(a => a.fullName.length > 5);
    if (suspicious.length > 0) {
      console.log("  Suspicious names:");
      for (const a of suspicious) {
        console.log(`    [${a.category}] role="${a.role}" fullName="${a.fullName}" family="${a.familyName}"`);
      }
    }
    console.log(`  Total: ${attendees.length}, Suspicious: ${suspicious.length}`);
    console.log("");
  }
  await prisma.$disconnect();
}
main();
