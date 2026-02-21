-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('assembly_minutes', 'committee_minutes', 'public_comment', 'other');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('regular', 'extra', 'committee', 'budget_committee', 'other');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('minutes', 'committee_minutes', 'public_comment', 'report', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('discovered', 'downloaded', 'extracted', 'parsed', 'failed');

-- CreateEnum
CREATE TYPE "StorageProvider" AS ENUM ('supabase_storage', 's3', 'local', 'other');

-- CreateEnum
CREATE TYPE "SpeakerRole" AS ENUM ('councilor', 'mayor', 'executive', 'chair', 'staff', 'unknown');

-- CreateEnum
CREATE TYPE "IngestionTrigger" AS ENUM ('manual', 'schedule', 'webhook');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('success', 'partial', 'failed');

-- CreateTable
CREATE TABLE "municipalities" (
    "id" UUID NOT NULL,
    "name_ja" TEXT NOT NULL,
    "name_en" TEXT,
    "prefecture_ja" TEXT NOT NULL,
    "code_jis" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "source_type" "SourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "session_name" TEXT NOT NULL,
    "session_type" "SessionType" NOT NULL,
    "held_on" DATE,
    "start_on" DATE,
    "end_on" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "session_id" UUID,
    "document_type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_on" DATE,
    "document_version" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'discovered',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_assets" (
    "document_id" UUID NOT NULL,
    "storage_provider" "StorageProvider" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "content_sha256" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL,
    "downloaded_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "document_assets_pkey" PRIMARY KEY ("document_id")
);

-- CreateTable
CREATE TABLE "speakers" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "name_ja" TEXT NOT NULL,
    "role" "SpeakerRole" NOT NULL DEFAULT 'unknown',
    "party" TEXT,
    "term_start_on" DATE,
    "term_end_on" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "speakers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "speeches" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "session_id" UUID,
    "speaker_id" UUID,
    "speaker_name_raw" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "speech_text" TEXT NOT NULL,
    "speech_text_clean" TEXT,
    "page_start" INTEGER,
    "page_end" INTEGER,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "speeches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" UUID NOT NULL,
    "municipality_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,
    "trigger" "IngestionTrigger" NOT NULL,
    "status" "IngestionStatus",
    "log" JSONB,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "municipalities_prefecture_ja_name_ja_key" ON "municipalities"("prefecture_ja", "name_ja");

-- CreateIndex
CREATE INDEX "sources_municipality_id_source_type_is_active_idx" ON "sources"("municipality_id", "source_type", "is_active");

-- CreateIndex
CREATE INDEX "sessions_municipality_id_fiscal_year_session_type_idx" ON "sessions"("municipality_id", "fiscal_year", "session_type");

-- CreateIndex
CREATE UNIQUE INDEX "documents_url_key" ON "documents"("url");

-- CreateIndex
CREATE INDEX "document_assets_content_sha256_idx" ON "document_assets"("content_sha256");

-- CreateIndex
CREATE INDEX "speakers_municipality_id_name_ja_idx" ON "speakers"("municipality_id", "name_ja");

-- CreateIndex
CREATE INDEX "speeches_document_id_sequence_idx" ON "speeches"("document_id", "sequence");

-- CreateIndex
CREATE INDEX "ingestion_runs_municipality_id_started_at_idx" ON "ingestion_runs"("municipality_id", "started_at" DESC);

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_assets" ADD CONSTRAINT "document_assets_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speakers" ADD CONSTRAINT "speakers_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "speeches" ADD CONSTRAINT "speeches_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "speakers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
