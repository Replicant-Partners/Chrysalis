/**
 * Comparison functions for Semantic Diff Analysis
 */

import type {
  APISignature,
  APIChangeDetail,
  SchemaDefinition,
  SchemaComparison,
} from './types';

/**
 * Check if two API signatures match (same endpoint)
 */
export function apiSignaturesMatch(a: APISignature, b: APISignature): boolean {
  if (a.path && b.path) {
    return a.path === b.path && a.method === b.method;
  }
  return a.name === b.name;
}

/**
 * Check if two API signatures are exactly equal
 */
export function apiSignaturesEqual(a: APISignature, b: APISignature): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compare two API signatures and return detailed changes
 */
export function compareAPISignatures(
  before: APISignature,
  after: APISignature
): APIChangeDetail[] {
  const changes: APIChangeDetail[] = [];

  const beforeParams = new Map(before.parameters.map((p) => [p.name, p]));
  const afterParams = new Map(after.parameters.map((p) => [p.name, p]));

  afterParams.forEach((param, name) => {
    if (!beforeParams.has(name)) {
      changes.push({
        type: 'parameter_added',
        field: name,
        after: param,
        isBreaking: param.required && param.default === undefined,
        reason: param.required
          ? `Required parameter '${name}' added without default`
          : `Optional parameter '${name}' added`,
      });
    }
  });

  beforeParams.forEach((param, name) => {
    if (!afterParams.has(name)) {
      changes.push({
        type: 'parameter_removed',
        field: name,
        before: param,
        isBreaking: true,
        reason: `Parameter '${name}' removed`,
      });
    }
  });

  beforeParams.forEach((beforeParam, name) => {
    const afterParam = afterParams.get(name);
    if (afterParam) {
      if (beforeParam.type !== afterParam.type) {
        changes.push({
          type: 'parameter_type_changed',
          field: name,
          before: beforeParam.type,
          after: afterParam.type,
          isBreaking: true,
          reason: `Parameter '${name}' type changed from ${beforeParam.type} to ${afterParam.type}`,
        });
      }
      if (beforeParam.required !== afterParam.required) {
        changes.push({
          type: 'required_changed',
          field: name,
          before: beforeParam.required,
          after: afterParam.required,
          isBreaking: !beforeParam.required && afterParam.required,
          reason: afterParam.required
            ? `Parameter '${name}' became required`
            : `Parameter '${name}' became optional`,
        });
      }
    }
  });

  if (before.returnType !== after.returnType) {
    changes.push({
      type: 'return_type_changed',
      field: 'returnType',
      before: before.returnType,
      after: after.returnType,
      isBreaking: true,
      reason: `Return type changed from ${before.returnType} to ${after.returnType}`,
    });
  }

  return changes;
}

/**
 * Compare two schema definitions
 */
export function compareSchemas(
  before: SchemaDefinition,
  after: SchemaDefinition
): SchemaComparison {
  const result: SchemaComparison = {
    added: [],
    removed: [],
    modified: [],
    isCompatible: true,
    migrationRequired: false,
  };

  const beforeFields = new Map(before.fields.map((f) => [f.name, f]));
  const afterFields = new Map(after.fields.map((f) => [f.name, f]));

  afterFields.forEach((field, name) => {
    if (!beforeFields.has(name)) {
      result.added.push(field);
      if (after.required.includes(name)) {
        result.isCompatible = false;
        result.migrationRequired = true;
      }
    }
  });

  beforeFields.forEach((field, name) => {
    if (!afterFields.has(name)) {
      result.removed.push(field);
      result.isCompatible = false;
      result.migrationRequired = true;
    }
  });

  beforeFields.forEach((beforeField, name) => {
    const afterField = afterFields.get(name);
    if (afterField && JSON.stringify(beforeField) !== JSON.stringify(afterField)) {
      const isBreaking = beforeField.type !== afterField.type;
      result.modified.push({
        field: name,
        before: beforeField,
        after: afterField,
        isBreaking,
        reason: isBreaking
          ? `Type changed from ${beforeField.type} to ${afterField.type}`
          : 'Field properties modified',
      });
      if (isBreaking) {
        result.isCompatible = false;
        result.migrationRequired = true;
      }
    }
  });

  return result;
}
