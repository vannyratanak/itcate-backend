import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { Principal } from '../auth/auth-state.service';
import { StaffService } from './staff.service';

// Owner only (enforced by the guard's role matrix and again in the service).
@Controller('staff')
@UseGuards(AdminGuard)
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get() list(@Req() req: { user: Principal }) { return this.staff.list(req.user); }
  @Post() create(@Req() req: { user: Principal }, @Body() b: any) { return this.staff.create(req.user, b); }
  @Patch(':id') update(@Req() req: { user: Principal }, @Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.staff.update(req.user, id, b); }
  @Post(':id/reset-password') reset(@Req() req: { user: Principal }, @Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.staff.resetPassword(req.user, id, b); }
  @Delete(':id') remove(@Req() req: { user: Principal }, @Param('id', ParseIntPipe) id: number) { return this.staff.remove(req.user, id); }
}
