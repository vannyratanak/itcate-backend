import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// Slugs that the front end already uses for its own routes.
const RESERVED = new Set(['survey', 'survey-user', 'survey-success', 'menu', 'api', 'admin', 'uploads', '_next', 'p', 'home-page']);
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX = { html: 500_000, css: 300_000, project: 3_000_000 };

// Defence in depth: pages are written by an admin, but they are shown to every visitor, so strip
// anything that could run script even if the editor's own filtering is bypassed.
export function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, '')
    .replace(/<\/?(html|head|body)\b[^>]*>/gi, '')
    .replace(/<(object|embed|base|meta|link)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\b(href|src|xlink:href|action|formaction)\s*=\s*("|')\s*(javascript|data:text\/html|vbscript):[^"']*\2/gi, '$1=$2#$2');
}
export function cleanCss(css: string) {
  return css.replace(/<\/?style[^>]*>/gi, '').replace(/expression\s*\(/gi, '(').replace(/@import[^;]*;?/gi, '').replace(/javascript:/gi, '');
}

@Injectable()
export class PagesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.page.findMany({ select: { id: true, slug: true, title: true, published: true, updated_at: true }, orderBy: { updated_at: 'desc' } });
  }

  async getPublic(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page || !page.published) throw new NotFoundException('page not found');
    return { slug: page.slug, title: page.title, html: page.html, css: page.css, updated_at: page.updated_at };
  }

  async getForEdit(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('page not found');
    return page;
  }

  async create(dto: { slug?: string; title?: string }) {
    const slug = typeof dto?.slug === 'string' ? dto.slug.trim().toLowerCase() : '';
    const title = typeof dto?.title === 'string' ? dto.title.trim() : '';
    if (!title || title.length > 120) throw new BadRequestException('title is required (max 120 characters)');
    if (!SLUG.test(slug) || slug.length > 60) throw new BadRequestException('The address can only use lowercase letters, numbers and dashes (max 60)');
    if (RESERVED.has(slug)) throw new BadRequestException(`"${slug}" is already used by the site, pick another address`);
    if (await this.prisma.page.findUnique({ where: { slug } })) throw new ConflictException(`A page at /${slug} already exists`);
    return this.prisma.page.create({ data: { slug, title } });
  }

  async save(slug: string, dto: { title?: string; project?: unknown; html?: string; css?: string; published?: boolean }) {
    await this.getForEdit(slug);
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (typeof dto.title !== 'string' || !dto.title.trim() || dto.title.length > 120) throw new BadRequestException('title is required (max 120 characters)');
      data.title = dto.title.trim();
    }
    if (dto.html !== undefined) {
      if (typeof dto.html !== 'string' || dto.html.length > MAX.html) throw new BadRequestException('html is too large');
      data.html = cleanHtml(dto.html);
    }
    if (dto.css !== undefined) {
      if (typeof dto.css !== 'string' || dto.css.length > MAX.css) throw new BadRequestException('css is too large');
      data.css = cleanCss(dto.css);
    }
    if (dto.project !== undefined) {
      if (dto.project !== null && (typeof dto.project !== 'object' || JSON.stringify(dto.project).length > MAX.project)) throw new BadRequestException('project is invalid or too large');
      data.project = dto.project === null ? undefined : dto.project;
    }
    if (dto.published !== undefined) {
      if (typeof dto.published !== 'boolean') throw new BadRequestException('published must be a boolean');
      data.published = dto.published;
    }
    return this.prisma.page.update({ where: { slug }, data });
  }

  async remove(slug: string) {
    await this.getForEdit(slug);
    await this.prisma.page.delete({ where: { slug } });
    return { slug };
  }
}
