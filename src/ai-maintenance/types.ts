/**
 * AI-Led Adaptive Maintenance System - Core Types
 * 
 * Type definitions for the autonomous monitoring, analysis, and adaptation
 * system that maintains protocol adapters and codebase health.
 * 
 * @module ai-maintenance/types
 * @version 1.0.0
 */

import { AgentFramework } from '../adapters/protocol-types';

// ============================================================================
// Pattern Categories and Severity
// ============================================================================

/**
 * Categories of evolutionary patterns.
 */
export type PatternCategory = 
  | 'dependency-management'  // External dependency updates
  | 'interface-evolution'    // API changes and deprecations
  | 'data-evolution'         // Schema and format changes
  | 'protocol-evolution'     // Protocol extensions and changes
  | 'security'               // Security vulnerabilities
  | 'operational'            // Performance and reliability
  | 'architectural';         // Structural changes

/**
 * Severity levels for patterns.
 */
export type PatternSeverity = 
  | 'critical'   // Requires immediate attention
  | 'high'       // Should be addressed soon
  | 'medium'     // Can be scheduled
  | 'low'        // Nice to have
  | 'info';      // Informational only

/**
 * Expected frequency of pattern occurrence.
 */
export type PatternFrequency = 
  | 'daily'      // Expected daily
  | 'weekly'     // Expected weekly
  | 'monthly'    // Expected monthly
  | 'quarterly'  // Expected quarterly
  | 'rare';      // Occurs infrequently

/**
 * Automation level for remediation.
 */
export type AutomationLevel = 
  | 'fully-automatic'       // No human intervention needed
  | 'semi-automatic'        // Human review required
  | 'assisted'              // AI suggests, human implements
  | 'manual';               // Human-driven with AI support

// ============================================================================
// Detection Heuristics and Triggers
// ============================================================================

/**
 * Detection heuristic for identifying patterns.
 */
export interface DetectionHeuristic {
  /** Unique heuristic identifier */
  heuristicId: string;
  /** Heuristic name */
  name: string;
  /** Heuristic type */
  type: HeuristicType;
  /** Detection configuration */
  config: Record<string, unknown>;
  /** Confidence weight (0.0 - 1.0) */
  weight: number;
  /** Is this heuristic enabled? */
  enabled: boolean;
}

/**
 * Types of detection heuristics.
 */
export type HeuristicType = 
  | 'semver-comparison'      // Semantic version comparison
  | 'changelog-analysis'     // Parse changelog/release notes
  | 'api-surface-diff'       // Compare API signatures
  | 'schema-diff'            // Compare data schemas
  | 'deprecation-scan'       // Scan for deprecation notices
  | 'security-advisory'      // Check security advisories
  | 'metrics-anomaly'        // Detect metric anomalies
  | 'pattern-match'          // Regex/AST pattern matching
  | 'llm-analysis';          // LLM-based analysis

/**
 * Trigger condition for pattern activation.
 */
export interface TriggerCondition {
  /** Condition identifier */
  conditionId: string;
  /** Condition type */
  type: TriggerType;
  /** Condition threshold or value */
  threshold?: number | string;
  /** Comparison operator */
  operator?: ComparisonOperator;
  /** Time window for evaluation */
  timeWindowMs?: number;
  /** Minimum occurrences before trigger */
  minOccurrences?: number;
  /** Is condition active? */
  active: boolean;
}

/**
 * Types of trigger conditions.
 */
export type TriggerType = 
  | 'version-change'         // New version released
  | 'deprecation-notice'     // Deprecation detected
  | 'breaking-change'        // Breaking change detected
  | 'security-alert'         // Security vulnerability found
  | 'metrics-breach'         // Metrics threshold breached
  | 'error-spike'            // Error rate increased
  | 'schema-change'          // Schema modification detected
  | 'capability-change';     // New capability or removal

/**
 * Comparison operators for triggers.
 */
export type ComparisonOperator = 
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' 
  | 'contains' | 'matches' | 'in' | 'not-in';

// ============================================================================
// Anticipatory Structures and Remediation
// ============================================================================

/**
 * Anticipatory code structure for proactive adaptation.
 */
export interface AnticipatoryStructure {
  /** Structure identifier */
  structureId: string;
  /** Structure name */
  name: string;
  /** Structure type */
  type: StructureType;
  /** Code template or pattern */
  template?: string;
  /** File locations where structure applies */
  locations: string[];
  /** Prerequisites for implementation */
  prerequisites?: string[];
  /** Estimated implementation effort */
  effortHours?: number;
}

