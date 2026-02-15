import { describe, it, expect } from "vitest";
import {
  parseSpeeches,
  parseSpeakerName,
  flattenPages,
  matchSpeakerLine,
} from "@/lib/ingestion/parser";
import type { PageText } from "@/lib/ingestion/types";

describe("parseSpeakerName", () => {
  it("議長を正しく分離", () => {
    const result = parseSpeakerName("大 下 議 長");
    expect(result.name).toBe("大下");
    expect(result.role).toBe("議長");
    expect(result.confidence).toBe("high");
  });

  it("議員を正しく分離", () => {
    const result = parseSpeakerName("宍 戸 議 員");
    expect(result.name).toBe("宍戸");
    expect(result.role).toBe("議員");
    expect(result.confidence).toBe("high");
  });

  it("予算決算常任委員長を正しく分離", () => {
    const result = parseSpeakerName("石飛予算決算常任委員長");
    expect(result.name).toBe("石飛");
    expect(result.role).toBe("予算決算常任委員長");
    expect(result.confidence).toBe("high");
  });

  it("市長を正しく分離", () => {
    const result = parseSpeakerName("藤 田 市 長");
    expect(result.name).toBe("藤田");
    expect(result.role).toBe("市長");
    expect(result.confidence).toBe("high");
  });

  it("副市長を正しく分離", () => {
    const result = parseSpeakerName("猪掛副市長");
    expect(result.name).toBe("猪掛");
    expect(result.role).toBe("副市長");
    expect(result.confidence).toBe("high");
  });

  it("教育長を正しく分離", () => {
    const result = parseSpeakerName("山本教育長");
    expect(result.name).toBe("山本");
    expect(result.role).toBe("教育長");
    expect(result.confidence).toBe("high");
  });

  it("部長を正しく分離", () => {
    const result = parseSpeakerName("田中総務部長");
    expect(result.name).toBe("田中");
    expect(result.role).toBe("総務部長");
    expect(result.confidence).toBe("high");
  });

  it("役職なしの場合はmedium confidence", () => {
    const result = parseSpeakerName("田中太郎");
    expect(result.name).toBe("田中太郎");
    expect(result.role).toBe("");
    expect(result.confidence).toBe("medium");
  });
});

describe("matchSpeakerLine", () => {
  it("名前+役職のみの行", () => {
    const result = matchSpeakerLine("○大 下 議 長");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("大 下 議 長");
    expect(result!.rest).toBe("");
  });

  it("名前+役職+発言テキストが続く行", () => {
    const result = matchSpeakerLine("○大下議長ただいまの出席議員は17名であります。");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("大下議長");
    expect(result!.rest).toBe("ただいまの出席議員は17名であります。");
  });

  it("長い役職+発言テキスト", () => {
    const result = matchSpeakerLine("○南澤産業厚生常任委員長まず1点目");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("南澤産業厚生常任委員長");
    expect(result!.rest).toBe("まず1点目");
  });

  it("委員+発言テキスト", () => {
    const result = matchSpeakerLine("○南澤委員賛成の立場で討論いたします。");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("南澤委員");
    expect(result!.rest).toBe("賛成の立場で討論いたします。");
  });

  it("課長+発言テキスト", () => {
    const result = matchSpeakerLine("○沖田財政課長本案は、安芸髙田市公の施設における");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("沖田財政課長");
    expect(result!.rest).toBe("本案は、安芸髙田市公の施設における");
  });

  it("事務局長+発言テキスト（組織名を含む役職は最短名マッチ）", () => {
    // "農業委員会事務局長" は組織名+役職の複合パターン
    // "委員" が先にマッチし、名前="稲田農業" となる既知の制限
    const result = matchSpeakerLine("○稲田農業委員会事務局長農業委員会事務局に係る要点を説明します。");
    expect(result).not.toBeNull();
    expect(result!.raw).toBe("稲田農業委員");
  });

  it("○のみの行はマッチしない", () => {
    expect(matchSpeakerLine("○")).toBeNull();
  });
});

