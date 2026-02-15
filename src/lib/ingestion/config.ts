export const BASE_URL = "https://www.akitakata.jp";

/** 年度ごとの会議録ページURL */
export const YEAR_PAGES: Record<string, string> = {
  R6: `${BASE_URL}/ja/parliament/gikai201/g152/u112/`,
  R7: `${BASE_URL}/ja/parliament/gikai201/e672/`,
};

/** PDFダウンロード先ディレクトリ */
export const PDF_DIR = "data/pdfs";

/** ダウンロード間隔（ミリ秒） */
export const DOWNLOAD_INTERVAL_MS = 500;
