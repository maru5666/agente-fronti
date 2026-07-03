import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { BcvService } from '../bcv/bcv.service';

@Injectable()
export class ExchangeRateService {
  constructor(private readonly bcvService: BcvService) {}

  async getCurrentUsdRate() {
    return this.bcvService.getLatestRateValue();
  }

  async getCurrentUsdRateDecimal() {
    const rate = await this.getCurrentUsdRate();

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ServiceUnavailableException('Tasa BCV no disponible.');
    }

    return new Decimal(rate);
  }

  usdToBs(priceUsd: Decimal.Value, rate: Decimal.Value) {
    return new Decimal(priceUsd).mul(new Decimal(rate)).toDecimalPlaces(2);
  }

  async convertUsdToBs(priceUsd: Decimal.Value) {
    const rate = await this.getCurrentUsdRateDecimal();
    return this.usdToBs(priceUsd, rate);
  }

  formatUsd(value: Decimal.Value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  formatBs(value: Decimal.Value) {
    return new Intl.NumberFormat('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  formatDualPrice(priceUsd: Decimal.Value, rate: Decimal.Value) {
    const priceBs = this.usdToBs(priceUsd, rate);

    return {
      priceUsd: new Decimal(priceUsd).toDecimalPlaces(2),
      priceBs,
      formattedUsd: this.formatUsd(priceUsd),
      formattedBs: `Bs. ${this.formatBs(priceBs)}`,
    };
  }
}
