/**
 * generalQuestions の質問者名を正規化する。
 * 「X 議員」形式をフルネームに置換し、DB を更新する。
 *
 * Usage: npm run normalize-questioner-names
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";

// 既知の名寄せマッピング（「表記ゆれ」→「正規フルネーム」）
const NAME_MAP: Record<string, string> = {
  "山本 議員": "山本 数博",
  "山根 議員": "山根 温子",
  "宍戸 議員": "宍戸 邦夫",
  "新田 議員": "新田 和明",
};

function normalizeQuestions(
  questions: { questioner: string; topic: string }[],
): { changed: boolean; questions: { questioner: string; topic: string }[] } {
  let changed = false;
  const normalized = questions.map((q) => {
    const mapped = NAME_MAP[q.questioner];
    if (mapped) {
      changed = true;
      return { ...q, questioner: mapped };
    }
    return q;
  });
  return { changed, questions: normalized };
}

async function main() {
  console.log("=== Normalize Questioner Names ===");

  const summaries = await prisma.documentSummary.findMany({
    where: {
      document: { session: { sessionType: "regular" } },
      generalQuestions: { not: Prisma.AnyNull },
    },
    select: {
      documentId: true,
      generalQuestions: true,
      document: { select: { title: true } },
    },
  });

  let updated = 0;

  for (const s of summaries) {
    const questions = s.generalQuestions as { questioner: string; topic: string }[] | null;
    if (!Array.isArray(questions) || questions.length === 0) continue;

    const { changed, questions: normalized } = normalizeQuestions(questions);
    if (!changed) continue;

    console.log(`  UPDATE: ${s.document.title}`);
    questions.forEach((q, i) => {
      if (q.questioner !== normalized[i].questioner) {
        console.log(`    "${q.questioner}" → "${normalized[i].questioner}"`);
      }
    });

    await prisma.documentSummary.update({
      where: { documentId: s.documentId },
      data: { generalQuestions: normalized as unknown as Prisma.InputJsonValue },
    });

    updated++;
  }

  console.log(`\n更新: ${updated} 件`);
  if (updated === 0) console.log("（変更対象なし）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
