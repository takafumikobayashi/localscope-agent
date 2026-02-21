import { prisma } from "@/lib/prisma";

export async function getDashboardStats(municipalityId: string) {
  const [totalDocuments, totalSpeeches, totalSpeakers, totalSummaries] =
    await Promise.all([
      prisma.document.count({ where: { municipalityId } }),
      prisma.speech.count({ where: { document: { municipalityId } } }),
      prisma.speaker.count({ where: { municipalityId } }),
      prisma.documentSummary.count({ where: { document: { municipalityId } } }),
    ]);

  return { totalDocuments, totalSpeeches, totalSpeakers, totalSummaries };
}

export async function getRecentDocuments(municipalityId: string, limit = 10) {
  return prisma.document.findMany({
    where: { municipalityId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      summary: { select: { summaryText: true, topics: true } },
      _count: { select: { speeches: true } },
    },
  });
}

export async function getTopicFrequencies(municipalityId: string, limit = 15) {
  const summaries = await prisma.documentSummary.findMany({
    where: { document: { municipalityId } },
    select: { topics: true },
  });

  const counts = new Map<string, number>();
  for (const s of summaries) {
    const topics = s.topics as string[];
    if (!Array.isArray(topics)) continue;
    for (const t of topics) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getSpeakerRanking(municipalityId: string, limit = 15) {
  const speakers = await prisma.speaker.findMany({
    where: { municipalityId },
    select: {
      nameJa: true,
      role: true,
      _count: { select: { speeches: true } },
    },
    orderBy: { speeches: { _count: "desc" } },
    take: limit,
  });

  return speakers.map((s) => ({
    name: s.nameJa,
    role: s.role,
    count: s._count.speeches,
  }));
}
