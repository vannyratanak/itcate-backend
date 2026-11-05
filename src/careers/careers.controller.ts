import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CareersService } from './careers.service';

@Controller('careers')
export class CareersController {
  constructor(private readonly careers: CareersService) {}

  // ---- public ----
  @Get()
  list() {
    return this.careers.listActive();
  }

  @Post('apply')
  apply(@Body() body: unknown, @Req() req: any) {
    // nginx forwards the real client address in X-Forwarded-For
    const ip = String(req.headers?.['x-forwarded-for'] ?? req.ip ?? '').split(',')[0].trim();
    return this.careers.apply(body, ip);
  }

  // ---- admin ----
  @Get('all')
  @UseGuards(AdminGuard)
  all() {
    return this.careers.listAll();
  }

  @Patch('reorder')
  @UseGuards(AdminGuard)
  reorder(@Body() body: { ids?: number[] }) {
    return this.careers.reorder(body?.ids);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() body: unknown) {
    return this.careers.create(body);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) {
    return this.careers.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.careers.remove(id);
  }
}
