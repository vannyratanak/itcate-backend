import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { ShopService } from './shop.service';

@Controller('shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Get()
  get() {
    return this.shop.get();
  }

  @Put()
  @UseGuards(AdminGuard)
  update(@Body() body: { name?: string; title?: string; logo_url?: string | null }) {
    return this.shop.update(body);
  }
}
