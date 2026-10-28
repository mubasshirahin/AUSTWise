/* ============================================================================
   AUSTWise — Full database schema (SQL Server / AUSTWise database)
   ----------------------------------------------------------------------------
   How to use:
     1. Open this file in SSMS
     2. Make sure you are connected to the local instance (PEPSi\SQLEXPRESS)
     3. Select all (Ctrl+A) and run (F5)
        → creates the AUSTWise database (if missing) and every table.
   This file is idempotent — running it twice is safe (tables are skipped if
   they already exist).

   The app also auto-creates these tables on startup (see server/db.mjs,
   server/userStore.mjs, server/storeDB.mjs, server/vaultNotesDB.mjs,
   server/roleAppDB.mjs). The Prisma-backed tables (section 2) would normally
   be created by `npx prisma db push` — this file contains them so you can
   manage everything from SSMS.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   SECTION 0 — Create the database if it doesn't exist
   -------------------------------------------------------------------------- */
IF DB_ID(N'AUSTWise') IS NULL
BEGIN
    CREATE DATABASE [AUSTWise];
END
GO

USE [AUSTWise];
GO

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 1 — mssql-managed tables (server modules)
   ═══════════════════════════════════════════════════════════════════════════ */

-- ── TelegramUsers ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TelegramUsers')
BEGIN
    CREATE TABLE TelegramUsers (
        ChatId      NVARCHAR(50)    NOT NULL PRIMARY KEY,
        Routine     NVARCHAR(MAX)   NULL,
        Enabled     BIT             NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
        UpdatedAt   DATETIME2       NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ── AttendanceRecords ───────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AttendanceRecords')
BEGIN
    CREATE TABLE AttendanceRecords (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        ChatId      NVARCHAR(50)    NOT NULL,
        CourseCode  NVARCHAR(50)    NOT NULL,
        Attended    BIT             NOT NULL,
        RecordDate  DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        Timestamp   DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Attendance_TelegramUsers
            FOREIGN KEY (ChatId) REFERENCES TelegramUsers(ChatId)
            ON DELETE CASCADE,
        CONSTRAINT UQ_Attendance_Daily
            UNIQUE (ChatId, CourseCode, RecordDate)
    );

    CREATE NONCLUSTERED INDEX IX_Attendance_ChatId
        ON AttendanceRecords (ChatId)
        INCLUDE (CourseCode, Attended, RecordDate);
END
GO

-- ── LibraryPresence (legacy GPS check-in) ───────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LibraryPresence')
BEGIN
    CREATE TABLE LibraryPresence (
        DeviceId    NVARCHAR(100)   NOT NULL PRIMARY KEY,
        Lat         FLOAT           NOT NULL,
        Lng         FLOAT           NOT NULL,
        UpdatedAt   DATETIME2       NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ── live_library_occupancy (real-time geofence occupancy) ──────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'live_library_occupancy')
BEGIN
    CREATE TABLE live_library_occupancy (
        id            INT             IDENTITY(1,1) PRIMARY KEY,
        user_id       INT             NOT NULL,
        is_inside     BIT             NOT NULL DEFAULT 0,
        lat           FLOAT           NULL,
        lng           FLOAT           NULL,
        last_updated  DATETIME2       NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_live_library_occupancy_user UNIQUE (user_id)
    );
END
GO

-- ── PasswordVault (AES-256-GCM encrypted credentials) ───────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PasswordVault')
BEGIN
    CREATE TABLE PasswordVault (
        Id           UNIQUEIDENTIFIER NOT NULL PRIMARY KEY DEFAULT NEWID(),
        UserId       NVARCHAR(100)    NOT NULL,
        Platform     NVARCHAR(120)    NOT NULL,
        Email        NVARCHAR(255)    NOT NULL,
        Username     NVARCHAR(120)    NULL,
        EncIv        NVARCHAR(500)    NOT NULL,
        EncContent   NVARCHAR(MAX)    NOT NULL,
        EncAuthTag   NVARCHAR(500)    NOT NULL,
        CreatedAt    DATETIME2        NOT NULL DEFAULT GETDATE(),
        UpdatedAt    DATETIME2        NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_PasswordVault_User UNIQUE (UserId, Platform)
    );

    CREATE NONCLUSTERED INDEX IX_PasswordVault_UserId
        ON PasswordVault (UserId);
END
GO

-- ── Invitations ─────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Invitations')
BEGIN
    CREATE TABLE Invitations (
        Id          INT             IDENTITY(1,1) PRIMARY KEY,
        Email       NVARCHAR(255)   NOT NULL,
        Role        NVARCHAR(50)    NOT NULL,
        Token       NVARCHAR(500)   NOT NULL,
        Status      NVARCHAR(20)    NOT NULL DEFAULT 'pending',
        InvitedBy   NVARCHAR(255)   NULL,
        CreatedAt   DATETIME2       NOT NULL DEFAULT GETDATE(),
        ExpiresAt   DATETIME2       NULL,
        AcceptedAt  DATETIME2       NULL,
        CONSTRAINT UQ_Invitations_Token UNIQUE (Token)
    );

    CREATE NONCLUSTERED INDEX IX_Invitations_Email
        ON Invitations (Email);

    CREATE NONCLUSTERED INDEX IX_Invitations_Status
        ON Invitations (Status)
        INCLUDE (Email, Role, CreatedAt);
END
GO

-- ── AuthUsers (accounts — used by server/userStore.mjs) ─────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuthUsers')
BEGIN
    CREATE TABLE AuthUsers (
        id              NVARCHAR(50)    PRIMARY KEY,
        awid            NVARCHAR(50)    NOT NULL,
        email           NVARCHAR(200)   NOT NULL UNIQUE,
        name            NVARCHAR(200)   NOT NULL DEFAULT '',
        data            NVARCHAR(MAX)   DEFAULT '{}'
    );

    CREATE INDEX IX_AuthUsers_email ON AuthUsers(email);
    CREATE INDEX IX_AuthUsers_awid  ON AuthUsers(awid);
END
GO

-- ── UserStore (per-user KV store — server/storeDB.mjs) ──────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'UserStore')
BEGIN
    CREATE TABLE UserStore (
        id        NVARCHAR(50) DEFAULT (NEWID()) PRIMARY KEY,
        userId    NVARCHAR(50) NOT NULL,
        [key]     NVARCHAR(200) NOT NULL,
        value     NVARCHAR(MAX) DEFAULT '{}',
        updatedAt DATETIME2 DEFAULT GETDATE(),
        createdAt DATETIME2 DEFAULT GETDATE(),
        CONSTRAINT UQ_UserStore UNIQUE (userId, [key])
    );

    CREATE INDEX IX_UserStore_userId ON UserStore(userId);
