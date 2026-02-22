# LocalScope Agent

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)

地方自治体の公開会議録（PDF）を収集し、テキスト抽出・発言分割・発言者紐付けを行って、機械可読なデータへ変換するプロジェクトです。AI要約・議題抽出・Web UIによる可視化まで一貫して提供します。

## 現在の実装範囲

実装済み:

- PDFリンクのスクレイピング（安芸高田市）
- PDFダウンロードとハッシュ管理（`data/pdfs`）
- PDFテキスト抽出（`pdfjs-dist`）
- 出席者抽出（前文の出席者欄）
- 発言分割（`○` 行起点の純粋テキストパーサー）
- 発言者解決（`SpeakerResolver` による6段階マッチング）
- `speakers` への upsert（`(municipality_id, name_ja)` UNIQUE制約）
- `speaker_aliases` への alias 自動登録（出席者由来）
- `speeches` への保存（解決済み `speaker_id` 紐付け）
- AI要約バッチ生成（GPT-4o、チャンク分割＋統合対応）
- 議題・審議結果抽出（GPT-4o、会議種別ごとのプロンプト対応）
- Web UI（ダッシュボード・議事録一覧・詳細・Analytics）

## アーキテクチャ

### 発言者解決フロー

`SpeakerResolver` が以下の優先順位で発言者名を canonical speaker に解決する:

1. `attendeeMap.byFullName` 完全一致
2. `attendeeMap.byFamilyName` 完全一致（同姓1名の場合のみ）
3. `aliasMap` の aliasNorm 完全一致
4. 括弧ヒント（例: `山本(数)` → fullName に "数" を含む speaker）
5. familyName 前方一致（1名のみヒット時）
6. 未解決 → `speaker_id = NULL`

### 処理パイプライン（`extract.ts`）

1. PDFテキスト抽出
2. 前文から出席者リスト抽出（`parseAttendees`）
3. 出席者を `speakers` に upsert + alias 自動登録
4. `speaker_aliases` から alias マップを読み込み
5. `SpeakerResolver` を構築
6. 発言分割（`parseSpeeches` — 純粋テキストパーサー、発言者解決は行わない）
7. 各発言に対し `resolver.resolve()` で `speaker_id` を取得
8. `speeches` に保存

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Prisma 7 (`@prisma/adapter-pg`)
- PostgreSQL（Supabase想定）
- Cheerio（スクレイピング）
- pdfjs-dist（PDFテキスト抽出）
- AI SDK (`ai`, `@ai-sdk/openai`) + GPT-4o（AI要約・議題抽出）
- recharts（グラフ描画）
- Vitest（ユニットテスト）

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

1. 環境変数を設定

```bash
cp .env.example .env
```

`.env` の `DATABASE_URL` は必須です。

1. PrismaスキーマをDBへ反映

```bash
npx prisma migrate deploy
```

コミット済み migration が schema.prisma に追随していない場合は:

```bash
npx prisma migrate dev --name add_speaker_aliases
```

1. Prisma Client 生成

```bash
npx prisma generate
```

1. 開発サーバー起動（UI確認用）

```bash
npm run dev
```

## データ処理フロー（推奨順）

1. 初期データ投入（自治体・ソース）

```bash
npm run seed
```

1. PDF取り込み（どちらか）

公開サイトをスクレイピング:

```bash
npm run ingest -- --year=R6
```

ローカルPDFディレクトリから取り込み:

```bash
npm run import-local -- --dir=./path/to/pdfs --year=R6
```

1. 抽出・パース・保存

```bash
npm run extract
```

1. AI要約生成

```bash
npm run summarize
```

1. 議題・審議結果抽出

```bash
npm run extract-agenda
```

## npm scripts 一覧

- `npm run dev`:
  Next.js 開発サーバー起動
- `npm run build`:
  本番ビルド
- `npm run start`:
  本番サーバー起動
- `npm run seed`:
  `municipalities` / `sources` の初期データ upsert
- `npm run ingest -- --year=R6`:
  公開ページから PDF URL を抽出し、未取得PDFを保存
