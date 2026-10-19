# Database Integration Issue (closes #12)

## Issue Summary
Replace JSON file storage with SQL Server / MongoDB for persistent data across restarts.

## Problem
- Currently JSON file-based storage (`.telegram_users.json`, `.library_presence.json`)
- Data does not persist across server restarts
- Not manageable via SQL Server or MongoDB

## Acceptance Criteria
- [ ] SQL Server or MongoDB integration established
- [ ] All JSON file data migrated to database
- [ ] Data persists across server restarts
- [ ] Admin panel can manage data via SSMS or MongoDB

## Implementation Notes
- Prisma ORM already configured - extend to include user, library, faculty tables
- Update server endpoints to use database queries
- Maintain backward compatibility during migration
- Update frontend storage hooks to use API calls instead of localStorage

## Labels
- type: high priority
- module: backend
- area: database