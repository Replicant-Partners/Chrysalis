#!/usr/bin/env ts-node
/**
 * Buffett vs. Graham Investment Debate
 *
 * A simulated investment debate between Warren Buffett and Benjamin Graham
 * using their agent personalities, beliefs, and investment philosophies.
 *
 * This demonstrates Chrysalis's agent personality system and A2A collaboration.
 */

import * as fs from 'fs';
import * as path from 'path';

// Agent personality and belief structures
interface Belief {
  content: string;
  conviction: number;
  privacy: string;
  source: string;
}

interface AgentPersonality {
  name: string;
  role: string;
  core_traits: string[];
  signature_phrases: string[];
  beliefs: {
    who: Belief[];
    what: Belief[];
    where: Belief[];
    when: Belief[];
    why: Belief[];
    how: Belief[];
    huh: Belief[];
  };
  investment_philosophy: {
    core_principles: string[];
    evaluation_approach: string[];
  };
  communication_style: {
    all: string[];
  };
  temperature: number;
}

// Debate topics
interface DebateTopic {
  question: string;
  context: string;
  category: 'philosophy' | 'valuation' | 'strategy' | 'risk' | 'modern' | 'growth-investing' | 'concentration' | 'moats' | 'stock-2026';
}

// Load agent specifications
function loadAgent(agentPath: string): AgentPersonality {
  const jsonData = JSON.parse(fs.readFileSync(agentPath, 'utf-8'));
  return {
    name: jsonData.name,
    role: jsonData.designation,
    core_traits: jsonData.personality.core_traits,
    signature_phrases: jsonData.signature_phrases,
    beliefs: jsonData.beliefs,
    investment_philosophy: jsonData.investment_philosophy,
    communication_style: jsonData.communication_style,
    temperature: agentPath.includes('buffett') ? 0.7 : 0.6
  };
}

// Simulate agent response based on personality and beliefs
function generateResponse(
  agent: AgentPersonality,
  topic: DebateTopic,
  opponentLastResponse?: string
): string {
  // Find relevant beliefs
  const relevantBeliefs: Belief[] = [];

  // Search through all belief categories
  for (const category of ['who', 'what', 'where', 'when', 'why', 'how', 'huh'] as const) {
    const beliefs = agent.beliefs[category];
    if (Array.isArray(beliefs)) {
      beliefs.forEach(belief => {
        if (belief.conviction >= 0.9) {
          relevantBeliefs.push(belief);
        }
      });
    }
  }

  // This is a simulated response - in a real Chrysalis deployment,
  // this would call Claude API with the agent's personality as system prompt
  return `[${agent.name} would respond here based on beliefs: ${relevantBeliefs[0]?.content || 'core principles'}]`;
}

// Debate structure
class InvestmentDebate {
  private buffett: AgentPersonality;
  private graham: AgentPersonality;
  private debateHistory: Array<{ speaker: string; statement: string; }> = [];

  constructor(buffettPath: string, grahamPath: string) {
    this.buffett = loadAgent(buffettPath);
    this.graham = loadAgent(grahamPath);
  }

