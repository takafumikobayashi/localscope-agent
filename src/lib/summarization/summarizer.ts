import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const MODEL_ID = "gpt-4o";

export interface GeneralQuestion {
  questioner: string;
  topic: string;
}

export interface AgendaItem {
  title: string;
  result?: string;
  notes?: string;
}

const SYSTEM_PROMPT = `あなたは日本の地方議会（安芸高田市）の議事録を要約する専門家です。
以下の議事録から、次の情報をJSON形式で出力してください:
1. summary: 会議全体の要約（300-500字）
2. topics: 議論されたテーマ一覧（配列）
3. key_points: 主要な論点や決定事項（配列、各項目1-2文）

出力は以下のJSON形式のみで返してください:
{"summary": "...", "topics": ["..."], "key_points": ["..."]}`;

const CHUNK_PROMPT = `あなたは日本の地方議会（安芸高田市）の議事録を要約する専門家です。
以下は長い議事録の一部分です。この部分の内容を要約してください。
これは部分要約であり、後で他の部分と統合されます。

出力は以下のJSON形式のみで返してください:
{"summary": "...", "topics": ["..."], "key_points": ["..."]}`;

const MERGE_PROMPT = `あなたは日本の地方議会（安芸高田市）の議事録を要約する専門家です。
以下は同じ会議の議事録を分割して要約したものです。これらを統合して、1つの要約を作成してください。

出力は以下のJSON形式のみで返してください:
{"summary": "...(300-500字)", "topics": ["..."], "key_points": ["..."]}`;

/** トークン数の概算（日本語: 文字数 × 0.5） */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 0.5);
}

/** 発言配列をテキストに変換 */
export function formatSpeeches(
  speeches: { speakerNameRaw: string; speechText: string }[],
): string {
  return speeches
    .map((s) => `${s.speakerNameRaw}: ${s.speechText}`)
    .join("\n\n");
}

export interface SummaryResult {
  summary: string;
  topics: string[];
  keyPoints: string[];
  totalTokens: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MAX_RETRIES = 5;

/** LLM に要約を依頼し、JSON をパースして返す（リトライ付き） */
async function callLLM(
  systemPrompt: string,
  userContent: string,
): Promise<{ parsed: { summary: string; topics: string[]; key_points: string[] }; tokens: number }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await generateText({
        model: openai(MODEL_ID),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        providerOptions: {
          openai: {
            response_format: { type: "json_object" },
          },
        },
      });

