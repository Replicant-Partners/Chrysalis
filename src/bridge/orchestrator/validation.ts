/**
 * Chrysalis Universal Agent Bridge - Request Validation
 *
 * Input validation guards for orchestrator requests.
 *
 * @module bridge/orchestrator/validation
 */

import { AgentFramework } from '../../adapters/base-adapter';
import { RequestValidationError, RequestValidationResult } from './types';

/**
 * Validate translation request structure
 */
export function validateTranslationRequest(request: unknown): RequestValidationResult {
  const errors: RequestValidationError[] = [];
  const warnings: RequestValidationError[] = [];

  if (!request || typeof request !== 'object') {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request must be an object',
      path: '',
      expected: 'object',
      actual: typeof request
    });
    return { valid: false, errors, warnings };
  }

  const req = request as Record<string, unknown>;

  if (!req.agent) {
    errors.push({
      code: 'MISSING_AGENT',
      message: 'Agent is required',
      path: 'agent'
    });
  } else if (typeof req.agent !== 'object' || req.agent === null) {
    errors.push({
      code: 'INVALID_AGENT',
      message: 'Agent must be an object',
      path: 'agent',
      expected: 'object',
      actual: typeof req.agent
    });
  } else {
    const agent = req.agent as Record<string, unknown>;

    if (!agent.framework) {
      errors.push({
        code: 'MISSING_FRAMEWORK',
        message: 'Agent framework is required',
        path: 'agent.framework'
      });
    } else if (typeof agent.framework !== 'string') {
      errors.push({
        code: 'INVALID_FRAMEWORK',
        message: 'Agent framework must be a string',
        path: 'agent.framework',
        expected: 'string',
        actual: typeof agent.framework
      });
    }

    if (agent.data === undefined) {
      errors.push({
        code: 'MISSING_DATA',
        message: 'Agent data is required',
        path: 'agent.data'
      });
    } else if (typeof agent.data !== 'object' || agent.data === null) {
      errors.push({
        code: 'INVALID_DATA',
        message: 'Agent data must be an object',
        path: 'agent.data',
        expected: 'object',
        actual: agent.data === null ? 'null' : typeof agent.data
      });
    } else if (Object.keys(agent.data as object).length === 0) {
      warnings.push({
        code: 'EMPTY_DATA',
        message: 'Agent data is empty',
        path: 'agent.data'
      });
    }
  }

  if (!req.targetFramework) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Target framework is required',
      path: 'targetFramework'
    });
  } else if (typeof req.targetFramework !== 'string') {
    errors.push({
      code: 'INVALID_TARGET',
      message: 'Target framework must be a string',
      path: 'targetFramework',
      expected: 'string',
      actual: typeof req.targetFramework
    });
  }

  const booleanFields = ['persist', 'useCache', 'validate'];
  for (const field of booleanFields) {
    if (req[field] !== undefined && typeof req[field] !== 'boolean') {
      warnings.push({
        code: 'INVALID_OPTION',
        message: `${field} should be a boolean`,
        path: field,
        expected: 'boolean',
        actual: typeof req[field]
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Validate batch translation request structure
 */
export function validateBatchTranslationRequest(request: unknown): RequestValidationResult {
  const errors: RequestValidationError[] = [];
  const warnings: RequestValidationError[] = [];

  if (!request || typeof request !== 'object') {
    errors.push({
      code: 'INVALID_REQUEST',
      message: 'Request must be an object',
      path: '',
      expected: 'object',
      actual: typeof request
    });
    return { valid: false, errors, warnings };
  }

  const req = request as Record<string, unknown>;

  if (!req.agents) {
    errors.push({
      code: 'MISSING_AGENTS',
      message: 'Agents array is required',
      path: 'agents'
    });
  } else if (!Array.isArray(req.agents)) {
    errors.push({
      code: 'INVALID_AGENTS',
      message: 'Agents must be an array',
      path: 'agents',
      expected: 'array',
      actual: typeof req.agents
    });
  } else if (req.agents.length === 0) {
    warnings.push({
      code: 'EMPTY_AGENTS',
      message: 'Agents array is empty',
      path: 'agents'
    });
  } else {
    for (let i = 0; i < req.agents.length; i++) {
      const agent = req.agents[i];
      if (!agent || typeof agent !== 'object') {
        errors.push({
          code: 'INVALID_AGENT_ITEM',
          message: `Agent at index ${i} must be an object`,
          path: `agents[${i}]`,
          expected: 'object',
          actual: typeof agent
        });
        continue;
      }

      const agentObj = agent as Record<string, unknown>;
      if (!agentObj.framework) {
        errors.push({
          code: 'MISSING_AGENT_FRAMEWORK',
          message: `Agent at index ${i} is missing framework`,
          path: `agents[${i}].framework`
        });
      }
      if (agentObj.data === undefined || agentObj.data === null) {
        errors.push({
          code: 'MISSING_AGENT_DATA',
          message: `Agent at index ${i} is missing data`,
          path: `agents[${i}].data`
        });
      }
    }
  }

  if (!req.targetFramework) {
    errors.push({
      code: 'MISSING_TARGET',
      message: 'Target framework is required',
      path: 'targetFramework'
    });
  } else if (typeof req.targetFramework !== 'string') {
    errors.push({
      code: 'INVALID_TARGET',
      message: 'Target framework must be a string',
      path: 'targetFramework',
      expected: 'string',
      actual: typeof req.targetFramework
    });
  }

  const booleanFields = ['continueOnError', 'parallel', 'persist'];
  for (const field of booleanFields) {
    if (req[field] !== undefined && typeof req[field] !== 'boolean') {
      warnings.push({
        code: 'INVALID_OPTION',
        message: `${field} should be a boolean`,
        path: field,
        expected: 'boolean',
        actual: typeof req[field]
      });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check if a framework string is a valid AgentFramework
 */
export function isValidFramework(framework: string): framework is AgentFramework {
  const validFrameworks: AgentFramework[] = [
    'usa', 'lmos', 'mcp', 'langchain', 'openai', 'autogpt', 'semantic-kernel'
  ];
  return validFrameworks.includes(framework as AgentFramework);
}