/**
 * Types of anticipatory structures.
 */
export type StructureType = 
  | 'version-negotiation'    // Handle multiple versions
  | 'compatibility-layer'    // Bridge between versions
  | 'feature-flag'           // Toggle functionality
  | 'fallback-handler'       // Graceful degradation
  | 'schema-migration'       // Data transformation
  | 'adapter-interface'      // Pluggable adapter
  | 'circuit-breaker'        // Fault tolerance
  | 'retry-policy';          // Resilience pattern

/**
 * Remediation strategy for pattern response.
 */
export interface RemediationStrategy {
  /** Strategy identifier */
  strategyId: string;
  /** Strategy name */
  name: string;
  /** Strategy type */
  type: RemediationType;
  /** Automation level */
  automationLevel: AutomationLevel;
  /** Steps to execute */
  steps: RemediationStep[];
  /** Estimated duration in minutes */
  estimatedDurationMinutes?: number;
  /** Rollback procedure */
  rollbackProcedure?: string;
  /** Success criteria */
  successCriteria?: string[];
}

/**
 * Types of remediation strategies.
 */
export type RemediationType = 
  | 'update-dependency'      // Update to new version
  | 'apply-patch'            // Apply security patch
  | 'generate-adapter'       // Generate adapter code
  | 'create-shim'            // Create compatibility shim
  | 'migrate-schema'         // Migrate data schema
  | 'configure-feature'      // Toggle feature flag
  | 'scale-resource'         // Adjust resources
  | 'notify-team';           // Human notification

/**
 * Individual step in a remediation strategy.
 */
export interface RemediationStep {
  /** Step order */
  order: number;
  /** Step description */
  description: string;
  /** Step action type */
  action: StepAction;
  /** Action parameters */
  parameters: Record<string, unknown>;
  /** Is step optional? */
  optional: boolean;
  /** Condition for execution */
  condition?: string;
}

/**
 * Step action types.
 */
export type StepAction = 
  | 'execute-command'        // Run CLI command
  | 'modify-file'            // Modify source file
  | 'create-file'            // Create new file
  | 'delete-file'            // Delete file
  | 'invoke-llm'             // Use LLM agent
  | 'run-tests'              // Execute tests
  | 'deploy-staged'          // Staged deployment
  | 'send-notification'      // Notify stakeholders
  | 'await-approval';        // Wait for human approval

// ============================================================================
// Pattern Specification
// ============================================================================

/**
 * Complete evolutionary pattern specification.
 */
export interface EvolutionaryPattern {
  /** Unique pattern identifier */
  patternId: string;
  /** Human-readable pattern name */
  patternName: string;
  /** Pattern category */
  category: PatternCategory;
  /** Detailed description */
  description: string;
  /** Pattern version */
  version: string;
  
  // Detection
  /** Heuristics for detecting this pattern */
  detectionHeuristics: DetectionHeuristic[];
  /** Conditions that trigger this pattern */
  triggerConditions: TriggerCondition[];
  
  // Response
  /** Anticipatory code structures */
  anticipatoryStructures: AnticipatoryStructure[];
  /** Remediation strategies */
  remediationStrategies: RemediationStrategy[];
  
  // Metadata
  /** Pattern severity */
  severity: PatternSeverity;
  /** Expected frequency */
  frequency: PatternFrequency;
  /** Automation capability */
  automationLevel: AutomationLevel;
  /** Confidence in pattern (0.0 - 1.0) */
  confidence: number;
  /** Applicable frameworks/protocols */
  applicableTo?: AgentFramework[];
  /** Related patterns */
  relatedPatterns?: string[];
  
  // Examples
  /** Real-world examples */
  examples: PatternExample[];
  
