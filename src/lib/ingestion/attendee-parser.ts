import type { PageText, Attendee } from "./types";

/**
 * 全角数字→半角変換テーブル
 */
const ZEN_TO_HAN: Record<string, string> = {
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5", "６": "6", "７": "7", "８": "8", "９": "9",
};

function zenToHan(s: string): string {
  return s.replace(/[０-９]/g, (c) => ZEN_TO_HAN[c] ?? c);
}

/**
 * スペース区切りの名前からスペースを除去してフルネームを返す
 * 例: "南 澤 克 彦" → "南澤克彦"
 */
function removeSpaces(s: string): string {
  return s.replace(/\s+/g, "");
}

/**
 * スペース区切りの名前から姓を推定する。
 * スペース位置から姓名の境界を推定:
 * - 2文字姓が最も一般的（例: "南 澤 克 彦" → 姓=南澤）
 * - 1文字姓もある（例: "林 太 郎" → 姓=林）
 *
 * ルール: 名前のスペース区切り文字列で、最初の1〜3文字を姓と推定
 * スペースで区切った各文字が1文字ずつの場合、最初の2要素が姓
 * （3文字姓の場合もあるが、2文字姓がデフォルト）
 */
function extractFamilyName(spacedName: string): string {
  const chars = spacedName.trim().split(/\s+/);
  if (chars.length <= 1) return removeSpaces(spacedName);

  // 各要素が1文字ずつ（例: "南 澤 克 彦"）
  if (chars.every((c) => c.length === 1)) {
    if (chars.length === 2) return chars[0]; // 1文字姓 + 1文字名
    if (chars.length === 3) {
      // 2文字姓+1文字名 or 1文字姓+2文字名 → 判断困難だが2文字姓を優先
      return chars[0] + chars[1];
    }
    // 4文字以上: 2文字姓を前提
    return chars[0] + chars[1];
  }

  // 混在（例: "南澤 克彦"）→ 最初の要素が姓
  return chars[0];
}

/** セクション種別 */
type SectionType = "councilor" | "executive" | "staff";

/** セクション検出パターン */
const SECTION_PATTERNS: Array<{ pattern: RegExp; type: SectionType }> = [
  { pattern: /出席議員/, type: "councilor" },
  { pattern: /出席委員/, type: "councilor" },
  { pattern: /説明のため出席した者/, type: "executive" },
  { pattern: /規定により出席した者/, type: "executive" },
  { pattern: /事務局の職氏名/, type: "staff" },
  { pattern: /事務局職員/, type: "staff" },
];

/** 既知の役職パターン（長い順にマッチ） */
const KNOWN_ROLES = [
  "予算決算常任委員長",
  "総務文教常任委員長",
  "産業建設常任委員長",
  "産業厚生常任委員長",
  "常任委員長",
  "特別委員長",
  "副委員長",
  "委員長",
  "副議長",
  "議長",
  "副市長",
  "市長",
  "教育長",
  "総務部長",
  "企画部長",
  "市民部長",
  "福祉保健部長",
  "産業部長",
  "建設部長",
  "消防長",
  "危機管理監",
  "財政課長",
  "総務課長",
  "会計管理者",
  "水道局長",
  "農業委員会事務局長",
  "教育次長",
  "部長",
  "課長",
  "局長",
  "参事",
  "次長",
  "監査委員",
  "委員",
  "事務局長",
  "書記",
];

/**
 * 議員番号パターン: "１番" / "１ ０ 番" 等
 * 全角数字+番をキャプチャ
 */
const SEAT_NUMBER_RE = /([０-９\s]+)番/;

/**
 * PDF前文から出席者リストを抽出する。
 * 最初の `○` 行が出現するまでを前文として処理する。
 */
export function parseAttendees(pages: PageText[]): Attendee[] {
  const preambleText = extractPreamble(pages);
  if (!preambleText) return [];

  const lines = preambleText.split("\n");
  const attendees: Attendee[] = [];

  let currentSection: SectionType | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // セクション検出
    const section = detectSection(trimmed);
    if (section) {
      currentSection = section;
      // セクションヘッダ行自体は名前を含まないので続行
      // ただし同じ行に名前が含まれる場合もある（ヘッダの後に名前が続く）
      continue;
    }

    if (!currentSection) continue;

    // セクション終了の検出（次のセクションの番号パターン）
    if (/^[０-９\s]*[３４５６７８９]．/.test(trimmed)) {
      currentSection = null;
      // 新しいセクションかもしれないので再チェック
      const newSection = detectSection(trimmed);
      if (newSection) {
        currentSection = newSection;
      }
      continue;
    }

    // 現在のセクションに応じてパース
    if (currentSection === "councilor") {
      // 番号がある場合は議員パース、なければ委員会形式（役職+名前）
      const hasNumber = /[０-９]/.test(trimmed) && /番/.test(trimmed);
      if (hasNumber) {
        attendees.push(...parseCouncilorLine(trimmed));
      } else {
        // 委員会形式: "委員長芦田宏治副委員長山本数博"
        const officials = parseOfficialLine(trimmed, "executive");
        // カテゴリを councilor に修正
        for (const a of officials) {
          a.category = "councilor";
        }
        attendees.push(...officials);
      }
    } else {
      attendees.push(...parseOfficialLine(trimmed, currentSection));
    }
  }

  return attendees;
}

