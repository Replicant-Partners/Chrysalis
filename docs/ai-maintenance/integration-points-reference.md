# Integration Points and Operational Procedures

> **Module:** `ai-maintenance`  
> **Version:** 1.0.0  
> **Last Updated:** 2026-01-11

## Overview

This document describes the integration points between the AI-Led Adaptive Maintenance System and other Chrysalis components, external systems, and operational procedures for managing the adaptation lifecycle.

---

## Integration Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                        External Systems Integration                             │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   GitHub     │  │   GitLab     │  │   Bitbucket  │  │   Custom     │       │
│  │   Webhooks   │  │   Webhooks   │  │   Webhooks   │  │   Sources    │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                 │                │
│         └─────────────────┴────────┬────────┴─────────────────┘                │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    AI-Led Adaptive Maintenance System                    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                           │
│         ┌──────────────────────────┼──────────────────────────┐               │
│         │                          │                          │               │
│         ▼                          ▼                          ▼               │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐        │
│  │   Adapter    │          │   Protocol   │          │   Bridge     │        │
│  │   Registry   │          │   Registry   │          │   Services   │        │
│  └──────────────┘          └──────────────┘          └──────────────┘        │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                         CI/CD Integration                                │  │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         │  │
│  │   │ Jenkins  │    │  GitHub  │    │  GitLab  │    │  Custom  │         │  │
│  │   │   CI     │    │ Actions  │    │    CI    │    │Pipeline  │         │  │
│  │   └──────────┘    └──────────┘    └──────────┘    └──────────┘         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### 1. Repository Webhook Integration

#### GitHub Webhooks

```typescript
// GitHub webhook configuration
import { RepositoryMonitor, createProtocolRepository } from '@chrysalis/ai-maintenance';

const monitor = new RepositoryMonitor({
  webhooksEnabled: true,
  webhookPath: '/webhooks/github',
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
});

// Register protocol repositories
monitor.addRepository(createProtocolRepository({
  name: 'mcp',
  provider: 'github',
  owner: 'modelcontextprotocol',
  repo: 'specification',
  branch: 'main',
  watchPaths: ['schema/**', 'docs/**'],
  events: ['push', 'release', 'pull_request']
}));
```

**Required GitHub Webhook Events:**
- `push` - Commit pushes to watched branches
- `release` - New releases/tags
- `pull_request` - PR events for preview analysis

**Webhook Payload Processing:**
```typescript
monitor.on('webhook:received', async (payload) => {
  const change = monitor.parseGitHubPayload(payload);
  await monitor.processChange(change);
});
```

#### GitLab Webhooks

```typescript
monitor.addRepository(createProtocolRepository({
  name: 'internal-protocol',
  provider: 'gitlab',
  projectId: '12345',
  branch: 'main',
  watchPaths: ['api/**'],
  events: ['Push Hook', 'Tag Push Hook', 'Release Hook']
}));
```

---

### 2. Adapter Registry Integration

The AI Maintenance System integrates with the Adapter Registry to discover and update adapters.

```typescript
import { 
  adapterRegistry,
  crossCuttingController 
} from '@chrysalis/ai-maintenance';

// Auto-instrument all registered adapters
adapterRegistry.on('adapter:registered', (adapter) => {
  crossCuttingController.instrument(adapter);
});

// Update adapters when modifications are generated
orchestrator.on('proposal:approved', async (proposal) => {
  const adapter = adapterRegistry.get(proposal.protocol);
  await applyModification(adapter, proposal);
  
  // Notify registry of update
  adapterRegistry.emit('adapter:updated', {
    protocol: proposal.protocol,
    version: proposal.targetVersion,
    changes: proposal.changes
  });
});
```

**Registry Events:**
| Event | Description | Action |
|-------|-------------|--------|
| `adapter:registered` | New adapter added | Instrument with sensors |
| `adapter:updated` | Adapter modified | Re-validate capabilities |
| `adapter:removed` | Adapter deregistered | Clean up sensors |

---

### 3. Protocol Registry Integration

```typescript
import { 
  protocolRegistry,
  repositoryMonitor 
} from '@chrysalis/ai-maintenance';

// Sync monitored repositories with registered protocols
protocolRegistry.on('protocol:registered', (protocol) => {
  if (protocol.repositoryUrl) {
    repositoryMonitor.addRepository({
      name: protocol.name,
      url: protocol.repositoryUrl,
      branch: protocol.defaultBranch || 'main',
      watchPaths: protocol.watchPaths || ['**/*']
    });
  }
});

// Update protocol metadata when changes detected
repositoryMonitor.on('release:detected', async (release) => {
  const protocol = protocolRegistry.get(release.protocol);
  if (protocol) {
    protocolRegistry.update(protocol.name, {
      latestVersion: release.version,
      lastUpdated: release.timestamp
    });
  }
});
```

