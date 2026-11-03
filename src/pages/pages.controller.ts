import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { PagesService } from './pages.service';

@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  // Admin: where the front end lives, so the editor can link to the real page.
  @Get('config')
  @UseGuards(AdminGuard)
  config() {
    return { frontend_url: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '') };
  }

  @Get()
  @UseGuards(AdminGuard)
  list() {
    return this.pages.list();
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: any) {
    return this.pages.create(body);
  }

  // Admin: the full page, including unpublished ones and the editor project.
  @Get(':slug/edit')
  @UseGuards(AdminGuard)
  edit(@Param('slug') slug: string) {
    return this.pages.getForEdit(slug);
  }

  // Public: what the front end renders (published pages only).
  @Get(':slug')
  show(@Param('slug') slug: string) {
    return this.pages.getPublic(slug);
  }

  @Put(':slug')
  @UseGuards(AdminGuard)
  save(@Param('slug') slug: string, @Body() body: any) {
    return this.pages.save(slug, body);
  }

  @Delete(':slug')
  @UseGuards(AdminGuard)
  remove(@Param('slug') slug: string) {
    return this.pages.remove(slug);
  }
}
