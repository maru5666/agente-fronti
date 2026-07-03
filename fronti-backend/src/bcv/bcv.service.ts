import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as https from 'node:https';
import { URL } from 'node:url';
import { PrismaService } from '../prisma/prisma.service';

type StoredRate = {
  id: string;
  currency: string;
  rate: { toString(): string };
  source: string;
  imageUrl?: string | null;
  extractionMethod?: string | null;
  publishedAt: Date;
  fetchedAt: Date;
  createdAt: Date;
};

type BcvRateResponse = {
  id: string;
  currency: string;
  usdRate: number;
  formattedRate: string;
  source: string;
  publishedDate: string;
  fetchedAt: string;
  status: 'updated' | 'stale';
  isFallback: boolean;
  error?: string;
  imageUrl?: string | null;
  extractionMethod?: string | null;
  officialUrl: string;
};

@Injectable()
export class BcvService {
  private readonly officialSource = 'Banco Central de Venezuela';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getLatest() {
    const latest = await this.getLatestStoredRate();

    if (latest) {
      return {
        ...this.toResponse(latest),
        status: this.isTodayInVenezuela(latest.fetchedAt)
          ? ('updated' as const)
          : ('stale' as const),
      };
    }

    try {
      return await this.sync();
    } catch (error) {
      throw error;
    }
  }

  async sync() {
    console.log('Consultando BCV...');

    try {
      const scraped = await this.fetchOfficialRate();
      console.log('Tasa BCV obtenida:', scraped.usdRate);

      const rate = await this.prisma.bcvRate.create({
        data: {
          currency: 'USD',
          rate: scraped.usdRate,
          source: this.officialSource,
          imageUrl: scraped.imageUrl,
          extractionMethod: scraped.extractionMethod,
          publishedAt: scraped.publishedAt,
          fetchedAt: new Date(),
        },
      });

      return this.toResponse(rate);
    } catch (error) {
      console.error('No se pudo leer la tasa desde BCV.', error);
      const latest = await this.getLatestStoredRate();

      if (latest) {
        console.log('Usando ultima tasa guardada:', Number(latest.rate));
        return {
          ...this.toResponse(latest),
          status: 'stale' as const,
          error: 'No se pudo leer la tasa desde BCV.',
        };
      }

      throw new ServiceUnavailableException('No se pudo leer la tasa desde BCV.');
    }
  }