END
GO

-- ── SharedStore (shared KV store — server/storeDB.mjs) ──────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SharedStore')
BEGIN
    CREATE TABLE SharedStore (
        id        NVARCHAR(50) DEFAULT (NEWID()) PRIMARY KEY,
        [key]     NVARCHAR(200) NOT NULL UNIQUE,
        value     NVARCHAR(MAX) DEFAULT '{}',
        updatedBy NVARCHAR(50) DEFAULT '',
        updatedAt DATETIME2 DEFAULT GETDATE(),
        createdAt DATETIME2 DEFAULT GETDATE()
    );
END
GO

-- ── VaultNotes (encrypted vault notes — server/vaultNotesDB.mjs) ────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'VaultNotes')
BEGIN
    CREATE TABLE VaultNotes (
        id   NVARCHAR(100) PRIMARY KEY,
        data NVARCHAR(MAX) DEFAULT '{}'
    );
END
GO

-- ── RoleApplications (CR/SR applications — server/roleAppDB.mjs) ────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleApplications')
BEGIN
    CREATE TABLE RoleApplications (
        id    NVARCHAR(50) PRIMARY KEY,
        data  NVARCHAR(MAX) DEFAULT '{}'
    );

    -- Note: server/roleAppDB.mjs originally tried to index
    -- CAST(JSON_VALUE(data, '$.userId') AS NVARCHAR(50)), but SQL Server
    -- rejects expressions in CREATE INDEX (needs a computed column). The app
    -- only reads/writes by id, so the index is omitted here.
