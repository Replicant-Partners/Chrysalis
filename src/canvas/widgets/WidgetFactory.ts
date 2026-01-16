/**
 * Widget Factory
 *
 * Creates widget instances with resolved dependencies.
 * Handles dependency injection and lifecycle management.
 */

import {
  WidgetTypeId,
  WidgetDefinition,
  WidgetInstance,
  WidgetServices,
  WidgetBaseProps,
  ServiceType,
} from './types';
import { WidgetRegistry, getWidgetRegistry } from './WidgetRegistry';
import type { CanvasKind } from '../core/types';

// =============================================================================
// Service Provider Interface
// =============================================================================

/**
 * Service provider supplies services for dependency injection.
 * Implement this interface to provide custom services to widgets.
 */
export interface ServiceProvider {
  getService<T>(type: ServiceType): T | undefined;
  hasService(type: ServiceType): boolean;
}

// =============================================================================
// Default Service Provider (no-op implementations)
// =============================================================================

export class DefaultServiceProvider implements ServiceProvider {
  private services: Map<ServiceType, unknown> = new Map();

  provide<T>(type: ServiceType, service: T): void {
    this.services.set(type, service);
  }

  getService<T>(type: ServiceType): T | undefined {
    return this.services.get(type) as T | undefined;
  }

  hasService(type: ServiceType): boolean {
    return this.services.has(type);
  }
}

// =============================================================================
// Widget Factory
// =============================================================================

export class WidgetFactory {
  private registry: WidgetRegistry;
  private serviceProvider: ServiceProvider;
  private instances: Map<string, WidgetInstance> = new Map();

  constructor(
    registry?: WidgetRegistry,
    serviceProvider?: ServiceProvider
  ) {
    this.registry = registry ?? getWidgetRegistry();
    this.serviceProvider = serviceProvider ?? new DefaultServiceProvider();
  }

  // ===========================================================================
  // Instance Creation
  // ===========================================================================

  /**
   * Create a widget instance for a canvas node.
   * Resolves dependencies and initializes lifecycle.
   */
  create<TData>(
    nodeId: string,
    typeId: WidgetTypeId,
    canvasKind: CanvasKind,
    initialData?: Partial<TData>
  ): WidgetInstance<TData> | null {
    const definition = this.registry.get<TData>(typeId);
    if (!definition) {
      console.error(`[WidgetFactory] Widget type '${typeId}' not found in registry`);
      return null;
    }

    // Check if widget is allowed on this canvas
    if (!this.registry.isAllowedOnCanvas(typeId, canvasKind)) {
      console.error(`[WidgetFactory] Widget '${typeId}' not allowed on canvas '${canvasKind}'`);
      return null;
    }

    // Resolve services
    const services = this.resolveServices(definition);

    // Create instance
    const instance: WidgetInstance<TData> = {
      nodeId,
      definition,
      data: { ...definition.defaultData(), ...initialData } as TData,
      services,
      state: 'mounting',
    };

    this.instances.set(nodeId, instance as WidgetInstance<unknown>);
    return instance;
  }

  /**
   * Get an existing widget instance by node ID.
   */
  getInstance<TData>(nodeId: string): WidgetInstance<TData> | undefined {
    return this.instances.get(nodeId) as WidgetInstance<TData> | undefined;
  }

  /**
   * Destroy a widget instance and clean up.
   */
  async destroy(nodeId: string): Promise<void> {
    const instance = this.instances.get(nodeId);
    if (!instance) return;

    instance.state = 'unmounting';

    // Call lifecycle hook
    if (instance.definition.lifecycle?.onUnmount) {
      await instance.definition.lifecycle.onUnmount();
    }

    instance.state = 'unmounted';
    this.instances.delete(nodeId);
  }

  // ===========================================================================
  // Lifecycle Management
  // ===========================================================================

  /**
   * Notify widget that it's now mounted.
   */
  async mount(nodeId: string, props: WidgetBaseProps): Promise<void> {
    const instance = this.instances.get(nodeId);
    if (!instance) return;

    if (instance.definition.lifecycle?.onMount) {
      await instance.definition.lifecycle.onMount(props);
    }
    instance.state = 'mounted';
  }

  /**
   * Notify widget that canvas is going to background.
   */
  async toBackground(nodeId: string): Promise<void> {
    const instance = this.instances.get(nodeId);
    if (!instance) return;

    if (instance.definition.lifecycle?.onBackground) {
      await instance.definition.lifecycle.onBackground();
    }
    instance.state = 'background';
  }

  /**
   * Notify widget that canvas is returning to foreground.
   */
  async toForeground(nodeId: string): Promise<void> {
    const instance = this.instances.get(nodeId);
    if (!instance) return;

    if (instance.definition.lifecycle?.onForeground) {
      await instance.definition.lifecycle.onForeground();
    }
    instance.state = 'mounted';
  }

  /**
   * Get widget data for saving.
   */
  async save<TData>(nodeId: string): Promise<TData | undefined> {
    const instance = this.instances.get(nodeId) as WidgetInstance<TData> | undefined;
    if (!instance) return undefined;

    if (instance.definition.lifecycle?.onSave) {
      return await instance.definition.lifecycle.onSave();
    }
    return instance.data;
  }

  /**
   * Restore widget from saved data.
   */
  async restore<TData>(nodeId: string, data: TData): Promise<void> {
    const instance = this.instances.get(nodeId) as WidgetInstance<TData> | undefined;
    if (!instance) return;

    instance.data = data;
    if (instance.definition.lifecycle?.onRestore) {
      await instance.definition.lifecycle.onRestore(data);
    }
  }

  // ===========================================================================
  // Dependency Resolution
  // ===========================================================================

  private resolveServices(definition: WidgetDefinition<unknown>): WidgetServices {
    const services: WidgetServices = {};

    for (const dep of definition.dependencies) {
      const service = this.serviceProvider.getService(dep.service);

      if (!service && dep.required) {
        console.warn(
          `[WidgetFactory] Required service '${dep.service}' not available for widget '${definition.typeId}'`
        );
      }

      if (service) {
        (services as Record<string, unknown>)[dep.service] = service;
      }
    }

    return services;
  }

  // ===========================================================================
  // Utility
  // ===========================================================================

  /**
   * Update service provider.
   */
  setServiceProvider(provider: ServiceProvider): void {
    this.serviceProvider = provider;
  }

  /**
   * Get count of active instances.
   */
  getInstanceCount(): number {
    return this.instances.size;
  }

  /**
   * Get all active node IDs.
   */
  getActiveNodeIds(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Destroy all instances.
   */
  async destroyAll(): Promise<void> {
    const nodeIds = Array.from(this.instances.keys());
    await Promise.all(nodeIds.map(id => this.destroy(id)));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalFactory: WidgetFactory | null = null;

export function getWidgetFactory(): WidgetFactory {
  if (!globalFactory) {
    globalFactory = new WidgetFactory();
  }
  return globalFactory;
}

export function resetWidgetFactory(): void {
  globalFactory?.destroyAll();
  globalFactory = null;
}
