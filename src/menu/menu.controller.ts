import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { MenuService } from './menu.service';

@Controller('menu')
export class MenuController {
  constructor(private readonly menu: MenuService) {}

  // Public: what the front end displays.
  @Get()
  list() {
    return this.menu.listActive();
  }

  // Admin: includes hidden items.
  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.menu.listAll();
  }

  // Categories (declared before the ':id' routes).
  @Get('categories')
  categories() {
    return this.menu.listCategories();
  }

  @Patch('categories/reorder')
  @UseGuards(AdminGuard)
  reorderCategories(@Body() body: { ids?: number[] }) {
    return this.menu.reorderCategories(body?.ids);
  }

  @Post('categories')
  @UseGuards(AdminGuard)
  createCategory(@Body() body: any) {
    return this.menu.createCategory(body);
  }

  @Patch('categories/:id')
  @UseGuards(AdminGuard)
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.menu.updateCategory(id, body);
  }

  @Delete('categories/:id')
  @UseGuards(AdminGuard)
  removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.menu.removeCategory(id);
  }

  @Patch('reorder')
  @UseGuards(AdminGuard)
  reorder(@Body() body: { category_id?: number; ids?: number[] }) {
    return this.menu.reorder(body?.category_id, body?.ids);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: any) {
    return this.menu.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.menu.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menu.remove(id);
  }
}