END
GO

/* ════════════════════════════════════════════════════════════════════════════
   SECTION 2 — Prisma-backed tables (server/prisma/schema.prisma)
   Normally created by: npx prisma db push
   ═══════════════════════════════════════════════════════════════════════════ */

-- ── User ────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'User')
BEGIN
    CREATE TABLE [User] (
        id               NVARCHAR(191) NOT NULL PRIMARY KEY,
        awid             NVARCHAR(191) NOT NULL UNIQUE,
        email            NVARCHAR(191) NOT NULL UNIQUE,
        name             NVARCHAR(MAX) NOT NULL,
        passwordHash     NVARCHAR(MAX) NOT NULL,
        role             NVARCHAR(MAX) NOT NULL DEFAULT N'student',
        department       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        batch            NVARCHAR(MAX) NOT NULL DEFAULT N'',
        batchNo          NVARCHAR(MAX) NOT NULL DEFAULT N'',
        batchName        NVARCHAR(MAX) NOT NULL DEFAULT N'',
        designation      NVARCHAR(MAX) NOT NULL DEFAULT N'',
        company          NVARCHAR(MAX) NOT NULL DEFAULT N'',
        graduationYear   NVARCHAR(MAX) NOT NULL DEFAULT N'',
        yearSemester     NVARCHAR(MAX) NOT NULL DEFAULT N'',
        section          NVARCHAR(MAX) NOT NULL DEFAULT N'',
        labSection       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        semester         INT           NOT NULL DEFAULT 1,
        avatar           NVARCHAR(MAX) NULL,
        openForTalk      BIT           NOT NULL DEFAULT 0,
        bloodGroup       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        facebook         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        whatsapp         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        linkedin         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        discord          NVARCHAR(MAX) NOT NULL DEFAULT N'',
        linkedSocial     NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        linkedAccounts   NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        cgpa             FLOAT         NOT NULL DEFAULT 0,
        creditsCompleted INT           NOT NULL DEFAULT 0,
        totalCredits     INT           NOT NULL DEFAULT 160,
        createdAt        DATETIME2     NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ── Routine ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Routine')
BEGIN
    CREATE TABLE Routine (
        id         NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId     NVARCHAR(191) NOT NULL,
        weekDay    INT           NOT NULL,
        timeSlot   NVARCHAR(MAX) NOT NULL,
        courseCode NVARCHAR(MAX) NOT NULL,
        room       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        isActive   BIT           NOT NULL DEFAULT 1,
        createdAt  DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_Routine_User FOREIGN KEY (userId) REFERENCES [User](id)
    );

    CREATE INDEX IX_Routine_userId_weekDay ON Routine (userId, weekDay);
END
GO

-- ── SemesterResult ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SemesterResult')
BEGIN
    CREATE TABLE SemesterResult (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId    NVARCHAR(191) NOT NULL,
        semester  NVARCHAR(191) NOT NULL,
        courses   NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        cgpa      FLOAT         NOT NULL DEFAULT 0,
        createdAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_SemesterResult_User FOREIGN KEY (userId) REFERENCES [User](id),
        CONSTRAINT UQ_SemesterResult_user UNIQUE (userId, semester)
    );
END
GO

-- ── QuestionPaper ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'QuestionPaper')
BEGIN
    CREATE TABLE QuestionPaper (
        id              NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        contributorId   NVARCHAR(191) NOT NULL,
        contributorName NVARCHAR(MAX) NOT NULL DEFAULT N'',
        department      NVARCHAR(MAX) NOT NULL DEFAULT N'',
        yearSem         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        course          NVARCHAR(191) NOT NULL,
        name            NVARCHAR(MAX) NOT NULL DEFAULT N'',
        type            NVARCHAR(191) NOT NULL,
        year            NVARCHAR(MAX) NOT NULL DEFAULT N'',
        semester        NVARCHAR(MAX) NOT NULL DEFAULT N'',
        paperNo         INT           NOT NULL DEFAULT 1,
        solved          BIT           NOT NULL DEFAULT 0,
        fileName        NVARCHAR(MAX) NOT NULL,
        fileType        NVARCHAR(MAX) NOT NULL DEFAULT N'pdf',
        fileData        VARBINARY(MAX) NULL,
        uploadedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_QuestionPaper_User FOREIGN KEY (contributorId) REFERENCES [User](id)
    );

    CREATE INDEX IX_QuestionPaper_course_type     ON QuestionPaper (course, type);
    CREATE INDEX IX_QuestionPaper_contributorId   ON QuestionPaper (contributorId);
