/**
 * 前橋市議会 会議録テキストインポートスクリプト
 *
 * Usage:
 *   npx tsx scripts/import-txt-maebashi.ts              # data/maebashi_city を処理
 *   npx tsx scripts/import-txt-maebashi.ts --dry-run    # DB書き込みなしで確認
 *   npx tsx scripts/import-txt-maebashi.ts --dir=<path> # ディレクトリ指定
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import iconv from "iconv-lite";
import {
  upsertMunicipality,
  upsertSource,
  upsertSession,
  upsertDocument,
  updateDocumentStatus,
  upsertSpeaker,
  upsertSpeakerAlias,
  createSpeech,
  deleteSpeeches,
  createIngestionRun,
  finalizeIngestionRun,
} from "../src/lib/ingestion/db";
import { prisma } from "../src/lib/prisma";

// ============================================================
// 定数
// ============================================================

const MUNICIPALITY_PREFECTURE = "群馬県";
const MUNICIPALITY_NAME = "前橋市";
const SOURCE_TITLE = "前橋市議会 会議録";
const SOURCE_URL = "https://www.city.maebashi.gunma.dbsr.jp/";

// ============================================================
// CLI 引数
// ============================================================

const dirArg = process.argv.find((a) => a.startsWith("--dir="));
const BASE_DIR = dirArg ? dirArg.split("=")[1] : "data/maebashi_city";
const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================
// ユーティリティ
// ============================================================

/** 全角数字→半角数字 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

// ============================================================
// ファイルメタデータ解析
// ============================================================

/**
 * ファイル名から公開日を抽出
 * 例: "2_2025-03-28：令和７年..." → Date(2025-03-28)
 */
function extractDateFromFilename(filename: string): Date | null {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})：/);
  if (!match) return null;
  const d = new Date(match[1] + "T00:00:00Z");
  return isNaN(d.getTime()) ? null : d;
}

/**
 * ディレクトリ名からセッション情報を解析
 * 例: "令和７年第１回定例会" → { fiscalYear: 2025, sessionName: "令和７年第１回定例会", sessionType: "regular" }
 */
function parseSessionFromDirName(dirName: string): {
  fiscalYear: number;
  sessionName: string;
  sessionType:
    | "regular"
    | "extra"
    | "committee"
    | "budget_committee"
    | "other";
} | null {
  const reiwaMatch = dirName.match(/令和([０-９\d]+)年/);
  if (!reiwaMatch) return null;
  const reiwaYear = parseInt(toHalfWidth(reiwaMatch[1]), 10);
  const fiscalYear = 2018 + reiwaYear;

  let sessionType: "regular" | "extra" | "committee" | "budget_committee" | "other" =
    "other";
  if (dirName.includes("定例会")) sessionType = "regular";
  else if (dirName.includes("臨時会")) sessionType = "extra";
  else if (dirName.includes("予算決算")) sessionType = "budget_committee";
  else if (dirName.includes("予算委員会")) sessionType = "budget_committee";
  else if (dirName.includes("決算委員会")) sessionType = "budget_committee";
  else if (dirName.includes("委員会")) sessionType = "committee";

  return { fiscalYear, sessionName: dirName, sessionType };
}

// ============================================================
// 発言テキストパーサー
// ============================================================

interface ParsedSpeech {
  speakerRaw: string; // 例: "議長（富田公隆議員）"
  role: string; // 例: "議長", "議員", "市長"
  name: string; // 例: "富田公隆", "須賀博史"
  text: string;
}

/** 議員・委員系の役職サフィックス（長いもの優先） */
const MEMBER_ROLE_ENDINGS: { suffix: string; role: string }[] = [
  { suffix: "副委員長", role: "委員長" },
  { suffix: "委員長", role: "委員長" },
  { suffix: "副議長", role: "副議長" },
  { suffix: "議長", role: "議長" },
  { suffix: "議員", role: "議員" },
  { suffix: "委員", role: "議員" },
];

