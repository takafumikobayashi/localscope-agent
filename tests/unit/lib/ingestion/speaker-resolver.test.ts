import { describe, it, expect } from "vitest";
import { SpeakerResolver, normalizeAlias } from "@/lib/ingestion/speaker-resolver";
import type { AttendeeMap } from "@/lib/ingestion/db";

function makeAttendeeMap(
  entries: Array<{ fullName: string; familyName: string; speakerId: string }>,
): AttendeeMap {
  const byFullName = new Map<string, string>();
  const byFamilyName = new Map<string, string>();
  const familyCount = new Map<string, number>();

  for (const e of entries) {
    byFullName.set(e.fullName, e.speakerId);
    familyCount.set(e.familyName, (familyCount.get(e.familyName) ?? 0) + 1);
  }

  // 同姓が1名のみの場合にマップに追加
  for (const e of entries) {
    if (familyCount.get(e.familyName) === 1) {
      byFamilyName.set(e.familyName, e.speakerId);
    }
  }

  return { byFullName, byFamilyName };
}

describe("normalizeAlias", () => {
  it("空白を除去", () => {
    expect(normalizeAlias("南 澤 克 彦")).toBe("南澤克彦");
  });

  it("空文字列はそのまま", () => {
    expect(normalizeAlias("")).toBe("");
  });
});

describe("SpeakerResolver", () => {
  const attendeeMap = makeAttendeeMap([
    { fullName: "南澤克彦", familyName: "南澤", speakerId: "sp-1" },
    { fullName: "大下正幸", familyName: "大下", speakerId: "sp-2" },
    { fullName: "石丸伸二", familyName: "石丸", speakerId: "sp-3" },
    { fullName: "山本数博", familyName: "山本", speakerId: "sp-4" },
    { fullName: "山本優", familyName: "山本", speakerId: "sp-5" },
    { fullName: "佐々木智之", familyName: "佐々木", speakerId: "sp-6" },
  ]);

  const aliasMap = new Map<string, string>([
    ["沖田伸二", "sp-7"],
    ["沖田", "sp-7"],
  ]);

  const resolver = new SpeakerResolver(attendeeMap, aliasMap);

  describe("1. exact_fullname マッチ", () => {
    it("フルネーム完全一致", () => {
      const result = resolver.resolve("南澤克彦", "議員");
      expect(result.speakerId).toBe("sp-1");
      expect(result.fullName).toBe("南澤克彦");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("exact_fullname");
    });
  });

  describe("2. exact_family マッチ", () => {
    it("姓のみ完全一致（同姓なし）", () => {
      const result = resolver.resolve("南澤", "議員");
      expect(result.speakerId).toBe("sp-1");
      expect(result.fullName).toBe("南澤克彦");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("exact_family");
    });

    it("同姓複数の場合は familyName マップに含まれないので不一致", () => {
      const result = resolver.resolve("山本", "議員");
      // 山本は同姓2名なので byFamilyName にはない → alias or unresolved
      expect(result.matchStrategy).not.toBe("exact_family");
    });
  });

  describe("3. alias_norm マッチ", () => {
    it("alias 完全一致", () => {
      const result = resolver.resolve("沖田伸二", "課長");
      expect(result.speakerId).toBe("sp-7");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("alias_norm");
    });

    it("alias 姓のみ", () => {
      const result = resolver.resolve("沖田", "課長");
      expect(result.speakerId).toBe("sp-7");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("alias_norm");
    });
  });

  describe("4. paren_hint マッチ", () => {
    it("括弧付き: 山本(数) → 山本数博にマッチ", () => {
      const result = resolver.resolve("山本(数)", "議員");
      expect(result.speakerId).toBe("sp-4");
      expect(result.fullName).toBe("山本数博");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("paren_hint");
    });

    it("括弧付き: 山本(優) → 山本優にマッチ", () => {
      const result = resolver.resolve("山本(優)", "議員");
      expect(result.speakerId).toBe("sp-5");
      expect(result.fullName).toBe("山本優");
      expect(result.confidence).toBe("high");
      expect(result.matchStrategy).toBe("paren_hint");
    });

    it("全角括弧も対応", () => {
      const result = resolver.resolve("山本（数）", "議員");
      expect(result.speakerId).toBe("sp-4");
      expect(result.matchStrategy).toBe("paren_hint");
    });
  });

  describe("5. prefix マッチ", () => {
    it("姓+余分な文字列: 佐々木政策企画 → 佐々木智之", () => {
      const result = resolver.resolve("佐々木政策企画", "課長");
      expect(result.speakerId).toBe("sp-6");
      expect(result.fullName).toBe("佐々木智之");
      expect(result.confidence).toBe("medium");
      expect(result.matchStrategy).toBe("prefix");
    });
  });

  describe("6. unresolved", () => {
    it("マッチなし", () => {
      const result = resolver.resolve("田中", "議員");
      expect(result.speakerId).toBeNull();
      expect(result.confidence).toBe("low");
      expect(result.matchStrategy).toBe("unresolved");
    });
  });
});
