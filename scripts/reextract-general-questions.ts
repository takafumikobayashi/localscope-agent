/**
 * 一般質問の再抽出スクリプト（冒頭発言ベース・高精度版）
 *
 * 戦略:
 *   各質問者の「最初の発言」（通告宣言）にはほぼ全テーマが列挙されるため、
 *   冒頭発言のみを対象に抽出することでチャンク境界の問題を回避する。
 *
 * Usage:
 *   npm run reextract-questions                    # 全定例会ドキュメント
 *   npm run reextract-questions -- <documentId>    # 特定1件
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "../src/generated/prisma/client";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const MODEL_ID = "gpt-4o";
const DOC_WAIT_MS = 10_000;

const SYSTEM_PROMPT = `あなたは日本の地方議会の議事録を分析する専門家です。
以下は定例会における各議員の「通告宣言（発言の冒頭）」の一覧です。
各議員が通告した一般質問テーマを抽出してください。

ルール:
- questioner: 必ず姓と名を含むフルネーム（例: "山本 数博"）
- topic: 質問テーマ（20文字以内）
- 一般質問でない発言（委員会報告・議長発言など）は除外
- 同じ議員が複数テーマを述べた場合は個別に列挙

出力形式（JSONのみ）:
{"general_questions": [{"questioner": "山本 数博", "topic": "開庁時間について"}, ...]}
一般質問がなければ {"general_questions": []} を返す。`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 各議員の最初のN発言を収集（テーマ宣言を漏れなく捕捉するため複数発言を見る） */
async function extractOpeningStatements(documentId: string, maxPerSpeaker = 8) {
  const speeches = await prisma.speech.findMany({
    where: { documentId },
    select: {
      sequence: true,
      speakerNameRaw: true,
      speechText: true,
      speaker: { select: { nameJa: true, role: true } },
    },
    orderBy: { sequence: "asc" },
  });

  // 議員（councilor）ごとに先頭N発言を収集（議長除く）
  const counts = new Map<string, number>();
  const openings = new Map<string, string[]>();

  for (const s of speeches) {
    if (s.speaker?.role !== "councilor") continue;
    const name = s.speaker.nameJa ?? s.speakerNameRaw;
    if (/議長|委員長|会長/.test(name)) continue;

    const c = counts.get(name) ?? 0;
    if (c >= maxPerSpeaker) continue;
    counts.set(name, c + 1);

    if (!openings.has(name)) openings.set(name, []);
    // 各発言の先頭500文字（次テーマへの移行宣言を含む）
    openings.get(name)!.push(s.speechText.slice(0, 500));
  }

  return Array.from(openings.entries()).map(([name, texts]) => ({
    name,
    text: texts.join("\n"),
  }));
}

async function extractQuestionsFromOpenings(
  openings: { name: string; text: string }[],
): Promise<{ questioner: string; topic: string }[]> {
  if (openings.length === 0) return [];

  const userContent = openings
    .map((o) => `【${o.name}】\n${o.text}`)
    .join("\n\n---\n\n");

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await generateText({
        model: openai(MODEL_ID),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        providerOptions: { openai: { response_format: { type: "json_object" } } },
      });

      let jsonText = result.text.trim();
      const fence = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fence) jsonText = fence[1];

      const parsed = JSON.parse(jsonText) as {
        general_questions: { questioner: string; topic: string }[];
      };
      return parsed.general_questions ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("Rate limit")) {
        console.log(`  rate limit, waiting 30s...`);
        await sleep(30_000);
        continue;
      }
      throw err;
    }
  }
  return [];
}

async function main() {
  const targetDocId = process.argv[2] ?? null;

  const where: Prisma.DocumentSummaryWhereInput = {
    document: { session: { sessionType: "regular" } },
  };
  if (targetDocId) {
    (where as Record<string, unknown>).documentId = targetDocId;
  }

  const summaries = await prisma.documentSummary.findMany({
    where,
    select: {
      documentId: true,
      generalQuestions: true,
      document: { select: { title: true } },
    },
    orderBy: { document: { publishedOn: "asc" } },
  });

  console.log(`対象: ${summaries.length} 件`);
  let updated = 0;

  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];
    console.log(`\n[${i + 1}/${summaries.length}] ${s.document.title}`);

    const openings = await extractOpeningStatements(s.documentId);
    console.log(`  冒頭発言数: ${openings.length}`);
    if (openings.length === 0) {
      console.log("  冒頭発言なし、スキップ");
      continue;
    }

    try {
      const questions = await extractQuestionsFromOpenings(openings);

      if (questions.length === 0) {
        console.log("  一般質問なし");
        continue;
      }

      console.log("  抽出結果:");
      for (const q of questions) {
        console.log(`    ${q.questioner} / ${q.topic}`);
      }

      await prisma.documentSummary.update({
        where: { documentId: s.documentId },
        data: {
          generalQuestions: questions as unknown as Prisma.InputJsonValue,
        },
      });
      console.log("  → DB 更新完了");
      updated++;
    } catch (err) {
      console.error("  エラー:", err instanceof Error ? err.message : err);
    }

    if (i < summaries.length - 1) {
      await sleep(DOC_WAIT_MS);
    }
  }

  console.log(`\n=== 完了: ${updated}/${summaries.length} 件更新 ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