- `npm run import-local -- --dir=... --year=R6`:
  手元PDFを `data/pdfs` へ取り込み
- `npm run extract`:
  `status=downloaded` の文書を対象に抽出・パース・DB保存
- `npm run summarize`:
  `status=parsed` かつ未要約の文書を対象に GPT-4o で要約生成
- `npm run extract-agenda`:
  `document_summaries` が存在する文書を対象に GPT-4o で議題・審議結果を抽出し `agendaItems` に保存
- `npm run extract-questions`:
  一般質問データを抽出
- `npm run retry-questions`:
  失敗した一般質問抽出をリトライ
- `npm run reextract-questions`:
  一般質問を再抽出
- `npm run normalize-questioner-names`:
  質問者名の名寄せ
- `npm run backfill-published-on`:
  `publishedOn` の遡及補完
- `npm run backfill-titles`:
  タイトルの遡及補完
- `npm run backfill-sessions`:
  セッション情報の遡及補完
- `npm run lint`:
  ESLint + Markdown lint
- `npm run lint:fix`:
  ESLint + Markdown lint の自動修正
- `npm test`:
  Vitest 実行
- `npm run test:watch`:
  Vitest watch 実行

## 主要コマンド詳細

### `npm run ingest -- --year=<R6|R7>`

処理:

- 会議録ページからPDFリンク抽出（`src/lib/ingestion/scraper.ts`）
- `documents` をURL基準でupsert
- PDFを `data/pdfs` に保存、SHA-256とサイズを `document_assets` に保存
- `documents.status` を `downloaded` に更新
- 実行ログを `ingestion_runs.log` に保存

備考:

- `--year` 省略時は `R6`
- 現在の対応キーは `R6`, `R7`

### `npm run import-local -- --dir=<path> --year=<R6|R7>`

処理:

- 指定ディレクトリ内の `.pdf` を列挙
- `local://<filename>` 形式のURLで `documents` をupsert
- `data/pdfs` へコピー（必要時はSHA比較後に更新）
- `document_assets` 保存 + `documents.status=downloaded`
- 実行ログを `ingestion_runs.log` に保存

備考:

- `--dir` は必須
- `--year` はログ用途で、未指定時 `R6`

### `npm run extract`

対象:

- `documents.status = downloaded` かつ asset あり

処理:

- PDFテキスト抽出（ページ単位）
- 前文から出席者抽出（`parseAttendees`）
- 出席者を `speakers` に upsert
- 出席者由来 alias（fullName, familyName）を `speaker_aliases` に upsert
- `speaker_aliases` から alias マップ読み込み
- `SpeakerResolver` 構築（attendeeMap + aliasMap）
- 発言分割（`parseSpeeches`）
- 各発言に対し `resolver.resolve()` で6段階マッチング
- 既存 `speeches` を文書単位で削除して再投入（べき等性）
- `documents.status = parsed` に更新

備考:

- 発言が0件の場合は登録スキップ
- confidence は `high=1.0`, `medium=0.7`, `low=0.3`

### `npm run summarize`

対象:

- `status=parsed` かつ `document_summaries` が未作成の文書

処理:

- 発言テキストを結合し、トークン数を概算（文字数 × 0.5）
- 12,000トークン以下: 1回のAPI呼び出しで要約
- 超過時: チャンク分割 → 各チャンク要約 → 統合要約
- レート制限時は指数バックオフ（30s × 2^n）でリトライ（最大5回）
- 結果を `document_summaries`（summaryText, topics, keyPoints, modelId, tokenCount）に保存

### `npm run extract-agenda`

対象:

- `document_summaries` が存在し、`agendaItems` が未設定の文書

処理:

- 会議種別（`committee` / `budget_committee` / `extra` / `regular`）に応じたプロンプトを選択
- GPT-4o で発言テキストから議題・審議結果を抽出
- 可決・否決・継続審査などの審議結果を構造化して `agendaItems` に保存

### 補助スクリプト（`package.json` 未登録）

以下は `npx tsx scripts/<name>.ts` で直接実行:

#### `scripts/reparse.ts`

全ドキュメントの再パース。

処理:

