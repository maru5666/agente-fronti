import { ChatDto } from '../dto/chat.dto';

export type SkillContext = {
  chatDto: ChatDto;
  companyId: string;
  senderPhone: string;
  message: string;
  normalizedMessage: string;
  state?: {
    currentIntent?: string | null;
    awaitingField?: string | null;
    metadata?: unknown;
  } | null;
};

export type SkillResult = {
  handled: boolean;
  response: string;
  data?: Record<string, unknown>;
};

export interface FrontiSkill {
  readonly name: string;
  readonly description: string;
  readonly priority: number;
  canHandle(context: SkillContext): boolean | Promise<boolean>;
  execute(context: SkillContext): Promise<SkillResult>;
}

export type DeliveryEstimate = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  durationMinutes?: number;
  deliveryZoneId?: string;
  deliveryZoneName?: string;
  deliveryFeeUsd?: string | number;
  deliveryFeeBs?: string | null;
  navigationLink?: string;
  routeCalculated: boolean;
  usedLocalFallback?: boolean;
  message?: string;
};
