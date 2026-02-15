import "dotenv/config";
import { upsertMunicipality, upsertSource } from "../src/lib/ingestion/db";

async function main() {
  console.log("Seeding municipality and source data...");

  // 安芸高田市（広島県）をupsert
  const municipalityId = await upsertMunicipality("広島県", "安芸高田市");
  console.log(`Municipality: 広島県 安芸高田市 (${municipalityId})`);

  // ソース（会議録ページ）をupsert
  const sourceId = await upsertSource(
    municipalityId,
    "安芸高田市議会 会議録",
    "https://www.akitakata.jp/ja/parliament/gikai201/",
  );
  console.log(`Source: 安芸高田市議会 会議録 (${sourceId})`);

  console.log("Seed completed.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
