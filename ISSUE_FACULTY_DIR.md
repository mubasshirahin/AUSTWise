# Faculty Directory Issue (closes #11)

## Issue Summary
Implement faculty directory data population and server-side integration.

## Problem
- Faculty directory UI works but `facultyData` is empty
- No way to populate faculty data from server
- Directory display shows no entries

## Acceptance Criteria
- [ ] Faculty data fetched from server API
- [ ] Directory displays faculty names, departments, and contact info
- [ ] Data persists across sessions
- [ ] Search and filter functionality works

## Implementation Notes
- Update server API `/api/faculty` to return faculty data
- Connect VaultPage or Admin panel to faculty data endpoint
- Implement role-based access (faculty/staff visibility)
- Maintain backward compatibility with existing directory features

## Labels
- type: feature
- module: campus
- priority: medium