---

### 4. Bridge Services Integration

```typescript
import { 
  bridgeService,
  changePropagationSystem 
} from '@chrysalis/ai-maintenance';

// Propagate changes to bridge services
changePropagationSystem.subscribe('mcp', async (message) => {
  if (message.changeType === 'schema-migration') {
    await bridgeService.updateMappings({
      protocol: 'mcp',
      schema: message.payload.newSchema
    });
  }
});

// Bridge health affects adaptation decisions
bridgeService.on('health:changed', (health) => {
  if (health.status === 'degraded') {
    // Pause non-critical adaptations
    orchestrator.setPriority('critical-only');
  }
});
```

---

### 5. CI/CD Pipeline Integration

#### GitHub Actions

```yaml
# .github/workflows/adaptation-pipeline.yml
name: Adaptation Pipeline

on:
  repository_dispatch:
    types: [adaptation-proposal]

jobs:
  test-adaptation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.client_payload.branch }}
      
      - name: Run Tests
        run: npm test
      
      - name: Run Integration Tests
        run: npm run test:integration
      
      - name: Validate Adapters
        run: npm run validate:adapters

  deploy-staging:
    needs: test-adaptation
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: |
          npm run deploy:staging

      - name: Notify Orchestrator
        run: |
          curl -X POST ${{ secrets.ORCHESTRATOR_URL }}/pipeline/${{ github.event.client_payload.pipelineId }}/stage/staging-complete
```

#### Triggering CI/CD from Orchestrator

```typescript
orchestrator.on('stage:testing', async (pipeline) => {
  // Trigger GitHub Actions workflow
  await githubClient.repos.createDispatchEvent({
    owner: 'chrysalis-project',
    repo: 'adapters',
    event_type: 'adaptation-proposal',
    client_payload: {
      pipelineId: pipeline.id,
      branch: pipeline.branchName,
      proposals: pipeline.proposals.map(p => p.id)
    }
  });
});

// Handle CI/CD completion
app.post('/pipeline/:id/stage/:stage', async (req, res) => {
  const { id, stage } = req.params;
  await orchestrator.advanceStage(id, stage);
  res.json({ status: 'ok' });
});
```

---

### 6. Notification Integration

#### Slack Integration

```typescript
import { SlackNotifier } from '@chrysalis/notifications';

const slack = new SlackNotifier({
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  channel: '#adaptation-alerts'
});

// Notify on review required
orchestrator.on('stage:review', async (pipeline) => {
  await slack.send({
    text: `🔍 Adaptation Review Required`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Pipeline:* ${pipeline.id}\n*Protocol:* ${pipeline.change.protocol}\n*Impact:* ${pipeline.analysis?.impact || 'unknown'}`
        }
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            url: `${DASHBOARD_URL}/pipeline/${pipeline.id}/approve`
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            url: `${DASHBOARD_URL}/pipeline/${pipeline.id}/reject`
          }
        ]
      }
    ]
  });
});
```

#### Email Integration

```typescript
import { EmailNotifier } from '@chrysalis/notifications';

const email = new EmailNotifier({
  smtp: process.env.SMTP_URL,
  from: 'chrysalis@example.com'
});

// Weekly summary
orchestrator.on('summary:weekly', async (stats) => {
  await email.send({
    to: 'maintainers@example.com',
    subject: 'Weekly Adaptation Summary',
    template: 'weekly-summary',
    data: {
      totalPipelines: stats.totalPipelines,
      successRate: stats.successRate,
      topPatterns: stats.topPatterns,
      pendingReviews: stats.pendingReviews
    }
  });
});
```

---

### 7. Monitoring and Observability Integration

#### Prometheus Metrics

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const changesDetected = new Counter({
  name: 'chrysalis_changes_detected_total',
  help: 'Total number of changes detected',
  labelNames: ['protocol', 'type']
});

const pipelineDuration = new Histogram({
  name: 'chrysalis_pipeline_duration_seconds',
  help: 'Pipeline execution duration',
  labelNames: ['protocol', 'outcome'],
  buckets: [60, 300, 600, 1800, 3600]
});

const activePipelines = new Gauge({
  name: 'chrysalis_active_pipelines',
  help: 'Number of active pipelines'
});

// Instrument orchestrator
orchestrator.on('change:detected', (change) => {
  changesDetected.inc({ protocol: change.protocol, type: change.type });
});

orchestrator.on('pipeline:completed', (pipeline) => {
  const duration = (Date.now() - new Date(pipeline.startTime).getTime()) / 1000;
  pipelineDuration.observe(
    { protocol: pipeline.change.protocol, outcome: pipeline.status },
    duration
  );
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

#### OpenTelemetry Tracing

```typescript
import { trace, SpanKind } from '@opentelemetry/api';

