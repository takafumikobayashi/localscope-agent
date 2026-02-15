/** セクション種別（定例会・臨時会・委員会など） */
export type SectionKind = "regular" | "extra" | "committee" | "other";

/** スクレイピングで発見したPDFリンク */
export interface DiscoveredLink {
  url: string;
  title: string;
  sectionKind: SectionKind;
  fiscalYear: string; // e.g. "R6", "R7"
}

/** ダウンロード結果 */
export interface DownloadResult {
  storagePath: string;
  sha256: string;
  bytes: number;
}

/** インジェスション処理で共有するコンテキスト */
export interface IngestionContext {
  municipalityId: string;
  sourceId: string;
  runId: string;
}

/** ページごとの抽出テキスト */
export interface PageText {
  page: number;
  text: string;
}

/** パース済み発言データ */
export interface ParsedSpeech {
  /** 生テキスト（例: `大 下 議 長`） */
  speakerNameRaw: string;
  /** 正規化名（例: `大下`） */
  speakerName: string;
  /** 検出した役職 */
  speakerRole: string;
  /** 発言テキスト */
  speechText: string;
  /** 開始ページ番号 */
  pageStart: number;
  /** 終了ページ番号 */
  pageEnd: number;
  /** 信頼度 */
  confidence: "high" | "medium" | "low";
}
