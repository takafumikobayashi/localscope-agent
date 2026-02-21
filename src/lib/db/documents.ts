import { prisma } from "@/lib/prisma";

interface DocumentListFilters {
  fiscalYear?: number;
  sessionType?: string;
}

export async function getDocumentList(filters: DocumentListFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.fiscalYear) {
    where.session = { fiscalYear: filters.fiscalYear };
  }
  if (filters.sessionType) {
    where.session = {
      ...((where.session as Record<string, unknown>) ?? {}),
      sessionType: filters.sessionType,
    };
  }

  return prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      session: { select: { fiscalYear: true, sessionName: true, sessionType: true } },
      summary: { select: { summaryText: true, topics: true } },
      _count: { select: { speeches: true } },
    },
  });
}

export async function getDocumentDetail(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: {
      session: true,
      summary: true,
      speeches: {
        orderBy: { sequence: "asc" },
        include: {
          speaker: { select: { nameJa: true, role: true } },
        },
      },
    },
  });
}

export async function getDocumentSpeakerBreakdown(documentId: string) {
  const speeches = await prisma.speech.groupBy({
    by: ["speakerId"],
    where: { documentId },
    _count: { id: true },
  });

  const speakerIds = speeches
    .map((s) => s.speakerId)
    .filter((id): id is string => id !== null);

  const speakers = await prisma.speaker.findMany({
    where: { id: { in: speakerIds } },
    select: { id: true, nameJa: true, role: true },
  });

  const speakerMap = new Map(speakers.map((s) => [s.id, s]));

  return speeches
    .map((s) => ({
      name: s.speakerId ? speakerMap.get(s.speakerId)?.nameJa ?? "不明" : "不明",
      role: s.speakerId ? speakerMap.get(s.speakerId)?.role ?? "unknown" : "unknown",
      count: s._count.id,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function getAvailableFiscalYears() {
  const sessions = await prisma.session.findMany({
    select: { fiscalYear: true },
    distinct: ["fiscalYear"],
    orderBy: { fiscalYear: "desc" },
  });
  return sessions.map((s) => s.fiscalYear);
}

export async function getAvailableSessionTypes() {
  const sessions = await prisma.session.findMany({
    select: { sessionType: true },
    distinct: ["sessionType"],
  });
  return sessions.map((s) => s.sessionType);
}
