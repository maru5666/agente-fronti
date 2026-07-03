import { BadRequestException, Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CompaniesService } from '../companies/companies.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async create(createSaleDto: CreateSaleDto) {
    await this.companiesService.ensureExists(createSaleDto.companyId);

    const productIds = createSaleDto.items.map((item) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];

    if (productIds.length !== uniqueProductIds.length) {
      throw new BadRequestException(
        'No repitas productos en la misma venta. Agrupa las cantidades.',
      );
    }

    const usdRate = await this.exchangeRateService.getCurrentUsdRateDecimal();

    return this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: {
          id: { in: uniqueProductIds },
          companyId: createSaleDto.companyId,
          isActive: true,
        },
      });

      if (products.length !== uniqueProductIds.length) {
        throw new BadRequestException(
          'Uno o más productos no existen o no pertenecen a esta empresa.',
        );
      }

      const productMap = new Map(
        products.map((product) => [product.id, product]),
      );

      let totalUsd = new Decimal(0);
      let totalBs = new Decimal(0);

      const saleItems = createSaleDto.items.map((item) => {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new BadRequestException('Producto no encontrado.');
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`,
          );
        }

        const quantity = new Decimal(item.quantity);
        const subtotalUsd = product.priceUsd.mul(quantity);
        const unitPriceBs = this.exchangeRateService.usdToBs(
          product.priceUsd,
          usdRate,
        );
        const subtotalBs = unitPriceBs.mul(quantity).toDecimalPlaces(2);
        totalUsd = totalUsd.add(subtotalUsd);
        totalBs = totalBs.add(subtotalBs);

        return {
          productId: product.id,
          quantity: item.quantity,
          unitPriceUsd: product.priceUsd,
          unitPriceBs,
          subtotalUsd,
          subtotalBs,
        };
      });

      for (const item of createSaleDto.items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count !== 1) {
          const product = productMap.get(item.productId);
          throw new BadRequestException(
            `Stock insuficiente para ${product?.name ?? 'el producto seleccionado'}.`,
          );
        }
      }

      return tx.sale.create({
        data: {
          companyId: createSaleDto.companyId,
          totalUsd,
          totalBs,
          items: {
            create: saleItems,
          },
        },
        include: {
          items: {
            include: { product: true },
          },
        },
      });
    });
  }

  async findByCompany(companyId: string) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.sale.findMany({
      where: { companyId },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTodaySummary(companyId: string) {
    await this.companiesService.ensureExists(companyId);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [sales, totals] = await Promise.all([
      this.prisma.sale.count({
        where: {
          companyId,
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.sale.aggregate({
        where: {
          companyId,
          createdAt: { gte: start, lte: end },
        },
        _sum: {
          totalUsd: true,
          totalBs: true,
        },
      }),
    ]);

    return {
      sales,
      totalUsd: totals._sum.totalUsd ?? new Decimal(0),
      totalBs: totals._sum.totalBs ?? new Decimal(0),
    };
  }
}
