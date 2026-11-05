import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { sanitizeHtml, safeUrl } from './sanitize-html';

const LIST_SELECT = { id: true, slug: true, title_en: true, title_kh: true, excerpt_en: true, excerpt_kh: true, cover_url: true, published_at: true } as const;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const slugify = (title: string) =>
  title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '') || 'post';

function str(v: unknown, field: string, max: number, required = false): string | null | undefined {
  if (v === undefined) return required ? (() => { throw new BadRequestException(`${field} is required`); })() : undefined;
  if (v === null || v === '') { if (required) throw new BadRequestException(`${field} is required`); return null; }
  if (typeof v !== 'string') throw new BadRequestException(`${field} must be text`);
  const t = v.trim();
  if (!t && required) throw new BadRequestException(`${field} is required`);
  if (t.length > max) throw new BadRequestException(`${field} is too long (max ${max} characters)`);
  return t || null;
}

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- public ----------
  async listPublic(page = 1, limit = 9) {
    const take = Math.min(Math.max(Math.trunc(limit) || 9, 1), 24);
    const pg = Math.max(Math.trunc(page) || 1, 1);
    const where = { published: true };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({ where, orderBy: [{ published_at: 'desc' }, { id: 'desc' }], skip: (pg - 1) * take, take, select: LIST_SELECT }),
    ]);
    return { items, total, page: pg, limit: take, pages: Math.ceil(total / take) };
  }

  async getPublic(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, published: true },
      select: { ...LIST_SELECT, html_en: true, html_kh: true },
    });
    if (!post) throw new NotFoundException('post not found');
    return post;
  }

  // ---------- admin ----------
  listAll() {
    return this.prisma.blogPost.findMany({
      orderBy: [{ created_at: 'desc' }],
      select: { ...LIST_SELECT, published: true, created_at: true, updated_at: true },
    });
  }

  async getById(id: number) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('post not found');
    return post;
  }

  private async uniqueSlug(base: string, ignoreId?: number) {
    let slug = base, n = 1;
    while (await this.prisma.blogPost.findFirst({ where: { slug, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) }, select: { id: true } })) {
      n += 1; slug = `${base.slice(0, 74)}-${n}`;
    }
    return slug;
  }

  private cover(v: unknown) {
    if (v === undefined) return undefined;
    if (v === null || v === '') return null;
    if (typeof v !== 'string') throw new BadRequestException('cover_url is invalid');
    const u = safeUrl(v, { mailto: false });
    if (!u || u.length > 500) throw new BadRequestException('cover_url is invalid');
    return u;
  }

  private fields(body: any, creating: boolean) {
    if (!body || typeof body !== 'object') throw new BadRequestException('body is required');
    const data: Record<string, any> = {};
    const set = (k: string, v: unknown) => { if (v !== undefined) data[k] = v; };
    set('title_en', str(body.title_en, 'title_en', 200, creating || body.title_en !== undefined));
    set('title_kh', str(body.title_kh, 'title_kh', 200));
    set('excerpt_en', str(body.excerpt_en, 'excerpt_en', 500));
    set('excerpt_kh', str(body.excerpt_kh, 'excerpt_kh', 500));
    set('cover_url', this.cover(body.cover_url));
    if (body.html_en !== undefined) {
      if (typeof body.html_en !== 'string' || body.html_en.length > 100_000) throw new BadRequestException('html_en is invalid (max 100,000 characters)');
      data.html_en = sanitizeHtml(body.html_en);
    }
    if (body.html_kh !== undefined) {
      if (body.html_kh !== null && (typeof body.html_kh !== 'string' || body.html_kh.length > 100_000)) throw new BadRequestException('html_kh is invalid (max 100,000 characters)');
      data.html_kh = body.html_kh ? sanitizeHtml(body.html_kh) || null : null;
    }
    if (body.published !== undefined) {
      if (typeof body.published !== 'boolean') throw new BadRequestException('published must be true or false');
      data.published = body.published;
    }
    if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
      const s = String(body.slug).trim().toLowerCase();
      if (!SLUG_RE.test(s) || s.length > 80) throw new BadRequestException('slug may only contain lowercase letters, numbers and hyphens');
      data.slug = s;
    }
    return data;
  }

  async create(body: any) {
    const data = this.fields(body, true);
    const slug = await this.uniqueSlug(data.slug ?? slugify(data.title_en));
    return this.prisma.blogPost.create({
      data: { ...data, slug, published_at: data.published ? new Date() : null } as any,
    });
  }

  async update(id: number, body: any) {
    const current = await this.getById(id);
    const data = this.fields(body, false);
    if (data.slug && data.slug !== current.slug) data.slug = await this.uniqueSlug(data.slug, id);
    else delete data.slug;
    if (data.published === true && !current.published_at) data.published_at = new Date();
    return this.prisma.blogPost.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.getById(id);
    await this.prisma.blogPost.delete({ where: { id } });
    return { deleted: id };
  }
}
