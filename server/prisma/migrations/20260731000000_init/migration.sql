-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
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
CREATE TABLE "Routine" (
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
CREATE TABLE "SemesterResult" (
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
CREATE TABLE "QuestionPaper" (
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
CREATE TABLE "MarketplaceListing" (
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
CREATE TABLE "MentorRequest" (
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
CREATE TABLE "Message" (
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
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Admin',
    "postedBy" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "pinned" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenMenuItem" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CanteenMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 3,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanteenFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LibraryCheckin" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClubMembership" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "ClubMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
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
CREATE TABLE "RoleApplication" (
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
CREATE TABLE "TranscriptTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schedule" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoutineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedRoutine" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "semester" TEXT NOT NULL DEFAULT '',
    "section" TEXT NOT NULL DEFAULT '',
    "labSection" TEXT NOT NULL DEFAULT '',
    "routine" TEXT NOT NULL DEFAULT '{}',
    "weekDays" TEXT NOT NULL DEFAULT '[]',
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramUser" (
    "chatId" TEXT NOT NULL,
    "routine" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramUser_pkey" PRIMARY KEY ("chatId")
);

-- CreateTable
CREATE TABLE "TelegramAttendance" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "recordDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cheatsheet" (
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
CREATE TABLE "CampusLocation" (
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
CREATE TABLE "Course" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "department" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Course_pkey" PRIMARY KEY ("code")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_awid_key" ON "User"("awid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Routine_userId_weekDay_idx" ON "Routine"("userId", "weekDay");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterResult_userId_semester_key" ON "SemesterResult"("userId", "semester");

-- CreateIndex
CREATE INDEX "QuestionPaper_course_type_idx" ON "QuestionPaper"("course", "type");

-- CreateIndex
CREATE INDEX "QuestionPaper_contributorId_idx" ON "QuestionPaper"("contributorId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_listType_idx" ON "MarketplaceListing"("listType");

-- CreateIndex
CREATE INDEX "MarketplaceListing_contributorId_idx" ON "MarketplaceListing"("contributorId");

-- CreateIndex
CREATE INDEX "MentorRequest_contributorId_idx" ON "MentorRequest"("contributorId");

-- CreateIndex
CREATE INDEX "Message_conversationId_timestamp_idx" ON "Message"("conversationId", "timestamp");

-- CreateIndex
CREATE INDEX "Message_fromId_idx" ON "Message"("fromId");

-- CreateIndex
CREATE INDEX "Message_toId_idx" ON "Message"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "CanteenMenuItem_day_mealType_idx" ON "CanteenMenuItem"("day", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenFeedback_userId_menuItemId_key" ON "CanteenFeedback"("userId", "menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryCheckin_deviceId_key" ON "LibraryCheckin"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ClubMembership_clubId_userId_key" ON "ClubMembership"("clubId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_token_idx" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "SharedRoutine_department_idx" ON "SharedRoutine"("department");

-- CreateIndex
CREATE UNIQUE INDEX "SharedRoutine_studentId_key" ON "SharedRoutine"("studentId");

-- CreateIndex
CREATE INDEX "TelegramAttendance_chatId_idx" ON "TelegramAttendance"("chatId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramAttendance_chatId_courseCode_recordDate_key" ON "TelegramAttendance"("chatId", "courseCode", "recordDate");

-- CreateIndex
CREATE INDEX "Cheatsheet_category_idx" ON "Cheatsheet"("category");

-- CreateIndex
CREATE INDEX "Cheatsheet_course_idx" ON "Cheatsheet"("course");

-- CreateIndex
CREATE INDEX "CampusLocation_floor_idx" ON "CampusLocation"("floor");

-- CreateIndex
CREATE INDEX "CampusLocation_roomId_idx" ON "CampusLocation"("roomId");

-- CreateIndex
CREATE INDEX "Course_department_idx" ON "Course"("department");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterResult" ADD CONSTRAINT "SemesterResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionPaper" ADD CONSTRAINT "QuestionPaper_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorRequest" ADD CONSTRAINT "MentorRequest_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Notice" ADD CONSTRAINT "Notice_postedBy_fkey" FOREIGN KEY ("postedBy") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenFeedback" ADD CONSTRAINT "CanteenFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenFeedback" ADD CONSTRAINT "CanteenFeedback_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "CanteenMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubMembership" ADD CONSTRAINT "ClubMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleApplication" ADD CONSTRAINT "RoleApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptTemplate" ADD CONSTRAINT "TranscriptTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineTemplate" ADD CONSTRAINT "RoutineTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TelegramAttendance" ADD CONSTRAINT "TelegramAttendance_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "TelegramUser"("chatId") ON DELETE CASCADE ON UPDATE CASCADE;

