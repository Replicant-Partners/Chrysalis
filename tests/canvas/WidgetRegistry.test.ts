/**
 * WidgetRegistry Tests
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { WidgetRegistry, createWidgetRegistry, WidgetRegistryError } from '../../src/canvas/WidgetRegistry';
import type { WidgetDefinition, WidgetNodeData } from '../../src/canvas/types';
import React from 'react';

// Define a custom widget data type for testing
interface NoteWidgetData extends WidgetNodeData {
  text?: string;
}

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry('scrapbook', ['note', 'link']);
  });

  describe('register', () => {
    it('should register valid widget definition', () => {
      const definition: WidgetDefinition = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
      };

      expect(() => registry.register(definition)).not.toThrow();
      expect(registry.has('note')).toBe(true);
    });

    it('should reject widget with invalid type format', () => {
      const definition: WidgetDefinition = {
        type: 'Invalid-Type',
        displayName: 'Invalid',
        renderer: () => React.createElement('div'),
        capabilities: [],
      };

      expect(() => registry.register(definition)).toThrow(WidgetRegistryError);
    });

    it('should reject duplicate widget types', () => {
      const definition: WidgetDefinition = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
      };

      registry.register(definition);
      expect(() => registry.register(definition)).toThrow(WidgetRegistryError);
    });

    it('should reject widget types not in allowlist', () => {
      const definition: WidgetDefinition = {
        type: 'forbidden',
        displayName: 'Forbidden',
        renderer: () => React.createElement('div'),
        capabilities: [],
      };

      expect(() => registry.register(definition)).toThrow(WidgetRegistryError);
    });
  });

  describe('get and has', () => {
    it('should retrieve registered widget', () => {
      const definition: WidgetDefinition = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
      };

      registry.register(definition);
      const retrieved = registry.get('note');
      expect(retrieved).toBeDefined();
      expect(retrieved?.type).toBe('note');
    });

    it('should return undefined for unregistered widget', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
      expect(registry.has('nonexistent')).toBe(false);
    });
  });

  describe('createDefaultData', () => {
    it('should create data with default values', () => {
      const definition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: 'Default text' },
      };

      registry.register(definition);
      const data = registry.createDefaultData('note');

      expect(data.type).toBe('note');
      expect(data.label).toBe('Note');
      expect(data).toHaveProperty('text', 'Default text');
    });
  });
});