1. `parsed` → `downloaded` へ一括巻き戻し
2. 全 `downloaded` ドキュメントを `SpeakerResolver` で再パース
3. マッチ率を表示

備考:

- 孤立 speaker の削除は行わない（マスタ蓄積方針）

#### `scripts/migrate-speakers.ts`

重複 speaker の統合マイグレーション。UNIQUE制約適用前に実行する。

処理:

1. 同一 `municipalityId` 内で `nameJa` の前方一致でグルーピング（短い方が canonical、最低3文字）
2. duplicate の `speeches.speaker_id` を canonical に付け替え
3. duplicate の `speakers` レコードを削除

実行順:

```bash
npx tsx scripts/migrate-speakers.ts   # 重複統合
npx prisma migrate dev --name add_speaker_aliases  # スキーマ適用
npx tsx scripts/reparse.ts            # 再パース
```

## DBスキーマ概要

主要テーブル:

- `municipalities` — 自治体マスタ
- `sources` — 会議録ソース（URL）
- `sessions` — 会期
- `documents` — 文書（PDF単位）
- `document_assets` — ファイルメタ（ストレージパス, SHA-256, サイズ）
- `speakers` — 発言者マスタ（`UNIQUE(municipality_id, name_ja)`）
- `speaker_aliases` — 発言者エイリアス辞書（`UNIQUE(municipality_id, alias_norm)`）
- `speeches` — 発言データ
- `document_summaries` — AI要約（summaryText, topics, keyPoints, generalQuestions, agendaItems, modelId, tokenCount）
- `ingestion_runs` — 取り込み実行ログ

`document_summaries.agendaItems`:

- 会議種別ごとのプロンプトで GPT-4o が抽出した議題・審議結果を格納する JSON フィールド
- 可決・否決・継続審査などの審議結果を含む
- `committee` / `budget_committee` / `extra` / `regular` の4種別に対応

`speaker_aliases.alias_type`:

- `attendee_derived` — 出席者リストから自動生成
- `speech_derived` — 発言者名から自動生成
- `manual` — 手動登録

## ステータス遷移

- `discovered`: 文書URLを検出済み
- `downloaded`: PDF取得・asset保存済み
- `parsed`: 抽出・発言保存まで完了
- `failed`: 失敗

## テスト

```bash
npm test
```

ユニットテスト対象:

- `scraper` — PDFリンク抽出
- `downloader` — PDFダウンロード
- `attendee-parser` — 出席者リスト抽出
- `parser` — 発言分割（純粋テキストパーサー）
- `speaker-resolver` — 6段階発言者解決
- `db` — DB操作ヘルパー（alias upsert/load 含む）
- `migrate-speakers` — 重複統合ロジック

## Web UI

`npm run dev` で起動後、以下のページが利用可能:

| パス | 概要 |
|---|---|
| `/` | ダッシュボード — 総件数統計・直近議事録・頻出トピックチャート・発言者ランキング |
| `/documents` | 議事録一覧 — 年度・会議種別フィルタ付き |
| `/documents/[id]` | 議事録詳細 — AI要約・Key Points・審議事項（可決/否決）・発言タイムライン・発言者内訳 |
| `/analytics` | Analytics — トピック推移（年度別）・発言者統計 |

## 主要ディレクトリ

- `docs/`: PRD / ERD / パース戦略 / ワークフロー
- `prisma/`: スキーマとマイグレーション
- `scripts/`: seed / ingest / import-local / extract / summarize / extract-agenda / extract-questions / reparse / migrate-speakers など
- `src/lib/ingestion/`: 収集・抽出・パース・発言者解決・DB処理
- `src/lib/summarization/`: AI要約ロジック
- `src/lib/db/`: ダッシュボード・文書・Analytics クエリ層
- `src/components/`: UI コンポーネント（charts / documents / dashboard / layout / ui）
- `tests/unit/`: ユニットテスト
- `src/app/`: Next.js アプリ（App Router）

## 参照ドキュメント

- `docs/PRD.md`
- `docs/ERD.md`
- `docs/PARSING_STRATEGY.md`
- `docs/WORKFLOW.md`
