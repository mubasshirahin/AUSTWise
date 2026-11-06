import { describe, it, expect } from 'vitest';
import { buildHeatmapView, MAX_VISIBLE_BATCHES } from './deptHeatmapStorage';

// 5 contributors per batch — the minimum needed for a batch to appear
const subsFor = (n, count = 5) =>
  Array.from({ length: count }, (_, i) => ({
    contributorId: `u${n}-${i}`,
    department: 'CSE',
    batchNo: String(n),
    batchLabel: `Quanta ${n}`,
    semesters: { 1: 3.5, 2: 3.2 },
  }));

describe('buildHeatmapView batch order + cap', () => {
  it('sorts recent batch first (53 before 52) and caps at MAX_VISIBLE_BATCHES', () => {
    const subs = [49, 53, 51, 52, 50, 48, 47, 46, 45, 44, 43, 42].flatMap((n) => subsFor(n));
    const v = buildHeatmapView('CSE', subs);
    expect(MAX_VISIBLE_BATCHES).toBe(10);
    expect(v.visibleBatches.map((b) => b.batchNo)).toEqual(
      ['53', '52', '51', '50', '49', '48', '47', '46', '45', '44']
    );
    expect(v.visibleBatches.length).toBe(10);
    expect(v.totalBatches).toBe(12);
  });

  it('only shows batches with submitted CGPA for the selected department', () => {
    const subs = [...subsFor(53), ...subsFor(52).map((s) => ({ ...s, department: 'EEE' }))];
    const v = buildHeatmapView('CSE', subs);
    expect(v.visibleBatches.map((b) => b.batchNo)).toEqual(['53']);
  });

  it('hides a batch until 5 students from it have submitted', () => {
    const v = buildHeatmapView('CSE', subsFor(53, 4));
    expect(v.visibleBatches).toEqual([]);
    expect(v.pendingBatches.map((b) => b.batchNo)).toEqual(['53']);
    const v5 = buildHeatmapView('CSE', subsFor(53, 5));
    expect(v5.visibleBatches.map((b) => b.batchNo)).toEqual(['53']);
    expect(v5.visibleBatches[0].cells[0]).toBe(3.5);
  });
});