const tracer = trace.getTracer('chrysalis-ai-maintenance');

async function processPipeline(pipeline: AdaptationPipeline) {
  const span = tracer.startSpan('process-pipeline', {
    kind: SpanKind.INTERNAL,
    attributes: {
      'pipeline.id': pipeline.id,
      'pipeline.protocol': pipeline.change.protocol
    }
  });

  try {
    // Process with child spans
    const analyzeSpan = tracer.startSpan('analyze-change', { parent: span });
    const analysis = await semanticDiffAnalyzer.analyze(pipeline.change);
    analyzeSpan.end();

    const generateSpan = tracer.startSpan('generate-proposals', { parent: span });
    const proposals = await modificationGenerator.generate(analysis);
    generateSpan.end();

    span.setStatus({ code: SpanStatusCode.OK });
    return { analysis, proposals };
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
    throw error;
  } finally {
    span.end();
  }
}
```

---

## Operational Procedures

### 1. Starting the System

```bash
# Environment setup
export GITHUB_WEBHOOK_SECRET="..."
export GIT_TOKEN="..."
export SLACK_WEBHOOK_URL="..."

# Start the orchestrator
npm run start:orchestrator

# Or programmatically
import { createAndStartOrchestrator } from '@chrysalis/ai-maintenance';

const orchestrator = await createAndStartOrchestrator({
  monitoring: {
    repositories: [/* ... */],
    webhooksEnabled: true
  },
  pipeline: {
    autoApproveThreshold: 0.95,
    reviewTimeoutHours: 48
  },
  git: {
    remoteUrl: process.env.CHRYSALIS_REPO,
    baseBranch: 'main',
    credentials: { token: process.env.GIT_TOKEN }
  }
});

console.log('Orchestrator started:', orchestrator.getStatus());
```

### 2. Monitoring Health

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await orchestrator.getHealth();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Health response example
{
  "status": "healthy",
  "timestamp": "2026-01-11T15:30:00Z",
  "components": {
    "repositoryMonitor": { "status": "healthy", "monitored": 5 },
    "semanticAnalyzer": { "status": "healthy", "queueSize": 2 },
    "modificationGenerator": { "status": "healthy" },
    "pipelineOrchestrator": { "status": "healthy", "active": 1 }
  },
  "metrics": {
    "uptime": 86400,
    "changesProcessed": 42,
    "pipelinesCompleted": 38,
    "successRate": 0.95
  }
}
```

### 3. Manual Pipeline Operations

#### Creating a Manual Pipeline

```typescript
// Manually create pipeline for testing
const pipeline = await orchestrator.createPipeline({
  source: 'manual',
  protocol: 'mcp',
  change: {
    type: 'commit',
    repository: 'modelcontextprotocol/specification',
    ref: 'abc123',
    files: ['schema/message.proto']
  },
  priority: 'high'
});

console.log('Created pipeline:', pipeline.id);
```

#### Advancing Pipeline Stage

```typescript
// Manually advance a stuck pipeline
await orchestrator.advanceStage(pipelineId, 'current-stage-complete');

// Force retry a failed stage
await orchestrator.retryStage(pipelineId, 'testing');
```

#### Approving/Rejecting Proposals

```typescript
// Approve a proposal
await orchestrator.approveProposal(pipelineId, proposalId, {
  reviewer: 'admin@example.com',
  comment: 'LGTM'
});

// Reject with reason
await orchestrator.rejectProposal(pipelineId, proposalId, {
  reviewer: 'admin@example.com',
  reason: 'Breaking change not addressed'
});
```

### 4. Emergency Procedures

#### Pausing All Pipelines

```typescript
// Pause all processing
await orchestrator.pause();
console.log('System paused');

// Resume when ready
await orchestrator.resume();
console.log('System resumed');
```

#### Emergency Rollback

```typescript
// Rollback a specific pipeline
await orchestrator.rollbackPipeline(pipelineId, {
  reason: 'Production issue detected',
  initiator: 'ops-team'
});

// Rollback all recent deployments
await orchestrator.rollbackRecent({
  since: new Date(Date.now() - 3600000), // Last hour
  reason: 'Mass rollback due to incident'
});
```

