import { prisma } from "@/lib/prisma";

export async function getWordFrequencies(limit = 200) {
  return prisma.wordFrequency.findMany({
    orderBy: { count: "desc" },
    take: limit,
  });
}

export async function getTopicTrends() {
  const summaries = await prisma.documentSummary.findMany({
    select: {
      topics: true,
      document: {
        select: {
          session: { select: { fiscalYear: true } },
        },
      },
    },
  });

  // Group topics by fiscal year
  const yearTopics = new Map<number, Map<string, number>>();

  for (const s of summaries) {
    const year = s.document.session?.fiscalYear;
    if (!year) continue;
    const topics = s.topics as string[];
    if (!Array.isArray(topics)) continue;

    if (!yearTopics.has(year)) yearTopics.set(year, new Map());
    const topicMap = yearTopics.get(year)!;

    for (const t of topics) {
      topicMap.set(t, (topicMap.get(t) ?? 0) + 1);
    }
  }

  // Find top topics across all years
  const globalTopics = new Map<string, number>();
  for (const topicMap of yearTopics.values()) {
    for (const [t, c] of topicMap) {
      globalTopics.set(t, (globalTopics.get(t) ?? 0) + c);
    }
  }
  const topTopics = Array.from(globalTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  // Build chart data
  const years = Array.from(yearTopics.keys()).sort();
  return {
    years,
    topics: topTopics,
    data: years.map((year) => {
      const topicMap = yearTopics.get(year)!;
      const row: Record<string, number | string> = { year: `R${year - 2018}` };
      for (const t of topTopics) {
        row[t] = topicMap.get(t) ?? 0;
      }
      return row;
    }),
  };
}

export async function getSpeakerStats() {
  const speakers = await prisma.speaker.findMany({
    select: {
      nameJa: true,
      role: true,
      _count: { select: { speeches: true } },
    },
    orderBy: { speeches: { _count: "desc" } },
    take: 30,
  });

  return speakers.map((s) => ({
    name: s.nameJa,
    role: s.role,
    count: s._count.speeches,
  }));
}
