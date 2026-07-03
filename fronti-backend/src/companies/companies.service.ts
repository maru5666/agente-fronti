import {
  ConflictException,
  UnauthorizedException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { validateImageValue } from '../common/image-validation';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto) {
    try {
      const { password, email, workspaceCode, ...companyData } = createCompanyDto;
      return await this.prisma.company.create({
        data: {
          ...companyData,
          email: email.toLowerCase(),
          workspaceCode: workspaceCode.toLowerCase(),
          passwordHash: this.hashPassword(password),
        },
      });
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una empresa con ese RIF o ID de la empresa.',
        );
      }

      throw error;
    }
  }

  findAll() {
    return this.prisma.company.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        products: true,
        promotions: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return company;
  }

  async update(id: string, updateCompanyDto: UpdateCompanyDto) {
    await this.ensureExists(id);
    validateImageValue(updateCompanyDto.logo, 'logo');
    validateImageValue(updateCompanyDto.catalogBanner, 'bannerCatalogo');

    return this.prisma.company.update({
      where: { id },
      data: updateCompanyDto,
    });
  }

  async findByWorkspaceCode(workspaceCode: string) {
    const company = await this.prisma.company.findUnique({
      where: { workspaceCode: workspaceCode.toLowerCase() },
      include: {
        products: true,
        promotions: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return company;
  }

  async findByAccessCode(accessCode: string) {
    const normalized = accessCode.trim();
    const company = await this.prisma.company.findFirst({
      where: {
        OR: [
          { workspaceCode: normalized.toLowerCase() },
          { rif: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: {
        products: true,
        promotions: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }

    return company;
  }

  async login(identifier: string, password: string) {
    const normalized = identifier.trim();
    const company = await this.prisma.company.findFirst({
      where: {
        OR: [
          { workspaceCode: normalized.toLowerCase() },
          { rif: { equals: normalized, mode: 'insensitive' } },
        ],
      },
      include: {
        products: true,
        promotions: true,
      },
    });

    if (!company || !company.passwordHash) {
      throw new UnauthorizedException('ID de empresa o contraseña inválidos.');
    }

    if (!this.verifyPassword(password, company.passwordHash)) {
      throw new UnauthorizedException('ID de empresa o contraseña inválidos.');
    }

    return company;
  }

  async isWorkspaceCodeAvailable(workspaceCode: string) {
    const company = await this.prisma.company.findUnique({
      where: { workspaceCode: workspaceCode.toLowerCase() },
      select: { id: true },
    });

    return { available: !company };
  }

  async ensureExists(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!company) {
      throw new NotFoundException('Empresa no encontrada.');
    }
  }

  private hashPassword(password: string) {
    const salt = randomBytes(16).toString('hex');
    const digest = createHash('sha256').update(`${salt}:${password}`).digest('hex');
    return `${salt}:${digest}`;
  }

  private verifyPassword(password: string, storedHash: string) {
    const [salt, digest] = storedHash.split(':');

    if (!salt || !digest) {
      return false;
    }

    const candidate = createHash('sha256')
      .update(`${salt}:${password}`)
      .digest('hex');

    return timingSafeEqual(Buffer.from(candidate), Buffer.from(digest));
  }
}
