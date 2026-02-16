import type { PageText, ParsedSpeech } from "./types";

/** 既知の役職サフィックス（長いものから順にマッチさせる） */
const ROLE_SUFFIXES = [
  "予算決算常任委員長",
  "総務文教常任委員長",
  "産業建設常任委員長",
  "産業厚生常任委員長",
  "常任委員長",
  "特別委員長",
  "委員長",
  "副委員長",
  "副議長",
  "議長",
  "議員",
  "副市長",
  "市長",
  "教育長",
  "総務部長",
  "企画部長",
  "財政課長",
  "危機管理監",
  "部長",
  "課長",
  "局長",
  "参事",
  "次長",
  "監査委員",
  "委員",
  "事務局長",
];

/** CJK文字パターン */
const CJK_RE = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}()（）\s]+$/u;

/** フォールバック: ○ + 短い名前（役職なし、行末まで） */
const SPEAKER_FALLBACK_RE = /^○([\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]{1,10}(?:\s+[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]{1,5})*)\s*$/u;

/** 区切り行パターン */
const SEPARATOR_RE = /^[～~○◯\s]+$/;

/** ページ番号のみの行 */
const PAGE_NUMBER_RE = /^\s*\d+\s*$/;

/**
 * PageText[]からテキストを正規化して行単位に分割し、
 * 各行がどのページに属するかを追跡する
 */
function flattenPages(pages: PageText[]): Array<{ line: string; page: number }> {
  const result: Array<{ line: string; page: number }> = [];

  for (const { page, text } of pages) {
    const lines = text.split("\n");
    for (const line of lines) {
      // ページ番号のみの行を除去
      if (PAGE_NUMBER_RE.test(line)) continue;
      // 空行は圧縮するが、完全な空行は保持しない
      const trimmed = line.trimEnd();
      if (trimmed.length === 0) continue;
      result.push({ line: trimmed, page });
    }
  }

  return result;
}

/**
 * 発言者テキストから名前と役職を分離
 * 例: `大 下 議 長` → { name: "大下", role: "議長" }
 */
function parseSpeakerName(raw: string): {
  name: string;
  role: string;
  confidence: "high" | "medium" | "low";
} {
  // スペースを除去した文字列で役職を検索
  const normalized = raw.replace(/\s+/g, "");

  for (const suffix of ROLE_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      const name = normalized.slice(0, -suffix.length);
      if (name.length > 0) {
        return { name, role: suffix, confidence: "high" };
      }
    }
  }

  // 役職が見つからない場合
  return {
    name: normalized,
    role: "",
    confidence: normalized.length > 0 ? "medium" : "low",
  };
}

/** 名前の最大文字数（スペース除去後） */
const MAX_NAME_LENGTH = 8;

/**
 * ○で始まる行を解析して、発言者情報と残りのテキストを返す
 * 役職サフィックスを探索し、名前が最短（最も早い位置）で最長の役職を採用
 */
function matchSpeakerLine(
  line: string,
): { raw: string; rest: string } | null {
  if (!line.startsWith("○") || line.length <= 1) return null;

  const after = line.slice(1); // ○を除去
  const normalized = after.replace(/\s+/g, "");

  // 各役職サフィックスについてマッチを試み、
  // 名前部分が最短のもの（同じ長さなら役職が最長のもの）を採用
  let bestMatch: {
    nameLen: number;
    roleLen: number;
    endPos: number;
  } | null = null;

  for (const suffix of ROLE_SUFFIXES) {
    const idx = normalized.indexOf(suffix);
    if (idx <= 0) continue;
    if (idx > MAX_NAME_LENGTH) continue;

    const namePart = normalized.slice(0, idx);
    if (!CJK_RE.test(namePart)) continue;

    const endPos = idx + suffix.length;

    if (
      !bestMatch ||
      idx < bestMatch.nameLen ||
      (idx === bestMatch.nameLen && suffix.length > bestMatch.roleLen)
    ) {
      bestMatch = { nameLen: idx, roleLen: suffix.length, endPos };
    }
  }

  if (bestMatch) {
    // rawは元のテキスト（スペース付き）から発言者部分を復元
    const rawSpeaker = extractOriginalSpeaker(after, bestMatch.endPos);
    const rest = after.slice(rawSpeaker.length).trim();
    return { raw: rawSpeaker, rest };
  }

  // フォールバック: 短い名前のみ（役職なし、行末まで）
  const fb = SPEAKER_FALLBACK_RE.exec(line);
  if (fb) {
    return { raw: fb[1].trim(), rest: "" };
  }

  return null;
}

/**
 * 元のテキスト（スペースあり）から、正規化後のN文字に対応する部分を抽出
 */
function extractOriginalSpeaker(original: string, normalizedLen: number): string {
  let count = 0;
  let i = 0;
  for (; i < original.length && count < normalizedLen; i++) {
    if (!/\s/.test(original[i])) {
      count++;
    }
  }
  return original.slice(0, i);
}

/**
 * テキストをパースして発言者ごとのセグメントに分割する（純粋なテキストパーサー）
 * 発言者の解決は SpeakerResolver で行う
 */
export function parseSpeeches(
  pages: PageText[],
): ParsedSpeech[] {
  const lines = flattenPages(pages);
  const speeches: ParsedSpeech[] = [];

  let currentSpeaker: {
    raw: string;
    name: string;
    role: string;
    confidence: "high" | "medium" | "low";
    fullName?: string;
  } | null = null;
  let currentLines: string[] = [];
  let currentPageStart = 0;
  let currentPageEnd = 0;

  function flushSpeech() {
    if (currentSpeaker && currentLines.length > 0) {
      const speechText = currentLines.join("\n").trim();
      if (speechText.length > 0) {
        speeches.push({
          speakerNameRaw: currentSpeaker.raw,
          speakerName: currentSpeaker.name,
          speakerRole: currentSpeaker.role,
          speechText,
          pageStart: currentPageStart,
          pageEnd: currentPageEnd,
          confidence: currentSpeaker.confidence,
          fullName: currentSpeaker.fullName,
        });
      }
    }
    currentLines = [];
  }

  for (const { line, page } of lines) {
    // 区切り行はスキップ
    if (SEPARATOR_RE.test(line)) continue;

    // ○で始まる行かチェック
    if (line.startsWith("○")) {
      const speaker = matchSpeakerLine(line);
      if (speaker) {
        // 前の発言をフラッシュ
        flushSpeech();

        const parsed = parseSpeakerName(speaker.raw);

        currentSpeaker = {
          raw: speaker.raw,
          name: parsed.name,
          role: parsed.role,
          confidence: parsed.confidence,
        };
        currentPageStart = page;
        currentPageEnd = page;

        // 同じ行に発言テキストがある場合は追加
        if (speaker.rest.length > 0) {
          currentLines.push(speaker.rest);
        }
      } else {
        // ○で始まるが発言者パターンにマッチしない → 通常テキストとして扱う
        if (currentSpeaker) {
          currentLines.push(line);
          currentPageEnd = page;
        }
      }
    } else {
      // 現在の発言に追加
      if (currentSpeaker) {
        currentLines.push(line);
        currentPageEnd = page;
      }
    }
  }

  // 最後の発言をフラッシュ
  flushSpeech();

  return speeches;
}

// テスト用にエクスポート
export { parseSpeakerName, flattenPages, matchSpeakerLine, ROLE_SUFFIXES };
