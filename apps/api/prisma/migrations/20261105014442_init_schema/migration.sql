-- CreateEnum
CREATE TYPE "LessonStyle" AS ENUM ('HANDOUT', 'BOARD_NOTE');

-- CreateEnum
CREATE TYPE "PaperSize" AS ENUM ('A4', 'B4', 'A3');

-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('LANDSCAPE', 'PORTRAIT');

-- CreateEnum
CREATE TYPE "SchoolLevel" AS ENUM ('TOP', 'MID', 'FOUNDATION');

-- CreateEnum
CREATE TYPE "LessonStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "Method" AS ENUM ('NERIAGE', 'PAIR', 'GROUP', 'INDIVIDUAL_LECTURE');

-- CreateEnum
CREATE TYPE "AnswerSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'NONE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('REQUIRED', 'SKIPPABLE', 'EXTENSION');

-- CreateEnum
CREATE TYPE "Perspective" AS ENUM ('SUBJECTIVE', 'DIALOGIC', 'DEEP');

-- CreateEnum
CREATE TYPE "IssueKind" AS ENUM ('SOURCE_ERROR_SUSPECTED', 'UNREADABLE', 'CHECK_MISMATCH', 'RULE_VIOLATION');

-- CreateEnum
CREATE TYPE "CheckResult" AS ENUM ('MATCH', 'MISMATCH', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassroomProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonStyle" "LessonStyle" NOT NULL DEFAULT 'HANDOUT',
    "paperSize" "PaperSize" NOT NULL DEFAULT 'A4',
    "orientation" "Orientation" NOT NULL DEFAULT 'LANDSCAPE',
    "nameField" BOOLEAN NOT NULL DEFAULT true,
    "answerHeightSmall" INTEGER NOT NULL DEFAULT 25,
    "answerHeightMedium" INTEGER NOT NULL DEFAULT 45,
    "answerHeightLarge" INTEGER NOT NULL DEFAULT 80,

    CONSTRAINT "ClassroomProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "unitName" TEXT,
    "inferredUnit" TEXT,
    "inferredAim" TEXT,
    "schoolLevel" "SchoolLevel" NOT NULL,
    "adjustSubjective" INTEGER NOT NULL DEFAULT 0,
    "adjustDialogic" INTEGER NOT NULL DEFAULT 0,
    "adjustDeep" INTEGER NOT NULL DEFAULT 0,
    "focusPerspectives" "Perspective"[],
    "durationMin" INTEGER NOT NULL DEFAULT 50,
    "practiceSettings" JSONB NOT NULL DEFAULT '{}',
    "status" "LessonStatus" NOT NULL DEFAULT 'DRAFT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "plannedMin" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '{}',
    "method" "Method",
    "ruleId" TEXT,
    "reason" TEXT,
    "answerSize" "AnswerSize" NOT NULL DEFAULT 'NONE',
    "priority" "Priority" NOT NULL DEFAULT 'REQUIRED',
    "hasPresentation" BOOLEAN NOT NULL DEFAULT false,
    "editedByTeacher" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "activityId" TEXT,
    "kind" "IssueKind" NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "perspective" "Perspective" NOT NULL,
    "place" TEXT NOT NULL,
    "change" TEXT NOT NULL,
    "why" TEXT NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Check" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "exprA" TEXT NOT NULL,
    "exprB" TEXT NOT NULL,
    "result" "CheckResult" NOT NULL,
    "reason" TEXT,

    CONSTRAINT "Check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClassroomProfile_userId_key" ON "ClassroomProfile"("userId");

-- CreateIndex
CREATE INDEX "Lesson_userId_idx" ON "Lesson"("userId");

-- CreateIndex
CREATE INDEX "Lesson_expiresAt_idx" ON "Lesson"("expiresAt");

-- CreateIndex
CREATE INDEX "Activity_lessonId_idx" ON "Activity"("lessonId");

-- CreateIndex
CREATE INDEX "Issue_lessonId_idx" ON "Issue"("lessonId");

-- CreateIndex
CREATE INDEX "Issue_activityId_idx" ON "Issue"("activityId");

-- CreateIndex
CREATE INDEX "Suggestion_lessonId_idx" ON "Suggestion"("lessonId");

-- CreateIndex
CREATE INDEX "Check_activityId_idx" ON "Check"("activityId");

-- CreateIndex
CREATE INDEX "Snapshot_lessonId_idx" ON "Snapshot"("lessonId");

-- CreateIndex
CREATE INDEX "UsageLog_userId_idx" ON "UsageLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UsageLog_userId_date_key" ON "UsageLog"("userId", "date");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassroomProfile" ADD CONSTRAINT "ClassroomProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Check" ADD CONSTRAINT "Check_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageLog" ADD CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
