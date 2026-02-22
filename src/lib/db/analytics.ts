import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/** 議会運営語パターン（補正予算・議事手続き系を除外） */
const PROCEDURAL_PATTERN =
  /補正予算|当初予算|一般会計|特別会計|会期の決定|署名議員|議事日程|委員長報告|閉会宣言|開会宣言|人事案件|議長の選任|副議長の選任/;

export async function getTopicTrends(municipalityId: string, filterProcedural = false) {
  const summaries = await prisma.documentSummary.findMany({
    where: { document: { municipalityId } },
    select: {
      topics: true,
      document: {
        select: {
          publishedOn: true,
          session: { select: { sessionName: true, startOn: true } },
        },
      },
    },
  });

  // Group topics by period (session name > year-month from published_on)
  // periodKey は "YYYY-MM:label" 形式で時系列ソート用、label は表示用
  const periodTopics = new Map<string, Map<string, number>>();
  const periodLabel = new Map<string, string>(); // periodKey → display label

  for (const s of summaries) {
    const topics = s.topics as string[];
    if (!Array.isArray(topics)) continue;

    let periodKey: string | null = null;
    let label: string | null = null;

    if (s.document.session?.sessionName) {
      const name = s.document.session.sessionName;
      // startOn > publishedOn の順で日付を取得してソートキーに使う
      const sortDate = s.document.session.startOn ?? s.document.publishedOn;
      if (sortDate) {
        const yyyy = sortDate.getFullYear();
        const mm = sortDate.getMonth() + 1;
        periodKey = `${yyyy}-${String(mm).padStart(2, "0")}:${name}`;
      } else {
        periodKey = name;
      }
      label = name;
    } else if (s.document.publishedOn) {
      const d = s.document.publishedOn;
      const yyyy = d.getFullYear();
      const mm = d.getMonth() + 1;
      const reiwa = yyyy - 2018;
      periodKey = `${yyyy}-${String(mm).padStart(2, "0")}`;
      label = `R${reiwa}/${mm}月`;
    }

    if (!periodKey || !label) continue;

    if (!periodTopics.has(periodKey)) {
      periodTopics.set(periodKey, new Map());
      periodLabel.set(periodKey, label);
    }
    const topicMap = periodTopics.get(periodKey)!;
    for (const t of topics) {
      topicMap.set(t, (topicMap.get(t) ?? 0) + 1);
    }
  }

  // Find top topics across all periods
  const globalTopics = new Map<string, number>();
  for (const topicMap of periodTopics.values()) {
    for (const [t, c] of topicMap) {
      if (filterProcedural && PROCEDURAL_PATTERN.test(t)) continue;
      globalTopics.set(t, (globalTopics.get(t) ?? 0) + c);
    }
  }
  const topTopics = Array.from(globalTopics.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t);

  // Build chart data (sorted chronologically by periodKey)
  const sortedKeys = Array.from(periodTopics.keys()).sort();
  return {
    years: sortedKeys,
    topics: topTopics,
    data: sortedKeys.map((key) => {
      const topicMap = periodTopics.get(key)!;
      const row: Record<string, number | string> = {
        year: periodLabel.get(key)!,
      };
      for (const t of topTopics) {
        row[t] = topicMap.get(t) ?? 0;
      }
      return row;
    }),
  };
}

export async function getSpeechCountByYear(municipalityId: string) {
  const rows = await prisma.$queryRaw<{ year: string; count: bigint }[]>`
    SELECT EXTRACT(YEAR FROM d.published_on)::text AS year, COUNT(s.id) AS count
    FROM speeches s
    JOIN documents d ON s.document_id = d.id
    WHERE d.municipality_id = ${municipalityId}::uuid AND d.published_on IS NOT NULL
    GROUP BY year ORDER BY year
  `;
  return rows.map((r) => ({ year: r.year, count: Number(r.count) }));
}