      // LLMが ```json ... ``` で囲むケースに対応
      let jsonText = result.text.trim();
      const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        jsonText = fenceMatch[1];
      }

      const parsed = JSON.parse(jsonText) as {
        summary: string;
        topics: string[];
        key_points: string[];
      };

      const tokens = result.usage?.totalTokens ?? 0;
      return { parsed, tokens };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("Rate limit") || msg.includes("429");
      const isRetryable = isRateLimit || msg.includes("too large for");

      if (isRetryable && attempt < MAX_RETRIES - 1) {
        // レート制限: 指数バックオフ（30s, 60s, 120s, 240s）
        const waitMs = 30_000 * Math.pow(2, attempt);
        console.log(`    RETRY ${attempt + 1}/${MAX_RETRIES}: waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw new Error(`Failed after ${attempt + 1} attempts. Last error: ${msg}`);
    }
  }
  throw new Error("Unreachable");
}

/** 1リクエストあたりのトークン上限（TPM制限に合わせて調整） */
const TOKEN_THRESHOLD = 12_000;

/** チャンク間のウェイト（TPM 30K/min に対応） */
const CHUNK_WAIT_MS = 30_000;

/**
 * 発言をチャンクに分割する（各チャンクが TOKEN_THRESHOLD 以下になるよう）
 */
export function splitIntoChunks(
  speeches: { speakerNameRaw: string; speechText: string }[],
): { speakerNameRaw: string; speechText: string }[][] {
  const chunks: { speakerNameRaw: string; speechText: string }[][] = [];
  let current: { speakerNameRaw: string; speechText: string }[] = [];
  let currentTokens = 0;

  for (const s of speeches) {
    const tokens = estimateTokens(`${s.speakerNameRaw}: ${s.speechText}\n\n`);
    if (current.length > 0 && currentTokens + tokens > TOKEN_THRESHOLD) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(s);
    currentTokens += tokens;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * ドキュメントの発言を要約する
 * - TOKEN_THRESHOLD 以下: 1回のAPI呼び出し
 * - 超過: N分割 → 各チャンク要約 → 統合要約
 */
export async function summarizeDocument(
  speeches: { speakerNameRaw: string; speechText: string }[],
): Promise<SummaryResult> {
  const fullText = formatSpeeches(speeches);
  const estimated = estimateTokens(fullText);

  if (estimated <= TOKEN_THRESHOLD) {
    const { parsed, tokens } = await callLLM(SYSTEM_PROMPT, fullText);
    return {
      summary: parsed.summary,
      topics: parsed.topics,
      keyPoints: parsed.key_points,
      totalTokens: tokens,
    };
  }

  // N分割して各チャンクを順次要約（TPM制限回避のため直列実行+ウェイト）
  const chunks = splitIntoChunks(speeches);
  const chunkResults: { parsed: { summary: string; topics: string[]; key_points: string[] }; tokens: number }[] = [];
  let totalTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const text = formatSpeeches(chunks[i]);
    console.log(`    chunk ${i + 1}/${chunks.length} (~${estimateTokens(text)} tokens)`);
    const r = await callLLM(CHUNK_PROMPT, text);
    chunkResults.push(r);
    totalTokens += r.tokens;
    if (i < chunks.length - 1) {
      await sleep(CHUNK_WAIT_MS);
    }
  }

  // チャンクが1つだけならそのまま返す
  if (chunkResults.length === 1) {
    return {
      summary: chunkResults[0].parsed.summary,
      topics: chunkResults[0].parsed.topics,
      keyPoints: chunkResults[0].parsed.key_points,
      totalTokens,
    };
  }

  // 統合前にウェイト
  await sleep(CHUNK_WAIT_MS);

  // 統合
  const mergeInput = chunkResults
    .map((r, i) => `## パート${i + 1}の要約\n${JSON.stringify(r.parsed, null, 2)}`)
    .join("\n\n");
  const merged = await callLLM(MERGE_PROMPT, mergeInput);
  totalTokens += merged.tokens;

  return {
    summary: merged.parsed.summary,
    topics: merged.parsed.topics,
    keyPoints: merged.parsed.key_points,
    totalTokens,
  };
}

/** 単一テキストから一般質問を抽出する内部関数 */
async function extractGeneralQuestionsFromText(text: string): Promise<GeneralQuestion[]> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await generateText({
        model: openai(MODEL_ID),
        messages: [
          { role: "system", content: GENERAL_QUESTIONS_SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        providerOptions: {
          openai: {
            response_format: { type: "json_object" },
          },
        },
      });

      let jsonText = result.text.trim();
      const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        jsonText = fenceMatch[1];
      }

      const parsed = JSON.parse(jsonText) as { general_questions: GeneralQuestion[] };
      return parsed.general_questions ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("Rate limit") || msg.includes("429");

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const waitMs = 30_000 * Math.pow(2, attempt);
        console.log(`    RETRY ${attempt + 1}/${MAX_RETRIES}: waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

const GENERAL_QUESTIONS_SYSTEM_PROMPT = `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は安芸高田市議会定例会の議事録です。
「一般質問」として行われた各議員の質問を抽出してください。
一般質問とは: 議員が市政各事項について市長・行政に質問し答弁を得る場です。
各質問について questioner（質問議員のフルネーム）と topic（質問テーマ、20字以内）を抽出してください。

【重要】questioner には必ず姓と名を含むフルネームを記載してください。
議事録中に「○○議員」のような呼称しか登場しない場合でも、文脈や他の箇所から判断してフルネームを補完してください。
フルネームが特定できない場合のみ「姓 議員」の形式を使用してください。

出力形式: {"general_questions": [{"questioner": "田邊 裕哉", "topic": "地域公共交通について"}, ...]}
一般質問がない場合は {"general_questions": []} を返してください。`;

/**
 * 定例会議事録から一般質問を抽出する
 * トークン超過時は最初のチャンクのみ使用（一般質問は冒頭に集中するため）
 */
export async function extractGeneralQuestions(
  speeches: { speakerNameRaw: string; speechText: string }[],
): Promise<GeneralQuestion[]> {
  const fullText = formatSpeeches(speeches);
  const estimated = estimateTokens(fullText);

  const targetText =
    estimated <= TOKEN_THRESHOLD
      ? fullText
      : formatSpeeches(splitIntoChunks(speeches)[0]);

  try {
    return await extractGeneralQuestionsFromText(targetText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`extractGeneralQuestions failed. Last error: ${msg}`);
  }
}

/**
 * 全チャンクを処理し、各チャンクの結果をマージして返す。
 * 大規模ドキュメント（議員6名・700発言超など）で全員分を取得するために使用。
 * - 3チャンク連続で結果なし → それ以降はスキップ（一般質問は中盤で終わる）
 * - 同一 questioner+topic の重複はマージ時に除去
 */
export async function extractGeneralQuestionsAllChunksMerged(
  speeches: { speakerNameRaw: string; speechText: string }[],
  chunkTokenLimit = 4_000,
  chunkWaitMs = 10_000,
): Promise<GeneralQuestion[]> {
  const chunks: { speakerNameRaw: string; speechText: string }[][] = [];
  let current: { speakerNameRaw: string; speechText: string }[] = [];
  let currentTokens = 0;

  for (const s of speeches) {
    const tokens = estimateTokens(`${s.speakerNameRaw}: ${s.speechText}\n\n`);
    if (current.length > 0 && currentTokens + tokens > chunkTokenLimit) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(s);
    currentTokens += tokens;
  }
  if (current.length > 0) chunks.push(current);

  console.log(`    ${chunks.length} chunks (limit: ${chunkTokenLimit} tokens)`);

  const allQuestions: GeneralQuestion[] = [];
  const seen = new Set<string>(); // "questioner\0topic" で重複排除
  let consecutiveEmpty = 0;

  for (let i = 0; i < chunks.length; i++) {
    // 3チャンク連続で空 → 一般質問セクションは終了と判断
    if (consecutiveEmpty >= 3) {
      console.log(`    chunk ${i + 1}〜: skipped (3 consecutive empty)`);
      break;
    }

    const text = formatSpeeches(chunks[i]);
    console.log(`    chunk ${i + 1}/${chunks.length} (~${estimateTokens(text)} tokens)`);

    try {
      const questions = await extractGeneralQuestionsFromText(text);
      if (questions.length > 0) {
        let newCount = 0;
        for (const q of questions) {
          const key = `${q.questioner}\0${q.topic}`;
          if (!seen.has(key)) {
            seen.add(key);
            allQuestions.push(q);
            newCount++;
          }
        }
        console.log(`    chunk ${i + 1}: ${questions.length} found (${newCount} new)`);
        consecutiveEmpty = 0;
      } else {
        console.log(`    chunk ${i + 1}: no general questions`);
        consecutiveEmpty++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    chunk ${i + 1} failed: ${msg}`);
      consecutiveEmpty++;
    }

    if (i < chunks.length - 1) {
      await sleep(chunkWaitMs);
    }
  }

  console.log(`    merged total: ${allQuestions.length} questions`);
  return allQuestions;
}

