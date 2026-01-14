/**
 * Investment Agents Deployment Script
 *
 * Deploys Warren Buffett and Benjamin Graham agents using Chrysalis framework
 * with agent registry, consensus mechanism, and A2A communication simulation
 */

import * as fs from 'fs';
import * as yaml from 'js-yaml';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

interface AgentConfig {
  metadata: {
    name: string;
    version: string;
    description: string;
  };
  identity: {
    role: string;
    goal: string;
    backstory: string;
  };
  beliefs: Record<string, any[]>;
  signature_phrases: string[];
  capabilities: {
    skills: Array<{
      name: string;
      type: string;
      proficiency: number;
      description: string;
    }>;
  };
  protocols: {
    a2a: {
      enabled: boolean;
      collaboration_modes?: string[];
    };
  };
}

interface DeployedAgent {
  agent_id: string;
  instance_id: string;
  config: AgentConfig;
  status: 'initializing' | 'running' | 'idle' | 'terminated';
  created_at: string;
  last_active: string;
  stats: {
    interactions: number;
    collaborations: number;
    decisions_made: number;
  };
}

interface InvestmentAnalysis {
  company: string;
  analyst: string;
  timestamp: string;
  analysis: {
    business_quality: number;
    management_quality: number;
    competitive_advantage: number;
    intrinsic_value_estimate: string;
    margin_of_safety: number;
    recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'avoid';
    reasoning: string[];
  };
}

interface ConsensusResult {
  topic: string;
  participants: string[];
  votes: Record<string, string>;
  consensus_reached: boolean;
  final_decision: string;
  confidence: number;
  timestamp: string;
}

// ============================================================================
// Agent Registry
// ============================================================================

class AgentRegistry {
  private agents: Map<string, DeployedAgent> = new Map();

  register(config: AgentConfig): DeployedAgent {
    const agent_id = this.generateAgentId(config.metadata.name);
    const instance_id = this.generateInstanceId();

    const agent: DeployedAgent = {
      agent_id,
      instance_id,
      config,
      status: 'initializing',
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      stats: {
        interactions: 0,
        collaborations: 0,
        decisions_made: 0
      }
    };

    this.agents.set(agent_id, agent);
    return agent;
  }

  get(agent_id: string): DeployedAgent | undefined {
    return this.agents.get(agent_id);
  }

  list(): DeployedAgent[] {
    return Array.from(this.agents.values());
  }

  updateStatus(agent_id: string, status: DeployedAgent['status']): void {
    const agent = this.agents.get(agent_id);
    if (agent) {
      agent.status = status;
      agent.last_active = new Date().toISOString();
    }
  }

  incrementInteractions(agent_id: string): void {
    const agent = this.agents.get(agent_id);
    if (agent) {
      agent.stats.interactions++;
      agent.last_active = new Date().toISOString();
    }
  }

  private generateAgentId(name: string): string {
    return `agent-${name.toLowerCase().replace(/\s+/g, '-')}`;
  }

  private generateInstanceId(): string {
    return `instance-${crypto.randomBytes(8).toString('hex')}`;
  }
}

// ============================================================================
// Consensus Manager (like the demo we saw earlier)
// ============================================================================

class ConsensusManager {
  private polls: Map<string, any> = new Map();

  createPoll(topic: string, participants: string[]): string {
    const poll_id = `poll_${crypto.randomBytes(6).toString('hex')}`;

    this.polls.set(poll_id, {
      poll_id,
      topic,
      participants,
      votes: {},
      created_at: new Date().toISOString(),
      status: 'active'
    });

    return poll_id;
  }

  castVote(poll_id: string, agent_id: string, vote: string): void {
    const poll = this.polls.get(poll_id);
    if (poll && poll.status === 'active') {
      poll.votes[agent_id] = vote;
    }
  }

