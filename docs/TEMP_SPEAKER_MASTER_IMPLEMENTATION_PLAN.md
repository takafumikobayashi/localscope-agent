# Speaker Master / 揺らぎ対応 実装方針（テンポラリ）

## 目的

`speakers` 登録時の表記揺れ（例: 姓のみ、括弧付き、役職付き連結）で `speaker_id` の解決精度が落ちる問題を解消する。  
方針は「出席者ベースでマスタを作る + 揺らぎ変換テーブルで解決」を採用する。

## 現状の課題（実装差分）

- 出席者抽出はあるが、セッション単位で永続化されていない。
- 揺らぎ辞書（alias）テーブルがない。
- 解決ロジックがコード内ヒューリスティクス依存で、運用で補正できない。
- `speakers` に `municipalityId + nameJa` のユニーク制約がなく重複混入余地がある。
- `scripts/reparse.ts` で孤立 `speakers` を削除しており、マスタ蓄積方針と衝突する。

## スコープ

含む:

- Prisma スキーマ拡張（speaker alias / session attendees）
- speaker 解決ロジックの段階的マッチング実装
- extract/reparse パイプライン更新
- 既存データ移行（重複整理 + backfill）
- ユニットテスト追加

含まない:

- LLMベースの同定
- UI作成

## データモデル変更案

### 1. `speakers` の制約強化

- 追加: `@@unique([municipalityId, nameJa])`

目的:

- 同一自治体内での canonical name 重複防止

### 2. `speaker_aliases`（新規）

用途:

- 揺らぎ文字列を canonical speaker に紐づける辞書

主なカラム案:

- `id` (uuid, pk)
- `municipality_id` (fk)
- `speaker_id` (fk, nullable: 未解決aliasを一時保持する場合のみ nullable)
- `alias_raw` (text)
- `alias_norm` (text) 例: 空白除去・全半角正規化・役職除去後
- `alias_type` (enum: `attendee_derived` / `speech_derived` / `manual`)
- `source_document_id` (fk, nullable)
- `confidence` (numeric, nullable)
- `is_active` (bool, default true)
- `created_at`, `updated_at`

制約/Index案:

- `@@unique([municipalityId, aliasNorm, isActive])`（一意解決前提なら）
- `@@index([municipalityId, aliasRaw])`
- `@@index([speakerId])`

### 3. `session_attendees`（新規）

用途:

- 会期ごとの出席者集合を固定し、同姓衝突を局所化して解決する

主なカラム案:

- `id` (uuid, pk)
- `session_id` (fk)
- `speaker_id` (fk)
- `role_raw` (text)
- `seat_number` (int, nullable)
- `source_document_id` (fk, nullable)
- `created_at`

制約/Index案:

- `@@unique([sessionId, speakerId])`
- `@@index([sessionId])`

## 解決アルゴリズム（推奨順）

入力:

- `speech.speaker_name_raw`
- `session_attendees`
- `speaker_aliases`

手順:

1. `fullName` 完全一致（出席者由来）
2. セッション内 `familyName` 一意一致
3. `alias_raw` 完全一致
4. `alias_norm` 一致
5. 括弧ヒント一致（例: 山本(数)）
6. 前方一致（制限付き）
7. 未解決（`speaker_id = NULL`, confidence 低）

ルール:

- 解決根拠をログ/メタとして保存（`match_strategy`）
- 低信頼マッチは alias 自動昇格しない（手動承認フロー）

## 実装タスク（ファイル単位）

### A. Prisma / Migration

- `prisma/schema.prisma`
  - `Speaker` に unique 追加
  - `SpeakerAlias` モデル追加
  - `SessionAttendee` モデル追加
- `prisma/migrations/*`
  - 新規 migration 作成
  - 既存 `speakers` 重複がある場合の解消SQL同梱

### B. DB アクセス層

- `src/lib/ingestion/db.ts`
  - `upsertSpeakerAlias(...)`
  - `getSpeakerResolverContext(sessionId | documentId)`
  - `upsertSessionAttendees(...)`
  - `resolveSpeakerId(...)`（DB/メモリ辞書併用）

### C. パース/抽出パイプライン

- `src/lib/ingestion/attendee-parser.ts`
  - 出席者抽出結果に `source` 情報を付与
- `src/lib/ingestion/parser.ts`
  - in-memory ヒューリスティクスを resolver 呼び出しへ分離
- `scripts/extract.ts`
  - 出席者 -> `speakers` upsert
  - 出席者 -> `session_attendees` upsert
  - 揺らぎ（出席者由来） -> `speaker_aliases` upsert
  - 発言ごとに resolver 実行
- `scripts/reparse.ts`
  - 孤立 `speakers` 削除処理を削除
  - 再パース時に alias を使って再解決

### D. テスト

- `tests/unit/lib/ingestion/parser.test.ts`
  - 揺らぎケース拡充（括弧、姓のみ、役職連結）
- `tests/unit/lib/ingestion/db.test.ts`
  - alias upsert / session attendee upsert / resolve順序の検証
- （必要なら）`tests/unit/lib/ingestion/resolver.test.ts` 新規

## 移行手順（推奨）

1. DBバックアップ
2. migration適用
3. 既存 `speakers` 重複の統合
4. `downloaded/parsed` 対象に reparse 実行
5. unresolved 件数を集計し、手動 alias 追加
6. 再実行して unresolved 減少を確認

## 受け入れ条件（Acceptance Criteria）

- `speaker_aliases` と `session_attendees` が schema/migration に反映済み
- `scripts/extract.ts` で session attendees 永続化が行われる
- 発言者解決が alias テーブルを参照する
- `speaker_id=NULL` 比率が現行より改善（比較メトリクス提示）
- `npm test` / `npm run lint` が通る
- `scripts/reparse.ts` に master破壊（孤立speaker削除）が残っていない

## 実装時の注意点

- 既存API互換を壊さない（`speeches` 保存フォーマットは維持）
- alias 自動登録は高信頼のみ
- 低信頼推定を恒久データ化しない
- セッション未特定ドキュメントでは municipality スコープ fallback を使う

## 実行コマンド例

```bash
npx prisma migrate dev --name speaker_alias_and_session_attendees
npm run lint
npm test
npm run extract
npm run reparse
```
