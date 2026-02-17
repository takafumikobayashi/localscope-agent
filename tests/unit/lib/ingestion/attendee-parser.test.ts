import { describe, it, expect } from "vitest";
import {
  parseAttendees,
  extractFamilyName,
  parseCouncilorLine,
  parseOfficialLine,
  guessFamilyNameFromNormalized,
  truncateToName,
} from "@/lib/ingestion/attendee-parser";
import type { PageText } from "@/lib/ingestion/types";

describe("extractFamilyName", () => {
  it("スペース区切り4文字名から2文字姓を抽出", () => {
    expect(extractFamilyName("南 澤 克 彦")).toBe("南澤");
  });

  it("スペース区切り3文字名から2文字姓を抽出", () => {
    expect(extractFamilyName("石 丸 伸")).toBe("石丸");
  });

  it("スペース区切り2文字名から1文字目を姓として抽出", () => {
    // 2文字は姓名判断が難しいが、1文字姓+1文字名として扱う
    expect(extractFamilyName("林 太")).toBe("林");
  });

  it("スペースなしの名前はそのまま返す", () => {
    expect(extractFamilyName("南澤克彦")).toBe("南澤克彦");
  });

  it("姓名の2分割パターン", () => {
    expect(extractFamilyName("南澤 克彦")).toBe("南澤");
  });
});

describe("guessFamilyNameFromNormalized", () => {
  it("デフォルト2文字姓", () => {
    expect(guessFamilyNameFromNormalized("南澤克彦")).toBe("南澤");
  });

  it("既知の1文字姓", () => {
    expect(guessFamilyNameFromNormalized("林太郎")).toBe("林");
  });

  it("2文字の名前はそのまま", () => {
    expect(guessFamilyNameFromNormalized("南澤")).toBe("南澤");
  });
});

describe("parseCouncilorLine", () => {
  it("1行に2名の議員をパース", () => {
    const result = parseCouncilorLine(
      "１番　南 澤 克 彦　　　　　　　　　２番　田 邊 介 三",
    );
    expect(result).toHaveLength(2);

    expect(result[0].fullName).toBe("南澤克彦");
    expect(result[0].familyName).toBe("南澤");
    expect(result[0].role).toBe("議員");
    expect(result[0].seatNumber).toBe(1);
    expect(result[0].category).toBe("councilor");

    expect(result[1].fullName).toBe("田邊介三");
    expect(result[1].familyName).toBe("田邊");
    expect(result[1].seatNumber).toBe(2);
  });

  it("1行に1名の議員をパース", () => {
    const result = parseCouncilorLine("１５番　大 下 正 幸");
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("大下正幸");
    expect(result[0].seatNumber).toBe(15);
  });

  it("番号がない行は空配列", () => {
    const result = parseCouncilorLine("前文テキスト");
    expect(result).toHaveLength(0);
  });
});

describe("parseOfficialLine", () => {
  it("市長と副市長をパース", () => {
    const result = parseOfficialLine(
      "市長石丸伸二副市長米村公男",
      "executive",
    );
    expect(result).toHaveLength(2);

    expect(result[0].fullName).toBe("石丸伸二");
    expect(result[0].familyName).toBe("石丸");
    expect(result[0].role).toBe("市長");
    expect(result[0].category).toBe("executive");

    expect(result[1].fullName).toBe("米村公男");
    expect(result[1].familyName).toBe("米村");
    expect(result[1].role).toBe("副市長");
  });

  it("部長をパース", () => {
    const result = parseOfficialLine("総務部長高藤誠", "executive");
    expect(result).toHaveLength(1);
    expect(result[0].fullName).toBe("高藤誠");
    expect(result[0].role).toBe("総務部長");
  });

  it("事務局スタッフをパース", () => {
    const result = parseOfficialLine("事務局長田中太郎書記山田花子", "staff");
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe("事務局長");
    expect(result[0].category).toBe("staff");
    expect(result[1].role).toBe("書記");
  });
});

describe("truncateToName", () => {
  it("通常の名前はそのまま返す", () => {
    expect(truncateToName("石丸伸二")).toBe("石丸伸二");
  });

  it("名前の後に組織名バイグラムが続く場合、そこで切る", () => {
    expect(truncateToName("沖田伸二政策企画")).toBe("沖田伸二");
  });

  it("名前の後に未知の役職が続く場合、バイグラムで切れる", () => {
    expect(truncateToName("沖田伸二政策企画課長黒田貢一")).toBe("沖田伸二");
  });

  it("3文字の名前はそのまま", () => {
    expect(truncateToName("高藤誠")).toBe("高藤誠");
  });

  it("補佐接頭辞を除去して名前を抽出", () => {
    expect(truncateToName("補佐小野光基社会環境課")).toBe("小野光基");
  });

  it("兼+既知役職の接頭辞を除去して名前を抽出", () => {
    expect(truncateToName("兼福祉事務所長井上和志")).toBe("井上和志");
  });

  it("兼+未知役職（長で終わる）を除去して名前を抽出", () => {
    expect(truncateToName("兼給食センター所長内藤麻妃")).toBe("内藤麻妃");
  });

  it("特殊文字（・）で切る", () => {
    expect(truncateToName("田中太郎・次郎")).toBe("田中太郎");
  });

  it("特殊文字（（）で切る", () => {
    expect(truncateToName("田中太郎（代理）")).toBe("田中太郎");
  });
});

