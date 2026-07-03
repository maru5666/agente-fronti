import { Controller, Get, Post } from '@nestjs/common';
import { BcvService } from './bcv.service';

@Controller('bcv')
export class BcvController {
  constructor(private readonly bcvService: BcvService) {}

  @Get('latest')
  latest() {
    return this.bcvService.getLatest();
  }

  @Post('sync')
  sync() {
    return this.bcvService.sync();
  }
}
