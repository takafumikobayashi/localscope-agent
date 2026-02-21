import { describe, it, expect, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      summary: "テスト要約",
      topics: ["財政"],
      key_points: ["予算が承認された"],
    }),
    usage: { totalTokens: 150 },
  }),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mocked-model"),
}));

import {
  estimateTokens,
  formatSpeeches,
  summarizeDocument,
} from "@/lib/summarization/summarizer";

describe("estimateTokens", () => {
  it("日本語テキストのトークン数を概算する（文字数 × 0.5）", () => {
    expect(estimateTokens("あいうえお")).toBe(3); // 5 * 0.5 = 2.5 → ceil = 3
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
  });

  it("長文でも正しく計算する", () => {
    const text = "あ".repeat(1000);
    expect(estimateTokens(text)).toBe(500);
  });
});

describe("formatSpeeches", () => {
  it("発言を正しいフォーマットで結合する", () => {
    const speeches = [
      { speakerNameRaw: "議長", speechText: "開会します。" },
      { speakerNameRaw: "田中議員", speechText: "質問します。" },
    ];
    const result = formatSpeeches(speeches);
    expect(result).toBe("議長: 開会します。\n\n田中議員: 質問します。");
  });

  it("空配列で空文字を返す", () => {
    expect(formatSpeeches([])).toBe("");
  });
});

describe("summarizeDocument", () => {
  it("LLMを呼び出して要約結果を返す", async () => {
    const result = await summarizeDocument([
      { speakerNameRaw: "議長", speechText: "開会します。" },
    ]);

    expect(result.summary).toBe("テスト要約");
    expect(result.topics).toEqual(["財政"]);
    expect(result.keyPoints).toEqual(["予算が承認された"]);
    expect(result.totalTokens).toBe(150);
  });
});