  // Status
  /** Is pattern active? */
  active: boolean;
  /** Creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Example of pattern occurrence.
 */
export interface PatternExample {
  /** Example title */
  title: string;
  /** Description of the example */
  description: string;
  /** When it occurred */
  occurredAt?: string;
  /** Before state */
  before?: string;
  /** After state */
  after?: string;
  /** Lessons learned */
  lessonsLearned?: string[];
}

// ============================================================================
// Repository Monitoring
// ============================================================================

/**
 * Watched repository configuration.
 */
export interface WatchedRepository {
  /** Repository identifier */
  repositoryId: string;
  /** Repository name */
  name: string;
  /** Repository type */
  type: RepositoryType;
  /** Repository URL */
  url: string;
  /** Associated protocol/framework */
  protocol?: AgentFramework;
  /** Paths to watch (glob patterns) */
  watchPaths?: string[];
  /** Paths to ignore (glob patterns) */
  ignorePaths?: string[];
  /** Branch to monitor */
  branch?: string;
  /** Polling interval in milliseconds */
  pollIntervalMs?: number;
  /** Last checked timestamp */
  lastCheckedAt?: string;
  /** Last known commit/version */
  lastKnownVersion?: string;
  /** Is monitoring active? */
  active: boolean;
}

/**
 * Repository types.
 */
export type RepositoryType = 
  | 'git'           // Git repository
  | 'npm'           // NPM package
  | 'pypi'          // Python package
  | 'documentation' // Documentation site
  | 'rss'           // RSS/Atom feed
  | 'api';          // API endpoint

/**
 * Change detected in a repository.
 */
export interface RepositoryChange {
  /** Change identifier */
  changeId: string;
  /** Repository where change occurred */
  repositoryId: string;
  /** Change type */
  changeType: ChangeType;
  /** Previous version/commit */
  previousVersion?: string;
  /** Current version/commit */
  currentVersion: string;
  /** Change timestamp */
  detectedAt: string;
  /** Change summary */
  summary: string;
  /** Detailed change description */
  details?: string;
  /** Changed files/paths */
  changedPaths?: string[];
  /** Semantic diff result */
  semanticDiff?: SemanticDiff;
  /** Matched patterns */
  matchedPatterns?: string[];
  /** Processing status */
  status: ChangeStatus;
}

/**
 * Types of repository changes.
 */
export type ChangeType = 
  | 'version-release'       // New version released
  | 'commit'                // New commit(s)
  | 'tag'                   // New tag
  | 'documentation-update'  // Docs changed
  | 'security-advisory'     // Security notice
  | 'deprecation';          // Deprecation announcement

/**
 * Change processing status.
 */
export type ChangeStatus = 
  | 'detected'     // Change detected
  | 'analyzing'    // Being analyzed
  | 'analyzed'     // Analysis complete
  | 'generating'   // Generating response
  | 'reviewing'    // Under review
  | 'approved'     // Approved for deployment
  | 'deploying'    // Being deployed
  | 'deployed'     // Successfully deployed
  | 'rejected'     // Rejected by review
  | 'failed';      // Failed to process

// ============================================================================
// Semantic Diff Analysis
// ============================================================================

/**
 * Semantic diff result.
 */
export interface SemanticDiff {
  /** Diff identifier */
  diffId: string;
  /** Source being compared */
  sourceId: string;
  /** Previous version */
  fromVersion: string;
  /** Current version */
  toVersion: string;
  /** Overall impact assessment */
  impact: ImpactLevel;
  /** Breaking changes */
  breakingChanges: BreakingChange[];
  /** Non-breaking additions */
  additions: Addition[];
  /** Deprecations */
  deprecations: Deprecation[];
  /** Removals */
  removals: Removal[];
  /** API surface changes */
  apiChanges?: APIChange[];
  /** Schema changes */
  schemaChanges?: SchemaChange[];
  /** Analysis timestamp */
  analyzedAt: string;
}

/**
 * Impact level assessment.
 */
export type ImpactLevel = 
  | 'none'         // No impact
  | 'minimal'      // Minimal changes needed
  | 'moderate'     // Moderate updates required
  | 'significant'  // Significant work needed
  | 'critical';    // Major refactoring required

/**
 * Breaking change record.
 */
export interface BreakingChange {
  /** Change identifier */
  changeId: string;
  /** What changed */
  description: string;
  /** Location (file, function, etc.) */
  location?: string;
  /** Severity */
  severity: PatternSeverity;
  /** Migration guidance */
  migrationPath?: string;
  /** Affected adapters */
  affectedAdapters?: AgentFramework[];
}

/**
 * Non-breaking addition.
 */
export interface Addition {
  /** Addition identifier */
  additionId: string;
  /** What was added */
  description: string;
  /** Type of addition */
  type: 'feature' | 'api' | 'type' | 'method' | 'parameter' | 'other';
  /** Location */
  location?: string;
  /** Is it optional? */
  optional: boolean;
}

/**
 * Deprecation notice.
 */
export interface Deprecation {
  /** Deprecation identifier */
  deprecationId: string;
  /** What is deprecated */
  description: string;
  /** Deprecated since version */
  since: string;
  /** Removal target version */
  removalVersion?: string;
  /** Replacement recommendation */
  replacement?: string;
  /** Migration deadline */
  deadline?: string;
}

/**
 * Removal record.
 */
export interface Removal {
  /** Removal identifier */
  removalId: string;
  /** What was removed */
  description: string;
  /** Removed in version */
  removedInVersion: string;
  /** Previous deprecation notice */
  previousDeprecation?: string;
  /** Impact on adapters */
  adapterImpact?: string;
}

/**
 * API surface change.
 */
export interface APIChange {
  /** Change identifier */
  changeId: string;
  /** Change type */
  type: 'added' | 'modified' | 'removed' | 'deprecated';
  /** API element (endpoint, method, type) */
  element: string;
  /** Element kind */
  kind: 'endpoint' | 'method' | 'type' | 'parameter' | 'return' | 'event';
  /** Before signature/shape */
  before?: string;
  /** After signature/shape */
  after?: string;
  /** Is breaking? */
  breaking: boolean;
}

/**
 * Schema change.
 */
export interface SchemaChange {
  /** Change identifier */
  changeId: string;
  /** Schema name */
  schemaName: string;
  /** Change type */
  type: 'field-added' | 'field-removed' | 'field-modified' | 'type-changed';
  /** Field path */
  fieldPath?: string;
  /** Before type/value */
  before?: string;
  /** After type/value */
  after?: string;
  /** Required field change */
  requiredChange?: boolean;
  /** Migration strategy */
  migration?: string;
}

// ============================================================================
// Adaptation Pipeline
// ============================================================================

/**
 * Adaptation pipeline state.
 */
export interface AdaptationPipeline {
  /** Pipeline identifier */
  pipelineId: string;
  /** Triggering change */
  triggeringChange: RepositoryChange;
  /** Current stage */
  currentStage: PipelineStage;
  /** Stage history */
  stageHistory: StageTransition[];
  /** Analysis result */
  analysis?: AnalysisResult;
  /** Generated proposal */
  proposal?: ChangeProposal;
  /** Validation result */
  validation?: ValidationResult;
  /** Deployment result */
  deployment?: DeploymentResult;
  /** Pipeline status */
  status: PipelineStatus;
  /** Started timestamp */
  startedAt: string;
  /** Completed timestamp */
  completedAt?: string;
  /** Error if failed */
  error?: PipelineError;
}

/**
 * Pipeline stages.
 */
export type PipelineStage = 
  | 'monitoring'     // Watching for changes
  | 'analyzing'      // Analyzing changes
  | 'generating'     // Generating proposals
  | 'validating'     // Validating changes
  | 'awaiting-review'// Waiting for human review
  | 'deploying'      // Deploying changes
  | 'completed'      // Successfully completed
  | 'failed';        // Failed

/**
 * Pipeline status.
 */
export type PipelineStatus = 
  | 'active'         // Pipeline is running
  | 'paused'         // Paused by operator
  | 'completed'      // Successfully completed
  | 'failed'         // Failed
  | 'cancelled';     // Cancelled by operator

/**
 * Stage transition record.
 */
export interface StageTransition {
  /** From stage */
  fromStage: PipelineStage;
  /** To stage */
  toStage: PipelineStage;
  /** Transition timestamp */
  timestamp: string;
  /** Reason for transition */
  reason?: string;
  /** Who/what triggered */
  triggeredBy?: string;
}

/**
 * Analysis result from LLM agent.
 */
export interface AnalysisResult {
  /** Analysis identifier */
  analysisId: string;
  /** Semantic diff */
  semanticDiff: SemanticDiff;
  /** Matched patterns */
  matchedPatterns: PatternMatch[];
  /** Impact assessment */
  impactAssessment: ImpactAssessment;
  /** Recommended actions */
  recommendedActions: RecommendedAction[];
  /** Analysis confidence */
  confidence: number;
  /** Analysis timestamp */
  analyzedAt: string;
  /** LLM agent used */
  agentId?: string;
}

/**
 * Pattern match result.
 */
export interface PatternMatch {
  /** Pattern identifier */
  patternId: string;
  /** Match confidence */
  confidence: number;
  /** Evidence for match */
  evidence: string[];
  /** Recommended strategies */
  recommendedStrategies: string[];
}

/**
 * Impact assessment.
 */
export interface ImpactAssessment {
  /** Overall impact level */
  overallImpact: ImpactLevel;
  /** Affected adapters */
  affectedAdapters: AffectedAdapter[];
  /** Estimated effort hours */
  estimatedEffortHours: number;
  /** Risk level */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** Dependencies affected */
  dependenciesAffected: string[];
  /** Test coverage needed */
  testCoverageNeeded: string[];
}

/**
 * Affected adapter details.
 */
export interface AffectedAdapter {
  /** Adapter protocol */
  protocol: AgentFramework;
  /** Impact level */
  impact: ImpactLevel;
  /** Required changes */
  requiredChanges: string[];
  /** Files affected */
  filesAffected: string[];
}

/**
 * Recommended action from analysis.
 */
export interface RecommendedAction {
  /** Action identifier */
  actionId: string;
  /** Action type */
  type: StepAction;
  /** Priority */
  priority: number;
  /** Description */
  description: string;
  /** Automation feasibility */
  automatable: boolean;
  /** Estimated duration minutes */
  estimatedMinutes: number;
  /** Dependencies on other actions */
  dependencies?: string[];
}

/**
 * Change proposal generated by LLM agent.
 */
export interface ChangeProposal {
  /** Proposal identifier */
  proposalId: string;
  /** Proposal title */
  title: string;
  /** Proposal description */
  description: string;
  /** Proposed file changes */
  fileChanges: FileChange[];
  /** Generated tests */
  generatedTests?: GeneratedTest[];
  /** Documentation updates */
  documentationUpdates?: DocumentationUpdate[];
  /** Rollback procedure */
  rollbackProcedure: string;
  /** Proposal status */
  status: ProposalStatus;
  /** Generated by agent */
  generatedByAgentId: string;
  /** Generation timestamp */
  generatedAt: string;
  /** Review notes */
  reviewNotes?: string[];
}

/**
 * Proposal status.
 */
export type ProposalStatus = 
  | 'draft'         // Being generated
  | 'pending-review'// Awaiting review
  | 'approved'      // Approved for deployment
  | 'rejected'      // Rejected
  | 'deployed'      // Successfully deployed
  | 'rolled-back';  // Rolled back

/**
 * File change in a proposal.
 */
export interface FileChange {
  /** File path */
  filePath: string;
  /** Change type */
  type: 'create' | 'modify' | 'delete';
  /** Original content (for modify/delete) */
  originalContent?: string;
  /** New content (for create/modify) */
  newContent?: string;
  /** Diff patch format */
  patch?: string;
  /** Line-by-line changes */
  hunks?: DiffHunk[];
  /** Change rationale */
  rationale: string;
}

/**
 * Diff hunk (unified diff format).
 */
export interface DiffHunk {
  /** Original start line */
  oldStart: number;
  /** Original line count */
  oldLines: number;
  /** New start line */
  newStart: number;
  /** New line count */
  newLines: number;
  /** Hunk content */
  content: string[];
}

/**
 * Generated test case.
 */
export interface GeneratedTest {
  /** Test file path */
  testFilePath: string;
  /** Test name */
  testName: string;
  /** Test code */
  testCode: string;
  /** What it tests */
  testsFor: string;
  /** Test type */
  testType: 'unit' | 'integration' | 'e2e';
}

/**
 * Documentation update.
 */
export interface DocumentationUpdate {
  /** Document path */
  docPath: string;
  /** Section affected */
  section: string;
  /** Change type */
  type: 'add' | 'update' | 'remove';
  /** New content */
  content: string;
}

/**
 * Validation result from review agent.
 */
export interface ValidationResult {
  /** Validation identifier */
  validationId: string;
  /** Proposal being validated */
  proposalId: string;
  /** Is valid */
  valid: boolean;
  /** Contract compliance */
  contractCompliance: ComplianceCheck;
  /** Test results */
  testResults?: TestRunResult[];
  /** Security scan */
  securityScan?: SecurityScanResult;
  /** Performance impact */
  performanceImpact?: PerformanceImpact;
  /** Issues found */
  issues: ValidationIssue[];
  /** Validated by agent */
  validatedByAgentId: string;
  /** Validation timestamp */
  validatedAt: string;
}

/**
 * Contract compliance check.
 */
export interface ComplianceCheck {
  /** Compliant with protocol-types.ts */
  protocolTypesCompliant: boolean;
  /** Compliant with unified-adapter.ts */
  unifiedAdapterCompliant: boolean;
  /** Type errors */
  typeErrors: string[];
  /** Interface mismatches */
  interfaceMismatches: string[];
}

/**
 * Test run result.
 */
export interface TestRunResult {
  /** Test suite name */
  suiteName: string;
  /** Tests passed */
  passed: number;
  /** Tests failed */
  failed: number;
  /** Tests skipped */
  skipped: number;
  /** Test duration ms */
  durationMs: number;
  /** Failure details */
  failures?: TestFailure[];
}

/**
 * Test failure details.
 */
export interface TestFailure {
  /** Test name */
  testName: string;
  /** Error message */
  error: string;
  /** Stack trace */
  stack?: string;
}

/**
 * Security scan result.
 */
export interface SecurityScanResult {
  /** Scan passed */
  passed: boolean;
  /** Vulnerabilities found */
  vulnerabilities: SecurityVulnerability[];
  /** Scanner used */
  scanner: string;
  /** Scan timestamp */
  scannedAt: string;
}

/**
 * Security vulnerability.
 */
export interface SecurityVulnerability {
  /** Vulnerability ID (CVE, etc.) */
  id: string;
  /** Severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Description */
  description: string;
  /** Affected file */
  file?: string;
  /** Remediation */
  remediation?: string;
}

/**
 * Performance impact assessment.
 */
export interface PerformanceImpact {
  /** Overall assessment */
  assessment: 'positive' | 'neutral' | 'negative';
  /** Latency change percentage */
  latencyChangePercent?: number;
  /** Memory change percentage */
  memoryChangePercent?: number;
  /** Bundle size change bytes */
  bundleSizeChangeBytes?: number;
  /** Notes */
  notes?: string;
}

/**
 * Validation issue.
 */
export interface ValidationIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue type */
  type: string;
  /** Issue message */
  message: string;
  /** File affected */
  file?: string;
  /** Line number */
  line?: number;
  /** Suggested fix */
  suggestedFix?: string;
}

