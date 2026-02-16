import { describe, it, expect } from "vitest";
import { buildMergeGroups } from "../../../scripts/migrate-speakers";
import type { SpeakerRecord } from "../../../scripts/migrate-speakers";

describe("buildMergeGroups", () => {
  it("同一 municipality 内で prefix マッチするグループを構築", () => {
    const speakers: SpeakerRecord[] = [
      { id: "1", municipalityId: "muni-1", nameJa: "沖田伸二" },
      { id: "2", municipalityId: "muni-1", nameJa: "沖田伸二市民" },
      { id: "3", municipalityId: "muni-1", nameJa: "沖田伸二政策企画" },
    ];

    const groups = buildMergeGroups(speakers);
    expect(groups).toHaveLength(1);
    expect(groups[0].canonical.nameJa).toBe("沖田伸二");
    expect(groups[0].duplicates.map((d) => d.nameJa)).toEqual(
      expect.arrayContaining(["沖田伸二市民", "沖田伸二政策企画"]),
    );
  });

  it("3文字未満の名前は canonical にならない", () => {
    const speakers: SpeakerRecord[] = [
      { id: "1", municipalityId: "muni-1", nameJa: "田中" },
      { id: "2", municipalityId: "muni-1", nameJa: "田中太郎" },
    ];

    const groups = buildMergeGroups(speakers);
    expect(groups).toHaveLength(0);
  });

  it("異なる municipality は別扱い", () => {
    const speakers: SpeakerRecord[] = [
      { id: "1", municipalityId: "muni-1", nameJa: "沖田伸二" },
      { id: "2", municipalityId: "muni-2", nameJa: "沖田伸二市民" },
    ];

    const groups = buildMergeGroups(speakers);
    expect(groups).toHaveLength(0);
  });

  it("prefix でない場合はマージしない", () => {
    const speakers: SpeakerRecord[] = [
      { id: "1", municipalityId: "muni-1", nameJa: "南澤克彦" },
      { id: "2", municipalityId: "muni-1", nameJa: "大下正幸" },
    ];

    const groups = buildMergeGroups(speakers);
    expect(groups).toHaveLength(0);
  });

  it("重複なしの場合は空配列", () => {
    const groups = buildMergeGroups([]);
    expect(groups).toEqual([]);
  });
});