/**
 * 前文テキストを抽出（ページ1から最初の○行まで）
 */
function extractPreamble(pages: PageText[]): string | null {
  const textParts: string[] = [];

  for (const { text } of pages) {
    const lines = text.split("\n");
    for (const line of lines) {
      if (line.trimStart().startsWith("○")) {
        // ○行を見つけた→ここまでが前文
        return textParts.join("\n");
      }
      textParts.push(line);
    }
  }

  // ○行が見つからなかった場合は前文なし
  return null;
}

/**
 * セクション種別を検出
 */
function detectSection(line: string): SectionType | null {
  const normalized = removeSpaces(line);
  for (const { pattern, type } of SECTION_PATTERNS) {
    if (pattern.test(normalized)) return type;
  }
  return null;
}

/**
 * 議員行をパース
 * パターン: "１番 南 澤 克 彦 ２番 田 邊 介 三"
 * 1行に2名並ぶことが多い
 */
function parseCouncilorLine(line: string): Attendee[] {
  const attendees: Attendee[] = [];

  // 番号で分割: "１番 南 澤 克 彦" のチャンクに分ける
  // CJK文字の直後に全角数字が来る位置で分割（"彦　２番" の "２" の前）
  const chunks = line.split(/(?<=[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}]\s*)(?=[０-９])/u);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const seatMatch = SEAT_NUMBER_RE.exec(trimmed);
    if (seatMatch) {
      const seatStr = zenToHan(removeSpaces(seatMatch[1]));
      const seatNumber = parseInt(seatStr, 10);
      const nameStr = trimmed.slice(seatMatch.index + seatMatch[0].length).trim();

      if (nameStr) {
        const fullName = removeSpaces(nameStr);
        const familyName = extractFamilyName(nameStr);
        if (fullName.length >= 2) {
          attendees.push({
            fullName,
            familyName,
            role: "議員",
            seatNumber: isNaN(seatNumber) ? undefined : seatNumber,
            category: "councilor",
          });
        }
      }
    }
  }

  return attendees;
}

/**
 * 説明者/事務局行をパース
 * パターン: "市 長 石 丸 伸 二 副 市 長 米 村 公 男"
 * 役職 + フルネームが交互に出現
 */
function parseOfficialLine(line: string, category: SectionType): Attendee[] {
  const attendees: Attendee[] = [];
  const normalized = removeSpaces(line);

  // 既知の役職で分割位置を見つける
  const rolePositions: Array<{ role: string; index: number }> = [];

  let searchFrom = 0;
  while (searchFrom < normalized.length) {
    let bestMatch: { role: string; index: number; length: number } | null = null;

    for (const role of KNOWN_ROLES) {
      const idx = normalized.indexOf(role, searchFrom);
      if (idx === -1) continue;
      if (idx !== searchFrom && rolePositions.length === 0) {
        // 最初の役職は先頭付近にあるはず
      }
      if (
        !bestMatch ||
        idx < bestMatch.index ||
        (idx === bestMatch.index && role.length > bestMatch.length)
      ) {
        bestMatch = { role, index: idx, length: role.length };
      }
    }

    if (!bestMatch) break;

    rolePositions.push({ role: bestMatch.role, index: bestMatch.index });
    searchFrom = bestMatch.index + bestMatch.length;
  }

  // 各役職の後に名前が続く
  for (let i = 0; i < rolePositions.length; i++) {
    const { role, index: roleIndex } = rolePositions[i];
    const nameStart = roleIndex + role.length;
    const nameEnd =
      i + 1 < rolePositions.length
        ? rolePositions[i + 1].index
        : normalized.length;

    const nameStr = normalized.slice(nameStart, nameEnd).trim();
    if (nameStr.length >= 2) {
      // 名前部分のスペース区切りは元テキストから推定が難しいので
      // normalizedから姓を推定する（2文字姓をデフォルト）
      const familyName = guessFamilyNameFromNormalized(nameStr);

      attendees.push({
        fullName: nameStr,
        familyName,
        role,
        category: category === "executive" ? "executive" : "staff",
      });
    }
  }

  return attendees;
}

/**
 * スペースなしの名前から姓を推定
 * デフォルト2文字姓（日本の姓の大半を占める）
 * ただし既知の1文字姓・3文字姓は例外処理
 */
const ONE_CHAR_FAMILY_NAMES = new Set([
  "林", "森", "原", "関", "堀", "辻", "東", "西",
  "谷", "泉", "柳", "杉", "馬", "沢",
]);

function guessFamilyNameFromNormalized(name: string): string {
  if (name.length <= 2) return name;

  // 1文字姓チェック
  if (ONE_CHAR_FAMILY_NAMES.has(name[0]) && name.length >= 2) {
    return name[0];
  }

  // デフォルト: 2文字姓
  return name.slice(0, 2);
}

// テスト用にエクスポート
export {
  extractPreamble,
  extractFamilyName,
  parseCouncilorLine,
  parseOfficialLine,
  guessFamilyNameFromNormalized,
};
