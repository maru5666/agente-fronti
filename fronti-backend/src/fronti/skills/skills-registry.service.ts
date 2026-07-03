import { Injectable } from '@nestjs/common';
import { AddressSkill } from './address/address.skill';
import { BcvOcrSkill } from './bcv-ocr/bcv-ocr.skill';
import { CustomerMemorySkill } from './customer-memory/customer-memory.skill';
import { DeliverySkill } from './delivery/delivery.skill';
import { BillingSkill } from './billing/billing.skill';
import { GoogleMapsSkill } from './google-maps/google-maps.skill';
import { InventorySkill } from './inventory/inventory.skill';
import { OrdersSkill } from './orders/orders.skill';
import { PromotionsSkill } from './promotions/promotions.skill';
import { RecommendationsSkill } from './recommendations/recommendations.skill';
import { FrontiSkill, SkillContext, SkillResult } from './skill.types';

export type SkillExecution = SkillResult & {
  skillName: string | null;
};

@Injectable()
export class SkillsRegistryService {
  private readonly skills: FrontiSkill[];

  constructor(
    addressSkill: AddressSkill,
    googleMapsSkill: GoogleMapsSkill,
    bcvOcrSkill: BcvOcrSkill,
    inventorySkill: InventorySkill,
    ordersSkill: OrdersSkill,
    billingSkill: BillingSkill,
    deliverySkill: DeliverySkill,
    customerMemorySkill: CustomerMemorySkill,
    recommendationsSkill: RecommendationsSkill,
    promotionsSkill: PromotionsSkill,
  ) {
    this.skills = [
      addressSkill,
      googleMapsSkill,
      bcvOcrSkill,
      inventorySkill,
      ordersSkill,
      billingSkill,
      deliverySkill,
      customerMemorySkill,
      recommendationsSkill,
      promotionsSkill,
    ].sort((left, right) => right.priority - left.priority);
  }

  list() {
    return this.skills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      priority: skill.priority,
    }));
  }

  async execute(context: SkillContext): Promise<SkillExecution> {
    for (const skill of this.skills) {
      if (await skill.canHandle(context)) {
        const result = await skill.execute(context);

        if (result.handled) {
          return {
            ...result,
            skillName: skill.name,
          };
        }
      }
    }

    return {
      handled: false,
      response: '',
      data: {},
      skillName: null,
    };
  }
}
