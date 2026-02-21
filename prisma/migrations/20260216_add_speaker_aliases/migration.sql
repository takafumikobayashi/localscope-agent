-- CreateEnum
CREATE TYPE "AliasType" AS ENUM ('attendee_derived', 'speech_derived', 'manual');

-- DropIndex
DROP INDEX "speakers_municipality_id_name_ja_idx";

-- CreateTable
CREATE TABLE "speaker_aliases" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "speaker_id" UUID NOT NULL,
    "alias_raw" TEXT NOT NULL,
    "alias_norm" TEXT NOT NULL,
    "alias_type" "AliasType" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speaker_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "speaker_aliases_speaker_id_idx" ON "speaker_aliases"("speaker_id");

-- CreateIndex
CREATE UNIQUE INDEX "speaker_aliases_municipality_id_alias_norm_key" ON "speaker_aliases"("municipality_id", "alias_norm");

-- CreateIndex
CREATE UNIQUE INDEX "speakers_municipality_id_name_ja_key" ON "speakers"("municipality_id", "name_ja");

-- AddForeignKey
ALTER TABLE "speaker_aliases" ADD CONSTRAINT "speaker_aliases_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
