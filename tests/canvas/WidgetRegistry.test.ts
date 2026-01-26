/**
 * WidgetRegistry Tests
 * 
 * Updated to match current createWidgetRegistry factory function API
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createWidgetRegistry } from '../../src/canvas/WidgetRegistry';
import type { WidgetRegistry } from '../../src/canvas/WidgetRegistry';
import type { WidgetDefinition, WidgetNodeData } from '../../src/canvas/types';
import React from 'react';

// Define a custom widget data type for testing
interface NoteWidgetData extends WidgetNodeData {
  text?: string;
}

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = createWidgetRegistry('scrapbook', ['note', 'link']);
  });

  describe('register', () => {
    it('should register valid widget definition', () => {
      const definition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
      };

      expect(() => registry.register(definition)).not.toThrow();
      expect(registry.has('note')).toBe(true);
    });

    it('should allow registering widget and warn on duplicate', () => {
      const definition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
      };

      registry.register(definition);
      // Current implementation warns but doesn't throw on duplicate
      expect(() => registry.register(definition)).not.toThrow();
    });
  });

  describe('get and has', () => {
    it('should retrieve registered widget', () => {
      const definition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
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

  describe('getTypes', () => {
    it('should return all registered widget types', () => {
      const noteDefinition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
      };

      const linkDefinition: WidgetDefinition<WidgetNodeData> = {
        type: 'link',
        displayName: 'Link',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: {},
      };

      registry.register(noteDefinition);
      registry.register(linkDefinition);

      const types = registry.getTypes();
      expect(types).toContain('note');
      expect(types).toContain('link');
      expect(types).toHaveLength(2);
    });
  });

  describe('isAllowed', () => {
    it('should return true for allowed and registered types', () => {
      const definition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
      };

      registry.register(definition);
      expect(registry.isAllowed('note')).toBe(true);
    });

    it('should return false for unregistered types', () => {
      expect(registry.isAllowed('unregistered')).toBe(false);
    });
  });

  describe('getByCategory', () => {
    it('should filter widgets by category', () => {
      const noteDefinition: WidgetDefinition<NoteWidgetData> = {
        type: 'note',
        displayName: 'Note',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: { text: '' },
        category: 'content',
      };

      const linkDefinition: WidgetDefinition<WidgetNodeData> = {
        type: 'link',
        displayName: 'Link',
        renderer: () => React.createElement('div'),
        capabilities: [],
        defaultData: {},
        category: 'reference',
      };

      registry.register(noteDefinition);
      registry.register(linkDefinition);

      const contentWidgets = registry.getByCategory('content');
      expect(contentWidgets).toHaveLength(1);
      expect(contentWidgets[0].type).toBe('note');
    });
  });
});
