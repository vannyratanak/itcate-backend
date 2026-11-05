import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  // Public: contact details, opening hours and the notice banner.
  @Get()
  get() {
    return this.settings.get();
  }

  @Put()
  @UseGuards(AdminGuard)
  update(@Body() body: any) {
    return this.settings.update(body);
  }
}
