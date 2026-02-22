# CLAUDE.md — AI Assistant Guide for LocalScope Agent

## Project Overview

地方議会（安芸高田市）の議事録PDFを収集・構造化し、AI要約・分析するシビックインテリジェンス基盤。
Next.js 16 (App Router) + Prisma + PostgreSQL + GPT-4o で構成。

## Essential Commands

```bash
# 型チェック（CI相当 — コード変更後は必ず実行）
npx tsc --noEmit

# Lint（JS + Markdown）
npm run lint

# テスト
npm test

# Prisma クライアント再生成（schema.prisma 変更後）
npx prisma generate

# スキーマを DB に即時反映（migration 履歴に問題がある場合）
npx prisma db push
```

## Architecture

### Key File Paths

| 役割 | パス |
|------|------|
| DB スキーマ | `prisma/schema.prisma` |
| Prisma 生成先 | `src/generated/prisma/` |
| 収集パイプライン | `src/lib/ingestion/` |
| AI 要約・抽出 | `src/lib/summarization/summarizer.ts` |
| DB クエリ層 | `src/lib/db/` |
| Next.js ページ | `src/app/[municipalityId]/` |
| スクリプト群 | `scripts/` |

### Data Flow

```bash
安芸高田市サイト
  → scripts/ingest.ts（PDF URL 収集）
  → scripts/extract.ts（テキスト抽出・発言分割・speakers upsert）
  → scripts/summarize.ts（GPT-4o 要約 → document_summaries）
  → scripts/extract-agenda-items.ts（GPT-4o 議題抽出 → agendaItems）
  → scripts/extract-general-questions.ts（GPT-4o 一般質問抽出 → generalQuestions）
```

### DB Schema (Main Tables)

- `documents` — 文書（PDF単位）、status: discovered → downloaded → parsed
- `speeches` — 発言データ（speaker_name_raw + speakerId）
- `speakers` + `speaker_aliases` — 発言者マスタ・エイリアス辞書
- `document_summaries` — AI要約（summaryText, topics, keyPoints, generalQuestions, agendaItems）
- `sessions` — 会期（sessionType: regular / extra / committee / budget_committee / other）

### Prisma Notes

- Client は `src/generated/prisma/` に生成（`@/generated/prisma`）
- JSON nullable フィールドのフィルターは `Prisma.DbNull` を使う（`null` リテラル不可）
- 関連モデルの複数フィールドを同時にフィルターする場合はスプレッドでマージする:

  ```typescript
  where.summary = {
    ...((where.summary as Record<string, unknown>) ?? {}),
    agendaItems: { equals: Prisma.DbNull },
  };
  ```

## Coding Conventions

### TypeScript

- `strict: true` 相当（`npx tsc --noEmit` がパスすること）
- Recharts の `formatter` / `labelFormatter` コールバックは引数を広い型で受け取る:

  ```typescript
  formatter={(value: number | undefined, name: string | undefined) => [...]}
  labelFormatter={(label: ReactNode) => {...}}
  ```

### Summarizer Pattern (scripts/)

- GPT-4o 呼び出しは `generateText` + `response_format: { type: "json_object" }` を使う
- レート制限リトライ: `isRateLimit && attempt < MAX_RETRIES - 1` → 指数バックオフ（30s × 2^n）
- ドキュメント間ウェイト: `WAIT_MS = 10_000`
- JSON フェンス除去: `jsonText.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/)` で前処理

### Styling

- Tailwind CSS v4 を使用
- カラーは CSS 変数（`text-foreground`, `text-muted`, `text-accent` など）
- フォントは `font-mono`（データ表示）/ `font-sans`（説明文）

## Development Rules (docs/WORKFLOW.md)

- 全作業は Issue 管理必須
- 各 Issue に受け入れ条件定義
- Issue なしの直コミット禁止
- Phase ラベル必須

## Important Constraints

- `prisma/schema.prisma` を変更したら必ず `npx prisma generate` を実行する
- スキーマ変更後のコードは生成されたクライアントが更新されるまで型エラーが出ることがある
- `.next/` キャッシュが古い場合、削除済みルートへの型参照エラーが出ることがある（`rm -rf .next` で解消）
- DB push で `--accept-data-loss` が必要な変更（テーブル削除等）は必ずユーザーに確認する