END
GO

-- ── --------------------------------  MarketplaceListing ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MarketplaceListing')
BEGIN
    CREATE TABLE MarketplaceListing (
        id            NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        contributorId NVARCHAR(191) NOT NULL,
        listType      NVARCHAR(191) NOT NULL,
        title         NVARCHAR(MAX) NOT NULL,
        price         FLOAT         NOT NULL DEFAULT 0,
        condition     NVARCHAR(MAX) NOT NULL DEFAULT N'',
        category      NVARCHAR(MAX) NOT NULL DEFAULT N'',
        image         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        seller        NVARCHAR(MAX) NOT NULL DEFAULT N'',
        contact       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        location      NVARCHAR(MAX) NOT NULL DEFAULT N'',
        rent          FLOAT         NOT NULL DEFAULT 0,
        type          NVARCHAR(MAX) NOT NULL DEFAULT N'',
        amenities     NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        available     BIT           NOT NULL DEFAULT 1,
        owner         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        description   NVARCHAR(MAX) NOT NULL DEFAULT N'',
        environment   NVARCHAR(MAX) NOT NULL DEFAULT N'',
        utilities     NVARCHAR(MAX) NOT NULL DEFAULT N'',
        status        NVARCHAR(MAX) NOT NULL DEFAULT N'open',
        reporter      NVARCHAR(MAX) NOT NULL DEFAULT N'',
        postedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_MarketplaceListing_User FOREIGN KEY (contributorId) REFERENCES [User](id)
    );

    CREATE INDEX IX_MarketplaceListing_listType     ON MarketplaceListing (listType);
    CREATE INDEX IX_MarketplaceListing_contributorId ON MarketplaceListing (contributorId);
END
GO

-- ── MentorRequest ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MentorRequest')
BEGIN
    CREATE TABLE MentorRequest (
        id            NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        contributorId NVARCHAR(191) NOT NULL,
        requesterName NVARCHAR(MAX) NOT NULL DEFAULT N'',
        batch         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        department    NVARCHAR(MAX) NOT NULL DEFAULT N'',
        topic         NVARCHAR(MAX) NOT NULL,
        description   NVARCHAR(MAX) NOT NULL DEFAULT N'',
        contact       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        responses     NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        postedAt      DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_MentorRequest_User FOREIGN KEY (contributorId) REFERENCES [User](id)
    );

    CREATE INDEX IX_MentorRequest_contributorId ON MentorRequest (contributorId);
END
GO

