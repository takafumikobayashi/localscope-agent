import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/**
 * 重複 Speaker 統合マイグレーションスクリプト
 *
 * migration 適用前に実行する。
 *
 * ロジック:
 * 1. 全 speaker を取得
 * 2. 同一 municipalityId 内で nameJa の前方一致でグルーピング
 *    - 短い方を canonical、長い方を duplicate とする
 *    - 短い方の文字数 >= 3（フルネームの最低長）
 * 3. duplicate の speeches を canonical の speaker_id に付け替え
 * 4. duplicate の speaker レコードを削除
 * 5. 統合された名前を表示（migration後に alias として登録可能）
 */

interface SpeakerRecord {
  id: string;
  municipalityId: string;
  nameJa: string;
}

interface MergeGroup {
  canonical: SpeakerRecord;
  duplicates: SpeakerRecord[];
}

function buildMergeGroups(speakers: SpeakerRecord[]): MergeGroup[] {
  // municipalityId でグルーピング
  const byMuni = new Map<string, SpeakerRecord[]>();
  for (const s of speakers) {
    const list = byMuni.get(s.municipalityId) ?? [];
    list.push(s);
    byMuni.set(s.municipalityId, list);
  }

  const groups: MergeGroup[] = [];

  for (const [, muniSpeakers] of byMuni) {
    // nameJa の長さでソート（短い順）
    const sorted = [...muniSpeakers].sort(
      (a, b) => a.nameJa.length - b.nameJa.length,
    );

    const merged = new Set<string>(); // 既にマージ済みの speaker id

    for (let i = 0; i < sorted.length; i++) {
      const short = sorted[i];
      if (merged.has(short.id)) continue;
      if (short.nameJa.length < 3) continue; // フルネーム最低3文字

      const duplicates: SpeakerRecord[] = [];

      for (let j = i + 1; j < sorted.length; j++) {
        const long = sorted[j];
        if (merged.has(long.id)) continue;
        if (long.nameJa.length <= short.nameJa.length) continue;

        // 短い方が長い方の prefix である
        if (long.nameJa.startsWith(short.nameJa)) {
          duplicates.push(long);
          merged.add(long.id);
        }
      }

      if (duplicates.length > 0) {
        groups.push({ canonical: short, duplicates });
      }
    }
  }

  return groups;
}

async function main() {
  console.log("=== Speaker Merge Migration ===\n");

  // 1. 全 speaker 取得
  const speakers = await prisma.speaker.findMany({
    select: { id: true, municipalityId: true, nameJa: true },
  });
  console.log(`Total speakers: ${speakers.length}`);

  // 2. マージグループ構築
  const groups = buildMergeGroups(speakers);
  console.log(`Merge groups found: ${groups.length}\n`);

  if (groups.length === 0) {
    console.log("No duplicates to merge.");
    return;
  }

  // 3. 各グループを処理
  let totalMerged = 0;
  let totalSpeechesUpdated = 0;
  const mergedNames: Array<{ canonical: string; duplicates: string[] }> = [];

  for (const group of groups) {
    const dupNames = group.duplicates.map((d) => d.nameJa);
    console.log(
      `  Canonical: "${group.canonical.nameJa}" ← [${dupNames.map((n) => `"${n}"`).join(", ")}]`,
    );

    for (const dup of group.duplicates) {
      // speeches の speaker_id を canonical に付け替え
      const updated = await prisma.speech.updateMany({
        where: { speakerId: dup.id },
        data: { speakerId: group.canonical.id },
      });
      totalSpeechesUpdated += updated.count;
      if (updated.count > 0) {
        console.log(`    Updated ${updated.count} speech(es) from "${dup.nameJa}"`);
      }

      // duplicate speaker を削除
      await prisma.speaker.delete({ where: { id: dup.id } });
      totalMerged++;
    }

    mergedNames.push({
      canonical: group.canonical.nameJa,
      duplicates: dupNames,
    });
  }

  // サマリー
  console.log("\n=== Summary ===");
  console.log(`Speakers merged: ${totalMerged}`);
  console.log(`Speeches updated: ${totalSpeechesUpdated}`);

  const remainingSpeakers = await prisma.speaker.count();
  console.log(`Remaining speakers: ${remainingSpeakers}`);

  // マージされた名前を出力（alias 登録用の参考情報）
  console.log("\n=== Merged Names (for alias registration) ===");
  for (const { canonical, duplicates } of mergedNames) {
    for (const dup of duplicates) {
      console.log(`  "${dup}" → "${canonical}"`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// テスト用にエクスポート
export { buildMergeGroups };
export type { SpeakerRecord, MergeGroup };
