import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { OfferDto, OffersService } from './offers.service';

@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  // Public: what the website shows (active, not expired).  GET /offers?kind=offer|event
  @Get()
  list(@Query('kind') kind?: string) {
    return this.offers.listPublic(kind);
  }

  // ---- admin ----
  @Get('all')
  @UseGuards(AdminGuard)
  listAll() {
    return this.offers.listAll();
  }

  @Patch('reorder')
  @UseGuards(AdminGuard)
  reorder(@Body() body: { kind?: string; ids?: number[] }) {
    return this.offers.reorder(body?.kind, body?.ids);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: OfferDto) {
    return this.offers.create(dto ?? {});
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: OfferDto) {
    return this.offers.update(id, dto ?? {});
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.offers.remove(id);
  }
}
