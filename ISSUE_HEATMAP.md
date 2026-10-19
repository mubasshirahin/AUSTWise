# Topic Heatmap Issue (closes #13)

## Issue Summary
Implement topic frequency heatmap with data input capability.

## Problem
- `topicFrequency` is empty, no way to populate
- No UI for entering topic analysis data
- Heatmap component exists but has no data

## Acceptance Criteria
- [ ] Data input interface for topic frequency
- [ ] Heatmap populates from server-stored data
- [ ] Admin can manage topic categories
- [ ] Data persists across sessions and devices

## Implementation Notes
- Create API endpoint `/api/topic-frequency` for CRUD operations
- Integrate with Question Bank or separate topic tracking system
- Build admin CRUD interface for topic entries
- Connect to GradeLab analytics dashboard

## Labels
- type: high priority
- module: vault
- area: heatmap