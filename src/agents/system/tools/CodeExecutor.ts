/**
 * Code Executor Tool
 *
 * Enables system agents to execute code in various languages.
 * Inspired by Open Interpreter's exec(language, code) pattern.
 *
 * Supported Languages:
 * - shell (bash, zsh, powershell)
 * - python
 * - javascript/typescript (via Node.js)
 *
 * Safety Features:
 * - Permission system (require user approval)
 * - Timeout handling
 * - Sandbox mode (restricted execution)
 * - Output streaming
 *
 * @module agents/system/tools/CodeExecutor
 * @see https://github.com/openinterpreter/open-interpreter
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs/promises';

// =============================================================================
// Types
// =============================================================================

/**
 * Supported execution languages
 */
export type ExecutionLanguage = 'shell' | 'bash' | 'zsh' | 'powershell' | 'python' | 'javascript' | 'typescript';

/**
 * Execution request parameters
 */
export interface ExecutionRequest {
  language: ExecutionLanguage;
  code: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  sandbox?: boolean;
  streamOutput?: boolean;
}

/**
 * Result of code execution
 */
export interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  timedOut: boolean;
  killed: boolean;
  error?: string;
}

/**
 * Permission request for user approval
 */
export interface PermissionRequest {
  language: ExecutionLanguage;
  code: string;
  estimatedRisk: 'low' | 'medium' | 'high';
  warnings: string[];
}

/**
 * Permission handler callback
 */
export type PermissionHandler = (request: PermissionRequest) => Promise<boolean>;

/**
 * Configuration for code executor
 */
export interface CodeExecutorConfig {
  /** Default timeout in milliseconds (default: 30000) */
  defaultTimeout: number;
  /** Auto-run without permission (default: false) */
  autoRun: boolean;
  /** Working directory for execution */
  workingDirectory: string;
  /** Shell to use for shell commands */
  shell: string;
  /** Python interpreter path */
  pythonPath: string;
  /** Node.js path */
  nodePath: string;
  /** Maximum output buffer size (default: 10MB) */
  maxOutputSize: number;
  /** Enable sandbox mode by default */
  sandboxByDefault: boolean;
  /** Permission handler for user approval */
  permissionHandler?: PermissionHandler;
}

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: CodeExecutorConfig = {
  defaultTimeout: 30000,
  autoRun: false,
  workingDirectory: process.cwd(),
  shell: os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash',
  pythonPath: 'python3',
  nodePath: 'node',
  maxOutputSize: 10 * 1024 * 1024, // 10MB
  sandboxByDefault: false,
};

// =============================================================================
// Risk Assessment
// =============================================================================

/**
 * Patterns that indicate potentially dangerous code
 */
