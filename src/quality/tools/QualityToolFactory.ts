/**
 * Quality Tool Factory
 *
 * Centralizes creation of quality tools.
 *
 * Design Pattern: Factory Method Pattern (GoF, p. 107)
 * - Encapsulates instantiation logic for Python and TypeScript tools
 * - Simplifies addition of new tools
 *
 * References:
 * - Gamma, E., Helm, R., Johnson, R., & Vlissides, J. (1994). Design Patterns:
 *   Elements of Reusable Object-Oriented Software. Addison-Wesley. p. 107-116.
 */

import {
    Flake8Adapter,
    BlackAdapter,
    MyPyAdapter,
} from './PythonToolsAdapter';
import {
    ESLintAdapter,
    TypeScriptCompilerAdapter,
} from './TypeScriptToolsAdapter';
import { IQualityTool } from './QualityToolInterface';

const PYTHON_TOOLS = ['flake8', 'black', 'mypy'] as const;
const TS_TOOLS = ['eslint', 'tsc', 'typescript'] as const;

export type SupportedPythonTool = (typeof PYTHON_TOOLS)[number];
export type SupportedTsTool = (typeof TS_TOOLS)[number];

/**
 * Factory for creating quality tools by name.
 */
export class QualityToolFactory {
    /**
     * Create Python quality tool by name.
     */
    static createPythonTool(
        toolName: SupportedPythonTool,
        projectRoot: string
    ): IQualityTool {
        switch (toolName) {
            case 'flake8':
                return new Flake8Adapter(projectRoot);
            case 'black':
                return new BlackAdapter(projectRoot);
            case 'mypy':
                return new MyPyAdapter(projectRoot);
            default:
                throw new Error(`Unknown Python tool: ${toolName}`);
        }
    }

    /**
     * Create TypeScript quality tool by name.
     */
    static createTypeScriptTool(
        toolName: SupportedTsTool,
        projectRoot: string
    ): IQualityTool {
        switch (toolName) {
            case 'eslint':
                return new ESLintAdapter(projectRoot);
            case 'tsc':
            case 'typescript':
                return new TypeScriptCompilerAdapter(projectRoot);
            default:
                throw new Error(`Unknown TypeScript tool: ${toolName}`);
        }
    }

    /**
     * Create tool by name (auto-detect language).
     */
    static createTool(
        toolName: string,
        projectRoot: string
    ): IQualityTool {
        const lower = toolName.toLowerCase();
        if ((PYTHON_TOOLS as readonly string[]).includes(lower)) {
            return this.createPythonTool(lower as SupportedPythonTool, projectRoot);
        }
        if ((TS_TOOLS as readonly string[]).includes(lower)) {
            return this.createTypeScriptTool(lower as SupportedTsTool, projectRoot);
        }
        throw new Error(`Unknown quality tool: ${toolName}`);
    }

    /**
     * Create all supported tools.
     */
    static createAllTools(projectRoot: string): IQualityTool[] {
        const python = PYTHON_TOOLS.map((name) =>
            this.createPythonTool(name, projectRoot)
        );
        const ts = TS_TOOLS.map((name) =>
            this.createTypeScriptTool(name, projectRoot)
        );
        return [...python, ...ts];
    }
}
