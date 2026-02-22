/**
 * 本番DB → 開発DB データコピースクリプト
 * Usage: tsx scripts/copy-db.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const PROD_URL = process.env.DATABASE_URL!;
const DEV_URL = process.env.DEV_DATABASE_URL!;

if (!PROD_URL || !DEV_URL) {
  console.error("DATABASE_URL and DEV_DATABASE_URL must be set in .env");
  process.exit(1);
}

const prod = new Pool({ connectionString: PROD_URL });
const dev = new Pool({ connectionString: DEV_URL });

async function copyTable(
  tableName: string,
  columns: string[],
  prodClient: import("pg").PoolClient,
  devClient: import("pg").PoolClient,
) {
  const { rows } = await prodClient.query(
    `SELECT ${columns.map((c) => `"${c}"`).join(", ")} FROM "${tableName}"`,
  );

  await devClient.query(`DELETE FROM "${tableName}"`);

  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows (cleared)`);
    return;
  }

  // pg がJSONB列をオブジェクトとして返すため、オブジェクト/配列はJSON文字列化して渡す
  // ただし Date はタイムスタンプ列用にそのまま渡す（stringify すると引用符付き文字列になる）
  const serialize = (v: unknown) =>
    v !== null && typeof v === "object" && !(v instanceof Date) ? JSON.stringify(v) : v;

  // INSERT は1000行ずつバッチ処理
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batchRows = rows.slice(i, i + BATCH);
    const batchPlaceholders = batchRows.map(
      (_, rowIdx) =>
        `(${columns.map((_, colIdx) => `$${rowIdx * columns.length + colIdx + 1}`).join(", ")})`,
    );
    const batchValues = batchRows.flatMap((row) => columns.map((c) => serialize(row[c])));
    await devClient.query(
      `INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES ${batchPlaceholders.join(", ")}`,
      batchValues,
    );
    inserted += batchRows.length;
  }
  console.log(`  ${tableName}: ${inserted} rows copied`);
}

async function main() {
  console.log("Starting DB copy: prod → dev\n");

  const prodClient = await prod.connect();
  const devClient = await dev.connect();

  try {
    // FK制約を一時的に無効化してコピー
    await devClient.query("SET session_replication_role = replica");

    // コピー順序（FK依存関係に従う）
    const tables: [string, string[]][] = [
      ["municipalities", ["id", "name_ja", "name_en", "prefecture_ja", "code_jis", "created_at", "updated_at"]],
      ["sources", ["id", "municipality_id", "source_type", "title", "url", "is_active", "created_at", "updated_at"]],
      ["sessions", ["id", "municipality_id", "fiscal_year", "session_name", "session_type", "held_on", "start_on", "end_on", "created_at", "updated_at"]],
      ["speakers", ["id", "municipality_id", "name_ja", "role", "party", "term_start_on", "term_end_on", "created_at", "updated_at"]],
      ["documents", ["id", "municipality_id", "source_id", "session_id", "document_type", "title", "url", "published_on", "document_version", "status", "created_at", "updated_at"]],
      ["document_assets", ["document_id", "storage_provider", "storage_path", "content_sha256", "content_type", "bytes", "downloaded_at"]],
      ["speaker_aliases", ["id", "municipality_id", "speaker_id", "alias_raw", "alias_norm", "alias_type", "confidence", "created_at", "updated_at"]],
      ["speeches", ["id", "document_id", "session_id", "speaker_id", "speaker_name_raw", "sequence", "speech_text", "speech_text_clean", "page_start", "page_end", "confidence", "created_at"]],
      ["document_summaries", ["document_id", "summary_text", "topics", "key_points", "general_questions", "agenda_items", "model_id", "token_count", "created_at"]],
      ["ingestion_runs", ["id", "municipality_id", "started_at", "finished_at", "trigger", "status", "log"]],
    ];

    for (const [table, columns] of tables) {
      process.stdout.write(`Copying ${table}... `);
      await copyTable(table, columns, prodClient, devClient);
    }

    await devClient.query("SET session_replication_role = DEFAULT");
    console.log("\nAll tables copied successfully.");
  } catch (e) {
    console.error("Error:", e);
    throw e;
  } finally {
    prodClient.release();
    devClient.release();
    await prod.end();
    await dev.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
