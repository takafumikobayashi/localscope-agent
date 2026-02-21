import { readFile } from "fs/promises";
import type { PageText } from "./types";

/**
 * PDFファイルからページごとにテキストを抽出する
 */
export async function extractText(filePath: string): Promise<PageText[]> {
  // pdfjs-dist を動的インポート（ESM対応）
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const buf = await readFile(filePath);
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const pages: PageText[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // テキストアイテムを結合（改行を適切に処理）
    let text = "";
    let lastY: number | null = null;

    for (const item of content.items) {
      if (!("str" in item)) continue;

      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        text += "\n";
      }
      text += item.str;
      lastY = y;
    }

    pages.push({ page: i, text });
  }

  return pages;
}
