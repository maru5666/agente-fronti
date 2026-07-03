import { Body, Controller, Get, Post } from '@nestjs/common';
import { ChatDto } from './dto/chat.dto';
import { FrontiService } from './fronti.service';

@Controller('fronti')
export class FrontiController {
  constructor(private readonly frontiService: FrontiService) {}

  @Post('chat')
  chat(@Body() chatDto: ChatDto) {
    return this.frontiService.chat(chatDto);
  }

  @Get('skills')
  skills() {
    return this.frontiService.listSkills();
  }
}