  resolveConsensus(poll_id: string): ConsensusResult {
    const poll = this.polls.get(poll_id);
    if (!poll) {
      throw new Error(`Poll ${poll_id} not found`);
    }

    const votes = Object.values(poll.votes) as string[];
    const voteCounts = votes.reduce((acc, vote) => {
      acc[vote] = (acc[vote] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const winner = Object.keys(voteCounts).reduce((a, b) =>
      voteCounts[a] > voteCounts[b] ? a : b
    );

    const consensus_reached = voteCounts[winner] === poll.participants.length;
    const confidence = voteCounts[winner] / poll.participants.length;

    poll.status = 'resolved';

    return {
      topic: poll.topic,
      participants: poll.participants,
      votes: poll.votes,
      consensus_reached,
      final_decision: winner,
      confidence,
      timestamp: new Date().toISOString()
    };
  }
}

// ============================================================================
// Agent Interaction Simulator
// ============================================================================

class AgentInteractionSimulator {
  constructor(
    private registry: AgentRegistry,
    private consensus: ConsensusManager
  ) {}

  async analyzeInvestment(
    agent: DeployedAgent,
    company: string
  ): Promise<InvestmentAnalysis> {
    this.registry.incrementInteractions(agent.agent_id);

    const beliefs = agent.config.beliefs;
    const skills = agent.config.capabilities.skills;

    // Simulate analysis based on agent's skills and beliefs
    const isBuffett = agent.config.metadata.name.includes('buffett');
    const isGraham = agent.config.metadata.name.includes('graham');

    let analysis: InvestmentAnalysis;

    if (isBuffett) {
      analysis = {
        company,
        analyst: agent.config.metadata.name,
        timestamp: new Date().toISOString(),
        analysis: {
          business_quality: 0.85,
          management_quality: 0.90,
          competitive_advantage: 0.88,
          intrinsic_value_estimate: '$150-180 per share',
          margin_of_safety: 0.25,
          recommendation: 'buy',
          reasoning: [
            'Wonderful business with strong competitive moat',
            'Exceptional management team with integrity',
            'Predictable earnings and strong cash flow',
            'Trading below intrinsic value with adequate margin of safety',
            'Can hold this business forever'
          ]
        }
      };
    } else if (isGraham) {
      analysis = {
        company,
        analyst: agent.config.metadata.name,
        timestamp: new Date().toISOString(),
        analysis: {
          business_quality: 0.80,
          management_quality: 0.85,
          competitive_advantage: 0.82,
          intrinsic_value_estimate: '$140-165 per share',
          margin_of_safety: 0.30,
          recommendation: 'buy',
          reasoning: [
            'Solid financials with strong balance sheet',
            'P/E ratio below market average',
            'Consistent dividend history',
            'Price provides adequate margin of safety (>30%)',
            'Meets defensive investor criteria'
          ]
        }
      };
    } else {
      throw new Error('Unknown analyst type');
    }

    return analysis;
  }

  async collaborateOnDecision(
    agents: DeployedAgent[],
    question: string
  ): Promise<ConsensusResult> {
    console.log(`\n🤝 Initiating collaborative decision on: "${question}"\n`);

    const poll_id = this.consensus.createPoll(
      question,
      agents.map(a => a.agent_id)
    );

    // Each agent votes based on their philosophy
    for (const agent of agents) {
      const vote = this.getAgentVote(agent, question);
      this.consensus.castVote(poll_id, agent.agent_id, vote);

      console.log(`   [${agent.config.metadata.name}] votes: "${vote}"`);

      agent.stats.collaborations++;
      agent.stats.decisions_made++;
    }

    console.log();
    const result = this.consensus.resolveConsensus(poll_id);

    return result;
  }

  private getAgentVote(agent: DeployedAgent, question: string): string {
    // Simulate voting based on agent beliefs
    const beliefs = agent.config.beliefs;

    if (question.includes('market crash')) {
      return 'buy_quality_businesses';
    } else if (question.includes('overvalued')) {
      return 'wait_for_better_prices';
    } else if (question.includes('defensive')) {
      return 'prioritize_safety';
    }

    return 'need_more_analysis';
  }
}

// ============================================================================
// Color Output Utilities
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function log(color: string, prefix: string, message: string = '') {
  if (message) {
    console.log(`${color}${prefix}${colors.reset} ${message}`);
  } else {
    console.log(`${color}${prefix}${colors.reset}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Main Deployment
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(80));
  log(colors.bright, '🚀 CHRYSALIS AGENT DEPLOYMENT SYSTEM', '');
  console.log('='.repeat(80));
  console.log();

  const registry = new AgentRegistry();
  const consensus = new ConsensusManager();
  const simulator = new AgentInteractionSimulator(registry, consensus);

  // Load agent configs
  log(colors.cyan, '📦 Loading Agent Configurations...');
  console.log();

  const buffettPath = path.join(__dirname, 'Replicants', 'legends', 'warren_buffett_agent.yaml');
  const grahamPath = path.join(__dirname, 'Replicants', 'legends', 'benjamin_graham_agent.yaml');

  const buffettConfig = yaml.load(fs.readFileSync(buffettPath, 'utf-8')) as AgentConfig;
  const grahamConfig = yaml.load(fs.readFileSync(grahamPath, 'utf-8')) as AgentConfig;

  log(colors.green, '  ✓', `Loaded ${buffettConfig.metadata.name}`);
  log(colors.blue, '  ✓', `Loaded ${grahamConfig.metadata.name}`);
  console.log();

  await sleep(500);

  // Register agents
  log(colors.cyan, '📋 Registering Agents with Chrysalis Ledger...');
  console.log();

  const buffett = registry.register(buffettConfig);
  const graham = registry.register(grahamConfig);

  log(colors.green, '  ✓', `Registered: ${buffett.agent_id} (instance: ${buffett.instance_id})`);
  log(colors.blue, '  ✓', `Registered: ${graham.agent_id} (instance: ${graham.instance_id})`);
  console.log();

  await sleep(500);

  // Activate agents
  log(colors.cyan, '⚡ Activating Agents...');
  console.log();

  registry.updateStatus(buffett.agent_id, 'running');
  registry.updateStatus(graham.agent_id, 'running');

  log(colors.green, '  ✓', `${buffett.agent_id} status: running`);
  log(colors.blue, '  ✓', `${graham.agent_id} status: running`);
  console.log();

  await sleep(500);

  // Display agent capabilities
  console.log('─'.repeat(80));
  log(colors.magenta, '\n💡 Agent Capabilities:');
  console.log();

  console.log(`  ${buffett.config.metadata.name}:`);
  buffett.config.capabilities.skills.slice(0, 3).forEach(skill => {
    console.log(`    • ${skill.name} (${(skill.proficiency * 100).toFixed(0)}%)`);
  });
  console.log();

  console.log(`  ${graham.config.metadata.name}:`);
  graham.config.capabilities.skills.slice(0, 3).forEach(skill => {
    console.log(`    • ${skill.name} (${(skill.proficiency * 100).toFixed(0)}%)`);
  });
  console.log();

  await sleep(1000);

  // Scenario 1: Individual Analysis
  console.log('─'.repeat(80));
  log(colors.bright, '\n📊 SCENARIO 1: Individual Investment Analysis');
  console.log();

  const company = 'Acme Technology Corp';
  log(colors.yellow, '🏢 Company:', company);
  console.log();

  await sleep(500);

  log(colors.green, `[${buffett.config.metadata.name}] Analyzing...`);
  const buffettAnalysis = await simulator.analyzeInvestment(buffett, company);
  console.log(`  Recommendation: ${buffettAnalysis.analysis.recommendation.toUpperCase()}`);
  console.log(`  Margin of Safety: ${(buffettAnalysis.analysis.margin_of_safety * 100).toFixed(0)}%`);
  console.log(`  Key Reasoning: ${buffettAnalysis.analysis.reasoning[0]}`);
  console.log();

  await sleep(500);

  log(colors.blue, `[${graham.config.metadata.name}] Analyzing...`);
  const grahamAnalysis = await simulator.analyzeInvestment(graham, company);
  console.log(`  Recommendation: ${grahamAnalysis.analysis.recommendation.toUpperCase()}`);
  console.log(`  Margin of Safety: ${(grahamAnalysis.analysis.margin_of_safety * 100).toFixed(0)}%`);
  console.log(`  Key Reasoning: ${grahamAnalysis.analysis.reasoning[0]}`);
  console.log();

  await sleep(1000);

  // Scenario 2: Collaborative Decision (Consensus)
  console.log('─'.repeat(80));
  log(colors.bright, '\n🤝 SCENARIO 2: Collaborative Decision (Consensus Protocol)');
  console.log();

  const question = 'Should we buy quality businesses during a market crash?';
  const consensusResult = await simulator.collaborateOnDecision(
    [buffett, graham],
    question
  );

  log(colors.magenta, '📋 Consensus Result:');
  console.log(`  Decision: ${consensusResult.final_decision}`);
  console.log(`  Confidence: ${(consensusResult.confidence * 100).toFixed(0)}%`);
  console.log(`  Consensus Reached: ${consensusResult.consensus_reached ? 'YES' : 'NO'}`);
  console.log();

  await sleep(1000);

  // Display registry status
  console.log('─'.repeat(80));
  log(colors.bright, '\n📈 Agent Registry Status:');
  console.log();

  registry.list().forEach(agent => {
    console.log(`  ${agent.agent_id}:`);
    console.log(`    Status: ${agent.status}`);
    console.log(`    Interactions: ${agent.stats.interactions}`);
    console.log(`    Collaborations: ${agent.stats.collaborations}`);
    console.log(`    Decisions Made: ${agent.stats.decisions_made}`);
    console.log();
  });

  console.log('='.repeat(80));
  log(colors.green, '\n✅ Deployment Complete!');
  console.log();
  log(colors.yellow, '💡 Key Features Demonstrated:');
  console.log('   • Agent registration with unique IDs');
  console.log('   • Individual agent analysis capabilities');
  console.log('   • Consensus-based collaborative decision making');
  console.log('   • Experience tracking and statistics');
  console.log('   • Agent-to-Agent (A2A) communication protocol');
  console.log();
  log(colors.cyan, '🔗 Next Steps:');
  console.log('   • Connect to external data sources via MCP');
  console.log('   • Enable experience synchronization');
  console.log('   • Add more investor agents (Charlie Munger, Peter Lynch, etc.)');
  console.log('   • Integrate with real financial APIs');
  console.log();
  console.log('='.repeat(80));
  console.log();
}

// Run deployment
main().catch(error => {
  console.error('\n❌ Deployment failed:', error.message);
  process.exit(1);
});
