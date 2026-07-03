import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CompaniesService } from '../companies/companies.service';
import { validateImageValue } from '../common/image-validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(createBrandDto: CreateBrandDto) {
    await this.companiesService.ensureExists(createBrandDto.companyId);
    validateImageValue(createBrandDto.logo, 'logo');

    try {
      return await this.prisma.brand.create({
        data: createBrandDto,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una marca con ese nombre.');
      }

      throw error;
    }
  }

  async findByCompany(companyId: string) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.brand.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, updateBrandDto: UpdateBrandDto) {
    await this.findOneOrThrow(id);
    if (updateBrandDto.companyId) {
      await this.companiesService.ensureExists(updateBrandDto.companyId);
    }
    validateImageValue(updateBrandDto.logo, 'logo');

    return this.prisma.brand.update({
      where: { id },
      data: updateBrandDto,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.brand.delete({
      where: { id },
    });
  }

  async findOneOrThrow(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException('Marca no encontrada.');
    }

    return brand;
  }
}
