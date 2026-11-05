import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ReviewsService, firstName, meanScore, positionScore } from './reviews.service';

describe('score mapping', () => {
  it('maps a 5-point scale best -> worst to 5..1', () => {
    expect([0, 1, 2, 3, 4].map((i) => positionScore(i, 5))).toEqual([5, 4, 3, 2, 1]);
  });
  it('scales other sizes into 1..5', () => {
    expect(positionScore(0, 4)).toBe(5);
    expect(positionScore(3, 4)).toBe(1);
  });
  it('is null for degenerate scales', () => {
    expect(positionScore(0, 1)).toBeNull();
    expect(positionScore(5, 5)).toBeNull();
  });
  it('averages and ignores unknowns', () => {
    expect(meanScore([5, 4, null])).toBe(4.5);
    expect(meanScore([null])).toBeNull();
    expect(meanScore([5, 4, 4])).toBe(4.3);
  });
});

describe('privacy + validation', () => {
  it('only keeps the first name', () => {
    expect(firstName('  Sokha  Chan Dara ')).toBe('Sokha');
    expect(firstName('')).toBe('');
  });
  const fake: any = { survayerMessage: { findUnique: async ({ where }: any) => (where.id === 1 ? { id: 1, message: 'Great!' } : where.id === 2 ? { id: 2, message: '  ' } : null), update: async () => ({}) } };
  const svc = new ReviewsService(fake);
  it('approves an existing comment', async () => {
    expect(await svc.setApproved(1, true)).toEqual({ id: 1, approved: true });
  });
  it('rejects bad input', async () => {
    await expect(svc.setApproved(1, 'yes')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setApproved(2, true)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setApproved(99, true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.listAll('maybe')).rejects.toBeInstanceOf(BadRequestException);
  });
});
