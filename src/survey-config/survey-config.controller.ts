import { Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SurveyConfigService } from './survey-config.service';

// Admin-only editing of the survey form: questions and the answer scales they offer.
// (Reading stays on the public GET /surveys/field the front end already uses.)
@Controller('survey-config')
@UseGuards(AdminGuard)
export class SurveyConfigController {
  constructor(private readonly svc: SurveyConfigService) {}

  // Declared before ':id' routes so "reorder" isn't parsed as an id.
  @Patch('questions/reorder') reorderQuestions(@Body() b: { group_option_id?: number; ids?: number[] }) { return this.svc.reorderQuestions(b?.group_option_id as number, b?.ids); }
  @Patch('scales/reorder') reorderScales(@Body() b: { ids?: number[] }) { return this.svc.reorderScales(b?.ids); }

  @Post('questions') createQuestion(@Body() b: any) { return this.svc.createQuestion(b); }
  @Patch('questions/:id') updateQuestion(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateQuestion(id, b); }
  @Delete('questions/:id') removeQuestion(@Param('id', ParseIntPipe) id: number) { return this.svc.removeQuestion(id); }

  @Post('scales') createScale(@Body() b: any) { return this.svc.createScale(b); }
  @Patch('scales/:id') updateScale(@Param('id', ParseIntPipe) id: number, @Body() b: any) { return this.svc.updateScale(id, b); }
  @Delete('scales/:id') removeScale(@Param('id', ParseIntPipe) id: number) { return this.svc.removeScale(id); }
}
