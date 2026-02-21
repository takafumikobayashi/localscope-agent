import { prisma } from "@/lib/prisma";

export async function getMunicipalities() {
  const municipalities = await prisma.municipality.findMany({
    select: {
      id: true,
      nameJa: true,
      nameEn: true,
      prefectureJa: true,
      _count: {
        select: {
          documents: true,
          speakers: true,
        },
      },
    },
    orderBy: { nameJa: "asc" },
  });

  return municipalities.map((m) => ({
    id: m.id,
    nameJa: m.nameJa,
    nameEn: m.nameEn,
    prefectureJa: m.prefectureJa,
    documentCount: m._count.documents,
    speakerCount: m._count.speakers,
  }));
}

export async function getMunicipalityById(id: string) {
  return prisma.municipality.findUnique({
    where: { id },
    select: {
      id: true,
      nameJa: true,
      nameEn: true,
      prefectureJa: true,
    },
  });
}
