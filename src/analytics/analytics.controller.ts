import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminGuard } from '../auth/admin.guard';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
@UseGuards(AdminGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  overview() { return this.analytics.overview(); }

  @Get('survey')
  survey(@Query('from') from?: string, @Query('to') to?: string) { return this.analytics.survey(from, to); }

  @Get('survey.csv')
  async surveyCsv(@Query('from') from: string | undefined, @Query('to') to: string | undefined, @Res({ passthrough: true }) res: Response) {
    const { filename, body } = await this.analytics.surveyCsv(from, to);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return body;
  }
}
