import { createHash } from "crypto";
import { createWriteStream, mkdirSync } from "fs";
import { pipeline } from "stream/promises";
import { Readable, Transform } from "stream";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { PDF_DIR, DOWNLOAD_INTERVAL_MS } from "./config";
import type { DownloadResult } from "./types";

/**
 * URLからPDFをダウンロードし、SHA-256を計算して保存する
 */
export async function downloadPdf(pdfUrl: string): Promise<DownloadResult> {
  mkdirSync(PDF_DIR, { recursive: true });

  const filename = generateFilename(pdfUrl);
  const storagePath = path.join(PDF_DIR, filename);

  const res = await fetch(pdfUrl);
  if (!res.ok) {
    throw new Error(`Failed to download ${pdfUrl}: ${res.status}`);
  }
  if (!res.body) {
    throw new Error(`No response body for ${pdfUrl}`);
  }

  // ストリーム中にSHA-256を計算
  const hash = createHash("sha256");
  let bytes = 0;

  const nodeStream = Readable.fromWeb(
    res.body as import("stream/web").ReadableStream,
  );
  const writeStream = createWriteStream(storagePath);
  const tapStream = new Transform({
    transform(chunk, _encoding, callback) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(buf);
      bytes += buf.length;
      callback(null, buf);
    },
  });

  await pipeline(nodeStream, tapStream, writeStream);

  const sha256 = hash.digest("hex");

  return { storagePath, sha256, bytes };
}

/**
 * ローカルファイルのSHA-256を計算する
 */
export async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest("hex");
}

/**
 * ファイルサイズを取得
 */
export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

/**
 * URLからファイル名を生成
 *
 * URL全体のSHA-256先頭12文字をプレフィックスとして付与することで、
 * 異なるURLが同一basename（例: "minutes.pdf"）を持つ場合の上書き衝突を防ぐ。
 * 同じURLは常に同じファイル名になるため再実行しても冪等。
 *
 * 例: "a1b2c3d4e5f6_minutes.pdf"
 */
function generateFilename(url: string): string {
  const urlPath = new URL(url).pathname;
  const original = decodeURIComponent(path.basename(urlPath));
  const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  return `${urlHash}_${original}`;
}

/**
 * ポライトアクセス用のスリープ
 */
export function sleep(ms: number = DOWNLOAD_INTERVAL_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