export async function getSpeechCountByDocument(municipalityId: string) {
  const docs = await prisma.document.findMany({
    where: {
      municipalityId,
      session: { sessionType: "regular" },
    },
    select: {
      title: true,
      publishedOn: true,
      session: {
        select: { fiscalYear: true, sessionName: true, startOn: true },
      },
      _count: { select: { speeches: true } },
    },
    orderBy: [
      { session: { fiscalYear: "asc" } },
      { session: { startOn: "asc" } },
      { publishedOn: "asc" },
    ],
  });

  // 同一会期内での通し番号付け（タイトルに「第N日」がない場合に使用）
  const sessionDayCounter = new Map<string, number>();

  return docs
    .filter((d) => d._count.speeches > 0)
    .map((d) => {
      const reiwa = (d.session?.fiscalYear ?? 2024) - 2018;
      const sessionNum = d.session?.sessionName.match(/第(\d+)回/)?.[1] ?? "?";
      const sessionKey = `R${reiwa}-${sessionNum}`;

      // タイトルから「第N日」を抽出、なければ通し番号を付与
      const dayInTitle = d.title.match(/第(\d+)日/)?.[1];
      let dayLabel: string;
      if (dayInTitle) {
        dayLabel = `${dayInTitle}日`;
      } else {
        const n = (sessionDayCounter.get(sessionKey) ?? 0) + 1;
        sessionDayCounter.set(sessionKey, n);
        dayLabel = `${n}日`;
      }

      return {
        label: `${sessionKey}/${dayLabel}`,
        fullName: d.title,
        count: d._count.speeches,
      };
    });
}

export async function getSessionTimeline(municipalityId: string) {
  const sessions = await prisma.session.findMany({
    where: { municipalityId },
    select: {
      id: true,
      fiscalYear: true,
      sessionName: true,
      sessionType: true,
      startOn: true,
      endOn: true,
      _count: { select: { documents: true } },
    },
    orderBy: [{ fiscalYear: "desc" }, { startOn: "desc" }],
  });

  return sessions.map((s) => ({
    id: s.id,
    fiscalYear: s.fiscalYear,
    sessionName: s.sessionName,
    sessionType: s.sessionType,
    startOn: s.startOn?.toISOString().slice(0, 10) ?? null,
    endOn: s.endOn?.toISOString().slice(0, 10) ?? null,
    documentCount: s._count.documents,
  }));
}

/** 会期別の活発度（総文字数・発言件数・ユニーク発言者数） */
export async function getSessionIntensity(municipalityId: string) {
  const rows = await prisma.$queryRaw<{
    session_id: string;
    fiscal_year: number;
    session_name: string;
    speech_count: bigint;
    unique_speakers: bigint;
    total_chars: bigint;
  }[]>`
    SELECT
      ses.id                           AS session_id,
      ses.fiscal_year                  AS fiscal_year,
      ses.session_name                 AS session_name,
      COUNT(s.id)                      AS speech_count,
      COUNT(DISTINCT s.speaker_id)     AS unique_speakers,
      SUM(LENGTH(s.speech_text))       AS total_chars
    FROM speeches s
    JOIN documents d ON s.document_id = d.id
    JOIN sessions ses ON d.session_id = ses.id
    WHERE d.municipality_id = ${municipalityId}::uuid
    GROUP BY ses.id, ses.fiscal_year, ses.session_name, ses.start_on
    ORDER BY ses.fiscal_year ASC, ses.start_on ASC NULLS LAST, MIN(d.published_on) ASC
  `;

  return rows.map((r) => {
    const reiwa = r.fiscal_year - 2018;
    const numMatch = r.session_name.match(/第(\d+)回/);
    const label = numMatch ? `R${reiwa}-${numMatch[1]}回` : `R${reiwa} ${r.session_name}`;
    return {
      period: r.session_id,
      label,
      speechCount: Number(r.speech_count),
      uniqueSpeakers: Number(r.unique_speakers),
      totalChars: Number(r.total_chars),
    };
  });
}

/** 立場別発言比率 */
export async function getRoleDistribution(municipalityId: string) {
  const rows = await prisma.$queryRaw<{ role: string; count: bigint }[]>`
    SELECT sp.role, COUNT(s.id) AS count
    FROM speeches s
    JOIN speakers sp ON s.speaker_id = sp.id
    JOIN documents d  ON s.document_id = d.id
    WHERE d.municipality_id = ${municipalityId}::uuid
      AND s.speaker_id IS NOT NULL
    GROUP BY sp.role
    ORDER BY count DESC
  `;
  return rows.map((r) => ({ role: r.role, count: Number(r.count) }));
}

