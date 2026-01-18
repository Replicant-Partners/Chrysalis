# Universal Adapter Task Framework Guide

Complete guide to executing tasks with the Universal Adapter system.

## Overview

The Task Framework provides a structured way to execute agent protocol operations (translate, morph, validate, discover) with comprehensive telemetry and result tracking. Tasks are defined as JSON files and can be executed via CLI, API, or programmatically.

## Task Types

### 1. **Translate Task**
Convert an agent from one protocol to another using semantic field mapping.

```json
{
  "type": "translate",
  "name": "Optional task name",
  "sourceProtocol": "usa",
  "targetProtocol": "mcp",
  "agent": { /* agent definition */ },
  "options": {
    "includeConfidence": true,
    "timeoutMs": 30000
  }
}
```

### 2. **Morph Task**
High-fidelity translation that preserves agent identity, capabilities, and behavioral instructions.

```json
{
  "type": "morph",
  "name": "Identity-preserving morphing",
  "sourceProtocol": "crewai",
  "targetProtocol": "openai",
  "agent": { /* agent definition */ },
  "options": {
    "preserveExtensions": true,
    "targetCapabilities": ["tool1", "tool2"],
    "customMappings": { "field1": "field2" }
  }
}
```

### 3. **Validate Task**
Validate an agent definition against a protocol specification.

```json
{
  "type": "validate",
  "name": "Protocol validation",
  "protocol": "usa",
  "agent": { /* agent definition */ }
}
```

### 4. **Discover Task**
Discover capabilities and features of a protocol.

```json
{
  "type": "discover",
  "name": "Capability discovery",
  "protocol": "mcp"
}
```

### 5. **Batch Task**
Execute multiple tasks sequentially with optional early termination.

```json
{
  "type": "batch",
  "name": "Multi-task batch",
  "tasks": [
    { "type": "translate", /* ... */ },
    { "type": "morph", /* ... */ }
  ],
  "stopOnError": false
}
```

## Usage Methods

### CLI Usage

#### 1. Execute a Task File
```bash
# With npm (development)
npm run build
node dist/cli/adapter-task.js examples/tasks/translate-usa-to-mcp.json

# After global install
chrysalis-task examples/tasks/translate-usa-to-mcp.json
```

#### 2. Custom Output Location
```bash
chrysalis-task task.json --output results/my-result.json
```

#### 3. Verbose Mode
```bash
chrysalis-task task.json --verbose
```

#### 4. No Save (Print Only)
```bash
chrysalis-task task.json --no-save
```

#### 5. Validate Task File
```bash
chrysalis-task validate task.json
```

#### 6. Create Template
```bash
# Create template for each task type
chrysalis-task template translate
chrysalis-task template morph
chrysalis-task template validate
chrysalis-task template discover
chrysalis-task template batch
```

### API Usage

#### 1. Execute General Task
```bash
curl -X POST http://localhost:3000/api/adapter-tasks/execute \
  -H "Content-Type: application/json" \
  -d @examples/tasks/translate-usa-to-mcp.json
```

#### 2. Quick Translation
```bash
curl -X POST http://localhost:3000/api/adapter-tasks/translate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProtocol": "usa",
    "targetProtocol": "mcp",
    "agent": { /* agent definition */ }
  }'
```

#### 3. Quick Morphing
```bash
curl -X POST http://localhost:3000/api/adapter-tasks/morph \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProtocol": "crewai",
    "targetProtocol": "openai",
    "agent": { /* agent definition */ }
  }'
```

#### 4. Batch Execution
```bash
curl -X POST http://localhost:3000/api/adapter-tasks/batch \
  -H "Content-Type: application/json" \
  -d '{
    "tasks": [ /* array of tasks */ ],
    "stopOnError": false
  }'
```

#### 5. List Protocols
```bash
curl http://localhost:3000/api/adapter-tasks/protocols
```

#### 6. Health Check
```bash
curl http://localhost:3000/api/adapter-tasks/health
```

### Programmatic Usage

```typescript
import { executeTask, createTaskExecutor } from './adapters/universal/task-executor';

// Execute single task
const task = {
  type: 'translate',
  sourceProtocol: 'usa',
  targetProtocol: 'mcp',
  agent: { /* ... */ }
};

const result = await executeTask(task);
console.log(result.success, result.telemetry);

// Use executor directly
const executor = createTaskExecutor();
const result2 = await executor.executeTask(task);

// Execute from file
import { executeTaskFromFile } from './adapters/universal/task-executor';
const result3 = await executeTaskFromFile('task.json', 'result.json');
```

## Task Result Format

Every task execution returns a `TaskResult` object:

```typescript
{
  "taskId": "task_1705447200000_abc123xyz",
  "taskType": "translate",
  "taskName": "Optional task name",
  "success": true,
  "result": {
    // Task-specific result data
    "translatedAgent": { /* ... */ },
    "confidence": 0.92,
    "fieldMappings": [ /* ... */ ]
  },
  "telemetry": {
    "startTime": "2026-01-16T23:00:00.000Z",
    "endTime": "2026-01-16T23:00:02.453Z",
    "durationMs": 2453,
    "llmCalls": 1,
    "tokensUsed": 1250,
    "cacheHits": {
      "spec": 1,
      "mapping": 0
    },
    "errors": [],
    "warnings": ["Field 'personality' has no direct equivalent"]
  },
  "metadata": {
    "executedAt": "2026-01-16T23:00:00.000Z",
    "version": "1.0.0",
    "created": "2026-01-16T23:00:00Z",
    "author": "Chrysalis Team"
  }
}
```