-- ── Message ─────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Message')
BEGIN
    CREATE TABLE Message (
        id             NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        conversationId NVARCHAR(191) NOT NULL,
        fromId         NVARCHAR(191) NOT NULL,
        toId           NVARCHAR(191) NOT NULL,
        text           NVARCHAR(MAX) NOT NULL,
        timestamp      DATETIME2     NOT NULL DEFAULT GETDATE(),
        [read]         BIT           NOT NULL DEFAULT 0,
        deleted        BIT           NOT NULL DEFAULT 0,
        edited         BIT           NOT NULL DEFAULT 0,
        editedAt       DATETIME2     NULL,
        replyTo        NVARCHAR(MAX) NULL,
        CONSTRAINT FK_Message_From FOREIGN KEY (fromId) REFERENCES [User](id),
        CONSTRAINT FK_Message_To   FOREIGN KEY (toId)   REFERENCES [User](id)
    );

    CREATE INDEX IX_Message_conversationId_timestamp ON Message (conversationId, timestamp);
    CREATE INDEX IX_Message_fromId ON Message (fromId);
    CREATE INDEX IX_Message_toId   ON Message (toId);
END
GO

-- ── MessageReaction ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MessageReaction')
BEGIN
    CREATE TABLE MessageReaction (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        messageId NVARCHAR(191) NOT NULL,
        userId    NVARCHAR(191) NOT NULL,
        emoji     NVARCHAR(191) NOT NULL,
        CONSTRAINT FK_MessageReaction_Message FOREIGN KEY (messageId) REFERENCES Message(id) ON DELETE CASCADE,
        CONSTRAINT FK_MessageReaction_User    FOREIGN KEY (userId)    REFERENCES [User](id),
        CONSTRAINT UQ_MessageReaction UNIQUE (messageId, userId, emoji)
    );
END
GO

-- ── Notice ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Notice')
BEGIN
    CREATE TABLE Notice (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        title     NVARCHAR(MAX) NOT NULL,
        body      NVARCHAR(MAX) NOT NULL,
        postedBy  NVARCHAR(191) NOT NULL,
        postedAt  DATETIME2     NOT NULL DEFAULT GETDATE(),
        expiresAt DATETIME2     NULL,
        pinned    BIT           NOT NULL DEFAULT 0,
        CONSTRAINT FK_Notice_User FOREIGN KEY (postedBy) REFERENCES [User](id)
    );
END
GO

-- ── CanteenMenuItem ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CanteenMenuItem')
BEGIN
    CREATE TABLE CanteenMenuItem (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        day       NVARCHAR(191) NOT NULL,
        mealType  NVARCHAR(191) NOT NULL,
        name      NVARCHAR(MAX) NOT NULL,
        price     FLOAT         NOT NULL DEFAULT 0,
        available BIT           NOT NULL DEFAULT 1
    );

    CREATE INDEX IX_CanteenMenuItem_day_mealType ON CanteenMenuItem (day, mealType);
END
GO

-- ── CanteenFeedback ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CanteenFeedback')
BEGIN
    CREATE TABLE CanteenFeedback (
        id         NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId     NVARCHAR(191) NOT NULL,
        menuItemId NVARCHAR(191) NOT NULL,
        rating     INT           NOT NULL DEFAULT 3,
        comment    NVARCHAR(MAX) NOT NULL DEFAULT N'',
        createdAt  DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_CanteenFeedback_User     FOREIGN KEY (userId)     REFERENCES [User](id),
        CONSTRAINT FK_CanteenFeedback_MenuItem FOREIGN KEY (menuItemId) REFERENCES CanteenMenuItem(id) ON DELETE CASCADE,
        CONSTRAINT UQ_CanteenFeedback UNIQUE (userId, menuItemId)
    );
END
GO

-- ── LibraryCheckin ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LibraryCheckin')
BEGIN
    CREATE TABLE LibraryCheckin (
        id          NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId      NVARCHAR(191) NOT NULL UNIQUE,
        lat         FLOAT         NOT NULL,
        lng         FLOAT         NOT NULL,
        checkedInAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt   DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_LibraryCheckin_User FOREIGN KEY (userId) REFERENCES [User](id)
    );
END
GO