/** 行政職員系の役職サフィックス（長いもの優先） */
const STAFF_ROLE_ENDINGS = [
  "事務局長", "副市長", "教育長", "市長",
  "部長", "課長", "局長", "次長", "参事", "係長",
];

/**
 * 【...】内のテキストからspeaker情報を解析
 *
 * 対応フォーマット:
 *   1. "役職（氏名）"    例: 議長（富田公隆議員）, 市長（小川晶）
 *   2. "番号（氏名議員）" 例: ２３番（須賀博史議員）
 *   3. "氏名委員長"      例: 須賀委員長, 吉田（直）委員
 *   4. "氏名課長"        例: 大谷財政課長（部署含む場合あり）
 */
function parseSpeakerBracket(bracket: string): { role: string; name: string } {
  const trimmed = bracket.trim();

  // パターン1・2: 括弧（）で終わる → "役職（氏名）" 形式
  const parenEndMatch = trimmed.match(/^(.+?)（(.+?)）$/);
  if (parenEndMatch) {
    const roleOrNum = parenEndMatch[1].trim();
    const nameRaw = parenEndMatch[2].trim();
    const name = nameRaw.replace(/議員$/, "").trim();
    const isNumber = /^[０-９\d]+番$/.test(roleOrNum);
    const role = isNumber ? "議員" : roleOrNum;
    return { role, name };
  }

  // パターン3: 議員・委員系の役職サフィックスで終わる
  for (const { suffix, role } of MEMBER_ROLE_ENDINGS) {
    if (trimmed.endsWith(suffix)) {
      const name = trimmed.slice(0, -suffix.length).trim();
      if (name.length > 0) return { role, name };
    }
  }

  // パターン4: 行政職員系のサフィックスで終わる
  for (const ending of STAFF_ROLE_ENDINGS) {
    if (trimmed.endsWith(ending)) {
      const name = trimmed.slice(0, -ending.length).trim();
      if (name.length > 0) return { role: ending, name };
    }
  }

  return { role: "不明", name: trimmed };
}

/**
 * Shift-JIS TXTファイルを読み込み、発言リストに変換
 */
