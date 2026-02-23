/**
 * 前橋市議会 発言者名寄せスクリプト
 *
 * 定例会「【議長（富田公隆議員）】」と委員会「【須賀委員長】」のように
 * 同一人物が姓のみ/フルネームで別レコードになっている問題を解消する。
 *
 * 検出ロジック:
 *   1. 括弧形式 X（Y）→ フルネームが "X + Y の最初の文字" で始まるものを探す
 *   2. 純粋な前方一致: A.nameJa が B.nameJa の前方一致かつ B が長い → A は重複
 *
 * Usage:
 *   npx tsx scripts/merge-speakers-maebashi.ts             # dry-run（確認のみ）
 *   npx tsx scripts/merge-speakers-maebashi.ts --execute   # 実際にマージ実行
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const EXECUTE = process.argv.includes("--execute");

// ============================================================
// 型定義
// ============================================================

interface SpeakerRow {
  id: string;
  nameJa: string;
  role: string;
  speechCount: number;
  aliasIds: string[];
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 括弧形式 X（Y） の姓と先頭ヒント文字を取り出す
 * 例: "近藤（好）" → { surname: "近藤", hint: "好" }
 */
function parseBracketName(nameJa: string): { surname: string; hint: string } | null {
  const m = nameJa.match(/^(.+?)（(.)）$/);
  if (!m) return null;
  return { surname: m[1], hint: m[2] };
}

/**
 * role の互換性チェック（マージを許可する組み合わせ）
 * 議員と委員長は同一人物が兼任するため互換とみなす。
 */
function rolesCompatible(roleA: string, roleB: string): boolean {
  const council = new Set(["councilor", "chair"]);
  const exec = new Set(["executive", "mayor"]);

  if (council.has(roleA) && council.has(roleB)) return true;
  if (exec.has(roleA) && exec.has(roleB)) return true;
  // staff 同士は別人の可能性が高い（部署名込みのため除外）
  return false;
}

// ============================================================
// マージ候補の収集（前方一致ベース）
// ============================================================

interface MergeCandidate {
  duplicate: SpeakerRow; // 削除される短い方
  canonical: SpeakerRow; // 残るフルネームの方
  pattern: "bracket" | "prefix";
}

async function collectMergeCandidates(municipalityId: string): Promise<MergeCandidate[]> {
  const rawSpeakers = await prisma.speaker.findMany({
    where: { municipalityId },
    include: {
      aliases: { select: { id: true } },
      _count: { select: { speeches: true } },
    },
    orderBy: { nameJa: "asc" },
  });

  const speakers: SpeakerRow[] = rawSpeakers.map((s) => ({
    id: s.id,
    nameJa: s.nameJa,
    role: s.role,
    speechCount: s._count.speeches,
    aliasIds: s.aliases.map((a) => a.id),
  }));

  const candidates: MergeCandidate[] = [];
  const usedAsCanonical = new Set<string>();
  const usedAsDuplicate = new Set<string>();

  // 短い名前を先に処理するためソート
  const sorted = [...speakers].sort((a, b) => a.nameJa.length - b.nameJa.length || a.nameJa.localeCompare(b.nameJa));

  for (const sp of sorted) {
    if (usedAsDuplicate.has(sp.id) || usedAsCanonical.has(sp.id)) continue;

    const matches: { speaker: SpeakerRow; pattern: "bracket" | "prefix" }[] = [];

    const bracket = parseBracketName(sp.nameJa);

    if (bracket) {
      // パターン1: X（Y）→ "X + Yの先頭文字" で始まるフルネームを探す
      const prefix = bracket.surname + bracket.hint;
      for (const other of speakers) {
        if (other.id === sp.id || usedAsCanonical.has(other.id) || usedAsDuplicate.has(other.id)) continue;
        if (other.nameJa.startsWith(prefix) && rolesCompatible(sp.role, other.role)) {
          matches.push({ speaker: other, pattern: "bracket" });
        }
      }
    } else {
      // パターン2: sp.nameJa が other.nameJa の前方一致（かつ other が長い）
      for (const other of speakers) {
        if (other.id === sp.id || usedAsCanonical.has(other.id) || usedAsDuplicate.has(other.id)) continue;
        if (
          other.nameJa.startsWith(sp.nameJa) &&
          other.nameJa.length > sp.nameJa.length &&
          rolesCompatible(sp.role, other.role)
        ) {
          matches.push({ speaker: other, pattern: "prefix" });
        }
      }
    }

    if (matches.length === 1) {
      const { speaker: canonical, pattern } = matches[0];
      candidates.push({ duplicate: sp, canonical, pattern });
      usedAsCanonical.add(canonical.id);
      usedAsDuplicate.add(sp.id);
    } else if (matches.length > 1) {
      console.warn(
        `  [SKIP] 候補複数: "${sp.nameJa}"[${sp.role}] → ` +
          matches.map((m) => `"${m.speaker.nameJa}"[${m.speaker.role}]`).join(", "),
      );
    }
    // 0件はスキップ（ログなし）
  }

  return candidates;
}