-- ── Club ────────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Club')
BEGIN
    CREATE TABLE Club (
        id          NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        name        NVARCHAR(191) NOT NULL UNIQUE,
        description NVARCHAR(MAX) NOT NULL DEFAULT N'',
        category    NVARCHAR(MAX) NOT NULL DEFAULT N'',
        createdAt   DATETIME2     NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ── ClubMembership ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ClubMembership')
BEGIN
    CREATE TABLE ClubMembership (
        id     NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        clubId NVARCHAR(191) NOT NULL,
        userId NVARCHAR(191) NOT NULL,
        role   NVARCHAR(MAX) NOT NULL DEFAULT N'member',
        CONSTRAINT FK_ClubMembership_Club FOREIGN KEY (clubId) REFERENCES Club(id) ON DELETE CASCADE,
        CONSTRAINT FK_ClubMembership_User FOREIGN KEY (userId) REFERENCES [User](id),
        CONSTRAINT UQ_ClubMembership UNIQUE (clubId, userId)
    );
END
GO

-- ── Invitation (Prisma version) ─────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Invitation')
BEGIN
    CREATE TABLE Invitation (
        id         NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        email      NVARCHAR(191) NOT NULL,
        role       NVARCHAR(MAX) NOT NULL,
        token      NVARCHAR(191) NOT NULL UNIQUE,
        status     NVARCHAR(MAX) NOT NULL DEFAULT N'pending',
        invitedBy  NVARCHAR(191) NOT NULL,
        createdAt  DATETIME2     NOT NULL DEFAULT GETDATE(),
        expiresAt  DATETIME2     NULL,
        acceptedAt DATETIME2     NULL,
        CONSTRAINT FK_Invitation_User FOREIGN KEY (invitedBy) REFERENCES [User](id)
    );

    CREATE INDEX IX_Invitation_email ON Invitation (email);
    CREATE INDEX IX_Invitation_token ON Invitation (token);
END
GO

-- ── RoleApplication (Prisma version) ────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoleApplication')
BEGIN
    CREATE TABLE RoleApplication (
        id               NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId           NVARCHAR(191) NOT NULL,
        appliedRole      NVARCHAR(MAX) NOT NULL,
        department       NVARCHAR(MAX) NOT NULL,
        semester         NVARCHAR(MAX) NOT NULL,
        targetSection    NVARCHAR(MAX) NULL,
        targetLabSection NVARCHAR(MAX) NULL,
        statement        NVARCHAR(MAX) NOT NULL DEFAULT N'',
        status           NVARCHAR(MAX) NOT NULL DEFAULT N'pending',
        createdAt        DATETIME2     NOT NULL DEFAULT GETDATE(),
        reviewedAt       DATETIME2     NULL,
        reviewedBy       NVARCHAR(MAX) NULL,
        CONSTRAINT FK_RoleApplication_User FOREIGN KEY (userId) REFERENCES [User](id)
    );
END
GO

-- ── TranscriptTemplate ──────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TranscriptTemplate')
BEGIN
    CREATE TABLE TranscriptTemplate (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId    NVARCHAR(191) NOT NULL,
        name      NVARCHAR(MAX) NOT NULL,
        data      NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        createdAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_TranscriptTemplate_User FOREIGN KEY (userId) REFERENCES [User](id)
    );
END
GO

-- ── RoutineTemplate ─────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'RoutineTemplate')
BEGIN
    CREATE TABLE RoutineTemplate (
        id        NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        userId    NVARCHAR(191) NOT NULL,
        name      NVARCHAR(MAX) NOT NULL,
        schedule  NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        createdAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_RoutineTemplate_User FOREIGN KEY (userId) REFERENCES [User](id)
    );
END
GO

