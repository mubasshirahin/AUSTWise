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
});
