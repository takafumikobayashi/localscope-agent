import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const [totalDocuments, totalSpeeches, totalSpeakers, totalSummaries] =
    await Promise.all([
      prisma.document.count(),
      prisma.speech.count(),
      prisma.speaker.count(),
      prisma.documentSummary.count(),
    ]);

  return { totalDocuments, totalSpeeches, totalSpeakers, totalSummaries };
}

export async function getRecentDocuments(limit = 10) {
  return prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      summary: { select: { summaryText: true, topics: true } },
      _count: { select: { speeches: true } },
    },
  });
}

export async function getTopicFrequencies(limit = 15) {
  const summaries = await prisma.documentSummary.findMany({
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

export async function getSpeakerRanking(limit = 15) {
  const speakers = await prisma.speaker.findMany({
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
