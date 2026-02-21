import { afterEach, describe, expect, it, vi } from "vitest";
import { extractPdfLinks, scrapeMinutesPage } from "@/lib/ingestion/scraper";

describe("extractPdfLinks", () => {
  it("extracts PDF links and section kinds from minutes page HTML", () => {
    const html = `
      <main>
        <h2>令和6年 定例会</h2>
        <a href="/akitakata-media/filer_public/a1/report-1.pdf">第1回 定例会</a>
        <h3>委員会</h3>
        <a href="https://www.akitakata.jp/akitakata-media/filer_public/b2/committee-1.pdf">総務文教常任委員会</a>
      </main>
    `;

    const links = extractPdfLinks(html, "R6");

    expect(links).toEqual([
      {
        url: "https://www.akitakata.jp/akitakata-media/filer_public/a1/report-1.pdf",
        title: "第1回 定例会",
        sectionKind: "regular",
        fiscalYear: "R6",
      },
      {
        url: "https://www.akitakata.jp/akitakata-media/filer_public/b2/committee-1.pdf",
        title: "総務文教常任委員会",
        sectionKind: "committee",
        fiscalYear: "R6",
      },
    ]);
  });

  it("falls back to URL filename when anchor text is empty", () => {
    const html = `
      <main>
        <a href="/akitakata-media/filer_public/c3/%E8%AD%B0%E4%BA%8B%E9%8C%B2.pdf"></a>
      </main>
    `;

    const links = extractPdfLinks(html, "R6");
    expect(links[0]?.title).toBe("議事録");
  });

  it("ignores non-PDF links and unrelated paths", () => {
    const html = `
      <body>
        <h2>令和6年 臨時会</h2>
        <a href="/files/not-target.pdf">ignore by path</a>
        <a href="/akitakata-media/filer_public/c3/not-pdf.txt">ignore by extension</a>
      </body>
    `;

    const links = extractPdfLinks(html, "R6");
    expect(links).toEqual([]);
  });
});

describe("scrapeMinutesPage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches page and parses discovered links", async () => {
    const html = `
      <main>
        <h2>臨時会</h2>
        <a href="/akitakata-media/filer_public/d4/temp.pdf">臨時会議事録</a>
      </main>
    `;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(html, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const pageUrl = "https://example.com/minutes";
    const links = await scrapeMinutesPage(pageUrl, "R6");

    expect(fetchMock).toHaveBeenCalledWith(pageUrl);
    expect(links).toEqual([
      {
        url: "https://www.akitakata.jp/akitakata-media/filer_public/d4/temp.pdf",
        title: "臨時会議事録",
        sectionKind: "extra",
        fiscalYear: "R6",
      },
    ]);
  });

  it("throws when fetch response is not ok", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      scrapeMinutesPage("https://example.com/minutes", "R6"),
    ).rejects.toThrow("Failed to fetch https://example.com/minutes: 500");
  });
});
