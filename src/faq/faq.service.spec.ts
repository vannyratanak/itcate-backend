import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FaqService } from './faq.service';

const makePrisma = () => {
  const rows = [{ id: 1 }, { id: 2 }];
  const faq: any = {
    findMany: async () => rows,
    findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
    aggregate: async () => ({ _max: { sort_order: 2 } }),
    create: async ({ data }: any) => ({ id: 3, ...data }),
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    delete: async () => ({}),
  };
  return { faq, $transaction: async (ops: any[]) => Promise.all(ops) } as any;
};

describe('FaqService', () => {
  const svc = () => new FaqService(makePrisma());

  it('creates a trimmed FAQ at the end of the list', async () => {
    const r = await svc().create({ question_en: ' Parking? ', answer_en: ' Yes. ', question_kh: '', answer_kh: undefined });
    expect(r).toMatchObject({ question_en: 'Parking?', answer_en: 'Yes.', question_kh: null, sort_order: 3 });
  });

  it('requires English question and answer', async () => {
    await expect(svc().create({ question_en: '', answer_en: 'x' })).rejects.toThrow(BadRequestException);
    await expect(svc().create({ question_en: 'x' })).rejects.toThrow(BadRequestException);
    await expect(svc().create({ question_en: 'x'.repeat(301), answer_en: 'y' })).rejects.toThrow(BadRequestException);
  });

  it('updates only what is sent, 404s on unknown ids', async () => {
    await expect(svc().update(1, { active: false })).resolves.toMatchObject({ active: false });
    await expect(svc().update(1, { active: 'no' })).rejects.toThrow(BadRequestException);
    await expect(svc().update(9, { active: true })).rejects.toThrow(NotFoundException);
    await expect(svc().remove(9)).rejects.toThrow(NotFoundException);
  });

  it('reorder needs every id exactly once', async () => {
    await expect(svc().reorder([1])).rejects.toThrow(BadRequestException);
    await expect(svc().reorder([2, 1])).resolves.toEqual({ ids: [2, 1] });
  });
});
