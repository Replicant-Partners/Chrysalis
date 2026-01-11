/**
 * Dependency Injection Container
 *
 * Design Pattern: Service Locator + Dependency Injection (Fowler)
 * - Centralized dependency management
 * - Supports constructor injection via factories
 * - Enables testing through mock injection
 *
 * References:
 * - Fowler, M. (2004). "Inversion of Control Containers and the Dependency Injection pattern"
 *   https://martinfowler.com/articles/injection.html
 * - Martin, R. C. (2017). Clean Architecture. Chapter 11.
 */

/**
 * Factory function type
 */
export type Factory<T> = (container: Container) => T;

/**
 * Container Registration
 */
interface Registration<T> {
    factory: Factory<T>;
    singleton: boolean;
    instance?: T;
}

/**
 * Simple Dependency Injection Container
 *
 * Provides centralized dependency management for the Quality System.
 */
export class Container {
    private registrations = new Map<string, Registration<any>>();
    private static globalInstance: Container | null = null;

    /**
     * Get or create the global container instance
     */
    static getInstance(): Container {
        if (!Container.globalInstance) {
            Container.globalInstance = new Container();
        }
        return Container.globalInstance;
    }

    /**
     * Reset the global container (useful for testing)
     */
    static reset(): void {
        Container.globalInstance = null;
    }

    /**
     * Register a transient dependency (new instance each time)
     *
     * @param token - Unique identifier for the dependency
     * @param factory - Factory function to create instances
     */
    registerTransient<T>(token: string, factory: Factory<T>): void {
        this.registrations.set(token, {
            factory,
            singleton: false,
        });
    }

    /**
     * Register a singleton dependency (same instance always)
     *
     * @param token - Unique identifier for the dependency
     * @param factory - Factory function to create the instance
     */
    registerSingleton<T>(token: string, factory: Factory<T>): void {
        this.registrations.set(token, {
            factory,
            singleton: true,
        });
    }

    /**
     * Register an existing instance
     *
     * @param token - Unique identifier for the dependency
     * @param instance - The instance to register
     */
    registerInstance<T>(token: string, instance: T): void {
        this.registrations.set(token, {
            factory: () => instance,
            singleton: true,
            instance,
        });
    }

    /**
     * Resolve a dependency
     *
     * @param token - Unique identifier for the dependency
     * @returns The resolved dependency
     * @throws Error if dependency is not registered
     */
    resolve<T>(token: string): T {
        const registration = this.registrations.get(token);

        if (!registration) {
            throw new Error(`Dependency not registered: ${token}`);
        }

        if (registration.singleton) {
            if (registration.instance === undefined) {
                registration.instance = registration.factory(this);
            }
            return registration.instance;
        }

        return registration.factory(this);
    }

    /**
     * Try to resolve a dependency, returning undefined if not registered
     *
     * @param token - Unique identifier for the dependency
     * @returns The resolved dependency or undefined
     */
    tryResolve<T>(token: string): T | undefined {
        try {
            return this.resolve(token);
        } catch {
            return undefined;
        }
    }

    /**
     * Check if a dependency is registered
     *
     * @param token - Unique identifier to check
     * @returns true if registered
     */
    isRegistered(token: string): boolean {
        return this.registrations.has(token);
    }

    /**
     * Unregister a dependency
     *
     * @param token - Unique identifier to remove
     */
    unregister(token: string): void {
        this.registrations.delete(token);
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.registrations.clear();
    }

    /**
     * Get all registered tokens
     */
    getRegisteredTokens(): string[] {
        return Array.from(this.registrations.keys());
    }
}

/**
 * Dependency tokens for the Quality System
 */
export const QualityTokens = {
    // Core components
    PatternDatabase: 'QualityPatternDatabase',
    PatternMatcher: 'PatternMatcher',
    PatternLearner: 'PatternLearner',
    PatternRecognizer: 'QualityPatternRecognizer',

    // Registry
    ConditionMatcherRegistry: 'ConditionMatcherRegistry',

    // Tools
    Flake8Adapter: 'Flake8Adapter',
    BlackAdapter: 'BlackAdapter',
    MyPyAdapter: 'MyPyAdapter',
    ESLintAdapter: 'ESLintAdapter',
    TypeScriptCompilerAdapter: 'TypeScriptCompilerAdapter',

    // Orchestrators
    QualityToolOrchestrator: 'QualityToolOrchestrator',
    QualityResultAggregator: 'QualityResultAggregator',

    // Integration
    QualityPatternIntegration: 'QualityPatternIntegration',
    AdaptationIntegration: 'AdaptationIntegration',

    // Configuration
    Config: 'QualityConfig',
    ProjectRoot: 'ProjectRoot',
} as const;

export type QualityToken = typeof QualityTokens[keyof typeof QualityTokens];
