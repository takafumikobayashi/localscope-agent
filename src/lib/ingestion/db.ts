import { prisma } from "../prisma";
import type { InputJsonValue } from "@/generated/prisma/internal/prismaNamespace";
import type { SectionKind, Attendee } from "./types";
import { normalizeAlias } from "./speaker-resolver";

// ============================================================
// Seed helpers
// ============================================================

/**
 * 自治体をupsert（prefecture + name の組み合わせでユニーク）
 */
export async function upsertMunicipality(
  prefectureJa: string,
  nameJa: string,
): Promise<string> {
  const muni = await prisma.municipality.upsert({
    where: {
      prefectureJa_nameJa: { prefectureJa, nameJa },
    },
    create: { prefectureJa, nameJa },
    update: {},
  });
  return muni.id;
}

/**
 * ソースをupsert（URLでユニーク判定）
 */
export async function upsertSource(
  municipalityId: string,
  title: string,
  url: string,
): Promise<string> {
  // URLでソースを検索、なければ作成
  const existing = await prisma.source.findFirst({
    where: { municipalityId, url },
  });
  if (existing) return existing.id;

  const source = await prisma.source.create({
    data: {
      municipalityId,
      sourceType: "assembly_minutes",
      title,
      url,
    },
  });
  return source.id;
}

// ============================================================
// Ingestion Run
// ============================================================

export async function createIngestionRun(
  municipalityId: string,
  trigger: "manual" | "schedule" | "webhook",
): Promise<string> {
  const run = await prisma.ingestionRun.create({
    data: { municipalityId, trigger },
  });
  return run.id;
}

export async function finalizeIngestionRun(
  runId: string,
  status: "success" | "partial" | "failed",
  log: Record<string, unknown>,
): Promise<void> {
  await prisma.ingestionRun.update({
    where: { id: runId },
    data: {
      finishedAt: new Date(),
      status,
      log: log as unknown as InputJsonValue,
    },
  });
}

// ============================================================
// Document
// ============================================================

function sectionKindToDocumentType(
  kind: SectionKind,
): "minutes" | "committee_minutes" | "other" {
  switch (kind) {
    case "regular":
    case "extra":
      return "minutes";
    case "committee":
      return "committee_minutes";
    default:
      return "other";
  }
}

/**
 * ドキュメントをupsert（URLユニーク制約でべき等）
 * 新規の場合は status: discovered で作成
 */
export async function upsertDocument(params: {
  municipalityId: string;
  sourceId: string;
  url: string;
  title: string;
  sectionKind: SectionKind;
}): Promise<{ id: string; status: string; isNew: boolean }> {
  const documentType = sectionKindToDocumentType(params.sectionKind);

  const existing = await prisma.document.findUnique({
    where: { url: params.url },
  });

  if (existing) {
    return { id: existing.id, status: existing.status, isNew: false };
  }

  const doc = await prisma.document.create({
    data: {
      municipalityId: params.municipalityId,
      sourceId: params.sourceId,
      url: params.url,
      title: params.title,
      documentType,
      status: "discovered",
    },
  });

  return { id: doc.id, status: doc.status, isNew: true };
}

/**
 * DocumentAsset をupsert（documentId がPK）
 */
export async function upsertDocumentAsset(params: {
  documentId: string;
  storagePath: string;
  sha256: string;
  bytes: number;
}): Promise<void> {
  await prisma.documentAsset.upsert({
    where: { documentId: params.documentId },
    create: {
      documentId: params.documentId,
      storageProvider: "local",
      storagePath: params.storagePath,
      contentSha256: params.sha256,
      contentType: "application/pdf",
      bytes: BigInt(params.bytes),
      downloadedAt: new Date(),
    },
    update: {
      storagePath: params.storagePath,
      contentSha256: params.sha256,
      bytes: BigInt(params.bytes),
      downloadedAt: new Date(),
    },
  });
}

/**
 * ドキュメントのステータスを更新
 */
export async function updateDocumentStatus(
  documentId: string,
  status: "discovered" | "downloaded" | "extracted" | "parsed" | "failed",
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: { status },
  });
}

/**
 * status = downloaded のドキュメントを全件取得（アセット付き）
 */
export async function getDownloadedDocuments() {
  return prisma.document.findMany({
    where: { status: "downloaded" },
    include: { asset: true },
  });
}

// ============================================================
// Speaker / Speech
// ============================================================

/** SpeakerRole 文字列を Prisma enum にマッピング */
function toSpeakerRole(
  role: string,
): "councilor" | "mayor" | "executive" | "chair" | "staff" | "unknown" {
  if (role === "議員") return "councilor";
  if (role === "市長") return "mayor";
  if (role === "副市長" || role === "教育長") return "executive";
  if (role === "議長" || role === "副議長") return "chair";
  if (role.includes("委員長")) return "chair";
  if (
    role.includes("部長") ||
    role.includes("課長") ||
    role.includes("局長") ||
    role.includes("参事") ||
    role.includes("次長") ||
    role.includes("監査委員") ||
    role.includes("危機管理監")
  )
    return "staff";
  return "unknown";
}

/**
 * 発言者をupsert（municipalityId + nameJa で判定）
 */