function parseMaebashiTxt(filePath: string): ParsedSpeech[] {
  const rawBuffer = readFileSync(filePath);
  const text = iconv.decode(rawBuffer, "Shift_JIS");
  const lines = text.split(/\r?\n/);

  const speeches: ParsedSpeech[] = [];
  let current: ParsedSpeech | null = null;

  for (const line of lines) {
    // 発言者行: 行頭の【...（...）】
    const speakerMatch = line.match(/^【([^】]+)】\s*(.*)/);
    if (speakerMatch) {
      if (current && current.text.trim()) speeches.push(current);
      const { role, name } = parseSpeakerBracket(speakerMatch[1]);
      current = {
        speakerRaw: speakerMatch[1].trim(),
        role,
        name,
        text: speakerMatch[2].trim(),
      };
      continue;
    }

    // セクションヘッダー（◎）・登壇アナウンス行はスキップ
    if (/^\s*◎/.test(line)) continue;
    if (/^\s*（.+登壇）/.test(line)) continue;

    // 発言の続き
    if (current) {
      const trimmed = line.trim();
      if (trimmed) {
        current.text += (current.text ? "\n" : "") + trimmed;
      }
    }
  }
  if (current && current.text.trim()) speeches.push(current);

  return speeches;
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  console.log("=== 前橋市議会 会議録インポート ===");
  console.log(`Base dir : ${BASE_DIR}`);
  if (DRY_RUN) console.log("※ DRY RUN — DBへの書き込みは行いません\n");

  const municipalityId = await upsertMunicipality(
    MUNICIPALITY_PREFECTURE,
    MUNICIPALITY_NAME,
  );
  const sourceId = await upsertSource(
    municipalityId,
    SOURCE_TITLE,
    SOURCE_URL,
  );
  const runId = await createIngestionRun(municipalityId, "manual");

  // サブディレクトリ = セッション単位
  const sessionDirs = readdirSync(BASE_DIR)
    .filter((d) => statSync(path.join(BASE_DIR, d)).isDirectory())
    .sort();

  let totalDocs = 0;
  let totalSpeeches = 0;
  let totalFailed = 0;

  for (const sessionDir of sessionDirs) {
    const sessionInfo = parseSessionFromDirName(sessionDir);
    if (!sessionInfo) {
      console.warn(`SKIP (parse failed): ${sessionDir}`);
      continue;
    }

    console.log(
      `\n[Session] ${sessionInfo.sessionName}  fiscalYear=${sessionInfo.fiscalYear}  type=${sessionInfo.sessionType}`,
    );

    const sessionId = DRY_RUN
      ? "dry-run"
      : await upsertSession(
          municipalityId,
          sessionInfo.sessionName,
          sessionInfo.sessionType,
          sessionInfo.fiscalYear,
        );

    const dirPath = path.join(BASE_DIR, sessionDir);
    // 本文.txt のみ対象（名簿・意見書案・目次等は除外）
    const files = readdirSync(dirPath)
      .filter((f) => f.endsWith("本文.txt"))
      .sort((a, b) => {
        // 先頭の連番でソート（全角数字にも対応）
        const numA = parseInt(toHalfWidth(a.split("_")[0]), 10) || 0;
        const numB = parseInt(toHalfWidth(b.split("_")[0]), 10) || 0;
        return numA - numB;
      });

    for (const filename of files) {
      const filePath = path.join(dirPath, filename);
      const publishedOn = extractDateFromFilename(filename);
      const titleRaw = filename.replace(/^[０-９\d]+_/, "").replace(/\.txt$/, "");
      const url = `local://maebashi/${sessionDir}/${filename}`;

      process.stdout.write(`  ${filename} ... `);

      try {
        const speeches = parseMaebashiTxt(filePath);

        if (DRY_RUN) {
          console.log(`${speeches.length} speeches (dry-run)`);
          speeches.slice(0, 2).forEach((s) =>
            console.log(`    [${s.role}] ${s.name}: ${s.text.slice(0, 60).replace(/\n/g, " ")}`),
          );
          continue;
        }

        const doc = await upsertDocument({
          municipalityId,
          sourceId,
          url,
          title: titleRaw,
          sectionKind:
            sessionInfo.sessionType === "budget_committee"
              ? "committee"
              : sessionInfo.sessionType,
          publishedOn,
          sessionId,
        });

        if (!doc.isNew && doc.status === "parsed") {
          console.log("SKIP (already parsed)");
          continue;
        }

        // 発言を再登録（べき等性確保）
        await deleteSpeeches(doc.id);

        for (let i = 0; i < speeches.length; i++) {
          const s = speeches[i];
          const speakerId = await upsertSpeaker(
            municipalityId,
            s.name,
            s.role,
          );
          await upsertSpeakerAlias(
            municipalityId,
            speakerId,
            s.speakerRaw,
            "speech_derived",
            0.9,
          );
          await upsertSpeakerAlias(
            municipalityId,
            speakerId,
            s.name,
            "speech_derived",
            1.0,
          );
          await createSpeech({
            documentId: doc.id,
            sessionId,
            speakerId,
            speakerNameRaw: s.speakerRaw,
            sequence: i + 1,
            speechText: s.text,
            pageStart: null,
            pageEnd: null,
            confidence: 1.0,
          });
        }

        await updateDocumentStatus(doc.id, "parsed");
        totalDocs++;
        totalSpeeches += speeches.length;
        console.log(`${speeches.length} speeches`);
      } catch (err) {
        console.error(`FAIL: ${err}`);
        totalFailed++;
      }
    }
  }

  if (!DRY_RUN) {
    await finalizeIngestionRun(
      runId,
      totalFailed === 0 ? "success" : totalDocs > 0 ? "partial" : "failed",
      { totalDocs, totalSpeeches, totalFailed },
    );
  }

  console.log("\n=== 完了 ===");
  console.log(`Documents : ${totalDocs}`);
  console.log(`Speeches  : ${totalSpeeches}`);
  console.log(`Failed    : ${totalFailed}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
