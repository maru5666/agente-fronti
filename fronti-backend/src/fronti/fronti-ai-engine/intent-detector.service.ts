import { Injectable } from '@nestjs/common';
import { FrontiIntent } from '../agent.types';
import { IntentClassifierService } from './intent-classifier.service';

@Injectable()
export class AiIntentDetectorService {
  constructor(private readonly classifier: IntentClassifierService) {}

  detect(input: { message: string; type?: string; state?: { currentIntent?: string | null; awaitingField?: string | null } | null }): FrontiIntent {
    return this.classifier.toFrontiIntent(this.classifier.classify(input));
  }
}