  private colorize(text: string, color: 'blue' | 'green' | 'yellow' | 'cyan' | 'magenta'): string {
    const colors = {
      blue: '\x1b[34m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      cyan: '\x1b[36m',
      magenta: '\x1b[35m'
    };
    return `${colors[color]}${text}\x1b[0m`;
  }

  private printSeparator(): void {
    console.log('\n' + '─'.repeat(80) + '\n');
  }

  private printAgent(agent: AgentPersonality, statement: string, color: 'blue' | 'green'): void {
    console.log(this.colorize(`\n${agent.name} (${agent.role}):`, color));
    console.log(`  ${statement}\n`);
    this.debateHistory.push({ speaker: agent.name, statement });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async conductDebate(topic: DebateTopic): Promise<void> {
    this.printSeparator();
    console.log(this.colorize(`📊 DEBATE TOPIC: ${topic.question}`, 'yellow'));
    console.log(this.colorize(`Context: ${topic.context}`, 'cyan'));
    this.printSeparator();

    // Round 1: Graham opens (as the teacher/mentor)
    await this.sleep(1000);
    this.printAgent(this.graham, this.getGrahamResponse(topic), 'green');

    // Round 2: Buffett responds
    await this.sleep(1000);
    this.printAgent(this.buffett, this.getBuffettResponse(topic, 1), 'blue');

    // Round 3: Graham counters
    await this.sleep(1000);
    this.printAgent(this.graham, this.getGrahamCounter(topic), 'green');

    // Round 4: Buffett final thoughts
    await this.sleep(1000);
    this.printAgent(this.buffett, this.getBuffettFinal(topic), 'blue');

    this.printSeparator();
  }

  // Simulated responses based on agent beliefs and personalities
  private getGrahamResponse(topic: DebateTopic): string {
    const responses: Record<string, string> = {
      'growth-investing': `As I've taught for decades, let me be clear: growth is not investing--it's speculation. The intelligent investor must distinguish between the two.

When you pay a premium for growth, you're making an optimistic bet on the future. But operations for profit should be based not on optimism but on arithmetic.

Consider the mathematical reality: if a stock trades at 30 times earnings based on growth expectations, that company must sustain extraordinary performance for many years just to justify today's price. Any disappointment, and the investor suffers significant losses.

The margin of safety--the cornerstone of sound investing--disappears when you overpay for growth. My student Warren here has done well, but I worry he's sometimes paid prices that leave insufficient protection against the inevitable uncertainties of business.`,

      'concentration': `Warren, you've diverged from my teachings on this matter, and I must express my concern as your former professor.

Diversification is an established tenet of investment policy. The defensive investor should own at least 10-30 different securities, and preferably more. Why? Because individual business outcomes are inherently unpredictable, no matter how thorough one's analysis.

Your concentrated approach may work in favorable circumstances, but it exposes capital to unacceptable risk. What if Coca-Cola had faced a catastrophic event? Or if American Express had failed? You would have suffered permanent capital loss.

The defensive investor seeks adequate returns with minimum risk. Your approach seeks superior returns with concentrated risk. That, I'm afraid, is speculation dressed as investment, however brilliant the analysis.`,

      'moats': `Warren speaks eloquently about "economic moats" and competitive advantages. This is sound thinking as far as it goes, but it introduces dangerous subjectivity into the investment process.

How does one measure the depth of a moat? How permanent is a competitive advantage? These are qualitative judgments prone to error and emotion. Coca-Cola's brand seemed unassailable, but consumer preferences shift. American Express's network seemed impregnable, but technology disrupts.

I prefer quantitative measures: book value, current assets, earnings stability, dividend records. These are facts, not opinions. The balance sheet doesn't lie--or at least, it lies less than our projections about future competitive advantage.

The true margin of safety comes from buying at a substantial discount to measurable intrinsic value, not from qualitative assessments of future prosperity, however well-reasoned.`,

      'stock-2026': `Looking at the market in 2026, I must counsel extreme caution. The market valuations are stretched by historical standards, and I see dangerous speculation everywhere.

For the defensive investor--which most people should be--I recommend high-grade bonds and a diversified portfolio of blue-chip stocks trading at reasonable P/E multiples, ideally below 15. Look for companies with: 1) Adequate size ($2 billion+ market cap), 2) Strong financial condition (current ratio above 2.0), 3) Earnings stability (no deficits in past 10 years), 4) Dividend record (some payment in past 20 years), 5) Earnings growth (at least 1/3 increase over past decade), and 6) Moderate P/E (below 15).

If you cannot find stocks meeting these criteria at attractive prices--which is likely in today's inflated market--I strongly recommend low-cost index funds. The S&P 500 provides adequate diversification and removes the need for individual security selection.

Warren may point to exciting tech companies or high-growth opportunities, but remember: obvious prospects for growth in a business do not translate to obvious profits for investors. Most investors would be far better served by Treasury bonds yielding 4-5% than by chasing popular stocks at 30-40 times earnings.`
    };

    return responses[topic.category] || responses['growth-investing'];
  }

  private getBuffettResponse(topic: DebateTopic, round: number): string {
    const responses: Record<string, string> = {
      'growth-investing': `Ben, I learned everything from you, and I'll never stop being grateful. But I respectfully believe I've extended your principles rather than abandoned them.

You taught me to buy dollars for fifty cents. I agree completely. But I've learned something additional: some businesses are worth $2, while others are worth only $1. And more importantly, the $2 businesses tend to become $3 businesses over time, while the $1 businesses often become 75-cent businesses.

When I buy See's Candies or Coca-Cola, I'm not speculating on growth--I'm buying proven businesses with durable competitive advantages at reasonable prices. The growth isn't speculation; it's the natural result of outstanding economics.

Let me put it plainly: it's far better to buy a wonderful company at a fair price than a fair company at a wonderful price. That's not abandoning the margin of safety--it's recognizing that quality itself provides protection.`,

      'concentration': `Ben, you taught me to think independently, and I must respectfully disagree with you here. Diversification is protection against ignorance, but for those who know what they're doing, concentrated holdings make more sense.

Think about it from a business perspective. If you were offered the chance to own 10% of the best business in your town, would you say "No, I'd rather own 1% of the ten best businesses"? Of course not. Yet that's what extreme diversification does--it dilutes your best ideas.

I've watched Berkshire's value compound at tremendous rates precisely because we focused on our best ideas: GEICO, See's Candies, Coca-Cola. Had we diversified across 50 mediocre opportunities, we'd have mediocre results.

The key is the circle of competence you taught me about. If I truly understand a business, concentration makes sense. If I don't, I shouldn't invest at all--diversification won't save me from my ignorance.`,

      'moats': `Ben, you're absolutely right that qualitative analysis introduces subjectivity. But I'd argue that even your quantitative methods require judgment. What's the right P/E multiple? How do you adjust book value for intangibles? These aren't as objective as they appear.

The moat concept simply formalizes something you already taught: look for businesses that will remain profitable. You examined earnings stability--that's looking for a moat! You studied competitive position--another moat analysis!

I've just made it more explicit. When See's Candies raises prices every year without losing customers, that's a measurable moat. When American Express has the highest spending customers, that's quantifiable. When Coca-Cola has unmatched distribution, that's observable.

And here's the key: these moats often let you pay what seems like a full price, but turns out to be cheap because the business grows in value faster than expected. Time becomes your ally, not your enemy.`,

      'stock-2026': `Ben, I agree the market isn't cheap overall, but there are always opportunities if you look carefully. Let me be specific about what I'd consider in 2026.

First, I'd look at businesses with proven resilience: companies that have maintained or grown earnings through multiple economic cycles. Apple, for instance, has an ecosystem that creates genuine switching costs--people don't easily abandon their entire Apple infrastructure. That's a measurable moat.

Second, I'd consider select financial companies if they're trading at reasonable prices--banks with conservative lending, low-cost deposit bases, and competent management. These aren't exciting, but they compound wealth steadily.

Third, I'd look at capital-light businesses with pricing power. Companies that can raise prices without losing customers because their product is essential to their customers' operations. Think railroads, certain software companies with mission-critical products, or branded consumer goods with real loyalty.

Now, would I buy these at any price? Absolutely not. But if I can get a wonderful business at 15-20 times earnings with reasonable growth prospects, I'm getting better long-term value than a mediocre company at 8 times earnings or a bond yielding 4%. The key is that wonderful business will be worth far more in 10 years, while the bond just returns my principal.`
    };

    return responses[topic.category] || responses['growth-investing'];
  }

  private getGrahamCounter(topic: DebateTopic): string {
    const genericCounter = `Warren, your success speaks for itself, and I'm proud of what you've accomplished. But I worry about those who will try to follow your approach without your extraordinary talent.

The average investor cannot identify sustainable competitive advantages with your skill. They will convince themselves that today's popular stocks have "moats" when they're simply expensive. They'll concentrate their holdings and suffer devastating losses when their analysis proves wrong.

My approach is designed for the typical investor--the defensive investor who seeks adequate returns with safety of principal. Your approach requires exceptional insight and judgment. It's the difference between a path anyone can follow safely and a tightrope that only the most skilled can walk.

Moreover, the market has a way of making fools of us all eventually. The businesses you consider "wonderful" today may face challenges neither of us can foresee. The margin of safety I advocate--buying at a substantial discount to conservative intrinsic value--protects against these unknowns better than faith in competitive advantages.`;

    const specific: Record<string, string> = {
      'stock-2026': `Warren, you mention Apple at 15-20 times earnings as if that's conservative. But let me do the arithmetic for you: at 20 times earnings with 5% earnings growth, an investor needs that company to perform well for 10-15 years just to justify today's price. Any stumble--regulatory action, technological disruption, management misstep--and you face permanent capital loss.

Your railroads and "capital-light" businesses sound prudent, but you are forgetting the lesson of technological change. Railroad bonds were considered the safest investment in 1910. Today's "essential" software can be obsolete in five years. Consumer brand loyalty you describe evaporates when a better product arrives at a lower price.

I maintain my position: in 2026's elevated market, the defensive investor should hold predominantly high-grade bonds (4-5% with safety of principal) and limit stocks to perhaps 25% of the portfolio in a broad index fund. For those seeking individual stocks, stick to my quantitative criteria: P/E below 15, strong balance sheet, proven earnings record. If you cannot find such stocks--and in this market, you likely cannot--then bonds are your friend.

Your approach works for you because you are Warren Buffett. But the typical investor following your advice will pay premium prices for what they believe are "wonderful businesses" and discover, too late, that they overpaid for deteriorating franchises.`;
    };

    return specific[topic.category] || genericCounter;
  }

  private getBuffettFinal(topic: DebateTopic): string {
    const genericFinal = `Ben, you're right that most investors should stick with index funds--I've said that publicly many times. And you're right that my approach requires work and judgment that many won't or can't provide.

But here's where we truly agree more than we differ: we both believe in buying value, we both insist on a margin of safety, and we both advocate for patient, businesslike investing over speculation.

Our difference is mainly one of emphasis. You focused on measurable discounts to book value because in your era, that's where the opportunities were. In my era, I've found that buying quality businesses at reasonable prices provides equally good--or better--protection.

The core principle remains: understand what you're buying, pay less than it's worth, and give the investment time to work. Whether that's a net-net selling below book value or a quality franchise at 15 times earnings, both can work if done with discipline.

Time has proven that quality compounds in ways that mediocy cannot. But your teachings about emotional discipline, Mr. Market, and protection of capital remain as true today as ever. I'm living proof that your principles work--I've just adapted them to different types of opportunities.`;

    const specific: Record<string, string> = {
      'stock-2026': `Ben, you're absolutely right that most investors should buy index funds--I've recommended that strategy publicly for years, and I stand by it. For 2026 specifically, I completely agree with you that valuations are elevated and caution is warranted.

But here is where I would add nuance: if someone has the time and temperament to study businesses, there are still opportunities. You are concerned about paying 20 times earnings for Apple, and that is valid. But consider that Apple returns massive amounts of cash to shareholders through buybacks. Over the next 10 years, if they buy back 30-40% of shares outstanding while maintaining earnings, the effective P/E for someone buying today drops substantially.

You warn about technological disruption, and you are right to be cautious. That is exactly why circle of competence matters. I do not invest in businesses I cannot understand or predict. But some businesses--like railroads moving coal, or Coca-Cola selling beverages, or certain banks taking deposits and making loans--have business models that have not fundamentally changed in decades. That predictability has value.

Here is my practical advice for 2026: If you cannot find individual stocks meeting your criteria--and you are right that they are scarce--then absolutely buy an S&P 500 index fund and Treasury bonds. But if you do find a business you thoroughly understand, trading at a reasonable price relative to its earnings power, with a durable competitive position, do not let an arbitrary P/E cutoff stop you from buying something that will be worth far more in ten years.

The real agreement between us is this: never speculate, always protect capital, and think like a business owner. Whether that leads you to net-nets or quality franchises depends on what Mr. Market is offering at the time.`;
    };

    return specific[topic.category] || genericFinal;
  }

  displaySummary(): void {
    console.log(this.colorize('\n📋 DEBATE SUMMARY', 'magenta'));
    console.log(this.colorize('════════════════════════════════════════════════════════════════════════════════', 'magenta'));

    console.log(this.colorize('\n🎓 BENJAMIN GRAHAM - Core Positions:', 'green'));
    console.log('  • Margin of safety through quantitative discounts');
    console.log('  • Diversification protects against uncertainty');
    console.log('  • Systematic, formulaic approaches reduce error');
    console.log('  • Focus on measurable book value and earnings');
    console.log('  • Defensive investing for the average investor');

    console.log(this.colorize('\n💼 WARREN BUFFETT - Core Positions:', 'blue'));
    console.log('  • Quality businesses provide their own margin of safety');
    console.log('  • Concentration on best ideas maximizes returns');
    console.log('  • Competitive moats are identifiable and quantifiable');
    console.log('  • Time amplifies the power of great businesses');
    console.log('  • Better to own wonderful companies at fair prices');

    console.log(this.colorize('\n🤝 COMMON GROUND:', 'cyan'));
    console.log('  • Value investing over speculation');
    console.log('  • Emotional discipline is paramount');
    console.log('  • Understand what you own');
    console.log('  • Pay less than intrinsic value');
    console.log('  • Long-term patient approach');
    console.log('  • Most investors should use index funds');

    console.log(this.colorize('\n🎯 KEY INSIGHT:', 'yellow'));
    console.log('  Graham created the intellectual foundation; Buffett extended it.');
    console.log('  Graham focused on quantitative discounts in a pre-computer era.');
    console.log('  Buffett focused on qualitative advantages as markets became efficient.');
    console.log('  Both approaches work--the choice depends on opportunity and skill.\n');
  }
}

// Main execution
async function main(): Promise<void> {
  console.log('\n🦋 Chrysalis Investment Debate System');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');

  const replicantsDir = path.join(__dirname, '..', '..', 'Replicants', 'legends');
  const buffettPath = path.join(replicantsDir, 'warren_buffett.json');
  const grahamPath = path.join(replicantsDir, 'benjamin_graham.json');

  // Check if files exist
  if (!fs.existsSync(buffettPath) || !fs.existsSync(grahamPath)) {
    console.error('❌ Agent specification files not found!');
    console.error(`   Looking in: ${replicantsDir}`);
    process.exit(1);
  }

  const debate = new InvestmentDebate(buffettPath, grahamPath);

  // Define debate topics
  const topics: DebateTopic[] = [
    {
      question: 'What Stocks Should We Buy in 2026?',
      context: 'The market in 2026 shows elevated valuations by historical standards. With interest rates at 4-5%, bonds are competitive again. Where should investors put their money: tech giants like Apple, traditional value stocks, index funds, or bonds?',
      category: 'stock-2026'
    },
    {
      question: 'Is Growth Investing Compatible with Value Investing?',
      context: 'Buffett evolved from Graham\'s strict value approach to paying premium prices for quality growth companies like Coca-Cola and See\'s Candies. Does this violate value investing principles?',
      category: 'growth-investing'
    },
    {
      question: 'Diversification vs. Concentration: What is the Right Approach?',
      context: 'Graham advocated for broad diversification (10-30+ stocks), while Buffett famously concentrated Berkshire\'s holdings in his best ideas. Who is right?',
      category: 'concentration'
    },
    {
      question: 'Quantitative Analysis vs. Competitive Moats',
      context: 'Graham focused on measurable metrics like book value and P/E ratios. Buffett emphasizes intangible competitive advantages. Can moats be reliably assessed?',
      category: 'moats'
    }
  ];

  // Conduct debates
  for (const topic of topics) {
    await debate.conductDebate(topic);
  }

  // Display final summary
  debate.displaySummary();

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🦋 Debate completed. These responses reflect the agents\' documented beliefs');
  console.log('   and investment philosophies as specified in their Chrysalis agent files.');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
}

// Run the debate
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export { InvestmentDebate, DebateTopic };