// ============================================================
// Agenda Items Extraction
// ============================================================

const AGENDA_SYSTEM_PROMPTS: Record<string, string> = {
  committee: `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は委員会議事録です。審査された議案・案件を抽出してください。
各議案について title（議案名）、result（審査結果: 可決/否決/継続審査/承認 など）、notes（主な質疑・補足、省略可）を抽出してください。
出力形式（JSONのみ）:
{"agenda_items": [{"title": "議案第XX号 ...", "result": "可決", "notes": "..."}]}
審議事項がなければ {"agenda_items": []} を返してください。`,

  budget_committee: `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は予算決算委員会議事録です。審査された議案・予算案・決算案を抽出してください。
各議案について title（議案名）、result（審査結果: 可決/否決/継続審査/承認 など）、notes（主な質疑・補足、省略可）を抽出してください。
出力形式（JSONのみ）:
{"agenda_items": [{"title": "議案第XX号 ...", "result": "可決", "notes": "..."}]}
審議事項がなければ {"agenda_items": []} を返してください。`,

  extra: `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は臨時会議事録です。審議された議案と決議内容を抽出してください。
各議案について title（議案名）、result（審査結果: 可決/否決/継続審査/承認 など）、notes（主な質疑・補足、省略可）を抽出してください。
出力形式（JSONのみ）:
{"agenda_items": [{"title": "議案第XX号 ...", "result": "可決", "notes": "..."}]}
審議事項がなければ {"agenda_items": []} を返してください。`,

  regular: `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は定例会議事録です。一般質問を除いた議案審議・決議事項を抽出してください。
各議案について title（議案名）、result（審査結果: 可決/否決/継続審査/承認 など）、notes（主な質疑・補足、省略可）を抽出してください。
出力形式（JSONのみ）:
{"agenda_items": [{"title": "議案第XX号 ...", "result": "可決", "notes": "..."}]}
審議事項がなければ {"agenda_items": []} を返してください。`,

  other: `あなたは日本の地方議会（安芸高田市）の議事録を分析する専門家です。
以下は議会関連会議の議事録です。審議・報告された議案・案件を抽出してください。
各議案について title（議案名）、result（審査結果、省略可）、notes（主な内容・補足、省略可）を抽出してください。
出力形式（JSONのみ）:
{"agenda_items": [{"title": "...", "result": "...", "notes": "..."}]}
審議事項がなければ {"agenda_items": []} を返してください。`,
};

