/**
 * Factory functions for convenient agent creation.
 * @module core/agent-builder/factories
 */

import type { UniformSemanticAgentV2 } from '../UniformSemanticAgentV2';
import { AgentBuilder } from './builder';

/**
 * Create a new AgentBuilder instance.
 *
 * Factory function for convenient builder creation.
 *
 * @param template - Optional template agent
 * @returns New AgentBuilder instance
 *
 * @example
 * ```typescript
 * const agent = createAgentBuilder()
 *   .withIdentity({ name: "Ada" })
 *   .build();
 * ```
 */
export function createAgentBuilder(
  template?: Partial<UniformSemanticAgentV2>
): AgentBuilder {
  return new AgentBuilder(template);
}

/**
 * Quick agent creation with minimal configuration.
 *
 * @param name - Agent name
 * @param options - Optional configuration
 * @returns Constructed agent
 *
 * @example
 * ```typescript
 * const agent = quickAgent("Ada", {
 *   designation: "Research Assistant",
 *   traits: ["analytical", "curious"]
 * });
 * ```
 */
export function quickAgent(
  name: string,
  options?: {
    designation?: string;
    bio?: string;
    traits?: string[];
    capabilities?: string[];
    llm?: { provider: string; model: string };
  }
): UniformSemanticAgentV2 {
  const builder = new AgentBuilder().withIdentity({
    name,
    designation: options?.designation,
    bio: options?.bio,
  });

  if (options?.traits) {
    builder.addTraits(...options.traits);
  }

  if (options?.capabilities) {
    builder.addCapabilities(options.capabilities);
  }

  if (options?.llm) {
    builder.withLLM(options.llm.provider, options.llm.model);
  }

  return builder.build();
}
