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

  it('keeps one master pool and puts sub-parts inside it', () => {
    expect(prompt).toContain('[QID: 001]');
    expect(prompt).toContain('Topic:');
    expect(prompt).toContain('Semesters:');
    expect(prompt).toMatch(/separated by\s*<br>/i);
    // Both other sections must reference the pool instead of repeating text.
    expect(prompt).toMatch(/contains ONLY\s+the \[QID: nnn\] reference/i);
    expect(prompt).toMatch(/Question cell contains ONE thing only/i);
  });

  it('merges only character-for-character identical wording', () => {
    expect(prompt).toMatch(/ONLY when the\s+wording is character-for-character identical/i);
    expect(prompt).toMatch(/never paraphrase/i);
    expect(prompt).not.toMatch(/Version 1: ?\.\.\./);
  });

  it('does not ask the AI for answers', () => {
    expect(prompt).toMatch(/do NOT write answers/i);
    expect(prompt).not.toMatch(/^Answer:/m);
  });

  it('declares the counts the site verifies', () => {
    expect(prompt).toContain('total_questions_extracted:');
    expect(prompt).toContain('total_rows_after_merge:');
  });

  it('marks its example pool lines so they are never parsed as real questions', () => {
    expect(prompt).toMatch(/<!-- Example: \[QID: 001\]/);
  });
});
