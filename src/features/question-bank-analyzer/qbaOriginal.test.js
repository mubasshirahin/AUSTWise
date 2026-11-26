import { describe, it, expect } from 'vitest';
import { collectQidRows, matchSourceFile, neededFilesFrom, overrideKey } from './qbaOriginal';

describe('matchSourceFile', () => {
  const provided = [{ name: '6__Spring_22__4_.pdf' }, { name: 'Photo 02.jpeg' }];

  it('matches exactly first', () => {
    expect(matchSourceFile('6__Spring_22__4_.pdf', provided)?.name).toBe('6__Spring_22__4_.pdf');
  });

  it('matches case-insensitively', () => {
    expect(matchSourceFile('6__spring_22__4_.PDF', provided)?.name).toBe('6__Spring_22__4_.pdf');
  });

  it('ignores spaces versus underscores', () => {
    const list = [{ name: 'My Paper 01.pdf' }];
    expect(matchSourceFile('My_Paper_01.pdf', list)?.name).toBe('My Paper 01.pdf');
  });

  it('returns null when missing', () => {
    expect(matchSourceFile('nope.pdf', provided)).toBeNull();
  });
});

describe('collectQidRows', () => {
  const data = {
    semesterPapers: [
      {
        semester: 'Spring 2022',
        questions: [
          { qid: '001', number: 1, exam: 'Final', marks: 10, source: '', sourceRegions: [] },
          { qid: '002', number: 2, exam: 'Final', marks: 10, source: '', sourceRegions: [] },
        ],
      },
      {
        semester: 'Fall 2022',
        questions: [
          { qid: '001', number: 3, exam: 'Final', marks: 10, source: '', sourceRegions: [] },
        ],
      },
    ],
  };

  it('collects every row using the QID across semesters', () => {
    const rows = collectQidRows(data, '001');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ semester: 'Spring 2022', n: 1 });
    expect(rows[1]).toMatchObject({ semester: 'Fall 2022', n: 3 });
  });

  it('accepts the full [QID: nnn] spelling', () => {
    expect(collectQidRows(data, '[QID: 002]')).toHaveLength(1);
  });

  it('returns nothing for an empty QID', () => {
    expect(collectQidRows(data, '')).toEqual([]);
  });
});

describe('overrideKey', () => {
  it('joins semester, number and region index', () => {
    expect(overrideKey('Spring 2022', 2, 1)).toBe('Spring 2022|2|1');
  });
});

describe('neededFilesFrom', () => {
  const answer = (files, source) => `---\ncourse: X\nfiles: [${files.join(', ')}]\n---\n| 1 | [QID: 001] | Final | 10 | ${source} :: p1 :: 0,0,1,1 |`;

  it('lists the files of the current answer only, not the last preview', () => {
    const names = neededFilesFrom([answer(['new.pdf'], 'new.pdf')], { files: ['old.pdf'] });
    expect(names).toEqual(['new.pdf']);
  });

  it('adds files that only a Source cell names', () => {
    const names = neededFilesFrom([answer(['a.pdf'], 'Fall 22 paper.pdf')], null);
    expect(names).toEqual(['a.pdf', 'Fall 22 paper.pdf']);
  });

  it('falls back to the saved files when there is no Markdown (History)', () => {
    expect(neededFilesFrom(['', '  '], { files: ['h.pdf'] })).toEqual(['h.pdf']);
  });
});