/**
 * Deployment result.
 */
export interface DeploymentResult {
  /** Deployment identifier */
  deploymentId: string;
  /** Proposal deployed */
  proposalId: string;
  /** Deployment status
   * - 'success': Deployment completed successfully
   * - 'partial': Some stages succeeded, some failed
   * - 'failed': Deployment failed
   * - 'rolled-back': Deployment was rolled back
   * - 'simulated': Deployment was simulated (dry-run or stub mode)
   */
  status: 'success' | 'partial' | 'failed' | 'rolled-back' | 'simulated';
  /** Deployment strategy */
  strategy: 'direct' | 'canary' | 'blue-green';
  /** Deployment stages */
  stages: DeploymentStage[];
  /** PR link if applicable */
  pullRequestUrl?: string;
  /** Commit SHA */
  commitSha?: string;
  /** Deployed timestamp */
  deployedAt: string;
  /** Rollback available */
  rollbackAvailable: boolean;
}

/**
 * Deployment stage.
 */
export interface DeploymentStage {
  /** Stage name */
  name: string;
  /** Stage status */
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  /** Stage started */
  startedAt?: string;
  /** Stage completed */
  completedAt?: string;
  /** Stage output */
  output?: string;
}

/**
 * Pipeline error.
 */
export interface PipelineError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Error stage */
  stage: PipelineStage;
  /** Stack trace */
  stack?: string;
  /** Is retryable */
  retryable: boolean;
  /** Retry count */
  retryCount?: number;
}

