import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { CompaniesService } from '../companies/companies.service';
import { validateImageGallery, validateImageValue } from '../common/image-validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly configService: ConfigService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    await this.companiesService.ensureExists(createProductDto.companyId);
    await this.ensureBrandBelongsToCompany(
      createProductDto.brandId,
      createProductDto.companyId,
    );
    this.validateProductImages(createProductDto);
    const optimizedPayload = await this.persistProductImages(createProductDto);

    return this.prisma.product.create({
      data: {
        ...optimizedPayload,
        currencyBase: 'USD',
      },
      include: this.productInclude,
    });
  }

  async findByCompany(companyId: string, limit?: number) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.product.findMany({
      where: { companyId },
      include: this.productInclude,
      orderBy: { name: 'asc' },
      take: limit,
    });
  }

  async search(companyId: string, query?: string) {
    await this.companiesService.ensureExists(companyId);

    if (!query?.trim()) {
      throw new BadRequestException('El parámetro query es requerido.');
    }

    return this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: query.trim(), mode: 'insensitive' } },
          { category: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } },
          { tags: { has: query.trim() } },
          { brand: { name: { contains: query.trim(), mode: 'insensitive' } } },
          {
            promotions: {
              some: {
                OR: [
                  { title: { contains: query.trim(), mode: 'insensitive' } },
                  { description: { contains: query.trim(), mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      },
      include: this.productInclude,
      orderBy: { name: 'asc' },
    });
  }

  async findLowStock(companyId: string, limit?: number) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        stock: { lte: this.prisma.product.fields.minStock },
      },
      include: this.productInclude,
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
      take: limit,
    });
  }

  async getMetrics(companyId: string) {
    await this.companiesService.ensureExists(companyId);

    const [total, active, lowStock, outOfStock] = await Promise.all([
      this.prisma.product.count({ where: { companyId } }),
      this.prisma.product.count({ where: { companyId, isActive: true } }),
      this.prisma.product.count({
        where: {
          companyId,
          isActive: true,
          stock: { lte: this.prisma.product.fields.minStock },
        },
      }),
      this.prisma.product.count({ where: { companyId, stock: { lte: 0 } } }),
    ]);

    return { total, active, lowStock, outOfStock };
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.findOneOrThrow(id);

    if (
      updateProductDto.companyId &&
      updateProductDto.companyId !== product.companyId
    ) {
      await this.companiesService.ensureExists(updateProductDto.companyId);
    }
    await this.ensureBrandBelongsToCompany(
      updateProductDto.brandId,
      updateProductDto.companyId ?? product.companyId,
    );
    this.validateProductImages(updateProductDto);

    const optimizedPayload = await this.persistProductImages(updateProductDto);
    const { currencyBase: _currencyBase, ...data } = optimizedPayload;

    return this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(updateProductDto.priceUsd !== undefined ? { currencyBase: 'USD' } : {}),
      },
      include: this.productInclude,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: this.productInclude,
    });
  }

  async findOneOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: this.productInclude,
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    return product;
  }

  private async ensureBrandBelongsToCompany(
    brandId: string | undefined,
    companyId: string,
  ) {
    if (!brandId) {
      return;
    }

    const brand = await this.prisma.brand.findFirst({
      where: { id: brandId, companyId },
      select: { id: true },
    });

    if (!brand) {
      throw new BadRequestException('La marca no pertenece a esta empresa.');
    }
  }

  private validateProductImages(payload: {
    mainImage?: string;
    coverImage?: string;
    galleryImages?: string[];
  }) {
    validateImageValue(payload.mainImage, 'imagenPrincipal');
    validateImageValue(payload.coverImage, 'imagenPortada');
    validateImageGallery(payload.galleryImages);
  }

  private async persistProductImages<
    T extends {
      mainImage?: string;
      coverImage?: string;
      galleryImages?: string[];
    },
  >(payload: T): Promise<T> {
    return {
      ...payload,
      mainImage: await this.persistImage(payload.mainImage),
      coverImage: await this.persistImage(payload.coverImage),
      galleryImages: payload.galleryImages?.length
        ? await Promise.all(
            payload.galleryImages.map((image) => this.persistImage(image)),
          )
        : payload.galleryImages,
    };
  }

  private async persistImage(value?: string) {
    if (!value || !this.isDataUrl(value)) {
      return value;
    }

    const match = value.match(/^data:image\/(jpg|jpeg|png|webp);base64,(.+)$/i);

    if (!match) {
      throw new BadRequestException('La imagen no tiene un formato válido.');
    }

    const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buffer = Buffer.from(match[2], 'base64');

    if (buffer.byteLength > 10 * 1024 * 1024) {
      throw new BadRequestException(
        'La imagen supera el límite de 10 MB después de optimizar.',
      );
    }

    const uploadsDir = join(process.cwd(), 'uploads', 'products');
    await mkdir(uploadsDir, { recursive: true });

    const fileName = `${randomUUID()}.${extension}`;
    await writeFile(join(uploadsDir, fileName), buffer);

    const publicBaseUrl =
      this.configService.get<string>('PUBLIC_API_URL') ??
      `http://localhost:${process.env.PORT || 3000}`;

    return `${publicBaseUrl.replace(/\/$/, '')}/uploads/products/${fileName}`;
  }

  private isDataUrl(value: string) {
    return /^data:image\/(jpg|jpeg|png|webp);base64,/i.test(value.trim());
  }

  private readonly productInclude = {
    brand: true,
    promotions: true,
  };
}
