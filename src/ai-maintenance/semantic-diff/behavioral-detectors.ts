/**
 * Behavioral change detection functions for Semantic Diff Analysis
 */

import type { BehavioralChange } from './types';

/**
 * Detect changes in error handling patterns
 */
export function detectErrorHandlingChanges(before: string, after: string): BehavioralChange[] {
  const changes: BehavioralChange[] = [];

  const beforeCatches = (before.match(/catch\s*\(/g) || []).length;
  const afterCatches = (after.match(/catch\s*\(/g) || []).length;

  if (beforeCatches !== afterCatches) {
    changes.push({
      type: 'error_handling',
      description: `Error handling changed: ${beforeCatches} → ${afterCatches} catch blocks`,
      file: '',
      isPotentiallyBreaking: afterCatches < beforeCatches,
      confidence: 0.6,
      suggestedAction: 'Review error handling changes for compatibility',
    });
  }

  return changes;
}

/**
 * Detect changes in timeout values
 */
export function detectTimeoutChanges(before: string, after: string): BehavioralChange[] {
  const changes: BehavioralChange[] = [];

  const timeoutRegex = /timeout[:\s=]+(\d+)/gi;
  const beforeTimeouts: number[] = [];
  const afterTimeouts: number[] = [];

  let match;
  while ((match = timeoutRegex.exec(before)) !== null) {
    beforeTimeouts.push(parseInt(match[1]));
  }
  timeoutRegex.lastIndex = 0;
  while ((match = timeoutRegex.exec(after)) !== null) {
    afterTimeouts.push(parseInt(match[1]));
  }

  if (beforeTimeouts.length > 0 && afterTimeouts.length > 0) {
    const avgBefore = beforeTimeouts.reduce((a, b) => a + b, 0) / beforeTimeouts.length;
    const avgAfter = afterTimeouts.reduce((a, b) => a + b, 0) / afterTimeouts.length;

    if (Math.abs(avgBefore - avgAfter) > avgBefore * 0.2) {
      changes.push({
        type: 'timeout',
        description: `Timeout values changed significantly: avg ${avgBefore}ms → ${avgAfter}ms`,
        file: '',
        isPotentiallyBreaking: avgAfter < avgBefore,
        confidence: 0.5,
        suggestedAction: 'Review timeout changes and adjust adapter timeouts accordingly',
      });
    }
  }

  return changes;
}

/**
 * Detect changes in authentication patterns
 */
export function detectAuthenticationChanges(before: string, after: string): BehavioralChange[] {
  const changes: BehavioralChange[] = [];

  const authPatterns = [/bearer/i, /api[_-]?key/i, /authorization/i, /oauth/i, /jwt/i];

  const beforeAuthCount = authPatterns.reduce(
    (count, pattern) => count + (pattern.test(before) ? 1 : 0),
    0
  );
  const afterAuthCount = authPatterns.reduce(
    (count, pattern) => count + (pattern.test(after) ? 1 : 0),
    0
  );

  if (afterAuthCount > beforeAuthCount) {
    changes.push({
      type: 'authentication',
      description: 'New authentication mechanisms detected',
      file: '',
      isPotentiallyBreaking: true,
      confidence: 0.7,
      suggestedAction: 'Update adapter authentication to support new mechanisms',
    });
  }

  return changes;
}
