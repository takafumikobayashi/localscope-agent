-- document_summaries に general_questions / agenda_items カラムを追加
ALTER TABLE "document_summaries" ADD COLUMN "general_questions" JSONB;
ALTER TABLE "document_summaries" ADD COLUMN "agenda_items" JSONB;
