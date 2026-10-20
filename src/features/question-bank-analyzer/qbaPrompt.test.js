import { describe, it, expect } from 'vitest';
import { buildPrompt } from './qbaPrompt';

describe('buildPrompt', () => {
  const prompt = buildPrompt('CSE 3101', 'Database Management Systems');

  it('fills the course code and title in', () => {
    expect(prompt).toContain('CSE 3101');
    expect(prompt).toContain('Database Management Systems');
  });

  it('keeps the placeholders when the course is empty', () => {
    expect(buildPrompt('', '')).toContain('[COURSE CODE]');
  });

  it('asks the AI to mark questions that had a picture', () => {
    expect(prompt).toContain('[image]');
    expect(prompt).toMatch(/picture/i);
    expect(prompt).toMatch(/diagram/i);
  });

  it('keeps the output contract the parser expects', () => {
    expect(prompt).toContain('## TOPIC: <topic name>');
    expect(prompt).toContain('| # | Question | Exam | Semester | Marks | Times |');
    expect(prompt).toContain('## VIP_MATRIX');
    expect(prompt).toContain('## STUDY_PLAN');
  });

  it('asks for the raw papers of every semester, unmerged', () => {
    expect(prompt).toContain('## SEMESTER_PAPERS');
    expect(prompt).toContain('| # | Question | Exam | Marks |');
    expect(prompt).toMatch(/never merge/i);
    expect(prompt).toMatch(/### <semester name/);
  });

  it('asks for numbered sub-parts with no gaps', () => {
    expect(prompt).toContain('2.a)');
    expect(prompt).toContain('2.b)');
    expect(prompt).toMatch(/NO gaps/i);
    expect(prompt).toMatch(/2\.b\)\s*\n?\s*may never exist without a 2\.a\)/i);
  });
});
