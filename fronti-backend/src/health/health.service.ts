import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BcvService } from '../bcv/bcv.service';
import { PrismaService } from '../prisma/prisma.service';

type CheckStatus = 'connected' | 'not_configured' | 'error';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bcvService: BcvService,
    private readonly configService: ConfigService,
  ) {}

  async check() {
    const checks = {
      backend: this.ok('API NestJS activa.'),
      postgresql: await this.checkDatabase(),
      prisma: await this.checkPrisma(),
      bcv: await this.checkBcv(),
      maps: this.checkMaps(),
      whatsapp: this.checkWhatsApp(),
      inventario: await this.checkInventory(),
    };

    return {
      status: Object.values(checks).every((item) => item.status !== 'error')
        ? 'ok'
        : 'degraded',
      database:
        checks.postgresql.status === 'connected' ? 'connected' : 'error',
      bcv: checks.bcv.status,
      maps: checks.maps.status,
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.ok('PostgreSQL conectado.');
    } catch (error) {
      return this.fail('PostgreSQL no responde.', error);
    }
  }

  private async checkPrisma() {
    try {
      await this.prisma.company.count();
      return this.ok('Prisma puede consultar la base de datos.');
    } catch (error) {
      return this.fail('Prisma no pudo consultar la base de datos.', error);
    }
  }

  private async checkBcv() {
    try {
      const latest = await this.bcvService.getLatestStoredRate();

      if (!latest) {
        return {
          status: 'not_configured' as const,
          message: 'BCV sin tasa guardada. Ejecuta la actualización desde el panel.',
        };
      }

      return {
        status: 'connected' as const,
        message: 'BCV con tasa guardada disponible.',
        details: {
          source: latest.source,
          publishedAt: latest.publishedAt,
          fetchedAt: latest.fetchedAt,
        },
      };
    } catch (error) {
      return this.fail('No se pudo leer la tasa oficial BCV.', error);
    }
  }

  private checkMaps() {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');

    if (!apiKey) {
      return {
        status: 'not_configured' as const,
        message: 'Google Maps aún no está conectado.',
      };
    }

    return this.ok('Google Maps conectado.');
  }

  private checkWhatsApp() {
    const token = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');

    if (!token || !phoneId) {
      return {
        status: 'not_configured' as const,
        message:
          'WhatsApp aún no está conectado.',
      };
    }

    return this.ok('WhatsApp conectado.');
  }

  private async checkInventory() {
    try {
      const [total, lowStockProducts] = await Promise.all([
        this.prisma.product.count(),
        this.prisma.product.count({
          where: {
            isActive: true,
            stock: { lte: this.prisma.product.fields.minStock },
          },
        }),
      ]);

      return {
        status: 'connected' as const,
        message: 'Inventario disponible.',
        details: {
          totalProducts: total,
          lowStockProducts,
        },
      };
    } catch (error) {
      return this.fail('No se pudo consultar inventario.', error);
    }
  }

  private ok(message: string) {
    return {
      status: 'connected' as CheckStatus,
      message,
    };
  }

  private fail(message: string, error: unknown) {
    return {
      status: 'error' as CheckStatus,
      message,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
