import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

class CompanyLoginDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    const company = await this.companiesService.create(createCompanyDto);
    return this.toPublicCompany(company);
  }

  @Post('login')
  async login(@Body() loginDto: CompanyLoginDto) {
    const company = await this.companiesService.login(
      loginDto.identifier,
      loginDto.password,
    );
    return this.toPublicCompany(company);
  }

  @Get()
  findAll() {
    return this.companiesService.findAll();
  }

  @Get('workspace/:workspaceCode/availability')
  checkWorkspaceAvailability(@Param('workspaceCode') workspaceCode: string) {
    return this.companiesService.isWorkspaceCodeAvailable(workspaceCode);
  }

  @Get('workspace/:workspaceCode')
  async findByWorkspaceCode(@Param('workspaceCode') workspaceCode: string) {
    const company = await this.companiesService.findByWorkspaceCode(workspaceCode);
    return this.toPublicCompany(company);
  }

  @Get('access/:accessCode')
  async findByAccessCode(@Param('accessCode') accessCode: string) {
    const company = await this.companiesService.findByAccessCode(accessCode);
    return this.toPublicCompany(company);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const company = await this.companiesService.findOne(id);
    return this.toPublicCompany(company);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    const company = await this.companiesService.update(id, updateCompanyDto);
    return this.toPublicCompany(company);
  }

  private toPublicCompany(company: {
    id: string;
    name: string;
    commercialName?: string | null;
    workspaceCode: string;
    rif: string;
    phone: string;
    email?: string | null;
    address?: string | null;
    logo?: string | null;
    primaryColor?: string | null;
    catalogBanner?: string | null;
    establishmentName?: string | null;
    establishmentAddress?: string | null;
    establishmentLatitude?: unknown;
    establishmentLongitude?: unknown;
    googleMapsReference?: string | null;
    baseDeliveryZone?: string | null;
    deliveryBaseFeeUsd?: unknown;
    deliveryPricePerKmUsd?: unknown;
    deliveryMinimumFeeUsd?: unknown;
    deliveryFarZoneSurchargeUsd?: unknown;
    deliveryFreeFromUsd?: unknown;
  }) {
    return {
      id: company.id,
      name: company.name,
      commercialName: company.commercialName ?? null,
      workspaceCode: company.workspaceCode,
      rif: company.rif,
      phone: company.phone,
      email: company.email ?? null,
      address: company.address ?? null,
      logo: company.logo ?? null,
      primaryColor: company.primaryColor ?? null,
      catalogBanner: company.catalogBanner ?? null,
      establishmentName: company.establishmentName ?? null,
      establishmentAddress: company.establishmentAddress ?? null,
      establishmentLatitude: this.decimalToString(company.establishmentLatitude),
      establishmentLongitude: this.decimalToString(company.establishmentLongitude),
      googleMapsReference: company.googleMapsReference ?? null,
      baseDeliveryZone: company.baseDeliveryZone ?? null,
      deliveryBaseFeeUsd: this.decimalToString(company.deliveryBaseFeeUsd),
      deliveryPricePerKmUsd: this.decimalToString(company.deliveryPricePerKmUsd),
      deliveryMinimumFeeUsd: this.decimalToString(company.deliveryMinimumFeeUsd),
      deliveryFarZoneSurchargeUsd: this.decimalToString(company.deliveryFarZoneSurchargeUsd),
      deliveryFreeFromUsd: this.decimalToString(company.deliveryFreeFromUsd),
    };
  }

  private decimalToString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    return value.toString();
  }
}