-- ── SharedRoutine ───────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'SharedRoutine')
BEGIN
    CREATE TABLE SharedRoutine (
        id           NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        crId         NVARCHAR(MAX) NOT NULL DEFAULT N'',
        crName       NVARCHAR(MAX) NOT NULL DEFAULT N'',
        department   NVARCHAR(100) NOT NULL,
        yearSemester NVARCHAR(100) NOT NULL DEFAULT N'',
        section      NVARCHAR(100) NOT NULL DEFAULT N'',
        labSection   NVARCHAR(100) NOT NULL DEFAULT N'',
        routine      NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        weekDays     NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        createdAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_SharedRoutine UNIQUE (department, yearSemester, section, labSection)
    );
END
GO

-- ── TelegramUser (Prisma version) ───────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TelegramUser')
BEGIN
    CREATE TABLE TelegramUser (
        chatId    NVARCHAR(191) NOT NULL PRIMARY KEY,
        routine   NVARCHAR(MAX) NULL,
        enabled   BIT           NOT NULL DEFAULT 1,
        createdAt DATETIME2     NOT NULL DEFAULT GETDATE(),
        updatedAt DATETIME2     NOT NULL DEFAULT GETDATE()
    );
END
GO

-- ── TelegramAttendance (Prisma version) ─────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TelegramAttendance')
BEGIN
    CREATE TABLE TelegramAttendance (
        id         NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        chatId     NVARCHAR(191) NOT NULL,
        courseCode NVARCHAR(191) NOT NULL,
        attended   BIT           NOT NULL,
        recordDate DATETIME2     NOT NULL DEFAULT GETDATE(),
        timestamp  DATETIME2     NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_TelegramAttendance_TelegramUser FOREIGN KEY (chatId) REFERENCES TelegramUser(chatId) ON DELETE CASCADE,
        CONSTRAINT UQ_TelegramAttendance UNIQUE (chatId, courseCode, recordDate)
    );

    CREATE INDEX IX_TelegramAttendance_chatId ON TelegramAttendance (chatId);
END
GO

-- ── Cheatsheet ──────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Cheatsheet')
BEGIN
    CREATE TABLE Cheatsheet (
        id            NVARCHAR(191) NOT NULL PRIMARY KEY DEFAULT (LOWER(NEWID())),
        title         NVARCHAR(MAX) NOT NULL,
        category      NVARCHAR(191) NOT NULL DEFAULT N'General',
        course        NVARCHAR(191) NOT NULL DEFAULT N'',
        formulas      NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
        contributorId NVARCHAR(191) NULL,
        createdAt     DATETIME2     NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_Cheatsheet_category ON Cheatsheet (category);
    CREATE INDEX IX_Cheatsheet_course   ON Cheatsheet (course);
END
GO

-- ── CampusLocation ──────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CampusLocation')
BEGIN
    CREATE TABLE CampusLocation (
        id           INT           IDENTITY(1,1) PRIMARY KEY,
        floor        NVARCHAR(191) NOT NULL,
        roomId       NVARCHAR(191) NOT NULL,
        name         NVARCHAR(MAX) NOT NULL,
        type         NVARCHAR(MAX) NOT NULL,
        hotspotData  NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
        x            FLOAT         NULL,
        y            FLOAT         NULL,
        mapImage     NVARCHAR(MAX) NOT NULL DEFAULT N''
    );

    CREATE INDEX IX_CampusLocation_floor  ON CampusLocation (floor);
    CREATE INDEX IX_CampusLocation_roomId ON CampusLocation (roomId);
END
GO

-- ── Course ──────────────────────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Course')
BEGIN
    CREATE TABLE Course (
        code       NVARCHAR(191) NOT NULL PRIMARY KEY,
        name       NVARCHAR(MAX) NOT NULL,
        credit     FLOAT         NOT NULL DEFAULT 0,
        department NVARCHAR(191) NOT NULL DEFAULT N''
    );

    CREATE INDEX IX_Course_department ON Course (department);
END
GO

/* ============================================================================
   Done. You can now explore the tables under AUSTWise > Tables in SSMS.
   ============================================================================ */
