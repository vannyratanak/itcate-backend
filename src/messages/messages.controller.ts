import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { MessagesService } from './messages.service';
import { cleanPublicMessage, RateLimiter } from './message.validation';

@Controller('messages')
export class MessagesController {
  private readonly limiter = new RateLimiter(10, 60 * 60 * 1000);
  constructor(private readonly messages: MessagesService) {}

  // Public: contact / catering / gift card forms.
  @Post()
  create(@Body() body: unknown, @Req() req: any) {
    // nginx sends the real client IP in X-Real-IP; the backend itself only listens on localhost.
    const ip = String(req.headers?.['x-real-ip'] ?? req.headers?.['x-forwarded-for'] ?? req.ip ?? 'unknown').split(',')[0].trim();
    if (!this.limiter.allow(ip)) throw new HttpException('Too many messages, please try again later', HttpStatus.TOO_MANY_REQUESTS);
    return this.messages.create(cleanPublicMessage(body));
  }

  // ---- admin ----
  @Get()
  @UseGuards(AdminGuard)
  list(@Query() q: { kind?: string; status?: string; q?: string; page?: string }) {
    return this.messages.list(q);
  }

  @Get('unread-count')
  @UseGuards(AdminGuard)
  unread() {
    return this.messages.unreadCount();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.messages.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { status?: unknown }) {
    return this.messages.setStatus(id, body?.status);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.messages.remove(id);
  }
}
