CREATE TABLE "sources" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "edition" TEXT,
    "sourceType" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "fileReference" TEXT,
    "levelLabel" TEXT,
    "levelAuthority" TEXT,
    "notes" TEXT,
    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "fileHash" TEXT NOT NULL,
    "pageRangeJson" JSONB NOT NULL,
    "extractorVersion" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "stagedJson" JSONB NOT NULL,
    "validationErrorsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "committedAt" TIMESTAMPTZ(6),
    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "import_batches_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "import_batches_sourceId_fileHash_key" ON "import_batches"("sourceId", "fileHash");
CREATE INDEX "import_batches_createdAt_idx" ON "import_batches"("createdAt");
