import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OrdersService } from '../../../orders/orders.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class BillingSkill implements FrontiSkill {
  readonly name = 'facturacion';
  readonly description = 'Genera facturas PDF simples con fecha y hora.';
  readonly priority = 76;

  constructor(private readonly ordersService: OrdersService) {}

  canHandle(context: SkillContext) {
    return includesAny(context.normalizedMessage, [
      'factura',
      'facturacion',
      'facturación',
      'recibo',
      'comprobante',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    const latest = await this.ordersService.getLatestByCustomer(
      context.companyId,
      context.senderPhone,
    );

    if (!latest) {
      return {
        handled: true,
        response:
          'No veo un pedido reciente para facturar. Si me das el pedido o los datos de compra, puedo ayudarte a prepararlo.',
        data: { invoiceCreated: false },
      };
    }

    const invoiceDir = join(
      process.cwd(),
      'storage',
      'invoices',
      context.companyId,
    );
    await mkdir(invoiceDir, { recursive: true });
    const fileName = `factura-${latest.id.slice(0, 8)}.pdf`;
    const filePath = join(invoiceDir, fileName);
    await writeFile(
      filePath,
      this.buildMinimalPdf(
        latest.id,
        latest.totalUsd.toString(),
        latest.totalBs.toString(),
      ),
    );

    return {
      handled: true,
      response: `Factura generada para el pedido ${latest.id.slice(
        0,
        8,
      )} con fecha ${new Date().toLocaleString('es-VE')}.`,
      data: {
        invoiceCreated: true,
        orderId: latest.id,
        filePath,
      },
    };
  }

  private buildMinimalPdf(orderId: string, totalUsd: string, totalBs: string) {
    const text = [
      'Fronti AI - Factura',
      `Pedido: ${orderId}`,
      `Fecha: ${new Date().toLocaleString('es-VE')}`,
      `Total USD: ${totalUsd}`,
      `Total Bs: ${totalBs}`,
    ].join(' | ');
    const stream = `BT /F1 12 Tf 50 760 Td (${this.escapePdf(text)}) Tj ET`;
    return Buffer.from(
      `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${stream.length} >> stream
${stream}
endstream endobj
xref
0 6
0000000000 65535 f 
trailer << /Root 1 0 R /Size 6 >>
startxref
0
%%EOF`,
      'utf8',
    );
  }

  private escapePdf(value: string) {
    return value.replace(/[()\\]/g, (match) => `\\${match}`);
  }
}