#### Disabling Specific Patterns

```typescript
// Disable auto-adaptation for a pattern
orchestrator.setPatternEnabled('schema-migration', false);

// Disable all auto-deployments
orchestrator.setAutoDeployEnabled(false);
```

### 5. Maintenance Operations

#### Clearing Stale Pipelines

```typescript
// Clean up old completed pipelines
await orchestrator.cleanup({
  olderThan: 30 * 24 * 60 * 60 * 1000, // 30 days
  status: ['completed', 'failed', 'rolled-back']
});
```

#### Updating Configuration

```typescript
// Update configuration at runtime
await orchestrator.updateConfig({
  pipeline: {
    autoApproveThreshold: 0.98
  },
  monitoring: {
    pollIntervalMs: 600000
  }
});
```

#### Repository Management

```typescript
// Add new repository
await repositoryMonitor.addRepository({
  name: 'new-protocol',
  url: 'https://github.com/org/repo',
  branch: 'main'
});

// Remove repository
await repositoryMonitor.removeRepository('deprecated-protocol');

// Update repository config
await repositoryMonitor.updateRepository('existing-protocol', {
  pollIntervalMs: 120000
});
```

---

## Event Reference

### Orchestrator Events

| Event | Description | Payload |
|-------|-------------|---------|
| `pipeline:created` | New pipeline started | `AdaptationPipeline` |
| `pipeline:completed` | Pipeline finished | `AdaptationPipeline` |
| `pipeline:failed` | Pipeline error | `{ pipeline, error }` |
| `stage:changed` | Stage transition | `{ pipeline, stage }` |
| `proposal:generated` | New proposal created | `ModificationProposal` |
| `proposal:approved` | Proposal approved | `{ proposal, reviewer }` |
| `proposal:rejected` | Proposal rejected | `{ proposal, reason }` |
| `deployment:started` | Deployment began | `DeploymentInfo` |
| `deployment:completed` | Deployment finished | `DeploymentInfo` |
| `rollback:initiated` | Rollback started | `{ pipeline, reason }` |
| `rollback:completed` | Rollback finished | `{ pipeline, success }` |

### Monitor Events

| Event | Description | Payload |
|-------|-------------|---------|
| `change:detected` | New change found | `RepositoryChange` |
| `release:detected` | New release | `ReleaseInfo` |
| `webhook:received` | Webhook payload | `WebhookPayload` |
| `poll:started` | Poll cycle began | `{ repository }` |
| `poll:completed` | Poll cycle ended | `{ repository, changes }` |
| `monitor:error` | Monitor error | `MonitorError` |

### Cross-cutting Events

| Event | Description | Payload |
|-------|-------------|---------|
| `pattern-detected` | Pattern matched | `PatternDetection` |
| `propagation` | Change propagated | `PropagationMessage` |
| `modification` | Self-modification | `ModificationExecution` |
| `adapter-instrumented` | Adapter added | `{ protocol }` |

---

## Troubleshooting

### Common Issues

#### Pipeline Stuck in Stage

```typescript
// Check pipeline status
const pipeline = await orchestrator.getPipeline(pipelineId);
console.log('Current stage:', pipeline.stage);
console.log('Stage metrics:', pipeline.metrics[pipeline.stage]);

// Check for blocking conditions
const blockers = await orchestrator.getBlockers(pipelineId);
console.log('Blockers:', blockers);

// Force advance if appropriate
await orchestrator.forceAdvance(pipelineId);
```

#### Webhook Not Receiving Events

1. Verify webhook URL is accessible
2. Check webhook secret configuration
3. Review GitHub webhook delivery history
4. Check server logs for parsing errors

```bash
# Test webhook endpoint
curl -X POST http://localhost:3000/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"action": "push", ...}'
```

#### High Memory Usage

```typescript
// Check queue sizes
const status = orchestrator.getStatus();
console.log('Analysis queue:', status.analyzerQueueSize);
console.log('Generation queue:', status.generatorQueueSize);

// Reduce concurrent processing
await orchestrator.updateConfig({
  analysis: { maxConcurrentAnalyses: 1 },
  pipeline: { maxConcurrentPipelines: 1 }
});

// Clear old history
await orchestrator.cleanup({ olderThan: 7 * 24 * 60 * 60 * 1000 });
```

---

## See Also

- [Evolutionary Patterns Registry](./evolutionary-patterns-registry.md)
- [AI-Led Adaptation Architecture](./ai-led-adaptation-architecture.md)
- [Adapters Module Documentation](../adapters/README.md)
