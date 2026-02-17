import "dotenv/config";
import { extractText } from "../src/lib/ingestion/extractor";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const docs = await prisma.document.findMany({
    where: { status: "parsed" },
    include: { asset: true },
    take: 3,
  });

  for (const doc of docs) {
    if (!doc.asset) continue;
    console.log("=== Doc:", doc.title, "===");
    const pages = await extractText(doc.asset.storagePath);
    let done = false;
    for (const { page, text } of pages) {
      if (done) break;
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.trimStart().startsWith("○")) { done = true; break; }
        console.log("[p" + page + "] " + line);
      }
    }
    console.log("");
  }
  await prisma.$disconnect();
}
main();
