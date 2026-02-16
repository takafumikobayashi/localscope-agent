import { createHash } from "crypto";
import { rmSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeSha256,
  downloadPdf,
  getFileSize,
  sleep,
} from "@/lib/ingestion/downloader";

const ROOT_DIR = process.cwd();
const TEST_DATA_DIR = path.join(ROOT_DIR, ".test-data");

function expectedSha256(content: Buffer): string {
  const hash = createHash("sha256");
  hash.update(content);
  return hash.digest("hex");
}

// config の PDF_DIR をテスト用ディレクトリに差し替え
vi.mock("@/lib/ingestion/config", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/ingestion/config")>();
  return {
    ...original,
    PDF_DIR: path.join(process.cwd(), ".test-data", "pdfs"),
  };
});

describe("downloader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  });

  it("computes SHA-256 for local file", async () => {
    const filePath = path.join(ROOT_DIR, "tmp-sha.txt");
    const content = "hello-world";
    await writeFile(filePath, content, "utf-8");

    const sha = await computeSha256(filePath);
    expect(sha).toBe(expectedSha256(Buffer.from(content, "utf-8")));

    rmSync(filePath, { force: true });
  });

  it("returns local file size", async () => {
    const filePath = path.join(ROOT_DIR, "tmp-size.txt");
    await writeFile(filePath, "1234567890", "utf-8");

    const bytes = await getFileSize(filePath);
    expect(bytes).toBe(10);

    rmSync(filePath, { force: true });
  });

  it("sleeps at least specified milliseconds", async () => {
    const startedAt = Date.now();
    await sleep(20);
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(18);
  });

  it("downloads PDF, stores file, and returns metadata", async () => {
    const content = Buffer.from([1, 2, 3, 4, 5]);
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(content, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const url = "https://example.com/test%20minutes.pdf";
    const result = await downloadPdf(url);

    expect(fetchMock).toHaveBeenCalledWith(url);
    expect(result.storagePath).toBe(path.join(TEST_DATA_DIR, "pdfs", "test minutes.pdf"));
    expect(result.bytes).toBe(content.byteLength);
    expect(result.sha256).toBe(expectedSha256(content));

    const saved = await readFile(path.join(TEST_DATA_DIR, "pdfs", "test minutes.pdf"));
    expect(saved.equals(content)).toBe(true);
  });

  it("throws when download response is not ok", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadPdf("https://example.com/not-found.pdf")).rejects.toThrow(
      "Failed to download https://example.com/not-found.pdf: 404",
    );
  });

  it("throws when download response body is missing", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadPdf("https://example.com/no-body.pdf")).rejects.toThrow(
      "No response body for https://example.com/no-body.pdf",
    );
  });

  it("creates download directory when missing", async () => {
    rmSync(TEST_DATA_DIR, { recursive: true, force: true });
    const content = Buffer.from("pdf-data");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(content, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadPdf("https://example.com/dir-check.pdf");
    const saved = await readFile(result.storagePath);
    expect(saved.equals(content)).toBe(true);
  });
});