describe("flattenPages", () => {
  it("ページ番号のみの行を除去", () => {
    const pages: PageText[] = [
      { page: 1, text: "内容\n3\n次の内容" },
    ];
    const lines = flattenPages(pages);
    expect(lines.map((l) => l.line)).toEqual(["内容", "次の内容"]);
  });

  it("空行を除去", () => {
    const pages: PageText[] = [
      { page: 1, text: "行1\n\n\n行2" },
    ];
    const lines = flattenPages(pages);
    expect(lines.map((l) => l.line)).toEqual(["行1", "行2"]);
  });

  it("ページ番号を正しく追跡", () => {
    const pages: PageText[] = [
      { page: 1, text: "1ページ目" },
      { page: 2, text: "2ページ目" },
    ];
    const lines = flattenPages(pages);
    expect(lines[0].page).toBe(1);
    expect(lines[1].page).toBe(2);
  });
});

describe("parseSpeeches", () => {
  it("基本的な発言者セグメンテーション", () => {
    const pages: PageText[] = [
      {
        page: 3,
        text: [
          "○大 下 議 長",
          "　ただいまの出席議員は17名であります。",
          "定足数に達しておりますので、ただいまから本日の会議を開きます。",
          "○宍 戸 議 員",
          "　議長、質問があります。",
        ].join("\n"),
      },
    ];

    const speeches = parseSpeeches(pages);
    expect(speeches).toHaveLength(2);

    expect(speeches[0].speakerName).toBe("大下");
    expect(speeches[0].speakerRole).toBe("議長");
    expect(speeches[0].speechText).toContain("出席議員は17名");
    expect(speeches[0].pageStart).toBe(3);
    expect(speeches[0].pageEnd).toBe(3);

    expect(speeches[1].speakerName).toBe("宍戸");
    expect(speeches[1].speakerRole).toBe("議員");
    expect(speeches[1].speechText).toContain("質問があります");
  });

  it("名前+役職+発言テキストが1行にある場合", () => {
    const pages: PageText[] = [
      {
        page: 3,
        text: [
          "○大下議長ただいまの出席議員は17名であります。",
          "○南澤委員賛成の立場で討論いたします。",
        ].join("\n"),
      },
    ];

    const speeches = parseSpeeches(pages);
    expect(speeches).toHaveLength(2);

    expect(speeches[0].speakerName).toBe("大下");
    expect(speeches[0].speakerRole).toBe("議長");
    expect(speeches[0].speechText).toBe("ただいまの出席議員は17名であります。");

    expect(speeches[1].speakerName).toBe("南澤");
    expect(speeches[1].speakerRole).toBe("委員");
    expect(speeches[1].speechText).toBe("賛成の立場で討論いたします。");
  });

  it("区切り行をスキップ", () => {
    const pages: PageText[] = [
      {
        page: 3,
        text: [
          "○大 下 議 長",
          "　発言内容",
          "～～～～～～～～◯～～～～～～～～",
          "○宍 戸 議 員",
          "　次の発言",
        ].join("\n"),
      },
    ];

    const speeches = parseSpeeches(pages);
    expect(speeches).toHaveLength(2);
    expect(speeches[0].speechText).not.toContain("～～～～");
  });

  it("○より前のテキスト（前文）はスキップ", () => {
    const pages: PageText[] = [
      {
        page: 1,
        text: [
          "議事日程",
          "出席議員リスト",
          "○大 下 議 長",
          "　発言内容",
        ].join("\n"),
      },
    ];

    const speeches = parseSpeeches(pages);
    expect(speeches).toHaveLength(1);
    expect(speeches[0].speakerName).toBe("大下");
  });

  it("ページをまたぐ発言のpageEndを追跡", () => {
    const pages: PageText[] = [
      { page: 3, text: "○大 下 議 長\n　発言開始" },
      { page: 4, text: "　発言続き" },
      { page: 5, text: "○宍 戸 議 員\n　新しい発言" },
    ];

    const speeches = parseSpeeches(pages);
    expect(speeches).toHaveLength(2);
    expect(speeches[0].pageStart).toBe(3);
    expect(speeches[0].pageEnd).toBe(4);
    expect(speeches[1].pageStart).toBe(5);
    expect(speeches[1].pageEnd).toBe(5);
  });

  it("空の入力は空配列を返す", () => {
    const speeches = parseSpeeches([]);
    expect(speeches).toEqual([]);
  });

  it("発言者なしの場合は空配列を返す", () => {
    const pages: PageText[] = [
      { page: 1, text: "前文のみのテキスト\n何も発言なし" },
    ];
    const speeches = parseSpeeches(pages);
    expect(speeches).toEqual([]);
  });
});
