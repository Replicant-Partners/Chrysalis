/**
 * Investment Advisors Demo
 *
 * This script demonstrates Warren Buffett and Benjamin Graham agents
 * discussing investment strategies using the Chrysalis framework.
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';

interface AgentConfig {
  metadata: {
    name: string;
    description: string;
  };
  identity: {
    role: string;
    backstory: string;
  };
  signature_phrases: string[];
  beliefs: Record<string, any[]>;
}

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(color: string, prefix: string, message: string) {
  console.log(`${color}${prefix}${colors.reset} ${message}`);
}

async function loadAgent(yamlPath: string): Promise<AgentConfig> {
  const content = fs.readFileSync(yamlPath, 'utf-8');
  return yaml.load(content) as AgentConfig;
}

function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

function getBeliefSummary(agent: AgentConfig, category: string): string {
  const beliefs = agent.beliefs[category] || [];
  if (beliefs.length === 0) return '';
  const belief = beliefs[Math.floor(Math.random() * beliefs.length)];
  return belief.content || '';
}

async function simulateDiscussion(
  buffett: AgentConfig,
  graham: AgentConfig,
  topic: string
) {
  console.log('\n' + '='.repeat(80));
  log(colors.bright, '📊 INVESTMENT ADVISORS DISCUSSION', '');
  console.log('='.repeat(80));
  console.log();

  log(colors.cyan, `Topic:`, topic);
  console.log();

  log(colors.green, '👤 Participants:', '');
  console.log(`   • ${buffett.metadata.name} - ${buffett.identity.role}`);
  console.log(`   • ${graham.metadata.name} - ${graham.identity.role}`);
  console.log();

  console.log('-'.repeat(80));
  console.log();

  // Graham opens (as the professor/mentor)
  log(colors.blue, `[${graham.metadata.name}]:`, '');
  console.log(`   "${getRandomPhrase(graham.signature_phrases)}"`);
  console.log();
  console.log(`   ${getBeliefSummary(graham, 'what')}`);
  console.log();

  await sleep(1000);

  // Buffett responds (as the student/practitioner)
  log(colors.green, `[${buffett.metadata.name}]:`, '');
  console.log(`   "${getRandomPhrase(buffett.signature_phrases)}"`);
  console.log();
  console.log(`   ${getBeliefSummary(buffett, 'how')}`);
  console.log();

  await sleep(1000);

  // Graham on methodology
  log(colors.blue, `[${graham.metadata.name}]:`, '');
  console.log(`   ${getBeliefSummary(graham, 'how')}`);
  console.log();

  await sleep(1000);

  // Buffett on practical application
  log(colors.green, `[${buffett.metadata.name}]:`, '');
  console.log(`   ${getBeliefSummary(buffett, 'why')}`);
  console.log();

  await sleep(1000);

  // Graham's wisdom
  log(colors.blue, `[${graham.metadata.name}]:`, '');
  console.log(`   ${getBeliefSummary(graham, 'huh')}`);
  console.log();

  await sleep(1000);

  // Buffett's wisdom
  log(colors.green, `[${buffett.metadata.name}]:`, '');
  console.log(`   "${getRandomPhrase(buffett.signature_phrases)}"`);
  console.log();

  console.log('-'.repeat(80));
  console.log();

  log(colors.magenta, '💡 Key Insights:', '');
  console.log();
  console.log(`   Graham's Core Teaching: ${getBeliefSummary(graham, 'what')}`);
  console.log();
  console.log(`   Buffett's Application: ${getBeliefSummary(buffett, 'what')}`);
  console.log();

  console.log('='.repeat(80));
  console.log();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  try {
    console.log('\n🚀 Initializing Investment Advisors...\n');

    // Load agent configurations
    const buffettPath = path.join(__dirname, 'Replicants', 'legends', 'warren_buffett_agent.yaml');
    const grahamPath = path.join(__dirname, 'Replicants', 'legends', 'benjamin_graham_agent.yaml');

    const buffett = await loadAgent(buffettPath);
    const graham = await loadAgent(grahamPath);

    log(colors.green, '✓', `Loaded ${buffett.metadata.name}`);
    log(colors.blue, '✓', `Loaded ${graham.metadata.name}`);

    // Simulate a discussion
    await simulateDiscussion(
      buffett,
      graham,
      'Value Investing: The Margin of Safety Principle'
    );

    console.log();
    log(colors.yellow, '📝 Note:', 'This is a simulated discussion using agent beliefs and principles.');
    log(colors.yellow, '', 'For full LLM-powered conversations, integrate with Claude API.');
    console.log();

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the demo
main();
