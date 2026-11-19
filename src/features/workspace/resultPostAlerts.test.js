import { describe, it, expect } from 'vitest';
import { isResultPost, pickNewResultPosts, resultAlertKey, RESULT_ALERT_MAX_AGE_MS } from './resultPostAlerts';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const recent = new Date(NOW - 60 * 60 * 1000).toISOString();

describe('isResultPost', () => {
  it.each([
    'CT-2 marks have been published',
    'Midterm Result is out',
    'Final grades uploaded',
    'Your assignment has been graded',
    'Quiz 1 mark uploaded',
    'CT er রেজাল্ট দেওয়া হয়েছে',
    'মার্কস দেখে নাও',
  ])('matches %s', (text) => {
    expect(isResultPost({ text })).toBe(true);
  });

  it.each([
    'Please mark your attendance',
    'See the remarks on your report',
    'Bookmark the lab manual',
    'Upgrade your Python version',
    'Class postponed to Sunday',
    'মার্কেট এ দেখা হবে',
  ])('ignores %s', (text) => {
    expect(isResultPost({ text })).toBe(false);
  });

  it('checks material titles, descriptions and attachment names', () => {
    expect(isResultPost({ title: 'Lab files', materials: [{ driveFile: { driveFile: { title: 'CSE3101 Marksheet.pdf' } } }] })).toBe(true);
    expect(isResultPost({ title: 'Week 4', description: 'Grade sheet attached' })).toBe(true);
    expect(isResultPost({ title: 'Week 4', materials: [{ link: { title: 'Slides' } }] })).toBe(false);
  });
});

describe('pickNewResultPosts', () => {
  const post = (over = {}) => ({ id: 'a1', courseId: 'c1', text: 'CT-1 marks published', creationTime: recent, state: 'PUBLISHED', ...over });

  it('returns new, recent, published result posts', () => {
    expect(pickNewResultPosts([post()], new Set(), NOW)).toHaveLength(1);
  });

  it('skips posts already alerted', () => {
    expect(pickNewResultPosts([post()], new Set([resultAlertKey(post())]), NOW)).toHaveLength(0);
  });

  it('skips old posts so the first run does not flood', () => {
    const old = new Date(NOW - RESULT_ALERT_MAX_AGE_MS - 1000).toISOString();
    expect(pickNewResultPosts([post({ creationTime: old })], new Set(), NOW)).toHaveLength(0);
  });

  it('skips drafts and non-result posts', () => {
    expect(pickNewResultPosts([post({ state: 'DRAFT' })], new Set(), NOW)).toHaveLength(0);
    expect(pickNewResultPosts([post({ text: 'Class moved to room 7A' })], new Set(), NOW)).toHaveLength(0);
  });
});
