import { describe, it, expect } from 'vitest';
import { importCourseFromAiJson, validateCourseAiJson } from './courseAiImport';

const NEW_SCHEMA_JSON = JSON.stringify({
  courseTitle: 'React Bootcamp',
  description: 'Build modern React apps',
  platform: 'Udemy',
  instructor: 'Jonas',
  language: 'English',
  level: 'Intermediate',
  totalDuration: '40hr',
  structure: [
    {
      title: 'Chapter 1: Intro',
      type: 'chapter',
      children: [
        {
          title: 'Module 1: Basics',
          type: 'module',
          children: [
            { title: 'Lesson 1: Welcome', type: 'lesson', duration: '12:30' },
            { title: 'Lesson 2: Setup', type: 'lesson', duration: '' },
          ],
        },
      ],
    },
  ],
});

describe('importCourseFromAiJson — new prompt schema fields', () => {
  it('saves description, language, level on the course and duration on lessons', () => {
    const res = importCourseFromAiJson([], [], NEW_SCHEMA_JSON);
    expect(res.ok).toBe(true);
    expect(res.course.description).toBe('Build modern React apps');
    expect(res.course.language).toBe('English');
    expect(res.course.level).toBe('Intermediate');
    expect(res.course.provider).toBe('Udemy');
    expect(res.course.duration).toBe('40hr');

    const lesson1 = res.nodes.find((n) => n.title === 'Lesson 1: Welcome');
    const lesson2 = res.nodes.find((n) => n.title === 'Lesson 2: Setup');
    expect(lesson1.type).toBe('lesson');
    expect(lesson1.duration).toBe('12:30');
    expect(lesson2.duration).toBe('');
    // lesson is nested under its module
    const mod = res.nodes.find((n) => n.title === 'Module 1: Basics');
    expect(lesson1.parentId).toBe(mod.id);
  });

  it('defaults new fields to "" when the JSON omits them (old schema still works)', () => {
    const old = JSON.stringify({
      courseTitle: 'Old Course',
      platform: 'YouTube',
      structure: [{ title: 'Chapter 1', type: 'chapter' }],
    });
    const res = importCourseFromAiJson([], [], old);
    expect(res.ok).toBe(true);
    expect(res.course.description).toBe('');
    expect(res.course.language).toBe('');
    expect(res.course.level).toBe('');
    expect(res.nodes[0].duration).toBe('');
  });

  it('rejects non-string new fields', () => {
    const bad = JSON.stringify({ courseTitle: 'X', level: 3, structure: [] });
    const v = validateCourseAiJson(JSON.parse(bad));
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('"level"'))).toBe(true);

    const badNode = JSON.stringify({
      courseTitle: 'X',
      structure: [{ title: 'C1', type: 'chapter', duration: 42 }],
    });
    const v2 = validateCourseAiJson(JSON.parse(badNode));
    expect(v2.valid).toBe(false);
    expect(v2.errors.some((e) => e.includes('"duration"'))).toBe(true);
  });
});