// ============================================================================
// Adaptation Hooks
// ============================================================================

/**
 * Adaptation hook definition.
 */
export interface AdaptationHook {
  /** Hook identifier */
  hookId: string;
  /** Hook name */
  name: string;
  /** Hook type */
  hookType: HookType;
  /** Priority (lower = earlier) */
  priority: number;
  /** Condition for execution */
  condition: HookCondition;
  /** Is hook enabled */
  enabled: boolean;
  /** Hook timeout ms */
  timeoutMs?: number;
  /** Error handling strategy */
  onError: 'ignore' | 'warn' | 'fail';
}

/**
 * Hook types.
 */
export type HookType = 
  | 'pre-change'      // Before applying changes
  | 'post-change'     // After applying changes
  | 'on-error'        // On change failure
  | 'on-pattern'      // When pattern detected
  | 'on-version'      // On version mismatch
  | 'on-capability'   // On capability change
  | 'on-health';      // On health check

/**
 * Hook condition.
 */
export interface HookCondition {
  /** Condition type */
  type: 'always' | 'pattern-match' | 'version-check' | 'custom';
  /** Pattern ID for pattern-match */
  patternId?: string;
  /** Version range for version-check */
  versionRange?: string;
  /** Custom expression */
  expression?: string;
}

// ============================================================================
// Self-Modification Interface
// ============================================================================

