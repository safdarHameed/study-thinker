-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "learningId" UUID,
    "kind" VARCHAR(30) NOT NULL,
    "ref" VARCHAR(80),
    "label" VARCHAR(200) NOT NULL,
    "xp" INTEGER NOT NULL,
    "value" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_userId_createdAt_idx" ON "activities"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "activities_learningId_createdAt_idx" ON "activities"("learningId", "createdAt");

-- CreateIndex
CREATE INDEX "activities_userId_kind_ref_idx" ON "activities"("userId", "kind", "ref");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_learningId_fkey" FOREIGN KEY ("learningId") REFERENCES "learnings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
