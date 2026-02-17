-- CreateTable
CREATE TABLE "document_summaries" (
    "document_id" UUID NOT NULL,
    "summary_text" TEXT NOT NULL,
    "topics" JSONB NOT NULL,
    "key_points" JSONB NOT NULL,
    "model_id" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_summaries_pkey" PRIMARY KEY ("document_id")
);

-- AddForeignKey
ALTER TABLE "document_summaries" ADD CONSTRAINT "document_summaries_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
