import { Injectable, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(createBranchDto: CreateBranchDto) {
    await this.companiesService.ensureExists(createBranchDto.companyId);

    return this.prisma.$transaction(async (tx) => {
      if (createBranchDto.isMain) {
        await tx.companyBranch.updateMany({
          where: { companyId: createBranchDto.companyId },
          data: { isMain: false },
        });
      }

      return tx.companyBranch.create({
        data: createBranchDto,
      });
    });
  }

  async findByCompany(companyId: string, onlyActive = true) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.companyBranch.findMany({
      where: {
        companyId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async update(id: string, updateBranchDto: UpdateBranchDto) {
    const branch = await this.findOneOrThrow(id);

    if (updateBranchDto.companyId) {
      await this.companiesService.ensureExists(updateBranchDto.companyId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (updateBranchDto.isMain) {
        await tx.companyBranch.updateMany({
          where: {
            companyId: updateBranchDto.companyId ?? branch.companyId,
            id: { not: id },
          },
          data: { isMain: false },
        });
      }

      return tx.companyBranch.update({
        where: { id },
        data: updateBranchDto,
      });
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.companyBranch.update({
      where: { id },
      data: { isActive: false, isMain: false },
    });
  }

  async findOneOrThrow(id: string) {
    const branch = await this.prisma.companyBranch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Sucursal no encontrada.');
    }

    return branch;
  }
}
