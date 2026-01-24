-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "firebaseProjectId" TEXT,
    "bigqueryDatasetName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Component" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "fallbackMessage" TEXT DEFAULT 'Feature unavailable.',
    "crashThreshold" INTEGER DEFAULT 5,
    "totalCrashCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentVersionStat" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "crashCount" INTEGER NOT NULL DEFAULT 0,
    "actionCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentVersionStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedCrash" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "componentId" TEXT,
    "firebaseEventId" TEXT,
    "issueId" TEXT,
    "errorMessage" TEXT,
    "stackTrace" TEXT,
    "analysisStatus" TEXT NOT NULL DEFAULT 'pending',
    "geminiAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedCrash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentLock" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL DEFAULT 'system',
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComponentError" (
    "id" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "errorMessage" TEXT NOT NULL,
    "stackTrace" TEXT,
    "errorType" TEXT,
    "metadata" JSONB,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComponentError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationUtil" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentAppVersion" TEXT NOT NULL,
    "minSupportedVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationUtil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_apiKey_key" ON "Project"("apiKey");

-- CreateIndex
CREATE INDEX "Component_projectId_idx" ON "Component"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "Component_projectId_identifier_key" ON "Component"("projectId", "identifier");

-- CreateIndex
CREATE INDEX "ComponentVersionStat_componentId_idx" ON "ComponentVersionStat"("componentId");

-- CreateIndex
CREATE INDEX "ComponentVersionStat_appVersion_idx" ON "ComponentVersionStat"("appVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ComponentVersionStat_componentId_appVersion_key" ON "ComponentVersionStat"("componentId", "appVersion");

-- CreateIndex
CREATE INDEX "ComponentError_componentId_idx" ON "ComponentError"("componentId");

-- CreateIndex
CREATE INDEX "ComponentError_projectId_idx" ON "ComponentError"("projectId");

-- CreateIndex
CREATE INDEX "ComponentError_appVersion_idx" ON "ComponentError"("appVersion");

-- CreateIndex
CREATE INDEX "ComponentError_actionId_idx" ON "ComponentError"("actionId");

-- CreateIndex
CREATE INDEX "ComponentError_createdAt_idx" ON "ComponentError"("createdAt");

-- CreateIndex
CREATE INDEX "ComponentError_isArchived_idx" ON "ComponentError"("isArchived");

-- CreateIndex
CREATE INDEX "ApplicationUtil_projectId_idx" ON "ApplicationUtil"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationUtil_projectId_key" ON "ApplicationUtil"("projectId");

-- AddForeignKey
ALTER TABLE "Component" ADD CONSTRAINT "Component_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentVersionStat" ADD CONSTRAINT "ComponentVersionStat_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedCrash" ADD CONSTRAINT "ProcessedCrash_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedCrash" ADD CONSTRAINT "ProcessedCrash_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentLock" ADD CONSTRAINT "ComponentLock_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComponentError" ADD CONSTRAINT "ComponentError_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "Component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
