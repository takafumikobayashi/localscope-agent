import * as cheerio from "cheerio";
import { BASE_URL } from "./config";
import type { DiscoveredLink, SectionKind } from "./types";

/**
 * 会議録ページのHTMLからPDFリンクを抽出する
 */
export async function scrapeMinutesPage(
  pageUrl: string,
  fiscalYear: string,
): Promise<DiscoveredLink[]> {
  const res = await fetch(pageUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${pageUrl}: ${res.status}`);
  }
  const html = await res.text();
  return extractPdfLinks(html, fiscalYear);
}

/**
 * HTMLからPDFリンクを抽出
 */
export function extractPdfLinks(
  html: string,
  fiscalYear: string,
): DiscoveredLink[] {
  const $ = cheerio.load(html);
  const links: DiscoveredLink[] = [];

  // 現在のセクション種別を追跡
  let currentSection: SectionKind = "other";

  // コンテンツ領域内を走査
  const contentArea = $(".entry-content, .article-body, main, body").first();

  contentArea.find("h2, h3, h4, a").each((_, el) => {
    const $el = $(el);
    const tagName = el.type === "tag" ? el.tagName.toLowerCase() : "";

    // 見出しからセクション種別を判定
    if (tagName === "h2" || tagName === "h3" || tagName === "h4") {
      const headingText = $el.text();
      currentSection = detectSectionKind(headingText);
      return;
    }

    // PDFリンクを抽出
    if (tagName === "a") {
      const href = $el.attr("href");
      if (!href) return;

      // akitakata-media/filer_public を含むリンクのみ対象
      if (!href.includes("akitakata-media/filer_public")) return;

      // PDFファイルのみ
      if (!href.toLowerCase().endsWith(".pdf")) return;

      const absoluteUrl = href.startsWith("http")
        ? href
        : `${BASE_URL}${href.startsWith("/") ? "" : "/"}${href}`;

      const title = $el.text().trim() || extractTitleFromUrl(href);

      links.push({
        url: absoluteUrl,
        title,
        sectionKind: currentSection,
        fiscalYear,
      });
    }
  });

  return links;
}

/**
 * 見出しテキストからセクション種別を判定
 */
function detectSectionKind(text: string): SectionKind {
  if (/定例会|定例議会/.test(text)) return "regular";
  if (/臨時会|臨時議会/.test(text)) return "extra";
  if (/委員会/.test(text)) return "committee";
  return "other";
}

/**
 * URLからファイル名ベースのタイトルを生成
 */
function extractTitleFromUrl(url: string): string {
  const filename = url.split("/").pop() ?? "";
  return decodeURIComponent(filename.replace(/\.pdf$/i, ""));
}
