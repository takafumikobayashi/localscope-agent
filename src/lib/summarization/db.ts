import { prisma } from "../prisma";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";

/**
 * parsed 状態かつ summary 未生成のドキュメントを取得
 */
export async function getUnsummarizedDocuments() {
  return prisma.document.findMany({
    where: {
      status: "parsed",
      summary: null,
    },
    include: {
      speeches: {
        orderBy: { sequence: "asc" },
        select: { speakerNameRaw: true, speechText: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * すべての parsed ドキュメントを取得（--force 用）
 */
export async function getAllParsedDocuments() {
  return prisma.document.findMany({
    where: { status: "parsed" },
    include: {
      speeches: {
        orderBy: { sequence: "asc" },
        select: { speakerNameRaw: true, speechText: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * DocumentSummary を upsert（documentId PK でべき等）
 */
export async function upsertDocumentSummary(params: {
  documentId: string;
  summaryText: string;
  topics: string[];
  keyPoints: string[];
  modelId: string;
  tokenCount: number;
}): Promise<void> {
  await prisma.documentSummary.upsert({
    where: { documentId: params.documentId },
    create: {
      documentId: params.documentId,
      summaryText: params.summaryText,
      topics: params.topics as unknown as InputJsonValue,
      keyPoints: params.keyPoints as unknown as InputJsonValue,
      modelId: params.modelId,
      tokenCount: params.tokenCount,
    },
    update: {
      summaryText: params.summaryText,
      topics: params.topics as unknown as InputJsonValue,
      keyPoints: params.keyPoints as unknown as InputJsonValue,
      modelId: params.modelId,
      tokenCount: params.tokenCount,
    },
  });
}
