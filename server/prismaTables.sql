-- Idempotent, create-only bootstrap for the Prisma-managed tables.
-- Equivalent of `prisma db push` but WITHOUT the destructive part: it never
-- drops tables that aren't in the Prisma schema (AuthUsers, TelegramUsers,
-- PasswordVault, ... are managed by raw-SQL modules and must survive).
-- Run via db.mjs initializeDatabase() so it is re-applied at every boot.

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "awid" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'student',
    "department" TEXT NOT NULL DEFAULT '',
    "batch" TEXT NOT NULL DEFAULT '',
    "batchNo" TEXT NOT NULL DEFAULT '',
    "batchName" TEXT NOT NULL DEFAULT '',
    "designation" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "graduationYear" TEXT NOT NULL DEFAULT '',
    "yearSemester" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "labSection" TEXT NOT NULL DEFAULT '',
    "semester" INTEGER NOT NULL DEFAULT 1,
    "avatar" TEXT,
    "openForTalk" BOOLEAN NOT NULL DEFAULT false,
    "bloodGroup" TEXT NOT NULL DEFAULT '',
    "facebook" TEXT NOT NULL DEFAULT '',
    "whatsapp" TEXT NOT NULL DEFAULT '',
    "linkedin" TEXT NOT NULL DEFAULT '',
    "discord" TEXT NOT NULL DEFAULT '',
    "linkedSocial" TEXT NOT NULL DEFAULT '{}',
    "linkedAccounts" TEXT NOT NULL DEFAULT '[]',
    "cgpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "creditsCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalCredits" INTEGER NOT NULL DEFAULT 160,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekDay" INTEGER NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "room" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SemesterResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "courses" TEXT NOT NULL DEFAULT '[]',
    "cgpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SemesterResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuestionPaper" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "contributorName" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "yearSem" TEXT NOT NULL DEFAULT '',
    "course" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "year" TEXT NOT NULL DEFAULT '',
    "semester" TEXT NOT NULL DEFAULT '',
    "paperNo" INTEGER NOT NULL DEFAULT 1,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'pdf',
    "fileData" BYTEA,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "listType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "condition" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "seller" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "rent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT '',
    "amenities" TEXT NOT NULL DEFAULT '[]',
    "available" BOOLEAN NOT NULL DEFAULT true,
    "owner" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "environment" TEXT NOT NULL DEFAULT '',
    "utilities" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "reporter" TEXT NOT NULL DEFAULT '',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MentorRequest" (
    "id" TEXT NOT NULL,
    "contributorId" TEXT NOT NULL,
    "requesterName" TEXT NOT NULL DEFAULT '',
    "batch" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "responses" TEXT NOT NULL DEFAULT '[]',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "edited" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "replyTo" TEXT,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "postedBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CanteenMenuItem" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CanteenMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CanteenFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 3,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CanteenFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LibraryCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LibraryCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ClubMembership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoleApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appliedRole" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "semester" TEXT NOT NULL,
    "targetSection" TEXT,
    "targetLabSection" TEXT,
    "statement" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    CONSTRAINT "RoleApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TranscriptTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoutineTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoutineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedRoutine" (
    "id" TEXT NOT NULL,
    "crId" TEXT NOT NULL DEFAULT '',
    "crName" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL,
    "yearSemester" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "labSection" TEXT NOT NULL DEFAULT '',
    "routine" TEXT NOT NULL DEFAULT '{}',
    "weekDays" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SharedRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TelegramUser" (
    "chatId" TEXT NOT NULL,
    "routine" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TelegramAttendance" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "recordDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TelegramAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Cheatsheet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "course" TEXT NOT NULL DEFAULT '',
    "formulas" TEXT NOT NULL DEFAULT '[]',
    "contributorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Cheatsheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CampusLocation" (
    "id" SERIAL NOT NULL,
    "floor" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hotspotData" TEXT NOT NULL DEFAULT '{}',
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "mapImage" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "CampusLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Course" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "department" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Course_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserStore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SharedStore" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL DEFAULT '{}',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_awid_key" ON "User"("awid");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Routine_userId_weekDay_idx" ON "Routine"("userId", "weekDay");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SemesterResult_userId_semester_key" ON "SemesterResult"("userId", "semester");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestionPaper_course_type_idx" ON "QuestionPaper"("course", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuestionPaper_contributorId_idx" ON "QuestionPaper"("contributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketplaceListing_listType_idx" ON "MarketplaceListing"("listType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MarketplaceListing_contributorId_idx" ON "MarketplaceListing"("contributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MentorRequest_contributorId_idx" ON "MentorRequest"("contributorId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_conversationId_timestamp_idx" ON "Message"("conversationId", "timestamp");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_fromId_idx" ON "Message"("fromId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_toId_idx" ON "Message"("toId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CanteenMenuItem_day_mealType_idx" ON "CanteenMenuItem"("day", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CanteenFeedback_userId_menuItemId_key" ON "CanteenFeedback"("userId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "LibraryCheckin_userId_key" ON "LibraryCheckin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Club_name_key" ON "Club"("name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SharedRoutine_department_yearSemester_section_labSection_key" ON "SharedRoutine"("department", "yearSemester", "section", "labSection");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TelegramAttendance_chatId_idx" ON "TelegramAttendance"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TelegramAttendance_chatId_courseCode_recordDate_key" ON "TelegramAttendance"("chatId", "courseCode", "recordDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cheatsheet_category_idx" ON "Cheatsheet"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cheatsheet_course_idx" ON "Cheatsheet"("course");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampusLocation_floor_idx" ON "CampusLocation"("floor");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CampusLocation_roomId_idx" ON "CampusLocation"("roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Course_department_idx" ON "Course"("department");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserStore_userId_idx" ON "UserStore"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserStore_userId_key_key" ON "UserStore"("userId", "key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SharedStore_key_key" ON "SharedStore"("key");

-- AddForeignKey (guarded: only when the referenced table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "SemesterResult" ADD CONSTRAINT "SemesterResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
    ALTER TABLE "Message" ADD CONSTRAINT "Message_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Message') THEN
    ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "Notice" ADD CONSTRAINT "Notice_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "CanteenFeedback" ADD CONSTRAINT "CanteenFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'CanteenMenuItem') THEN
    ALTER TABLE "CanteenFeedback" ADD CONSTRAINT "CanteenFeedback_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CanteenMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "LibraryCheckin" ADD CONSTRAINT "LibraryCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Club') THEN
    ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "RoleApplication" ADD CONSTRAINT "RoleApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "TranscriptTemplate" ADD CONSTRAINT "TranscriptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    ALTER TABLE "RoutineTemplate" ADD CONSTRAINT "RoutineTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'TelegramUser') THEN
    ALTER TABLE "TelegramAttendance" ADD CONSTRAINT "TelegramAttendance_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "TelegramUser"("chatId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- ─── Gaming Zone ─────────────────────────────────────────────────────────────
-- Mirrors the Gaming Zone models in prisma/schema.prisma. userId columns hold
-- AuthUsers ids, so there is no foreign key to "User".
CREATE TABLE IF NOT EXISTS "Game" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genre" TEXT NOT NULL DEFAULT '',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "iconKey" TEXT NOT NULL DEFAULT 'gamepad',
    "maxSquad" INTEGER NOT NULL DEFAULT 5,
    "ranks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GameRoom" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'squad',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 5,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "inviteCode" TEXT,
    "rankMin" TEXT,
    "rankMax" TEXT,
    "region" TEXT NOT NULL DEFAULT '',
    "platform" TEXT NOT NULL DEFAULT '',
    "lobbyCode" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "slowModeSec" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameRoom_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GameRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomRole" TEXT NOT NULL DEFAULT 'member',
    "ready" BOOLEAN NOT NULL DEFAULT false,
    "mutedUntil" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameRoomMember_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GameRoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "replyToId" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameRoomMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GamerProfile" (
    "userId" TEXT NOT NULL,
    "games" TEXT NOT NULL DEFAULT '[]',
    "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability" TEXT NOT NULL DEFAULT '{}',
    "lookingForSquad" BOOLEAN NOT NULL DEFAULT false,
    "lfgGameIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT NOT NULL DEFAULT '',
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamerProfile_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE IF NOT EXISTS "GameEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "roomId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'game_night',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL DEFAULT 16,
    "teamSize" INTEGER NOT NULL DEFAULT 1,
    "format" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdBy" TEXT NOT NULL,
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "EventEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL DEFAULT '',
    "teamMembers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "seed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventEntry_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "TournamentMatch" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "entryAId" TEXT,
    "entryBId" TEXT,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "winnerEntryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reportedBy" TEXT,
    "reportedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "screenshotUrl" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TournamentMatch_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GamingReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "roomId" TEXT,
    "messageId" TEXT,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "handledBy" TEXT,
    "handledAt" TIMESTAMP(3),
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamingReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "GamingSanction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "roomId" TEXT,
    "until" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamingSanction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Game_slug_key" ON "Game"("slug");
CREATE INDEX IF NOT EXISTS "Game_active_sortOrder_idx" ON "Game"("active", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "GameRoom_inviteCode_key" ON "GameRoom"("inviteCode");
CREATE INDEX IF NOT EXISTS "GameRoom_gameId_status_idx" ON "GameRoom"("gameId", "status");
CREATE INDEX IF NOT EXISTS "GameRoom_type_status_idx" ON "GameRoom"("type", "status");
CREATE INDEX IF NOT EXISTS "GameRoom_ownerId_idx" ON "GameRoom"("ownerId");
CREATE UNIQUE INDEX IF NOT EXISTS "GameRoomMember_roomId_userId_key" ON "GameRoomMember"("roomId", "userId");
CREATE INDEX IF NOT EXISTS "GameRoomMember_userId_idx" ON "GameRoomMember"("userId");
CREATE INDEX IF NOT EXISTS "GameRoomMessage_roomId_createdAt_idx" ON "GameRoomMessage"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "GamerProfile_lookingForSquad_idx" ON "GamerProfile"("lookingForSquad");
CREATE INDEX IF NOT EXISTS "GameEvent_startsAt_idx" ON "GameEvent"("startsAt");
CREATE INDEX IF NOT EXISTS "GameEvent_gameId_startsAt_idx" ON "GameEvent"("gameId", "startsAt");
CREATE UNIQUE INDEX IF NOT EXISTS "EventEntry_eventId_userId_key" ON "EventEntry"("eventId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TournamentMatch_eventId_round_slot_key" ON "TournamentMatch"("eventId", "round", "slot");
CREATE INDEX IF NOT EXISTS "GamingReport_status_createdAt_idx" ON "GamingReport"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "GamingReport_targetUserId_idx" ON "GamingReport"("targetUserId");
CREATE INDEX IF NOT EXISTS "GamingSanction_userId_type_idx" ON "GamingSanction"("userId", "type");

DO $$ BEGIN
  ALTER TABLE "GameRoom" ADD CONSTRAINT "GameRoom_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GameRoomMember" ADD CONSTRAINT "GameRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GameRoomMessage" ADD CONSTRAINT "GameRoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "GameRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EventEntry" ADD CONSTRAINT "EventEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TournamentMatch" ADD CONSTRAINT "TournamentMatch_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