/**
 * Module AST representation for self-modification.
 */
export interface ModuleAST {
  /** Module path */
  modulePath: string;
  /** Module type */
  type: 'typescript' | 'javascript' | 'json' | 'yaml';
  /** Exports */
  exports: ModuleExport[];
  /** Imports */
  imports: ModuleImport[];
  /** Type definitions */
  typeDefinitions?: TypeDefinition[];
  /** Functions */
  functions?: FunctionDefinition[];
  /** Classes */
  classes?: ClassDefinition[];
  /** Raw content */
  rawContent: string;
}

/**
 * Module export.
 */
export interface ModuleExport {
  /** Export name */
  name: string;
  /** Export type */
  type: 'default' | 'named' | 're-export';
  /** Is type export */
  isType: boolean;
  /** Source module (for re-export) */
  sourceModule?: string;
}

/**
 * Module import.
 */
export interface ModuleImport {
  /** Import name(s) */
  names: string[];
  /** Source module */
  sourceModule: string;
  /** Import type */
  type: 'default' | 'named' | 'namespace' | 'side-effect';
  /** Is type import */
  isType: boolean;
}

/**
 * Type definition.
 */
export interface TypeDefinition {
  /** Type name */
  name: string;
  /** Type kind */
  kind: 'type' | 'interface' | 'enum' | 'class';
  /** Is exported */
  exported: boolean;
  /** Type parameters (generics) */
  typeParameters?: string[];
  /** Properties (for interface/class) */
  properties?: PropertyDefinition[];
}

