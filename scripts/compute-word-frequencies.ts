import "dotenv/config";
import path from "path";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// kuromoji types
import type { Tokenizer, IpadicFeatures } from "kuromoji";
import kuromoji from "kuromoji";

const STOP_WORDS = new Set([
  "これ", "それ", "あれ", "この", "その", "ここ", "そこ", "こと", "もの",
  "ため", "よう", "ところ", "わけ", "はず", "つもり", "ほう", "ほか",
  "とき", "とこ", "あと", "まま", "ほど", "くらい", "ぐらい",
  "中", "上", "下", "前", "後", "方", "等", "的", "性", "化", "者",
  "私", "僕", "皆", "皆さん", "議員", "さん", "氏",
  "年", "月", "日", "号", "回", "点", "件", "人", "分", "円",
  "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "百", "千", "万",
  "以上", "以下", "以内", "以外", "場合", "部分", "全体", "意味",
  "質問", "答弁", "説明", "議長", "委員", "市長",
]);

const MIN_WORD_LENGTH = 2;
const TOP_N = 500;

function loadTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({
        dicPath: path.join(
          process.cwd(),
          "node_modules/kuromoji/dict",
        ),
      })
      .build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
  });
}

async function main() {
  console.log("Loading kuromoji tokenizer...");
  const tokenizer = await loadTokenizer();
  console.log("Tokenizer loaded.");

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const speeches = await prisma.speech.findMany({
    select: { speechText: true },
  });

  console.log(`Processing ${speeches.length} speeches...`);

  const counts = new Map<string, { reading: string | null; pos: string; count: number }>();

  for (const speech of speeches) {
    const tokens = tokenizer.tokenize(speech.speechText);
    for (const token of tokens) {
      // Only keep nouns (名詞) - exclude pronouns (代名詞), non-independent (非自立), suffixes (接尾)
      if (token.pos !== "名詞") continue;
      if (token.pos_detail_1 === "代名詞") continue;
      if (token.pos_detail_1 === "非自立") continue;
      if (token.pos_detail_1 === "接尾") continue;
      if (token.pos_detail_1 === "数") continue;

      const word = token.surface_form;
      if (word.length < MIN_WORD_LENGTH) continue;
      if (STOP_WORDS.has(word)) continue;
      // Skip words that are only katakana/hiragana single chars or numbers
      if (/^[\d０-９]+$/.test(word)) continue;

      const existing = counts.get(word);
      if (existing) {
        existing.count++;
      } else {
        counts.set(word, {
          reading: token.reading !== "*" ? token.reading ?? null : null,
          pos: `${token.pos}/${token.pos_detail_1}`,
          count: 1,
        });
      }
    }
  }

  // Sort by count and take top N
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, TOP_N);

  console.log(`Found ${counts.size} unique words. Saving top ${sorted.length}...`);

  // Clear existing and insert
  await prisma.wordFrequency.deleteMany();

  for (const [word, data] of sorted) {
    await prisma.wordFrequency.create({
      data: {
        word,
        reading: data.reading,
        partOfSpeech: data.pos,
        count: data.count,
      },
    });
  }

  console.log(`Saved ${sorted.length} word frequencies.`);
  console.log("Top 20:");
  for (const [word, data] of sorted.slice(0, 20)) {
    console.log(`  ${word}: ${data.count}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch(console.error);