/** 発言スタイル（発言数 × 平均文字数） — 5件以上の発言者が対象 */
export async function getSpeakerStyles(municipalityId: string) {
  const rows = await prisma.$queryRaw<{
    name_ja: string;
    role: string;
    speech_count: bigint;
    avg_length: number;
    total_length: bigint;
  }[]>`
    SELECT
      sp.name_ja,
      sp.role,
      COUNT(s.id)              AS speech_count,
      AVG(LENGTH(s.speech_text)) AS avg_length,
      SUM(LENGTH(s.speech_text)) AS total_length
    FROM speeches s
    JOIN speakers sp ON s.speaker_id = sp.id
    JOIN documents d  ON s.document_id = d.id
    WHERE d.municipality_id = ${municipalityId}::uuid
      AND s.speaker_id IS NOT NULL
    GROUP BY sp.id, sp.name_ja, sp.role
    HAVING COUNT(s.id) >= 5
    ORDER BY total_length DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    name: r.name_ja,
    role: r.role,
    speechCount: Number(r.speech_count),
    avgLength: Math.round(Number(r.avg_length)),
    totalLength: Number(r.total_length),
  }));
}

export interface GeneralQuestionMatrix {
  questioners: string[];
  topics: string[];
  /** matrix[questionerIdx][topicIdx] = 質問回数 */
  matrix: number[][];
}

export async function getGeneralQuestionMatrix(
  municipalityId: string,
  maxQuestioners = 12,
  maxTopics = 15,
): Promise<GeneralQuestionMatrix> {
  const summaries = await prisma.documentSummary.findMany({
    where: {
      document: { municipalityId, session: { sessionType: "regular" } },
      generalQuestions: { not: Prisma.AnyNull },
    },
    select: { generalQuestions: true },
  });

  // questioner → topic → count
  const qMap = new Map<string, Map<string, number>>();

  for (const s of summaries) {
    const questions = s.generalQuestions as { questioner: string; topic: string }[] | null;
    if (!Array.isArray(questions)) continue;
    for (const q of questions) {
      if (!q.questioner || !q.topic) continue;
      if (!qMap.has(q.questioner)) qMap.set(q.questioner, new Map());
      const tMap = qMap.get(q.questioner)!;
      tMap.set(q.topic, (tMap.get(q.topic) ?? 0) + 1);
    }
  }

  // 質問総数の多い議員を上位 maxQuestioners 件選択
  const questioners = Array.from(qMap.entries())
    .map(([q, tMap]) => ({ q, total: Array.from(tMap.values()).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, maxQuestioners)
    .map(({ q }) => q);

  // トピック選択: ラウンドロビン方式で各議員から順番に選ぶ
  // （全トピックが出現回数1の場合でも各議員が均等に表示されるよう）
  const topicPool: string[] = [];
  const addedTopics = new Set<string>();
  const maxRounds = Math.ceil(maxTopics / Math.max(questioners.length, 1));
  for (let round = 0; round < maxRounds && topicPool.length < maxTopics; round++) {
    for (const q of questioners) {
      if (topicPool.length >= maxTopics) break;
      const qTopics = Array.from(qMap.get(q)!.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t);
      if (round < qTopics.length && !addedTopics.has(qTopics[round])) {
        topicPool.push(qTopics[round]);
        addedTopics.add(qTopics[round]);
      }
    }
  }
  const topics = topicPool;

  const matrix = questioners.map((q) =>
    topics.map((t) => qMap.get(q)?.get(t) ?? 0),
  );

  return { questioners, topics, matrix };
}

export interface GeneralQuestionBlock {
  questioner: string;
  topic: string;
  documentId: string;
  sessionName: string;
  fiscalYear: number;
  speechCount: number;
  totalChars: number;
  mayorResponses: number;
}

/** 姓名のスペースを除去して正規化（マッチング用） */
function normName(name: string): string {
  return name.replace(/[\s\u3000\u00a0]/g, "");
}

/**
 * 一般質問ごとの発言ブロック数を算出する。
 *
 * アルゴリズム:
 * - generalQuestions の順序（定例会での質問順）に従い、
 *   questioner が最初に発言した sequence を「ブロック開始」、
 *   次の questioner が最初に発言した sequence を「ブロック終了」として
 *   その区間に含まれる発言数をカウントする。
 */
export async function getGeneralQuestionBlocks(
  municipalityId: string,
  limit = 30,
): Promise<GeneralQuestionBlock[]> {
  // 1. generalQuestions を持つ定例会ドキュメントを取得
  const docs = await prisma.documentSummary.findMany({
    where: {
      document: { municipalityId, session: { sessionType: "regular" } },
      generalQuestions: { not: Prisma.AnyNull },
    },
    select: {
      documentId: true,
      generalQuestions: true,
      document: {
        select: {
          session: { select: { sessionName: true, fiscalYear: true } },
        },
      },
    },
  });

  if (docs.length === 0) return [];

  // 2. 対象ドキュメントの全発言を一括取得（N+1 回避）
  const docIds = docs.map((d) => d.documentId);
  const allSpeeches = await prisma.speech.findMany({
    where: { documentId: { in: docIds } },
    select: {
      documentId: true,
      sequence: true,
      speechText: true,
      speaker: { select: { nameJa: true, role: true } },
      speakerNameRaw: true,
    },
    orderBy: [{ documentId: "asc" }, { sequence: "asc" }],
  });

  // documentId → speeches[] にグループ化
  const speechesByDoc = new Map<string, typeof allSpeeches>();
  for (const s of allSpeeches) {
    if (!speechesByDoc.has(s.documentId)) speechesByDoc.set(s.documentId, []);
    speechesByDoc.get(s.documentId)!.push(s);
  }

  const results: GeneralQuestionBlock[] = [];

  for (const doc of docs) {
    const questions = doc.generalQuestions as { questioner: string; topic: string }[] | null;
    if (!Array.isArray(questions) || questions.length === 0) continue;

    const speeches = speechesByDoc.get(doc.documentId) ?? [];
    if (speeches.length === 0) continue;

    // 3. 各 questioner の「最初の発言 sequence」を特定
    // 「姓 議員」等の短縮形に対応するため "議員" サフィックスを除去し部分一致で検索
    const firstSeqMap = new Map<string, number>();
    for (const q of questions) {
      const normQ = normName(q.questioner).replace(/議員$/, "");
      if (!normQ) continue;
      for (const s of speeches) {
        const normSpeaker = normName(s.speaker?.nameJa ?? s.speakerNameRaw);
        if (
          !firstSeqMap.has(q.questioner) &&
          (normSpeaker.includes(normQ) || normQ.includes(normSpeaker))
        ) {
          firstSeqMap.set(q.questioner, s.sequence);
          break;
        }
      }
    }

    // 同一 questioner が複数トピックを持つ場合のトピック数（ブロック統計の分母）
    const topicCountByQuestioner = new Map<string, number>();
    for (const q of questions) {
      topicCountByQuestioner.set(q.questioner, (topicCountByQuestioner.get(q.questioner) ?? 0) + 1);
    }

    // 一般質問セクションの終端を推定: いずれかの質問者が最後に発言した sequence の次
    // これにより最後の質問者のブロックが閉会議事等を取り込むのを防ぐ
    const normQuestionerList = Array.from(firstSeqMap.keys())
      .map((q) => normName(q).replace(/議員$/, ""))
      .filter(Boolean);
    let sectionEndSeq = 0;
    for (const s of speeches) {
      const normSp = normName(s.speaker?.nameJa ?? s.speakerNameRaw);
      if (normQuestionerList.some((nq) => normSp.includes(nq) || nq.includes(normSp))) {
        sectionEndSeq = Math.max(sectionEndSeq, s.sequence);
      }
    }
    const sectionEnd = sectionEndSeq > 0 ? sectionEndSeq + 1 : Infinity;

    // 4. ブロックごとの発言数をカウント
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const startSeq = firstSeqMap.get(q.questioner);
      if (startSeq === undefined) continue;

      // 次の questioner の最初の発言（startSeq より後ろ）を探す
      // 見つからない場合は一般質問セクション終端を使う（Infinity は使わない）
      let endSeq = sectionEnd;
      for (let j = i + 1; j < questions.length; j++) {
        const nextSeq = firstSeqMap.get(questions[j].questioner);
        if (nextSeq !== undefined && nextSeq > startSeq) {
          endSeq = nextSeq;
          break;
        }
      }

      const blockSpeeches = speeches.filter(
        (s) => s.sequence >= startSeq && s.sequence < endSeq,
      );

      // 同一 questioner の複数トピックはブロックを共有するため、統計を等分して重複計上を防ぐ
      const n = topicCountByQuestioner.get(q.questioner) ?? 1;
      results.push({
        questioner: q.questioner,
        topic: q.topic,
        documentId: doc.documentId,
        sessionName: doc.document.session?.sessionName ?? "",
        fiscalYear: doc.document.session?.fiscalYear ?? 0,
        speechCount: Math.round(blockSpeeches.length / n),
        totalChars: Math.round(blockSpeeches.reduce((a, s) => a + s.speechText.length, 0) / n),
        mayorResponses: Math.round(blockSpeeches.filter((s) => s.speaker?.role === "mayor").length / n),
      });
    }
  }

  return results
    .filter((r) => r.speechCount > 0)
    .sort((a, b) => b.speechCount - a.speechCount)
    .slice(0, limit);
}

export async function getSpeakerStats(municipalityId: string, limit = 30) {
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
