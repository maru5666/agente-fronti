import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  imports: [CompaniesModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
