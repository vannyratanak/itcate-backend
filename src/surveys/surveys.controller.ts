import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { CreateSurveyDto } from './dto/create-survey.dto';
import { SurveysService } from './surveys.service';

@Controller('surveys')
export class SurveysController {
  constructor(private readonly surveysService: SurveysService) {}

  // --- public: used by the survey form ---
  @Post()
  create(@Body() createSurveyDto: CreateSurveyDto) {
    return this.surveysService.create(createSurveyDto);
  }

  @Get('field')
  getField() {
    return this.surveysService.getFields();
  }

  // --- admin only (x-admin-key header): responses contain names and phone numbers ---
  @Get()
  @UseGuards(AdminGuard)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.surveysService.findAll(Number(page) || 1, Number(limit) || 20);
  }

  @Get('stats')
  @UseGuards(AdminGuard)
  stats() {
    return this.surveysService.stats();
  }

  @Get(':id')
  @UseGuards(AdminGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.surveysService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.surveysService.remove(id);
  }
}
