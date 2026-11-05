import { AnalyticsService } from './analytics.service';

// Minimal fake Prisma: one scale of 5 options, two questions, three responses.
const options = ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'].map((n, i) => ({ option_id: i + 1, option: { name_en: n, name_kh: null } }));
const prisma: any = {
  menuQuestion: { findMany: async () => [1, 2].map((id) => ({ id, name_en: `Q${id}`, name_kh: null, group_option: { options } })) },
  survayer: {
    findMany: async () => [
      { id: 1, created_at: new Date('2026-11-04T10:00:00Z'), name: '=EVIL()', phoneNumber: '+85512', usedToVisit: true, survayOption: [{ menu_id: 1, option_id: 1 }, { menu_id: 2, option_id: 5 }], survayMessage: [{ message: 'nice, "food"' }] },
      { id: 2, created_at: new Date('2026-11-05T10:00:00Z'), name: 'B', phoneNumber: '1', usedToVisit: false, survayOption: [{ menu_id: 1, option_id: 5 }, { menu_id: 2, option_id: 5 }], survayMessage: [] },
    ],
    count: async () => 1,
  },
  survayerOption: { groupBy: async () => [{ menu_id: 1, option_id: 1, _count: { _all: 1 } }, { menu_id: 1, option_id: 5, _count: { _all: 1 } }, { menu_id: 2, option_id: 5, _count: { _all: 2 } }] },
};

describe('AnalyticsService', () => {
  const svc = new AnalyticsService(prisma);
  it('computes per-question distribution, averages and the low-score flag', async () => {
    const r = await svc.survey('2026-11-01', '2026-11-05');
    expect(r.total).toBe(2);
    const [q1, q2] = r.questions;
    expect(q1.average).toBe(3);            // (5 + 1) / 2
    expect(q1.low).toBe(false);
    expect(q2.average).toBe(1);            // both Strongly Disagree
    expect(q2.low).toBe(true);
    expect(q1.scale.map((o) => o.count)).toEqual([1, 0, 0, 0, 1]);
    expect(q1.scale[0].pct).toBe(50);
    expect(r.overallAverage).toBe(2);      // (5 + 1 + 1 + 1) / 4 answers
  });
  it('writes a safe CSV', async () => {
    const { body, filename } = await svc.surveyCsv('2026-11-01', '2026-11-05');
    expect(filename).toBe('survey-2026-11-01_2026-11-05.csv');
    const lines = body.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toBe('id,date,name,phone,used_to_visit,Q1,Q2,comment');
    expect(lines[1]).toContain("'=EVIL()");
    expect(lines[1]).toContain("'+85512");
    expect(lines[1]).toContain('"nice, ""food"""');
  });
});
