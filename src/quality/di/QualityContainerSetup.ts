/**
 * Quality Container Setup
 *
 * Configures the DI container with Quality System dependencies.
 *
 * Design Pattern: Composition Root (Mark Seemann)
 * - Single place where dependencies are wired together
 * - Separates configuration from usage
 *
 * References:
 * - Seemann, M. (2011). Dependency Injection in .NET. Manning. Chapter 3.
 */

import { Container, QualityTokens } from './Container';
import { QualityPatternDatabase } from '../patterns/QualityPatternDatabase';
import { PatternMatcher } from '../patterns/PatternMatcher';
import { PatternLearner } from '../patterns/PatternLearner';
import { QualityPatternRecognizer } from '../patterns/QualityPatternRecognizer';
import { createDefaultRegistry, ConditionMatcherRegistry } from '../patterns/matchers';
import { Flake8Adapter, BlackAdapter, MyPyAdapter } from '../tools/PythonToolsAdapter';
import { ESLintAdapter, TypeScriptCompilerAdapter } from '../tools/TypeScriptToolsAdapter';
import { QualityToolOrchestrator } from '../tools/QualityToolOrchestrator';
import { QualityResultAggregator } from '../tools/QualityResultAggregator';
import { QualityPatternIntegration } from '../integration/QualityPatternIntegration';

/**
 * Quality System Configuration
 */
export interface QualityConfig {
    projectRoot: string;
    patternStoragePath?: string;
    minConfidence?: number;
    minFrequency?: number;
    enableLearning?: boolean;
    enableAutoFix?: boolean;
    enablePythonTools?: boolean;
    enableTypeScriptTools?: boolean;
}

/**
 * Setup the Quality System DI container
 *
 * @param container - The container to configure
 * @param config - Configuration options
 */
export function setupQualityContainer(
    container: Container,
    config: QualityConfig
): void {
    // Register configuration
    container.registerInstance(QualityTokens.Config, config);
    container.registerInstance(QualityTokens.ProjectRoot, config.projectRoot);

    // Register pattern system components (singletons)
    container.registerSingleton(QualityTokens.ConditionMatcherRegistry, () => {
        return createDefaultRegistry();
    });

    container.registerSingleton(QualityTokens.PatternDatabase, (c) => {
        const cfg = c.resolve<QualityConfig>(QualityTokens.Config);
        return new QualityPatternDatabase(cfg.patternStoragePath);
    });

    container.registerSingleton(QualityTokens.PatternMatcher, (c) => {
        const registry = c.resolve<ConditionMatcherRegistry>(QualityTokens.ConditionMatcherRegistry);
        return new PatternMatcher(registry);
    });

    container.registerSingleton(QualityTokens.PatternLearner, (c) => {
        const database = c.resolve<QualityPatternDatabase>(QualityTokens.PatternDatabase);
        const cfg = c.resolve<QualityConfig>(QualityTokens.Config);
        return new PatternLearner(
            database,
            cfg.minFrequency ?? 3,
            cfg.minConfidence ?? 0.5
        );
    });

    container.registerSingleton(QualityTokens.PatternRecognizer, (c) => {
        const database = c.resolve<QualityPatternDatabase>(QualityTokens.PatternDatabase);
        const cfg = c.resolve<QualityConfig>(QualityTokens.Config);
        return new QualityPatternRecognizer(database, {
            min_confidence: cfg.minConfidence ?? 0.5,
            min_frequency: cfg.minFrequency ?? 3,
            enable_learning: cfg.enableLearning ?? true,
            enable_auto_fix: cfg.enableAutoFix ?? false,
            pattern_storage_path: cfg.patternStoragePath,
        });
    });

    // Register Python tool adapters (if enabled)
    if (config.enablePythonTools !== false) {
        container.registerSingleton(QualityTokens.Flake8Adapter, (c) => {
            const root = c.resolve<string>(QualityTokens.ProjectRoot);
            return new Flake8Adapter(root);
        });

        container.registerSingleton(QualityTokens.BlackAdapter, (c) => {
            const root = c.resolve<string>(QualityTokens.ProjectRoot);
            return new BlackAdapter(root);
        });

        container.registerSingleton(QualityTokens.MyPyAdapter, (c) => {
            const root = c.resolve<string>(QualityTokens.ProjectRoot);
            return new MyPyAdapter(root);
        });
    }

    // Register TypeScript tool adapters (if enabled)
    if (config.enableTypeScriptTools !== false) {
        container.registerSingleton(QualityTokens.ESLintAdapter, (c) => {
            const root = c.resolve<string>(QualityTokens.ProjectRoot);
            return new ESLintAdapter(root);
        });

        container.registerSingleton(QualityTokens.TypeScriptCompilerAdapter, (c) => {
            const root = c.resolve<string>(QualityTokens.ProjectRoot);
            return new TypeScriptCompilerAdapter(root);
        });
    }

    // Register orchestrator and aggregator
    container.registerSingleton(QualityTokens.QualityToolOrchestrator, (c) => {
        const orchestrator = new QualityToolOrchestrator();

        // Register available tools
        if (config.enablePythonTools !== false) {
            orchestrator.registerTool(c.resolve(QualityTokens.Flake8Adapter));
            orchestrator.registerTool(c.resolve(QualityTokens.BlackAdapter));
            orchestrator.registerTool(c.resolve(QualityTokens.MyPyAdapter));
        }

        if (config.enableTypeScriptTools !== false) {
            orchestrator.registerTool(c.resolve(QualityTokens.ESLintAdapter));
            orchestrator.registerTool(c.resolve(QualityTokens.TypeScriptCompilerAdapter));
        }

        return orchestrator;
    });

    container.registerSingleton(QualityTokens.QualityResultAggregator, () => {
        return new QualityResultAggregator();
    });

    // Register integration
    container.registerSingleton(QualityTokens.QualityPatternIntegration, (c) => {
        const orchestrator = c.resolve<QualityToolOrchestrator>(QualityTokens.QualityToolOrchestrator);
        const recognizer = c.resolve<QualityPatternRecognizer>(QualityTokens.PatternRecognizer);
        return new QualityPatternIntegration(orchestrator, recognizer);
    });
}

/**
 * Create a pre-configured Quality System container
 *
 * @param config - Configuration options
 * @returns Configured container
 */
export function createQualityContainer(config: QualityConfig): Container {
    const container = new Container();
    setupQualityContainer(container, config);
    return container;
}
