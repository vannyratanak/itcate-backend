import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GalleryService, isImageUrl } from './gallery.service';

const makePrisma = () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const galleryImage: any = {
    findMany: async () => rows,
    findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
    aggregate: async () => ({ _max: { sort_order: 3 } }),
    create: async ({ data }: any) => ({ id: 4, ...data }),
    update: async ({ where, data }: any) => ({ id: where.id, ...data }),
    delete: async () => ({}),
  };
  return { galleryImage, $transaction: async (ops: any[]) => Promise.all(ops) } as any;
};

describe('GalleryService', () => {
  const svc = () => new GalleryService(makePrisma());

  it('accepts upload paths and http(s) links only', () => {
    expect(isImageUrl('/uploads/abc123.png')).toBe(true);
    expect(isImageUrl('https://example.com/a.jpg')).toBe(true);
    expect(isImageUrl('javascript:alert(1)')).toBe(false);
    expect(isImageUrl('/uploads/../etc/passwd')).toBe(false);
    expect(isImageUrl(42)).toBe(false);
  });

  it('creates with trimmed captions and the next sort order', async () => {
    const r = await svc().create({ url: '/uploads/a.png', caption_en: '  Tacos  ', caption_kh: '' });
    expect(r).toMatchObject({ url: '/uploads/a.png', caption_en: 'Tacos', caption_kh: null, sort_order: 4 });
  });

  it('rejects bad input', async () => {
    await expect(svc().create({ url: 'nope' })).rejects.toThrow(BadRequestException);
    await expect(svc().create({ url: '/uploads/a.png', caption_en: 'x'.repeat(201) })).rejects.toThrow(BadRequestException);
    await expect(svc().update(1, { active: 'yes' })).rejects.toThrow(BadRequestException);
    await expect(svc().update(1, {})).rejects.toThrow(BadRequestException);
  });

  it('404s on unknown ids', async () => {
    await expect(svc().update(99, { active: false })).rejects.toThrow(NotFoundException);
    await expect(svc().remove(99)).rejects.toThrow(NotFoundException);
  });

  it('reorder needs every id exactly once', async () => {
    await expect(svc().reorder([1, 2])).rejects.toThrow(BadRequestException);
    await expect(svc().reorder([1, 1, 2])).rejects.toThrow(BadRequestException);
    await expect(svc().reorder([3, 2, 1])).resolves.toEqual({ ids: [3, 2, 1] });
  });
});
