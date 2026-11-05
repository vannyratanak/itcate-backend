import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { GalleryService } from './gallery.service';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly gallery: GalleryService) {}

  // Public: active images in display order.
  @Get()
  list() {
    return this.gallery.listActive();
  }

  // Admin: includes hidden images (declared before ':id').
  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.gallery.listAll();
  }

  @Patch('reorder')
  @UseGuards(AdminGuard)
  reorder(@Body() body: { ids?: number[] }) {
    return this.gallery.reorder(body?.ids);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: any) {
    return this.gallery.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.gallery.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.gallery.remove(id);
  }
}
