# LocalScope Agent

地方自治体の公開会議録（PDF）を収集し、将来的にAIが扱える構造化データへ変換するためのプロジェクトです。  
現在は **Phase 1（収集・保存基盤）** を実装中です。

## 現在の実装状況

実装済み:

- Prismaスキーマと初期マイグレーション（PostgreSQL）
- 安芸高田市会議録ページのPDFリンク収集
- PDFのローカル保存（`data/pdfs`）とSHA-256記録
- `documents` / `document_assets` / `ingestion_runs` への保存
- ローカルPDF一括取り込み（`import-local`）

未実装（これから）:

- PDFテキスト抽出
- 発言者分割・`speeches` 登録
- 要約・トピック抽出（Phase 2）
- ダッシュボード可視化（Phase 3）

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Prisma 7 (`@prisma/adapter-pg`)
- PostgreSQL（Supabase想定）
- Cheerio（スクレイピング）

## セットアップ

1. 依存関係をインストール

```bash
npm install
```

1. 環境変数を設定

```bash
cp .env.example .env
```

`.env` の `DATABASE_URL` を必ず設定してください。  
（`NEXT_PUBLIC_SUPABASE_URL` などは現時点では必須ではありません）

1. マイグレーションを適用

```bash
npx prisma migrate deploy
```

1. 開発サーバー起動（UI確認用）

```bash
npm run dev
```

## テスト

ユニットテストは Vitest を使用します。

```bash
npm test
```

```bash
npm run test:watch
```

## データ投入コマンド

### 1) 自治体・ソースの初期データ作成

```bash
npm run seed
```

### 2) 公開ページからPDF収集（年度指定）

```bash
npm run ingest -- --year=R6
```

利用可能な年度キー（現状）:

- `R6`
- `R7`

処理内容:

- 会議録ページをスクレイピングしてPDFリンク抽出
- 未取得PDFを `data/pdfs` に保存
- `documents.status` を `downloaded` へ更新
- 実行ログを `ingestion_runs.log` に記録

### 3) 手元PDFの一括取り込み

```bash
npm run import-local -- --dir=./path/to/pdfs --year=R6
```

処理内容:

- 指定ディレクトリの `.pdf` を列挙
- `data/pdfs` にコピー（必要時上書き）
- ハッシュ/サイズを `document_assets` に保存
- `documents.status` を `downloaded` へ更新

## 主要ディレクトリ

- `docs/`: PRD / ERD / パース戦略 / 開発ワークフロー
- `prisma/`: スキーマとマイグレーション
- `scripts/`: seed / ingest / import-local
- `tests/unit/`: ユニットテスト
- `src/lib/ingestion/`: 収集・ダウンロード・DB更新ロジック
- `src/app/`: Next.js アプリ

## 参照ドキュメント

- `docs/PRD.md`
- `docs/ERD.md`
- `docs/PARSING_STRATEGY.md`
- `docs/WORKFLOW.md`