  async getLatestStoredRate() {
    return this.prisma.bcvRate.findFirst({
      where: {
        currency: 'USD',
        source: this.officialSource,
      },
      orderBy: [{ fetchedAt: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  async getLatestRateValue() {
    const latest = await this.getLatest();
    return latest.usdRate;
  }

  private async fetchOfficialRate() {
    const url =
      this.configService.get<string>('BCV_EXCHANGE_URL') ||
      'https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv';

    const response = await axios.get<string>(url, {
      timeout: 20000,
      responseType: 'text',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FrontiAI/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      validateStatus: (status) => status >= 200 && status < 400,
    });

    const html = String(response.data);
    console.log('HTML recibido:', html.slice(0, 500));

    const $ = cheerio.load(html);
    const extracted =
      (await this.extractUsdTextFromOfficialImages($, url).catch((error) => {
        console.error('OCR BCV no disponible:', error);
        return null;
      })) ?? {
        usdText: this.extractUsdText($, html),
        imageUrl: null,
        extractionMethod: 'html_official_page',
      };
    const usdText = extracted.usdText;
    console.log('Tasa USD extraida:', usdText);

    const usdRate = this.parseVenezuelanNumber(usdText);
    console.log('Tasa normalizada:', usdRate);

    return {
      usdText,
      usdRate,
      imageUrl: extracted.imageUrl,
      extractionMethod: extracted.extractionMethod,
      publishedAt: this.extractPublishedAt($) ?? this.todayAtNoonUtc(),
    };
  }

  private async extractUsdTextFromOfficialImages(
    $: cheerio.CheerioAPI,
    pageUrl: string,
  ) {
    const candidates = this.extractImageCandidates($, pageUrl);

    for (const imageUrl of candidates) {
      try {
        console.log('Intentando OCR BCV en imagen:', imageUrl);
        const image = await axios.get<ArrayBuffer>(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 20000,
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 FrontiAI/1.0',
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
          },
        });
        const { recognize } = await import('tesseract.js');
        const ocr = await recognize(Buffer.from(image.data), 'eng+spa');
        const text = ocr.data.text.replace(/\s+/g, ' ');
        console.log('Texto OCR BCV:', text.slice(0, 500));
        const rate =
          this.findUsdRateNearContext(text) ?? this.findVenezuelanRate(text);

        if (rate) {
          return {
            usdText: rate,
            imageUrl,
            extractionMethod: 'ocr_official_image',
          };
        }
      } catch (error) {
        console.error('No se pudo leer imagen BCV con OCR:', error);
      }
    }

    return null;
  }

  private extractImageCandidates($: cheerio.CheerioAPI, pageUrl: string) {
    const scored = $('img')
      .toArray()
      .map((item) => {
        const element = $(item);
        const src = element.attr('src') ?? element.attr('data-src') ?? '';
        const alt = element.attr('alt') ?? '';
        const title = element.attr('title') ?? '';
        const context = `${src} ${alt} ${title} ${element.parent().text()}`.toLowerCase();

        if (!src) {
          return null;
        }

        const score =
          (context.includes('dolar') || context.includes('dólar') ? 8 : 0) +
          (context.includes('usd') ? 8 : 0) +
          (context.includes('tipo') && context.includes('cambio') ? 6 : 0) +
          (context.includes('oficial') ? 4 : 0) +
          (context.includes('euro') ? 2 : 0);

        return {
          src: this.resolveUrl(src, pageUrl),
          score,
        };
      })
      .filter((item): item is { src: string; score: number } => Boolean(item?.src))
      .sort((left, right) => right.score - left.score);

    return [...new Set(scored.map((item) => item.src))].slice(0, 8);
  }

  private resolveUrl(value: string, pageUrl: string) {
    try {
      return new URL(value, pageUrl).toString();
    } catch {
      return value;
    }
  }

  private extractUsdText($: cheerio.CheerioAPI, html: string) {
    const selectorCandidates = [
      '#dolar strong',
      '#dolar .centrado strong',
      '#dolar .centrado',
      '[id*="dolar" i] strong',
      '[id*="dolar" i]',
    ];

    for (const selector of selectorCandidates) {
      const text = $(selector).first().text().trim();
      const rate = this.findVenezuelanRate(text);

      if (rate) {
        return rate;
      }
    }

    const plainText = $('body').text().replace(/\s+/g, ' ');
    const contextRate = this.findUsdRateNearContext(plainText);

    if (contextRate) {
      return contextRate;
    }

    const htmlRate = this.findUsdRateNearContext(html);

    if (htmlRate) {
      return htmlRate;
    }

    throw new ServiceUnavailableException('No se pudo leer la tasa desde BCV.');
  }

  private findVenezuelanRate(text: string) {
    return text.match(/([0-9]{1,4}(?:\.[0-9]{3})*,[0-9]{2,8})/)?.[1] ?? null;
  }

  private findUsdRateNearContext(text: string) {
    return (
      text.match(/USD[\s\S]{0,900}?([0-9]{1,4}(?:\.[0-9]{3})*,[0-9]{2,8})/i)?.[1] ??
      text.match(/D[oó]lar[\s\S]{0,900}?([0-9]{1,4}(?:\.[0-9]{3})*,[0-9]{2,8})/i)?.[1] ??
      null
    );
  }

  private extractPublishedAt($: cheerio.CheerioAPI) {
    const text = $('body').text().replace(/\s+/g, ' ');
    const dateMatch = text.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);

    if (!dateMatch) {
      return null;
    }

    const [, day, month, year] = dateMatch;
    return new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0),
    );
  }

  private parseVenezuelanNumber(value: string) {
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const rate = Number(normalized);

    if (!Number.isFinite(rate) || rate <= 0) {
      throw new ServiceUnavailableException('No se pudo leer la tasa desde BCV.');
    }

    return rate;
  }

  private isTodayInVenezuela(date: Date) {
    return this.formatVenezuelaDay(date) === this.formatVenezuelaDay(new Date());
  }

  private formatVenezuelaDay(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private todayAtNoonUtc() {
    const [year, month, day] = this.formatVenezuelaDay(new Date())
      .split('-')
      .map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  }

  private toResponse(rate: StoredRate): BcvRateResponse {
    const usdRate = Number(rate.rate);

    return {
      id: rate.id,
      currency: rate.currency,
      usdRate,
      formattedRate: this.formatVenezuelanRate(usdRate),
      source: rate.source,
      imageUrl: rate.imageUrl ?? null,
      extractionMethod: rate.extractionMethod ?? null,
      publishedDate: this.formatVenezuelaDay(rate.publishedAt),
      fetchedAt: rate.fetchedAt.toISOString(),
      status: 'updated',
      isFallback: false,
      officialUrl:
        this.configService.get<string>('BCV_EXCHANGE_URL') ||
        'https://www.bcv.org.ve/seccionportal/tipo-de-cambio-oficial-del-bcv',
    };
  }

  private formatVenezuelanRate(rate: number) {
    return rate.toFixed(8).replace('.', ',');
  }
}
