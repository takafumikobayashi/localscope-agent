-- CreateTable
CREATE TABLE "word_frequencies" (
    "id" UUID NOT NULL,
    "word" TEXT NOT NULL,
    "reading" TEXT,
    "part_of_speech" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "word_frequencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "word_frequencies_count_idx" ON "word_frequencies"("count" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "word_frequencies_word_key" ON "word_frequencies"("word");
