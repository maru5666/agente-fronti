import { Injectable } from '@nestjs/common';
import { ProductAgentService } from '../../product-agent.service';
import { ProductsService } from '../../../products/products.service';
import { FrontiSkill, SkillContext, SkillResult } from '../skill.types';
import { includesAny } from '../shared';

@Injectable()
export class InventorySkill implements FrontiSkill {
  readonly name = 'inventario';
  readonly description =
    'Consulta disponibilidad, stock bajo, agotados y precios en tiempo real.';
  readonly priority = 80;

  constructor(
    private readonly productsService: ProductsService,
    private readonly productAgent: ProductAgentService,
  ) {}

  canHandle(context: SkillContext) {
    if (
      context.state?.currentIntent === 'delivery' ||
      context.state?.awaitingField === 'address'
    ) {
      return false;
    }

    return includesAny(context.normalizedMessage, [
      'stock',
      'disponible',
      'tienen',
      'hay',
      'precio',
      'cuesta',
      'agotado',
      'agotarse',
      'inventario',
    ]);
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    if (
      includesAny(context.normalizedMessage, [
        'stock bajo',
        'agotarse',
        'inventario bajo',
        'poco inventario',
      ])
    ) {
      const lowStock = await this.productsService.findLowStock(
        context.companyId,
      );

      return {
        handled: true,
        response: lowStock.length
          ? `Productos con stock bajo:\n${lowStock
              .map((item) => `- ${this.productNameWithBrand(item)}: ${item.stock} unidades`)
              .join('\n')}`
          : 'Por ahora no hay productos con stock bajo.',
        data: { lowStockCount: lowStock.length },
      };
    }

    const productResponse = await this.productAgent.respond({
      companyId: context.companyId,
      senderPhone: context.senderPhone,
      message: context.message,
      normalizedMessage: context.normalizedMessage,
      intent: context.normalizedMessage.includes('precio') || context.normalizedMessage.includes('cuesta')
        ? 'precio'
        : 'disponibilidad',
      state: context.state,
    });

    return {
      handled: true,
      response: productResponse.response,
      data: productResponse.result,
    };
  }

  private productNameWithBrand(product: { name: string; brand?: { name: string } | null }) {
    return product.brand?.name ? `${product.name} de ${product.brand.name}` : product.name;
  }
}
