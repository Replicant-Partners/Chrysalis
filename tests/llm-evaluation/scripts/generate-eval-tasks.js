#!/usr/bin/env node
/**
 * Generate Evaluation Task JSON Files
 * 
 * Automatically creates evaluation task files for all installed Ollama models
 * based on the model inventory and evaluation prompt library.
 */

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  ollamaEndpoint: 'http://localhost:11434',
  outputDir: '../examples/tasks/generated',
  resultsDir: './results',
  promptsPath: './prompts/mode1-process-manager.json',
  minSizeGB: 1,
  maxSizeGB: 8,
  excludePatterns: ['embed', 'embedding', 'cloud'] // Exclude embedding and cloud-proxy models
};

/**
 * Parse Ollama model list output
 */
function parseOllamaList(output) {
  const lines = output.trim().split('\n').slice(1); // Skip header
  const models = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue; // Need at least NAME ID SIZE MODIFIED

    const name = parts[0];
    const id = parts[1];
    const sizeStr = parts[2] + ' ' + parts[3]; // "6.6 GB" is two tokens after split

    console.log(`  Parsing: ${name} -> Size: ${sizeStr}`);

    // Parse size (e.g., "6.6 GB" -> 6.6)
    const sizeMatch = sizeStr.match(/([\d.]+)\s*(GB|MB)/);
    if (!sizeMatch) {
      console.log(`  Skipping ${name} (no valid size: ${sizeStr})`);
      continue; // Skip cloud models or invalid format
    }

    let sizeGB = parseFloat(sizeMatch[1]);
    if (sizeMatch[2] === 'MB') {
      sizeGB = sizeGB / 1024;
    }

    // Check if model should be excluded
    const shouldExclude = CONFIG.excludePatterns.some(pattern =>
      name.toLowerCase().includes(pattern.toLowerCase())
    );

    if (shouldExclude) {
      console.log(`  Skipping ${name} (excluded pattern)`);
      continue;
    }

    // Check size range
    if (sizeGB < CONFIG.minSizeGB || sizeGB > CONFIG.maxSizeGB) {
      console.log(`  Skipping ${name} (size ${sizeGB.toFixed(2)}GB outside range)`);
      continue;
    }

    models.push({
      name,
      id,
      sizeGB: parseFloat(sizeGB.toFixed(2)),
      sizeStr
    });
  }

  return models;
}

/**
 * Load evaluation prompts from JSON file
 */
