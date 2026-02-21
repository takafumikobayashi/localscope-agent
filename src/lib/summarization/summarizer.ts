import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const MODEL_ID = "gpt-4o";

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
