import { Injectable, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../companies/companies.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
  ) {}

  async create(createPaymentMethodDto: CreatePaymentMethodDto) {
    await this.companiesService.ensureExists(createPaymentMethodDto.companyId);

    return this.prisma.paymentMethod.create({
      data: createPaymentMethodDto,
    });
  }

  async findByCompany(companyId: string, onlyActive = true) {
    await this.companiesService.ensureExists(companyId);

    return this.prisma.paymentMethod.findMany({
      where: {
        companyId,
        ...(onlyActive ? { isActive: true } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, updatePaymentMethodDto: UpdatePaymentMethodDto) {
    await this.findOneOrThrow(id);

    if (updatePaymentMethodDto.companyId) {
      await this.companiesService.ensureExists(updatePaymentMethodDto.companyId);
    }

    return this.prisma.paymentMethod.update({
      where: { id },
      data: updatePaymentMethodDto,
    });
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);

    return this.prisma.paymentMethod.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async findOneOrThrow(id: string) {
    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Metodo de pago no encontrado.');
    }

    return paymentMethod;
  }

  async findMatching(companyId: string, text: string) {
    const query = text.toLowerCase();
    const methods = await this.findByCompany(companyId);

    return methods.find((method) => {
      const haystack = `${method.name} ${method.type} ${method.currency}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      return (
        haystack.includes(query) ||
        query.includes(method.name.toLowerCase()) ||
        query.includes(method.type.toLowerCase()) ||
        query.includes(method.currency.toLowerCase())
      );
    });
  }
}