describe("parseOfficialLine - 未知役職パターン", () => {
  it("未知の役職が挟まるケース", () => {
    const result = parseOfficialLine(
      "財政課長沖田伸二政策企画課長黒田貢一",
      "executive",
    );
    // 「財政課長」と「課長」にマッチ。
    // 財政課長の後の名前は「沖田伸二」（4文字）で切れるべき
    const names = result.map((a) => a.fullName);
    expect(names).toContain("沖田伸二");
  });

  it("事務局の次長パターン", () => {
    const result = parseOfficialLine(
      "事務局長高藤誠事務局次長國岡浩祐",
      "staff",
    );
    const names = result.map((a) => a.fullName);
    expect(names).toContain("高藤誠");
  });

  it("総務部長の後に未知の長い役職が続くケース", () => {
    const result = parseOfficialLine(
      "総務部長新谷洋子総務部政策統括監佐々木満朗",
      "executive",
    );
    expect(result[0].fullName).toBe("新谷洋子");
    expect(result[0].role).toBe("総務部長");
  });

  it("教育次長の後に未知の役職が続くケース", () => {
    const result = parseOfficialLine(
      "教育次長柳川知昭危機管理監神田正広",
      "executive",
    );
    expect(result[0].fullName).toBe("柳川知昭");
    expect(result[0].role).toBe("教育次長");
  });

  it("兼接頭辞ケース - 福祉保健部長兼福祉事務所長", () => {
    const result = parseOfficialLine(
      "福祉保健部長兼福祉事務所長井上和志",
      "executive",
    );
    // 福祉保健部長の名前部分は「兼福祉事務所長井上和志」→ truncateToNameで「井上和志」
    const names = result.map((a) => a.fullName);
    expect(names).toContain("井上和志");
  });

  it("補佐接頭辞ケース", () => {
    const result = parseOfficialLine(
      "課長補佐小野光基",
      "executive",
    );
    const names = result.map((a) => a.fullName);
    expect(names).toContain("小野光基");
  });

  it("係長パターン", () => {
    const result = parseOfficialLine(
      "総務課長田中太郎総務係長日野貴恵",
      "executive",
    );
    expect(result[0].fullName).toBe("田中太郎");
    expect(result[0].role).toBe("総務課長");
  });
});

describe("parseAttendees", () => {
  it("本会議パターンの出席者リストをパース", () => {
    const pages: PageText[] = [
      {
        page: 1,
        text: [
          "安芸高田市議会定例会会議録",
          "２．出席議員は次のとおりである。（１５名）",
          "１番　南 澤 克 彦　　　　　　　　　２番　田 邊 介 三",
          "３番　石 飛 空",
          "３．欠席議員",
          "なし",
          "５．地方自治法第１２１条により説明のため出席した者の職氏名（１６名）",
          "市長石丸伸二副市長米村公男",
          "総務部長高藤誠",
          "○大 下 議 長",
          "　ただいまの出席議員は15名であります。",
        ].join("\n"),
      },
    ];

    const attendees = parseAttendees(pages);

    // 議員3名 + 説明者3名
    const councilors = attendees.filter((a) => a.category === "councilor");
    const executives = attendees.filter((a) => a.category === "executive");

    expect(councilors.length).toBe(3);
    expect(executives.length).toBe(3);

    expect(councilors[0].fullName).toBe("南澤克彦");
    expect(councilors[0].familyName).toBe("南澤");

    expect(executives[0].fullName).toBe("石丸伸二");
    expect(executives[0].role).toBe("市長");
  });

  it("委員会パターンの出席者リストをパース", () => {
    const pages: PageText[] = [
      {
        page: 1,
        text: [
          "総務文教常任委員会会議録",
          "２．出席委員は次のとおりである。（７名）",
          "委員長芦田宏治副委員長山本数博",
          "委員南澤克彦",
          "５．安芸高田市議会委員会条例第２２条の規定により出席した者の職氏名（３４名）",
          "市長石丸伸二",
          "○芦 田 委 員 長",
          "　開会します。",
        ].join("\n"),
      },
    ];

    const attendees = parseAttendees(pages);

    const councilors = attendees.filter((a) => a.category === "councilor");
    const executives = attendees.filter((a) => a.category === "executive");

    expect(councilors.length).toBe(3);
    expect(councilors[0].role).toBe("委員長");
    expect(councilors[1].role).toBe("副委員長");
    expect(councilors[2].role).toBe("委員");

    expect(executives.length).toBe(1);
    expect(executives[0].fullName).toBe("石丸伸二");
  });

  it("○行がない場合は空配列", () => {
    const pages: PageText[] = [
      {
        page: 1,
        text: "前文のみのテキスト\n何も発言なし",
      },
    ];
    const attendees = parseAttendees(pages);
    expect(attendees).toEqual([]);
  });

  it("空ページは空配列", () => {
    expect(parseAttendees([])).toEqual([]);
  });
});