// ============================================================
// マージ実行
// ============================================================

async function mergeSpeakers(
  municipalityId: string,
  duplicate: SpeakerRow,
  canonical: SpeakerRow,
): Promise<{ speechesMoved: number }> {
  // 1. speeches の speakerId を canonical に付け替え
  const { count: speechesMoved } = await prisma.speech.updateMany({
    where: { speakerId: duplicate.id },
    data: { speakerId: canonical.id },
  });

  // 2. duplicate のエイリアスを全削除（aliasNorm ユニーク制約の競合回避）
  await prisma.speakerAlias.deleteMany({ where: { speakerId: duplicate.id } });

  // 3. duplicate speaker を削除
  await prisma.speaker.delete({ where: { id: duplicate.id } });

  // 4. duplicate の nameJa をエイリアスとして canonical に追加（未登録なら）
  const existing = await prisma.speakerAlias.findFirst({
    where: { municipalityId, aliasNorm: duplicate.nameJa },
  });
  if (!existing) {
    await prisma.speakerAlias.create({
      data: {
        municipalityId,
        speakerId: canonical.id,
        aliasRaw: duplicate.nameJa,
        aliasNorm: duplicate.nameJa,
        aliasType: "manual",
        confidence: 0.95,
      },
    });
  }

  return { speechesMoved };
}

// ============================================================
// メイン
// ============================================================

async function main() {
  console.log("=== 前橋市議会 発言者名寄せ ===");
  console.log(EXECUTE ? "モード: EXECUTE（実際にマージします）\n" : "モード: DRY RUN（--execute を付けると実行します）\n");

  const municipality = await prisma.municipality.findFirst({ where: { nameJa: "前橋市" } });
  if (!municipality) {
    console.error("前橋市が見つかりません");
    process.exit(1);
  }

  console.log("マージ候補を収集中...\n");
  const candidates = await collectMergeCandidates(municipality.id);

  if (candidates.length === 0) {
    console.log("マージ候補がありませんでした。");
    await prisma.$disconnect();
    return;
  }

  // ---- サマリー表示 ----
  const roleIcon: Record<string, string> = {
    councilor: "[議員]",
    chair: "[委員長]",
    executive: "[幹部]",
    mayor: "[市長]",
    staff: "[職員]",
    unknown: "[不明]",
  };

  let bracketCount = 0;
  let prefixCount = 0;
  let totalSpeechesToMove = 0;

  console.log(`マージ候補: ${candidates.length} 件\n`);
  for (const { duplicate: dup, canonical: can, pattern } of candidates) {
    const tag = pattern === "bracket" ? "括弧" : "前方";
    const dupRole = roleIcon[dup.role] ?? dup.role;
    const canRole = roleIcon[can.role] ?? can.role;
    console.log(
      `  [${tag}] ${dupRole}「${dup.nameJa}」(${dup.speechCount}件)` +
        ` → ${canRole}「${can.nameJa}」(${can.speechCount}件)`,
    );
    if (pattern === "bracket") bracketCount++;
    else prefixCount++;
    totalSpeechesToMove += dup.speechCount;
  }

  console.log(`\n内訳: 括弧形式=${bracketCount} 前方一致=${prefixCount}`);
  console.log(`移動予定発言数: ${totalSpeechesToMove} 件`);

  if (!EXECUTE) {
    console.log("\n⚠  DRY RUN のため変更は行っていません。");
    console.log("実行する場合は --execute を付けてください。");
    await prisma.$disconnect();
    return;
  }

  // ---- 実行 ----
  console.log("\n\nマージ実行中...");
  let totalMoved = 0;
  let succeeded = 0;
  let failed = 0;

  for (const { duplicate: dup, canonical: can, pattern } of candidates) {
    try {
      const { speechesMoved } = await mergeSpeakers(municipality.id, dup, can);
      totalMoved += speechesMoved;
      succeeded++;
      console.log(`  ✓ [${pattern}] 「${dup.nameJa}」→「${can.nameJa}」(${speechesMoved}件移動)`);
    } catch (err) {
      failed++;
      console.error(`  ✗ 「${dup.nameJa}」→「${can.nameJa}」: ${err}`);
    }
  }

  // ---- 結果 ----
  const remaining = await prisma.speaker.count({ where: { municipalityId: municipality.id } });

  console.log("\n=== 完了 ===");
  console.log(`  マージ成功 : ${succeeded} 件`);
  console.log(`  失敗       : ${failed} 件`);
  console.log(`  移動発言数 : ${totalMoved} 件`);
  console.log(`  残発言者数 : ${remaining} 名 (元 ${rawCount} 名)`);

  await prisma.$disconnect();
}

// 元の発言者数を表示用に保持
let rawCount = 0;
const origMain = main;
async function wrappedMain() {
  const municipality = await prisma.municipality.findFirst({ where: { nameJa: "前橋市" } });
  if (municipality) {
    rawCount = await prisma.speaker.count({ where: { municipalityId: municipality.id } });
  }
  await origMain();
}

wrappedMain().catch((e) => {
  console.error(e);
  process.exit(1);
});
