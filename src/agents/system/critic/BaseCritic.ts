/**
 * BaseCritic
 *
 * Minimal OpenHands-lite critic base class.
 */

import type { CriticContext, CriticResult } from './types';

export abstract class BaseCritic {
  abstract readonly criticId: string;

  abstract evaluate(context: CriticContext): CriticResult;
}
