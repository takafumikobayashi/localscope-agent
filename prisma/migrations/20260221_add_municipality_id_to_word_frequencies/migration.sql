-- word_frequencies の既存データはグローバル集計（municipality_id なし）なので全削除。
-- compute-word-frequencies スクリプトを再実行することで自治体ごとに再生成される。
TRUNCATE TABLE "word_frequencies";

-- municipality_id カラムを追加
ALTER TABLE "word_frequencies" ADD COLUMN "municipality_id" UUID NOT NULL;

-- 旧ユニーク制約（word のみ）を削除
DROP INDEX IF EXISTS "word_frequencies_word_key";

-- 旧インデックス（count のみ）を削除
DROP INDEX IF EXISTS "word_frequencies_count_idx";

-- 新ユニーク制約（municipality_id + word）
ALTER TABLE "word_frequencies" ADD CONSTRAINT "word_frequencies_municipality_id_word_key" UNIQUE ("municipality_id", "word");

-- 新インデックス（municipality_id + count）
CREATE INDEX "word_frequencies_municipality_id_count_idx" ON "word_frequencies"("municipality_id", "count" DESC);

-- 外部キー制約
ALTER TABLE "word_frequencies" ADD CONSTRAINT "word_frequencies_municipality_id_fkey"
  FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
