import type { AttendeeMap } from "./db";
import type { ResolveResult } from "./types";

/**
 * 発言者名を canonical speaker に解決する。
 *
 * 解決優先順位:
 * 1. attendeeMap.byFullName 完全一致
 * 2. attendeeMap.byFamilyName 完全一致
 * 3. aliasMap の aliasNorm 完全一致
 * 4. 括弧ヒント（例: "山本(数)" → fullName に "数" を含む）
 * 5. familyName 前方一致（1名のみ）
 * 6. 未解決 → speakerId = null
 */
export class SpeakerResolver {
  constructor(
    private attendeeMap: AttendeeMap,
    private aliasMap: Map<string, string>, // aliasNorm → speakerId
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- speakerRole は将来の role ベース解決で使用予定
  resolve(speakerName: string, _speakerRole?: string): ResolveResult {
    const norm = normalizeAlias(speakerName);

    // 1. fullName 完全一致
    const byFull = this.attendeeMap.byFullName.get(norm);
    if (byFull) {
      return {
        speakerId: byFull,
        fullName: norm,
        confidence: "high",
        matchStrategy: "exact_fullname",
      };
    }

    // 2. familyName 完全一致
    const byFamily = this.attendeeMap.byFamilyName.get(norm);
    if (byFamily) {
      // familyName → fullName の逆引き
      const fullName = this.findFullNameBySpeakerId(byFamily);
      return {
        speakerId: byFamily,
        fullName,
        confidence: "high",
        matchStrategy: "exact_family",
      };
    }

    // 3. alias 完全一致
    const byAlias = this.aliasMap.get(norm);
    if (byAlias) {
      const fullName = this.findFullNameBySpeakerId(byAlias);
      return {
        speakerId: byAlias,
        fullName,
        confidence: "high",
        matchStrategy: "alias_norm",
      };
    }

    // 4. 括弧ヒント: "山本(数)" → familyName="山本", hint="数"
    const parenMatch = norm.match(/^(.+)[（(](.+)[）)]$/);
    if (parenMatch) {
      const baseName = parenMatch[1];
      const hint = parenMatch[2];
      for (const [fullName, speakerId] of this.attendeeMap.byFullName) {
        // familyName が baseName に一致 かつ fullName が hint を含む
        if (this.isFamilyNameOf(baseName, fullName) && fullName.includes(hint)) {
          return {
            speakerId,
            fullName,
            confidence: "high",
            matchStrategy: "paren_hint",
          };
        }
      }
    }

    // 5. familyName 前方一致（1名のみ）
    const prefixMatches: Array<{ speakerId: string; fullName: string }> = [];
    for (const [familyName, speakerId] of this.attendeeMap.byFamilyName) {
      if (familyName.length >= 2 && norm.startsWith(familyName)) {
        const fullName = this.findFullNameBySpeakerId(speakerId);
        if (fullName) {
          prefixMatches.push({ speakerId, fullName });
        }
      }
    }
    if (prefixMatches.length === 1) {
      return {
        speakerId: prefixMatches[0].speakerId,
        fullName: prefixMatches[0].fullName,
        confidence: "medium",
        matchStrategy: "prefix",
      };
    }

    // 6. 未解決
    return {
      speakerId: null,
      confidence: "low",
      matchStrategy: "unresolved",
    };
  }

  /** speakerId → fullName を逆引き */
  private findFullNameBySpeakerId(speakerId: string): string | undefined {
    for (const [fullName, id] of this.attendeeMap.byFullName) {
      if (id === speakerId) return fullName;
    }
    return undefined;
  }

  /** baseName が fullName の姓（先頭部分）かどうか */
  private isFamilyNameOf(baseName: string, fullName: string): boolean {
    return fullName.startsWith(baseName) && fullName.length > baseName.length;
  }
}

/** alias 正規化: 空白除去 */
export function normalizeAlias(raw: string): string {
  return raw.replace(/\s+/g, "");
}
