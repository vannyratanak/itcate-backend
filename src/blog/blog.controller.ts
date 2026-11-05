import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { BlogService } from './blog.service';

@Controller('blog')
export class BlogController {
  constructor(private readonly blog: BlogService) {}

  // ---- admin (two-segment paths, so they never collide with /blog/:slug) ----
  @Get('all/list')
  @UseGuards(AdminGuard)
  listAll() { return this.blog.listAll(); }

  @Get('id/:id')
  @UseGuards(AdminGuard)
  byId(@Param('id', ParseIntPipe) id: number) { return this.blog.getById(id); }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: any) { return this.blog.create(body); }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.blog.update(id, body); }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) { return this.blog.remove(id); }

  // ---- public ----
  @Get()
  list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.blog.listPublic(Number(page) || 1, Number(limit) || 9);
  }

  @Get(':slug')
  show(@Param('slug') slug: string) { return this.blog.getPublic(slug); }
}