/** セッション種別に対応する議題抽出プロンプトを取得 */
function getAgendaSystemPrompt(sessionType: string): string {
  return AGENDA_SYSTEM_PROMPTS[sessionType] ?? AGENDA_SYSTEM_PROMPTS["other"];
}

/**
 * 議事録から議題・審議事項を抽出する
 * 先頭 TOKEN_THRESHOLD トークン分の発言を使用（議案は冒頭に集中するため）
 */
export async function extractAgendaItems(
  speeches: { speakerNameRaw: string; speechText: string }[],
  sessionType: string,
): Promise<AgendaItem[]> {
  const fullText = formatSpeeches(speeches);
  const estimated = estimateTokens(fullText);
  const targetText =
    estimated <= TOKEN_THRESHOLD
      ? fullText
      : formatSpeeches(splitIntoChunks(speeches)[0]);

  const systemPrompt = getAgendaSystemPrompt(sessionType);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await generateText({
        model: openai(MODEL_ID),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: targetText },
        ],
        providerOptions: {
          openai: {
            response_format: { type: "json_object" },
          },
        },
      });

      let jsonText = result.text.trim();
      const fenceMatch = jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
      if (fenceMatch) {
        jsonText = fenceMatch[1];
      }

      const parsed = JSON.parse(jsonText) as { agenda_items: AgendaItem[] };
      return parsed.agenda_items ?? [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isRateLimit = msg.includes("Rate limit") || msg.includes("429");

      if (isRateLimit && attempt < MAX_RETRIES - 1) {
        const waitMs = 30_000 * Math.pow(2, attempt);
        console.log(`    RETRY ${attempt + 1}/${MAX_RETRIES}: waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      throw new Error(`extractAgendaItems failed. Last error: ${msg}`);
    }
  }
  throw new Error("Unreachable");
}

/**
 * 全チャンクを順番に試し、一般質問が見つかったらそこで終了する
 * 大きなドキュメントで最初のチャンクが失敗した場合のリトライ用
 */
export async function extractGeneralQuestionsAllChunks(
  speeches: { speakerNameRaw: string; speechText: string }[],
  chunkTokenLimit = 4_000,
  chunkWaitMs = 10_000,
): Promise<GeneralQuestion[]> {
  // chunkTokenLimit でチャンク分割
  const chunks: { speakerNameRaw: string; speechText: string }[][] = [];
  let current: { speakerNameRaw: string; speechText: string }[] = [];
  let currentTokens = 0;

  for (const s of speeches) {
    const tokens = estimateTokens(`${s.speakerNameRaw}: ${s.speechText}\n\n`);
    if (current.length > 0 && currentTokens + tokens > chunkTokenLimit) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(s);
    currentTokens += tokens;
  }
  if (current.length > 0) chunks.push(current);

  console.log(`    ${chunks.length} chunks (limit: ${chunkTokenLimit} tokens)`);

  for (let i = 0; i < chunks.length; i++) {
    const text = formatSpeeches(chunks[i]);
    console.log(`    chunk ${i + 1}/${chunks.length} (~${estimateTokens(text)} tokens)`);

    try {
      const questions = await extractGeneralQuestionsFromText(text);
      if (questions.length > 0) {
        console.log(`    found ${questions.length} question(s) in chunk ${i + 1}`);
        return questions;
      }
      console.log(`    chunk ${i + 1}: no general questions`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`    chunk ${i + 1} failed: ${msg}`);
    }

    if (i < chunks.length - 1) {
      await sleep(chunkWaitMs);
    }
  }

  return [];
}
