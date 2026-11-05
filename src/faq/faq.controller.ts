import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { FaqService } from './faq.service';

@Controller('faq')
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  // Public: active questions in display order.
  @Get()
  list() {
    return this.faq.listActive();
  }

  // Admin: includes hidden questions (declared before ':id').
  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.faq.listAll();
  }

  @Patch('reorder')
  @UseGuards(AdminGuard)
  reorder(@Body() body: { ids?: number[] }) {
    return this.faq.reorder(body?.ids);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: any) {
    return this.faq.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.faq.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.faq.remove(id);
  }
}
