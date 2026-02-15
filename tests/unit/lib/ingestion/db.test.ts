import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    municipality: {
      upsert: vi.fn(),
    },
    source: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    ingestionRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentAsset: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("../../../../src/lib/prisma", () => ({
  prisma: mockPrisma,
}));

import {
  createIngestionRun,
  finalizeIngestionRun,
  updateDocumentStatus,
  upsertDocument,
  upsertDocumentAsset,
  upsertMunicipality,
  upsertSource,
} from "@/lib/ingestion/db";

describe("db helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upsertMunicipality returns municipality id", async () => {
    mockPrisma.municipality.upsert.mockResolvedValue({ id: "muni-1" });

    const id = await upsertMunicipality("広島県", "安芸高田市");

    expect(id).toBe("muni-1");
    expect(mockPrisma.municipality.upsert).toHaveBeenCalledWith({
      where: {
        prefectureJa_nameJa: { prefectureJa: "広島県", nameJa: "安芸高田市" },
      },
      create: { prefectureJa: "広島県", nameJa: "安芸高田市" },
      update: {},
    });
  });

  it("upsertSource reuses existing source by url", async () => {
    mockPrisma.source.findFirst.mockResolvedValue({ id: "source-existing" });

    const id = await upsertSource("muni-1", "会議録", "https://example.com/source");

    expect(id).toBe("source-existing");
    expect(mockPrisma.source.create).not.toHaveBeenCalled();
  });

  it("upsertSource creates source when not found", async () => {
    mockPrisma.source.findFirst.mockResolvedValue(null);
    mockPrisma.source.create.mockResolvedValue({ id: "source-new" });

    const id = await upsertSource("muni-1", "会議録", "https://example.com/source");

    expect(id).toBe("source-new");
    expect(mockPrisma.source.create).toHaveBeenCalledWith({
      data: {
        municipalityId: "muni-1",
        sourceType: "assembly_minutes",
        title: "会議録",
        url: "https://example.com/source",
      },
    });
  });

  it("createIngestionRun creates run and returns id", async () => {
    mockPrisma.ingestionRun.create.mockResolvedValue({ id: "run-1" });

    const id = await createIngestionRun("muni-1", "manual");

    expect(id).toBe("run-1");
    expect(mockPrisma.ingestionRun.create).toHaveBeenCalledWith({
      data: { municipalityId: "muni-1", trigger: "manual" },
    });
  });

  it("finalizeIngestionRun sets finishedAt, status, and log", async () => {
    await finalizeIngestionRun("run-1", "success", { total: 10 });

    expect(mockPrisma.ingestionRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        finishedAt: expect.any(Date),
        status: "success",
        log: { total: 10 },
      },
    });
  });

  it("upsertDocument returns existing document when already present", async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      status: "downloaded",
    });

    const result = await upsertDocument({
      municipalityId: "muni-1",
      sourceId: "source-1",
      url: "https://example.com/doc.pdf",
      title: "第1回",
      sectionKind: "regular",
    });

    expect(result).toEqual({ id: "doc-1", status: "downloaded", isNew: false });
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("upsertDocument creates new document with mapped document type", async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null);
    mockPrisma.document.create.mockResolvedValue({
      id: "doc-2",
      status: "discovered",
    });

    const result = await upsertDocument({
      municipalityId: "muni-1",
      sourceId: "source-1",
      url: "https://example.com/committee.pdf",
      title: "委員会",
      sectionKind: "committee",
    });

    expect(result).toEqual({ id: "doc-2", status: "discovered", isNew: true });
    expect(mockPrisma.document.create).toHaveBeenCalledWith({
      data: {
        municipalityId: "muni-1",
        sourceId: "source-1",
        url: "https://example.com/committee.pdf",
        title: "委員会",
        documentType: "committee_minutes",
        status: "discovered",
      },
    });
  });

  it("upsertDocumentAsset stores local provider and byte size as bigint", async () => {
    await upsertDocumentAsset({
      documentId: "doc-1",
      storagePath: "data/pdfs/doc-1.pdf",
      sha256: "abc123",
      bytes: 2048,
    });

    expect(mockPrisma.documentAsset.upsert).toHaveBeenCalledWith({
      where: { documentId: "doc-1" },
      create: {
        documentId: "doc-1",
        storageProvider: "local",
        storagePath: "data/pdfs/doc-1.pdf",
        contentSha256: "abc123",
        contentType: "application/pdf",
        bytes: BigInt(2048),
        downloadedAt: expect.any(Date),
      },
      update: {
        storagePath: "data/pdfs/doc-1.pdf",
        contentSha256: "abc123",
        bytes: BigInt(2048),
        downloadedAt: expect.any(Date),
      },
    });
  });

  it("updateDocumentStatus updates target document status", async () => {
    await updateDocumentStatus("doc-1", "parsed");

    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-1" },
      data: { status: "parsed" },
    });
  });
});
