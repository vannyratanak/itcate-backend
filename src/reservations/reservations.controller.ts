import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ReservationsService } from './reservations.service';

// Static routes are declared before ':id'.
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly svc: ReservationsService) {}

  // ---- public ----
  @Get('availability')
  availability(@Query('date') date: string, @Query('party') party?: string) {
    return this.svc.availability(date, Number(party) || undefined);
  }

  @Post()
  create(@Body() body: unknown, @Req() req: any) {
    const ip = String(req.headers['x-real-ip'] ?? req.headers['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();
    return this.svc.create(body, ip);
  }

  // ---- admin ----
  @Get('blocked') @UseGuards(AdminGuard)
  blocked() { return this.svc.blocked(); }

  @Post('blocked') @UseGuards(AdminGuard)
  block(@Body() body: unknown) { return this.svc.block(body); }

  @Delete('blocked/:id') @UseGuards(AdminGuard)
  unblock(@Param('id', ParseIntPipe) id: number) { return this.svc.unblock(id); }

  @Get('calendar') @UseGuards(AdminGuard)
  calendar(@Query('month') month: string) { return this.svc.calendar(month); }

  @Get() @UseGuards(AdminGuard)
  list(@Query() q: { status?: string; from?: string; to?: string; page?: string; limit?: string }) { return this.svc.list(q); }

  @Get(':id') @UseGuards(AdminGuard)
  get(@Param('id', ParseIntPipe) id: number) { return this.svc.get(id); }

  @Patch(':id') @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: unknown) { return this.svc.update(id, body); }

  @Delete(':id') @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}
