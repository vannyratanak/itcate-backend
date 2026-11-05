import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ReviewsService } from './reviews.service';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  // Public
  @Get()
  list() {
    return this.reviews.listPublic();
  }

  @Get('summary')
  summary() {
    return this.reviews.summary();
  }

  // Admin
  @Get('all')
  @UseGuards(AdminGuard)
  listAll(@Query('approved') approved?: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.reviews.listAll(approved, Number(page) || 1, Number(limit) || 20);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  setApproved(@Param('id', ParseIntPipe) id: number, @Body() body: { approved?: boolean }) {
    return this.reviews.setApproved(id, body?.approved);
  }
}
