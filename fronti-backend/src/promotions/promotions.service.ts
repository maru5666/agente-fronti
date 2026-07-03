import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly productsService: ProductsService,
  ) {}

  async create(createPromotionDto: CreatePromotionDto) {
    await this.validatePromotionData(createPromotionDto);

    return this.prisma.promotion.create({
      data: {
        ...createPromotionDto,
        startDate: new Date(createPromotionDto.startDate),
        endDate: new Date(createPromotionDto.endDate),
      },
      include: { product: true },
    });
  }

  async findActive(companyId: string, limit?: number) {
    await this.companiesService.ensureExists(companyId);

    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        companyId,
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: { product: true },
      orderBy: { endDate: 'asc' },
      take: limit,
    });
  }

  async update(id: string, updatePromotionDto: UpdatePromotionDto) {
    const current = await this.findOneOrThrow(id);
    const nextCompanyId = updatePromotionDto.companyId ?? current.companyId;

    await this.validatePromotionData({
      companyId: nextCompanyId,
      productId:
        updatePromotionDto.productId === undefined
          ? current.productId ?? undefined
          : updatePromotionDto.productId,
      startDate:
        updatePromotionDto.startDate ?? current.startDate.toISOString(),
      endDate: updatePromotionDto.endDate ?? current.endDate.toISOString(),
    });

    return this.prisma.promotion.update({
      where: { id },
      data: {
        ...updatePromotionDto,
        startDate: updatePromotionDto.startDate
          ? new Date(updatePromotionDto.startDate)
          : undefined,
        endDate: updatePromotionDto.endDate
          ? new Date(updatePromotionDto.endDate)
          : undefined,
      },
      include: { product: true },
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findOneOrThrow(id: string) {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      throw new NotFoundException('Promocion no encontrada.');
    }

    return promotion;
  }

  private async validatePromotionData(data: {
    companyId: string;
    productId?: string | null;
    startDate: string;
    endDate: string;
  }) {
    await this.companiesService.ensureExists(data.companyId);

    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new BadRequestException(
        'La fecha de inicio no puede ser posterior a la fecha de fin.',
      );
    }

    if (data.productId) {
      const product = await this.productsService.findOneOrThrow(data.productId);
      if (product.companyId !== data.companyId) {
        throw new BadRequestException(
          'El producto no pertenece a la empresa indicada.',
        );
      }
    }
  }
}