/**
 * Property definition.
 */
export interface PropertyDefinition {
  /** Property name */
  name: string;
  /** Property type */
  type: string;
  /** Is optional */
  optional: boolean;
  /** Is readonly */
  readonly: boolean;
}

/**
 * Function definition.
 */
export interface FunctionDefinition {
  /** Function name */
  name: string;
  /** Is exported */
  exported: boolean;
  /** Is async */
  async: boolean;
  /** Parameters */
  parameters: ParameterDefinition[];
  /** Return type */
  returnType: string;
}

/**
 * Parameter definition.
 */
export interface ParameterDefinition {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: string;
  /** Is optional */
  optional: boolean;
  /** Default value */
  defaultValue?: string;
}

/**
 * Class definition.
 */
export interface ClassDefinition {
  /** Class name */
  name: string;
  /** Is exported */
  exported: boolean;
  /** Extends */
  extends?: string;
  /** Implements */
  implements?: string[];
  /** Properties */
  properties: PropertyDefinition[];
  /** Methods */
  methods: FunctionDefinition[];
}

/**
 * Audit entry for self-modification.
 */
export interface AuditEntry {
  /** Audit entry ID */
  auditId: string;
  /** Timestamp */
  timestamp: string;
  /** Action type */
  action: 'read' | 'propose' | 'apply' | 'rollback';
  /** Module affected */
  modulePath: string;
  /** Proposal ID if applicable */
  proposalId?: string;
  /** Actor (agent ID or user) */
  actor: string;
  /** Action result */
  result: 'success' | 'failure';
  /** Error message if failed */
  error?: string;
  /** Change summary */
  changeSummary?: string;
  /** Approval token used */
  approvalToken?: string;
}

/**
 * Approval token for self-modification.
 */
export interface ApprovalToken {
  /** Token ID */
  tokenId: string;
  /** Approved by */
  approvedBy: string;
  /** Proposal ID */
  proposalId: string;
  /** Valid until */
  validUntil: string;
  /** Scope of approval */
  scope: 'full' | 'partial';
  /** Approved changes (for partial) */
  approvedChanges?: string[];
  /** Signature */
  signature: string;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Type exports are handled by the export statements above
};