## Example Task Files

### Example 1: Translate SemanticAgent to MCP
See: `examples/tasks/translate-usa-to-mcp.json`

Translates a SemanticAgent file manager agent to MCP server format.

**Run:**
```bash
chrysalis-task examples/tasks/translate-usa-to-mcp.json
```

### Example 2: Morph CrewAI to OpenAI
See: `examples/tasks/morph-crewai-to-openai.json`

Morphs a CrewAI research analyst to OpenAI Assistant format.

**Run:**
```bash
chrysalis-task examples/tasks/morph-crewai-to-openai.json
```

### Example 3: Batch Multi-Protocol
See: `examples/tasks/batch-multi-protocol.json`

Executes multiple translations in sequence.

**Run:**
```bash
chrysalis-task examples/tasks/batch-multi-protocol.json
```

## Telemetry Tracking

The task executor tracks comprehensive telemetry:

- **Execution Time**: Wall clock and internal duration
- **LLM Calls**: Number of language model API calls
- **Cache Performance**: Spec and mapping cache hits
- **Errors**: Detailed error messages with timestamps and context
- **Warnings**: Non-fatal issues and recommendations

This telemetry helps:
- **Performance Analysis**: Identify slow operations
- **Cost Tracking**: Monitor LLM usage
- **Debugging**: Trace execution flow
- **Optimization**: Measure cache effectiveness

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/adapter-tasks/execute` | POST | Execute general task |
| `/api/adapter-tasks/batch` | POST | Execute batch tasks |
| `/api/adapter-tasks/translate` | POST | Quick translation |
| `/api/adapter-tasks/morph` | POST | Quick morphing |
| `/api/adapter-tasks/validate` | POST | Quick validation |
| `/api/adapter-tasks/protocols` | GET | List protocols |
| `/api/adapter-tasks/health` | GET | Health check |

## Best Practices

### 1. Use Descriptive Names
```json
{
  "name": "Translate FileManager from SemanticAgent to MCP for Claude Desktop",
  "metadata": {
    "description": "Production deployment for Claude Desktop MCP integration",
    "project": "mcp-integration",
    "environment": "production"
  }
}
```

### 2. Include Metadata
Add metadata for tracking and documentation:
```json
{
  "metadata": {
    "created": "2026-01-16T23:00:00Z",
    "author": "DevOps Team",
    "version": "1.2.0",
    "tags": ["production", "mcp", "filesystem"]
  }
}
```

### 3. Use Batch for Related Tasks
Group related operations:
```json
{
  "type": "batch",
  "name": "Deploy Multi-Protocol Agents",
  "tasks": [
    { "type": "translate", /* MCP */ },
    { "type": "translate", /* A2A */ },
    { "type": "validate", /* Verify SemanticAgent source */ }
  ]
}
```

### 4. Preserve Results
Always save results for audit trails:
```bash
chrysalis-task task.json --output results/$(date +%Y%m%d-%H%M%S)-result.json
```

### 5. Validate Before Execute
Test your task files:
```bash
chrysalis-task validate task.json
```

## Troubleshooting

### Gateway Connection Error
```
❌ Translation failed: fetch failed
```

**Solution**: Ensure Gateway is running:
```bash
cd go-services
go run cmd/gateway/main.go
```

### Invalid Task Format
```
❌ Invalid task: Task body must include a "type" field
```

**Solution**: Validate your JSON:
```bash
chrysalis-task validate task.json
```

### Ollama Model Not Found
```
❌ Translation failed: model not found
```

**Solution**: Start Ollama with the model:
```bash
ollama run ministral-3:3b
```

### High Latency
If tasks are slow, check:
1. Gateway is running locally (not remote)
2. Ollama model is loaded (`ollama list`)
3. Cache is enabled (check telemetry)

## Integration Examples

### CI/CD Pipeline
```yaml
# .github/workflows/agent-deploy.yml
- name: Translate Agent
  run: |
    chrysalis-task deploy-tasks/prod-agent.json \
      --output results/deployment-${{ github.sha }}.json
```

### Node.js Script
```javascript
const { executeTaskFromFile } = require('./dist/adapters/universal/task-executor');

async function deployAgent() {
  const result = await executeTaskFromFile(
    'tasks/production.json',
    `results/${Date.now()}.json`
  );
  
  if (!result.success) {
    throw new Error(`Deployment failed: ${result.error.message}`);
  }
  
  console.log(`Deployed in ${result.telemetry.durationMs}ms`);
  return result;
}
```

### Python Script
```python
import requests
import json

def execute_task(task_file):
    with open(task_file) as f:
        task = json.load(f)
    
    response = requests.post(
        'http://localhost:3000/api/adapter-tasks/execute',
        json=task
    )
    
    return response.json()
```

## Performance Tips

1. **Enable Caching**: Let spec and mapping caches warm up
2. **Batch Related Tasks**: Reduce overhead by batching
3. **Use Local Gateway**: Avoid network latency
4. **Pre-load Models**: Start Ollama before running tasks
5. **Monitor Telemetry**: Track performance over time

## Support

For issues or questions:
- Check logs: Look at telemetry.errors in results
- Validate tasks: Use `chrysalis-task validate`
- Test protocols: Use `npm run adapter:list`
- Review examples: See `examples/tasks/` directory

## Next Steps

1. **Create your first task**: Use `chrysalis-task template translate`
2. **Test execution**: Run `chrysalis-task task.json`
3. **Review results**: Check the `-result.json` file
4. **Integrate**: Add to your workflow (CLI, API, or code)

Explore the power of the Universal Adapter and seamless protocol translation! 🚀