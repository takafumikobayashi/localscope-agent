import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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

export interface GeneralQuestionRow {
  questioner: string;
  topic: string;
  documentId: string;
  sessionName: string | null;
}

export async function getGeneralQuestionTopics(
  municipalityId: string,
  limit = 20,
): Promise<GeneralQuestionRow[]> {
  const docs = await prisma.document.findMany({
    where: {
      municipalityId,
      session: { sessionType: "regular" },
      summary: { generalQuestions: { not: Prisma.AnyNull } },
    },
    orderBy: [
      { session: { fiscalYear: "desc" } },
      { session: { startOn: "desc" } },
      { publishedOn: "desc" },
    ],
    select: {
      id: true,
      session: { select: { sessionName: true } },
      summary: { select: { generalQuestions: true } },
    },
  });

  // トピックの出現頻度を集計し、代表行（最新の出現）を保持する
  const topicCount = new Map<string, number>();
  const topicFirst = new Map<string, GeneralQuestionRow>();

  for (const doc of docs) {
    const questions = doc.summary?.generalQuestions as { questioner: string; topic: string }[] | null;
    if (!Array.isArray(questions)) continue;
    for (const q of questions) {
      if (!q.topic || !q.questioner) continue;
      topicCount.set(q.topic, (topicCount.get(q.topic) ?? 0) + 1);
      // docs は新しい順に並んでいるため、最初に出現した行が最新の出現
      if (!topicFirst.has(q.topic)) {
        topicFirst.set(q.topic, {
          questioner: q.questioner,
          topic: q.topic,
          documentId: doc.id,
          sessionName: doc.session?.sessionName ?? null,
        });
      }
    }
  }

  // 頻度降順でソートして上位 limit 件を返す
  return Array.from(topicCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([topic]) => topicFirst.get(topic)!);
}
