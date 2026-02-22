/**
 * 既存ドキュメントから sessions テーブルを生成し、
 * documents.session_id と speeches.session_id を設定するスクリプト
 * Usage: npm run backfill-sessions
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deriveSessionInfo, upsertSession } from "../src/lib/ingestion/db";

type SessionType = "regular" | "extra" | "committee" | "budget_committee" | "other";

interface SessionGroup {
  municipalityId: string;
  sessionName: string;
  sessionType: SessionType;
  fiscalYear: number;
  documentIds: string[];
  publishedOns: Date[];
}

async function main() {
  const docs = await prisma.document.findMany({
    select: { id: true, url: true, publishedOn: true, municipalityId: true },
  });

  console.log(`Found ${docs.length} document(s)`);

  // セッションキー → SessionGroup
  const groups = new Map<string, SessionGroup>();

  for (const doc of docs) {
    const info = deriveSessionInfo(doc.url);
    if (!info) {
      console.log(`  SKIP: ${doc.url} — セッション情報を導出できませんでした`);
      continue;
    }

    const key = `${doc.municipalityId}:${info.fiscalYear}:${info.sessionName}`;
    if (!groups.has(key)) {
      groups.set(key, {
        municipalityId: doc.municipalityId,
        sessionName: info.sessionName,
        sessionType: info.sessionType,
        fiscalYear: info.fiscalYear,
        documentIds: [],
        publishedOns: [],
      });
    }
    const group = groups.get(key)!;
    group.documentIds.push(doc.id);
    if (doc.publishedOn) group.publishedOns.push(doc.publishedOn);
  }

  console.log(`\nGrouped into ${groups.size} session(s)\n`);

  let sessionsCreated = 0;
  let docsLinked = 0;
  let speechesLinked = 0;

  for (const group of groups.values()) {
    const { municipalityId, sessionName, sessionType, fiscalYear, documentIds, publishedOns } = group;

    // startOn/endOn は publishedOn の min/max
    const sortedDates = [...publishedOns].sort((a, b) => a.getTime() - b.getTime());
    const startOn = sortedDates[0] ?? null;
    const endOn = sortedDates[sortedDates.length - 1] ?? null;
    // 1日のみの場合は heldOn も設定
    const heldOn = startOn && endOn && startOn.getTime() === endOn.getTime() ? startOn : null;

    const sessionId = await upsertSession(
      municipalityId,
      sessionName,
      sessionType,
      fiscalYear,
      { startOn, endOn, heldOn },
    );

    console.log(
      `  "${sessionName}" (${fiscalYear}) — ${documentIds.length} doc(s)` +
      (startOn ? ` / ${startOn.toISOString().slice(0, 10)}` : "") +
      (endOn && endOn !== startOn ? `〜${endOn.toISOString().slice(0, 10)}` : ""),
    );
    sessionsCreated++;

    // documents.session_id を更新
    const docResult = await prisma.document.updateMany({
      where: { id: { in: documentIds } },
      data: { sessionId },
    });
    docsLinked += docResult.count;

    // speeches.session_id を更新
    const speechResult = await prisma.speech.updateMany({
      where: { documentId: { in: documentIds } },
      data: { sessionId },
    });
    speechesLinked += speechResult.count;
  }

  console.log(`\nDone.`);
  console.log(`Sessions upserted : ${sessionsCreated}`);
  console.log(`Documents linked  : ${docsLinked}`);
  console.log(`Speeches linked   : ${speechesLinked}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