async function loadPrompts() {
  const content = await fs.readFile(CONFIG.promptsPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Generate task JSON for a specific model and prompt
 */
function generateTaskJSON(model, prompt, promptIndex) {
  const timestamp = new Date().toISOString().split('T')[0];
  const modelSlug = model.name.replace(/[:\/]/g, '-');
  const testId = prompt.test_id;
  
  return {
    type: 'evaluate',
    name: `Evaluate ${model.name} - ${prompt.name}`,
    prompt: prompt.prompt,
    model: {
      provider: 'ollama',
      name: model.name
    },
    parameters: {
      temperature: 0.3,
      maxTokens: prompt.expected_output_schema ? 1000 : 2000
    },
    options: {
      outputPath: `./tests/llm-evaluation/results/${modelSlug}/${testId}.md`,
      includeMetadata: true,
      timeoutMs: 30000
    },
    metadata: {
      mode: 1,
      test_id: testId,
      category: prompt.category || 'atomic',
      complexity: prompt.difficulty <= 3 ? 'low' : prompt.difficulty <= 6 ? 'medium' : 'high',
      description: prompt.name,
      model_size_gb: model.sizeGB,
      generated: timestamp,
      author: 'Chrysalis Evaluation Framework'
    }
  };
}

/**
 * Generate batch task JSON for multi-model comparison
 */
function generateBatchTaskJSON(models, prompts) {
  const subtasks = [];
  
  for (const model of models) {
    for (const prompt of prompts.atomic_tests.slice(0, 2)) { // First 2 atomic tests for batch
      subtasks.push(generateTaskJSON(model, prompt, subtasks.length));
    }
  }

  return {
    type: 'batch',
    name: 'Multi-Model Evaluation Batch - Mode 1 Atomic Tests',
    tasks: subtasks,
    stopOnError: false,
    metadata: {
      description: 'Batch evaluation of all installed models on Mode 1 atomic tests',
      total_models: models.length,
      total_tests: subtasks.length,
      generated: new Date().toISOString()
    }
  };
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Discovering installed Ollama models...\n');

  // Get model list from Ollama
  let ollamaOutput;
  try {
    ollamaOutput = execSync('ollama list', { encoding: 'utf-8' });
  } catch (error) {
    console.error('❌ Failed to get Ollama model list');
    console.error('   Make sure Ollama is installed and running');
    process.exit(1);
  }

  // Parse models
  const models = parseOllamaList(ollamaOutput);
  console.log(`✅ Found ${models.length} models in size range ${CONFIG.minSizeGB}-${CONFIG.maxSizeGB}GB:\n`);
  
  models.forEach((m, idx) => {
    console.log(`   ${idx + 1}. ${m.name.padEnd(40)} ${m.sizeStr.padStart(8)}`);
  });

  if (models.length === 0) {
    console.log('\n⚠️  No models found in the specified size range');
    console.log('   Run: ollama pull mistral:latest');
    process.exit(0);
  }

  // Load prompts
  console.log(`\n📝 Loading evaluation prompts from ${CONFIG.promptsPath}...\n`);
  
  let prompts;
  try {
    prompts = await loadPrompts();
    console.log(`✅ Loaded ${prompts.atomic_tests.length} atomic tests`);
    console.log(`✅ Loaded ${prompts.compound_tests.length} compound tests`);
    console.log(`✅ Loaded ${prompts.integration_tests ? prompts.integration_tests.length : 0} integration tests`);
    console.log(`✅ Loaded ${prompts.adversarial_tests ? prompts.adversarial_tests.length : 0} adversarial tests`);
  } catch (error) {
    console.error(`❌ Failed to load prompts: ${error.message}`);
    process.exit(1);
  }

  // Create output directories
  console.log(`\n📁 Creating output directories...\n`);
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  await fs.mkdir(CONFIG.resultsDir, { recursive: true });

  for (const model of models) {
    const modelSlug = model.name.replace(/[:\/]/g, '-');
    await fs.mkdir(path.join(CONFIG.resultsDir, modelSlug), { recursive: true });
  }

  // Generate individual task files
  console.log(`\n⚙️  Generating individual evaluation tasks...\n`);
  
  let tasksGenerated = 0;
  const allTests = [
    ...prompts.atomic_tests,
    ...prompts.compound_tests,
    ...(prompts.integration_tests || []),
    ...(prompts.adversarial_tests || [])
  ];

  for (const model of models) {
    const modelSlug = model.name.replace(/[:\/]/g, '-');
    
    for (let i = 0; i < allTests.length; i++) {
      const prompt = allTests[i];
      const taskJSON = generateTaskJSON(model, prompt, i);
      const filename = `evaluate-${modelSlug}-${prompt.test_id}.json`;
      const filepath = path.join(CONFIG.outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(taskJSON, null, 2), 'utf-8');
      tasksGenerated++;
    }
  }

  console.log(`✅ Generated ${tasksGenerated} individual task files`);

  // Generate batch task file
  console.log(`\n⚙️  Generating batch evaluation task...\n`);
  
  const batchTask = generateBatchTaskJSON(models, prompts);
  const batchFilepath = path.join(CONFIG.outputDir, 'batch-eval-all-models.json');
  await fs.writeFile(batchFilepath, JSON.stringify(batchTask, null, 2), 'utf-8');
  
  console.log(`✅ Generated batch task with ${batchTask.tasks.length} subtasks`);

  // Generate execution script
  console.log(`\n📜 Generating execution script...\n`);
  
  const execScript = `#!/bin/bash
# Auto-generated LLM Evaluation Execution Script
# Generated: ${new Date().toISOString()}
# Models: ${models.length}
# Tests per model: ${allTests.length}
# Total evaluations: ${tasksGenerated}

set -e

echo "🚀 Starting LLM Evaluation Suite"
echo "================================="
echo ""
echo "Models to evaluate: ${models.length}"
echo "Tests per model: ${allTests.length}"
echo "Total evaluations: ${tasksGenerated}"
echo ""

# Create results directory
mkdir -p ${CONFIG.resultsDir}

# Execute batch evaluation
echo "Running batch evaluation..."
npm run task ${batchFilepath}

echo ""
echo "✅ Evaluation complete!"
echo "Results saved to: ${CONFIG.resultsDir}"
`;

  const execScriptPath = path.join(CONFIG.outputDir, 'run-evaluation.sh');
  await fs.writeFile(execScriptPath, execScript, 'utf-8');
  await fs.chmod(execScriptPath, 0o755); // Make executable

  console.log(`✅ Generated execution script: ${execScriptPath}`);

  // Summary
  console.log(`\n
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  📊 Task Generation Complete                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

Models discovered:     ${models.length}
Tests per model:       ${allTests.length}
Individual tasks:      ${tasksGenerated}
Batch task subtasks:   ${batchTask.tasks.length}

Output directory:      ${CONFIG.outputDir}
Results directory:     ${CONFIG.resultsDir}

Next steps:
1. Review generated task files in ${CONFIG.outputDir}
2. Run: ${execScriptPath}
3. Or run individual tasks: npm run task ${CONFIG.outputDir}/evaluate-[model]-[test].json
4. Or run batch: npm run task ${batchFilepath}

Estimated runtime:
- Per test: ~5-30 seconds (depending on model size)
- Total: ~${Math.round((tasksGenerated * 15) / 60)} minutes (assuming 15s average)
`);
}

// Execute
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