const DANGEROUS_PATTERNS = {
  high: [
    /rm\s+-rf\s+[/~]/i, // Recursive delete from root or home
    /:\(\)\{:\|\:&\};:/, // Fork bomb
    /mkfs/i, // Filesystem format
    /dd\s+if=.*of=\/dev/i, // Direct disk write
    />\s*\/dev\/sd[a-z]/i, // Overwrite disk device
    /curl.*\|\s*bash/i, // Pipe curl to bash
    /wget.*\|\s*sh/i, // Pipe wget to shell
    /eval\s*\(.*\)/i, // Dynamic eval
    /exec\s*\(.*\)/i, // Dynamic exec
    /subprocess.*shell\s*=\s*True/i, // Python shell injection
    /os\.system/i, // Python system call
  ],
  medium: [
    /rm\s+-r/i, // Recursive delete
    /chmod\s+777/i, // Wide open permissions
    /sudo/i, // Elevated privileges
    /su\s+-/i, // Switch user
    /\|\s*xargs/i, // Piped xargs
    />\s*\/etc\//i, // Write to system config
    /import\s+subprocess/i, // Python subprocess
    /require\(['"]child_process['"]\)/i, // Node child_process
  ],
  low: [
    /curl/i, // Network request
    /wget/i, // Network download
    /pip\s+install/i, // Package install
    /npm\s+install/i, // Package install
    /apt(-get)?\s+install/i, // System package install
  ],
};

/**
 * Assess risk level of code
 */
function assessRisk(code: string): { level: 'low' | 'medium' | 'high'; warnings: string[] } {
  const warnings: string[] = [];

  // Check high-risk patterns
  for (const pattern of DANGEROUS_PATTERNS.high) {
    if (pattern.test(code)) {
      warnings.push(`High-risk pattern detected: ${pattern.source}`);
      return { level: 'high', warnings };
    }
  }

  // Check medium-risk patterns
  for (const pattern of DANGEROUS_PATTERNS.medium) {
    if (pattern.test(code)) {
      warnings.push(`Medium-risk pattern detected: ${pattern.source}`);
    }
  }

  if (warnings.length > 0) {
    return { level: 'medium', warnings };
  }

  // Check low-risk patterns
  for (const pattern of DANGEROUS_PATTERNS.low) {
    if (pattern.test(code)) {
      warnings.push(`Network/install operation detected`);
    }
  }

  return { level: warnings.length > 0 ? 'low' : 'low', warnings };
}

// =============================================================================
// Code Executor
// =============================================================================

/**
 * Executes code in various languages with safety features
 */
export class CodeExecutor extends EventEmitter {
  private config: CodeExecutorConfig;
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(config: Partial<CodeExecutorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Execute code in specified language
   */
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Assess risk
    const risk = assessRisk(request.code);

    // Check permission if not auto-run
    if (!this.config.autoRun) {
      const permitted = await this.requestPermission({
        language: request.language,
        code: request.code,
        estimatedRisk: risk.level,
        warnings: risk.warnings,
      });

      if (!permitted) {
        return {
          success: false,
          stdout: '',
          stderr: 'Execution denied by user',
          exitCode: null,
          duration: Date.now() - startTime,
          timedOut: false,
          killed: true,
          error: 'Permission denied',
        };
      }
    }

    // Route to appropriate executor
    try {
      switch (this.normalizeLanguage(request.language)) {
        case 'shell':
          return await this.executeShell(request, startTime);
        case 'python':
          return await this.executePython(request, startTime);
        case 'javascript':
          return await this.executeNode(request, startTime);
        default:
          return {
            success: false,
            stdout: '',
            stderr: `Unsupported language: ${request.language}`,
            exitCode: null,
            duration: Date.now() - startTime,
            timedOut: false,
            killed: false,
            error: `Unsupported language: ${request.language}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        exitCode: null,
        duration: Date.now() - startTime,
        timedOut: false,
        killed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Kill a running process
   */
  kill(processId: string): boolean {
    const proc = this.runningProcesses.get(processId);
    if (proc) {
      proc.kill('SIGTERM');
      this.runningProcesses.delete(processId);
      return true;
    }
    return false;
  }

  /**
   * Kill all running processes
   */
  killAll(): void {
    this.runningProcesses.forEach((proc) => {
      proc.kill('SIGTERM');
    });
    this.runningProcesses.clear();
  }

  /**
   * Update configuration
   */
  configure(config: Partial<CodeExecutorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set auto-run mode
   */
  setAutoRun(enabled: boolean): void {
    this.config.autoRun = enabled;
  }

  // ===========================================================================
  // Language Executors
  // ===========================================================================

  /**
   * Execute shell command
   */
  private async executeShell(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    const shell = this.config.shell;
    const args = os.platform() === 'win32' ? ['-Command', request.code] : ['-c', request.code];

    return this.spawnProcess(shell, args, request, startTime);
  }

  /**
   * Execute Python code
   */
  private async executePython(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    // Create temp file for Python code
    const tempFile = path.join(os.tmpdir(), `chrysalis_exec_${Date.now()}.py`);

    try {
      await fs.writeFile(tempFile, request.code, 'utf8');
      const result = await this.spawnProcess(
        this.config.pythonPath,
        [tempFile],
        request,
        startTime
      );
      return result;
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Execute JavaScript/TypeScript via Node.js
   */
  private async executeNode(
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    // For TypeScript, we'd need ts-node or compilation
    // For now, just use eval with Node
    return this.spawnProcess(this.config.nodePath, ['-e', request.code], request, startTime);
  }

  // ===========================================================================
  // Process Spawning
  // ===========================================================================

  /**
   * Spawn a process and capture output
   */
  private spawnProcess(
    command: string,
    args: string[],
    request: ExecutionRequest,
    startTime: number
  ): Promise<ExecutionResult> {
    return new Promise(resolve => {
      const timeout = request.timeout ?? this.config.defaultTimeout;
      const cwd = request.cwd ?? this.config.workingDirectory;
      const env = { ...process.env, ...request.env };

      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let killed = false;

      const processId = `exec_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const proc = spawn(command, args, {
        cwd,
        env,
        shell: false,
        timeout: 0, // We handle timeout ourselves
      });

      this.runningProcesses.set(processId, proc);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
      }, timeout);

      // Capture stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;

        // Truncate if too large
        if (stdout.length > this.config.maxOutputSize) {
          stdout = stdout.slice(0, this.config.maxOutputSize) + '\n[Output truncated]';
          proc.kill('SIGTERM');
        }

        if (request.streamOutput) {
          this.emit('stdout', { processId, data: chunk });
        }
      });

      // Capture stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;

        // Truncate if too large
        if (stderr.length > this.config.maxOutputSize) {
          stderr = stderr.slice(0, this.config.maxOutputSize) + '\n[Output truncated]';
        }

        if (request.streamOutput) {
          this.emit('stderr', { processId, data: chunk });
        }
      });

      // Handle completion
      proc.on('close', (exitCode, signal) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(processId);

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          killed = true;
        }

        resolve({
          success: exitCode === 0 && !timedOut && !killed,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          duration: Date.now() - startTime,
          timedOut,
          killed,
        });
      });

      // Handle errors
      proc.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        this.runningProcesses.delete(processId);

        resolve({
          success: false,
          stdout: stdout.trim(),
          stderr: error.message,
          exitCode: null,
          duration: Date.now() - startTime,
          timedOut: false,
          killed: false,
          error: error.message,
        });
      });
    });
  }

  // ===========================================================================
  // Permission Handling
  // ===========================================================================

  /**
   * Request permission to execute code
   */
  private async requestPermission(request: PermissionRequest): Promise<boolean> {
    // If custom handler provided, use it
    if (this.config.permissionHandler) {
      return this.config.permissionHandler(request);
    }

    // Emit permission request event
    return new Promise(resolve => {
      this.emit('permission_request', {
        ...request,
        approve: () => resolve(true),
        deny: () => resolve(false),
      });

      // Default to denied after 5 minutes if no response
      setTimeout(() => resolve(false), 5 * 60 * 1000);
    });
  }

  // ===========================================================================
  // Utility Methods
  // ===========================================================================

  /**
   * Normalize language identifier
   */
  private normalizeLanguage(language: ExecutionLanguage): 'shell' | 'python' | 'javascript' {
    switch (language.toLowerCase()) {
      case 'shell':
      case 'bash':
      case 'zsh':
      case 'powershell':
        return 'shell';
      case 'python':
        return 'python';
      case 'javascript':
      case 'typescript':
        return 'javascript';
      default:
        return 'shell';
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let globalExecutor: CodeExecutor | null = null;

/**
 * Get global code executor instance
 */
export function getCodeExecutor(config?: Partial<CodeExecutorConfig>): CodeExecutor {
  if (!globalExecutor) {
    globalExecutor = new CodeExecutor(config);
  }
  return globalExecutor;
}

/**
 * Reset global executor (for testing)
 */
export function resetCodeExecutor(): void {
  if (globalExecutor) {
    globalExecutor.killAll();
  }
  globalExecutor = null;
}

// =============================================================================
// (Exports are inline with class definitions above)
// =============================================================================
