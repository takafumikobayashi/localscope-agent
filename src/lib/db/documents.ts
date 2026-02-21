import { prisma } from "@/lib/prisma";
import { SessionType } from "@/generated/prisma/enums";

const VALID_SESSION_TYPES = new Set<string>(Object.values(SessionType));

function parseSessionType(value: string): SessionType | undefined {
  return VALID_SESSION_TYPES.has(value) ? (value as SessionType) : undefined;
}

interface DocumentListFilters {
  fiscalYear?: number;
  sessionType?: string;
}

export async function getDocumentList(
  municipalityId: string,
  filters: DocumentListFilters = {},
) {
  const where: Record<string, unknown> = { municipalityId };

  if (filters.fiscalYear) {
    where.session = { fiscalYear: filters.fiscalYear };
  }
  const sessionType = filters.sessionType
    ? parseSessionType(filters.sessionType)
    : undefined;
  if (sessionType) {
    where.session = {
      ...((where.session as Record<string, unknown>) ?? {}),
      sessionType,
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

export async function getDocumentDetail(municipalityId: string, id: string) {
  const doc = await prisma.document.findUnique({
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

  if (!doc || doc.municipalityId !== municipalityId) return null;
  return doc;
}

export async function getDocumentSpeakerBreakdown(
  municipalityId: string,
  documentId: string,
) {
  // Verify the document belongs to the municipality
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { municipalityId: true },
  });
  if (!doc || doc.municipalityId !== municipalityId) return [];

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

export async function getAvailableFiscalYears(municipalityId: string) {
  const sessions = await prisma.session.findMany({
    where: { municipalityId },
    select: { fiscalYear: true },
    distinct: ["fiscalYear"],
    orderBy: { fiscalYear: "desc" },
  });
  return sessions.map((s) => s.fiscalYear);
}

export async function getAvailableSessionTypes(municipalityId: string) {
  const sessions = await prisma.session.findMany({
    where: { municipalityId },
    select: { sessionType: true },
    distinct: ["sessionType"],
  });
  return sessions.map((s) => s.sessionType);
}
