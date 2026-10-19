# Directory Reference Issue (dirreferent)

## Issue Summary
Fix directory and path referencing across the application to ensure consistent file and resource handling.

## Problem
- Inconsistent directory path handling across features
- LocalStorage keys not properly namespaced for different user roles
- Directory/folder references not persisted correctly across sessions

## Acceptance Criteria
- [ ] All directory/path references use consistent naming convention
- [ ] LocalStorage keys are properly namespaced by user role/department
- [ ] Folder/batch references persist correctly across page reloads
- [ ] No broken references when switching between student/faculty/alumni roles

## Implementation Notes
- Update authStorage.js to use role-prefixed storage keys
- Ensure vault folder references use consistent URL format
- Update all imports and references to use the new key structure
- Maintain backward compatibility with existing localStorage data

## Labels
- type: bug
- module: auth
- module: vault
- priority: medium