export async function upsertSpeaker(
  municipalityId: string,
  nameJa: string,
  role: string,
): Promise<string> {
  const speakerRole = toSpeakerRole(role);

  const existing = await prisma.speaker.findFirst({
    where: { municipalityId, nameJa },
  });

  if (existing) {
    // roleがunknownから判明した場合は更新
    if (existing.role === "unknown" && speakerRole !== "unknown") {
      await prisma.speaker.update({
        where: { id: existing.id },
        data: { role: speakerRole },
      });
    }
    return existing.id;
  }

  const speaker = await prisma.speaker.create({
    data: { municipalityId, nameJa, role: speakerRole },
  });
  return speaker.id;
}

/** upsertAttendees の返り値 */
export interface AttendeeMap {
  /** familyName → speakerId（同姓重複は除外） */
  byFamilyName: Map<string, string>;
  /** fullName → speakerId */
  byFullName: Map<string, string>;
}

/**
 * 出席者リストから speakers テーブルに一括 upsert し、
 * 出席者由来の alias（fullName, familyName）を自動登録する
 */
export async function upsertAttendees(
  municipalityId: string,
  attendees: Attendee[],
): Promise<AttendeeMap> {
  const byFamilyName = new Map<string, string>();
  const byFullName = new Map<string, string>();

  for (const attendee of attendees) {
    const speakerRole = toSpeakerRole(attendee.role);

    const existing = await prisma.speaker.findFirst({
      where: { municipalityId, nameJa: attendee.fullName },
    });

    let speakerId: string;
    if (existing) {
      // roleがunknownから判明した場合は更新
      if (existing.role === "unknown" && speakerRole !== "unknown") {
        await prisma.speaker.update({
          where: { id: existing.id },
          data: { role: speakerRole },
        });
      }
      speakerId = existing.id;
    } else {
      const speaker = await prisma.speaker.create({
        data: { municipalityId, nameJa: attendee.fullName, role: speakerRole },
      });
      speakerId = speaker.id;
    }

    // fullName マップ（常に追加）
    byFullName.set(attendee.fullName, speakerId);

    // familyName マップ（同姓が複数いる場合はマップに含めない）
    if (byFamilyName.has(attendee.familyName)) {
      byFamilyName.set(attendee.familyName, "");
    } else {
      byFamilyName.set(attendee.familyName, speakerId);
    }

    // alias 登録（fullName, familyName）
    await upsertSpeakerAlias(
      municipalityId,
      speakerId,
      attendee.fullName,
      "attendee_derived",
      1.0,
    );
    // familyName は同姓でも登録（後で aliasMap では最初に登録された方が残る）
    await upsertSpeakerAlias(
      municipalityId,
      speakerId,
      attendee.familyName,
      "attendee_derived",
      0.8,
    );
  }

  // 重複（空文字）エントリを除去
  for (const [key, value] of byFamilyName) {
    if (value === "") byFamilyName.delete(key);
  }

  return { byFamilyName, byFullName };
}

/**
 * ドキュメントに紐づく発言を全削除（再パース用のべき等性確保）
 */
export async function deleteSpeeches(documentId: string): Promise<number> {
  const result = await prisma.speech.deleteMany({
    where: { documentId },
  });
  return result.count;
}

/**
 * 発言を作成
 */
export async function createSpeech(params: {
  documentId: string;
  speakerId: string | null;
  speakerNameRaw: string;
  sequence: number;
  speechText: string;
  pageStart: number | null;
  pageEnd: number | null;
  confidence: number;
}): Promise<string> {
  const speech = await prisma.speech.create({
    data: {
      documentId: params.documentId,
      speakerId: params.speakerId ?? undefined,
      speakerNameRaw: params.speakerNameRaw,
      sequence: params.sequence,
      speechText: params.speechText,
      pageStart: params.pageStart,
      pageEnd: params.pageEnd,
      confidence: params.confidence,
    },
  });
  return speech.id;
}

// ============================================================
// Speaker Alias
// ============================================================

/**
 * SpeakerAlias を upsert（municipalityId + aliasNorm でユニーク）
 */
export async function upsertSpeakerAlias(
  municipalityId: string,
  speakerId: string,
  aliasRaw: string,
  aliasType: "attendee_derived" | "speech_derived" | "manual",
  confidence?: number,
): Promise<void> {
  const aliasNorm = normalizeAlias(aliasRaw);
  if (aliasNorm.length === 0) return;

  const existing = await prisma.speakerAlias.findUnique({
    where: {
      municipalityId_aliasNorm: { municipalityId, aliasNorm },
    },
  });

  if (existing) {
    // 既存のaliasが同じspeakerIdなら何もしない
    // 異なるspeakerIdの場合、manual > attendee_derived > speech_derived の優先順で更新
    if (existing.speakerId !== speakerId) {
      const priority: Record<string, number> = {
        manual: 3,
        attendee_derived: 2,
        speech_derived: 1,
      };
      if ((priority[aliasType] ?? 0) > (priority[existing.aliasType] ?? 0)) {
        await prisma.speakerAlias.update({
          where: { id: existing.id },
          data: { speakerId, aliasRaw, aliasType, confidence },
        });
      }
    }
    return;
  }

  await prisma.speakerAlias.create({
    data: {
      municipalityId,
      speakerId,
      aliasRaw,
      aliasNorm,
      aliasType,
      confidence,
    },
  });
}

/**
 * municipality の全 alias を読み込んで aliasNorm → speakerId マップを返す
 */
export async function loadAliasMap(
  municipalityId: string,
): Promise<Map<string, string>> {
  const aliases = await prisma.speakerAlias.findMany({
    where: { municipalityId },
  });

  const map = new Map<string, string>();
  for (const alias of aliases) {
    map.set(alias.aliasNorm, alias.speakerId);
  }
  return map;
}
