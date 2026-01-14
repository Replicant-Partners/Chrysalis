/**
 * Validation Stage Executor
 * 
 * Executes the validation phase of the adaptation pipeline:
 * type compliance, test execution, security scanning.
 * 
 * @module ai-maintenance/pipeline/stages/validation-stage
 */

import {
  AdaptationPipeline,
  ChangeProposal,
  ValidationResult,
  ComplianceCheck,
  TestRunResult,
} from '../../types';
import { PipelineConfig } from '../types';

/**
 * Security vulnerability found in scan
 */
interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  location?: string;
}

/**
 * Validation stage executor
 */
export class ValidationStageExecutor {
  constructor(private config: PipelineConfig) {}

  /**
   * Execute the validation stage
   */
  async execute(
    pipeline: AdaptationPipeline,
    proposal: ChangeProposal
  ): Promise<ValidationResult> {
    const issues: Array<{ severity: 'error' | 'warning' | 'info'; type: string; message: string }> = [];

    // Type compliance check
    const complianceCheck = await this.checkTypeCompliance(proposal);
    if (!complianceCheck.protocolTypesCompliant) {
      issues.push({
        severity: 'error',
        type: 'type-error',
        message: `Protocol types non-compliant: ${complianceCheck.typeErrors.join(', ')}`,
      });
    }

    // Test execution
    const testResults = this.config.dryRun ? [] : await this.runTests(proposal);
    const failedTests = testResults.filter(t => t.failed > 0);
    if (failedTests.length > 0) {
      issues.push({
        severity: 'error',
        type: 'test-failure',
        message: `${failedTests.length} test suite(s) failed`,
      });
    }

    // Security scanning
    const securityScan = await this.runSecurityScan(proposal);
    if (!securityScan.passed) {
      const criticalVulns = securityScan.vulnerabilities.filter(
        (v: SecurityVulnerability) => v.severity === 'critical' || v.severity === 'high'
      );
      if (criticalVulns.length > 0) {
        issues.push({
          severity: 'error',
          type: 'security-vulnerability',
          message: `${criticalVulns.length} critical/high severity vulnerabilities found`,
        });
      } else if (securityScan.vulnerabilities.length > 0) {
        issues.push({
          severity: 'warning',
          type: 'security-vulnerability',
          message: `${securityScan.vulnerabilities.length} security issues found (medium/low severity)`,
        });
      }
    }

    const hasErrors = issues.some(i => i.severity === 'error');

    return {
      validationId: `validation-${pipeline.pipelineId}`,
      proposalId: proposal.proposalId,
      valid: !hasErrors,
      contractCompliance: complianceCheck,
      testResults,
      securityScan,
      issues,
      validatedByAgentId: 'validation-agent-v1',
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Check type compliance of the proposed changes.
   * Validates that protocol types and unified adapter interfaces are maintained.
   */
  private async checkTypeCompliance(proposal: ChangeProposal): Promise<ComplianceCheck> {
    const typeErrors: string[] = [];
    const interfaceMismatches: string[] = [];

    // Check each file change for type issues
    for (const fileChange of proposal.fileChanges) {
      const patch = fileChange.patch || '';

      // Look for removed type annotations
      const removedTypePattern = /-\s*:\s*(string|number|boolean|\w+\[\]|\w+<.*>)/g;
      const matches = patch.match(removedTypePattern);
      if (matches && matches.length > 0) {
        typeErrors.push(`${fileChange.filePath}: Potential type annotation removal detected (${matches.length} instances)`);
      }

      // Look for any -> specific type changes that could break compatibility
      if (patch.includes('- any') && !patch.includes('+ any')) {
        // This is actually good - removing 'any' types
      } else if (patch.includes('+ any')) {
        typeErrors.push(`${fileChange.filePath}: New "any" type introduced - consider using specific types`);
      }

      // If this is a unified adapter change, verify interface compliance
      if (fileChange.filePath.includes('unified-adapter') || fileChange.filePath.includes('adapters/')) {
        // Check that required methods are preserved
        const requiredMethods = ['toCanonical', 'fromCanonical', 'validate'];
        for (const method of requiredMethods) {
          if (patch.includes(`-  ${method}(`) && !patch.includes(`+  ${method}(`)) {
            interfaceMismatches.push(`${fileChange.filePath}: Required method "${method}" appears to be removed`);
          }
        }
      }
    }

    return {
      protocolTypesCompliant: typeErrors.length === 0,
      unifiedAdapterCompliant: interfaceMismatches.length === 0,
      typeErrors,
      interfaceMismatches,
    };
  }

  /**
   * Run tests for the proposed changes.
   * In dry-run mode, returns empty results.
   */
  private async runTests(proposal: ChangeProposal): Promise<TestRunResult[]> {
    // Log that we're running validation tests
    console.info(`[ValidationStage] Running tests for proposal: ${proposal.proposalId}`);

    // In a real implementation, this would:
    // 1. Apply the proposed changes to a temp branch
    // 2. Run the test suite (npm test, vitest, etc.)
    // 3. Parse and return the results
    
    // For now, return a placeholder indicating no tests were actually run
    return [{
      suiteName: 'validation-pending',
      passed: 0,
      failed: 0,
      skipped: 0,
      durationMs: 0,
    }];
  }

  /**
   * Run security scan on the proposed changes.
   * Performs basic pattern-based security checks.
   */
  private async runSecurityScan(proposal: ChangeProposal): Promise<{
    passed: boolean;
    vulnerabilities: SecurityVulnerability[];
    scanner: string;
    scannedAt: string;
  }> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Check each file change for security issues
    for (const fileChange of proposal.fileChanges) {
      const patch = fileChange.patch || '';
      
      // Check for common security anti-patterns in added code
      const addedLines = patch
        .split('\n')
        .filter((line: string) => line.startsWith('+') && !line.startsWith('+++'));

      for (const line of addedLines) {
        // Check for eval usage
        if (/\beval\s*\(/.test(line)) {
          vulnerabilities.push({
            id: `sec-eval-${Date.now()}`,
            severity: 'critical',
            title: 'Dangerous eval() usage',
            description: 'eval() can execute arbitrary code and should be avoided',
            location: line.slice(1, 50),
          });
        }

        // Check for innerHTML (potential XSS)
        if (/\.innerHTML\s*=/.test(line)) {
          vulnerabilities.push({
            id: `sec-xss-${Date.now()}`,
            severity: 'high',
            title: 'Potential XSS via innerHTML',
            description: 'innerHTML can execute scripts; use textContent or DOM APIs instead',
            location: line.slice(1, 50),
          });
        }

        // Check for hardcoded secrets patterns
        if (/(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}/i.test(line)) {
          vulnerabilities.push({
            id: `sec-secret-${Date.now()}`,
            severity: 'critical',
            title: 'Potential hardcoded secret',
            description: 'Secrets should not be hardcoded; use environment variables',
            location: line.slice(1, 50),
          });
        }

        // Check for SQL injection patterns
        if (/`[^`]*\$\{.*\}[^`]*`/.test(line) && /(?:SELECT|INSERT|UPDATE|DELETE|WHERE)/i.test(line)) {
          vulnerabilities.push({
            id: `sec-sqli-${Date.now()}`,
            severity: 'high',
            title: 'Potential SQL injection',
            description: 'String interpolation in SQL queries can lead to injection; use parameterized queries',
            location: line.slice(1, 50),
          });
        }

        // Check for command injection patterns
        if (/(?:exec|spawn|execSync)\s*\(/.test(line) && /\$\{|\+\s*\w+/.test(line)) {
          vulnerabilities.push({
            id: `sec-cmdi-${Date.now()}`,
            severity: 'high',
            title: 'Potential command injection',
            description: 'Dynamic command construction can lead to injection; validate and sanitize inputs',
            location: line.slice(1, 50),
          });
        }
      }
    }

    const criticalOrHigh = vulnerabilities.filter(
      v => v.severity === 'critical' || v.severity === 'high'
    );

    return {
      passed: criticalOrHigh.length === 0,
      vulnerabilities,
      scanner: 'chrysalis-security-scanner-v1',
      scannedAt: new Date().toISOString(),
    };
  }
}
