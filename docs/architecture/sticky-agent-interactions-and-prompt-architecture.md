# Sticky Agent Interactions & Prompt Architecture

**Date:** 2026-01-14  
**Status:** Design Principles  
**Scope:** Human-Agent Interaction Patterns and Prompt Engineering for Chrysalis Terminal

---

## Executive Summary

This document explores what makes agent interactions **sticky** for humans (characteristics that drive engagement and trust) and the **prompt architecture** needed to enable logical problem decomposition and emergent intelligence.

**Core Insight:** Stickiness comes from agents that feel like they "get" you - remembering context, anticipating needs, explaining reasoning, and growing with you.

**Architectural Principle:** Prompts should be **cognitive scaffolding** - decomposing complex problems into logical operations that can be composed, verified, and evolved.

---

## What Makes Agent Interaction Sticky?

### 1. Predictable Surprise

**The Balance:**
- **Predictable** in how it behaves (consistent patterns, reliable responses)
- **Surprising** in what it discovers (novel insights, unexpected connections)

**Anti-Pattern: Random Agent**
```
Human: "Why is this API slow?"
Agent (Day 1): "Check database queries"
Agent (Day 2): "Maybe network latency?"
Agent (Day 3): "Could be anything really"

Result: Human stops trusting agent
```

**Sticky Pattern: Consistent Method, Novel Results**
```
Human: "Why is this API slow?"

Agent (predictable process):
1. Always analyzes logs
2. Always checks metrics
3. Always reviews code
4. Always correlates events

Agent (surprising discovery):
"The slowness correlates with full moon dates!

Investigation:
- Your cron job runs on lunar schedule
- It processes large datasets
- Starves CPU during peak API traffic

Evidence:
- 12 slowdowns in past year
- All within 48h of full moon
- CPU usage spikes correlate

This is real, not a joke. Check cron schedule."
```

**Why This Is Sticky:**
- Human knows *what* to expect (consistent analysis)
- Human never knows *what* will be found (surprising insights)
- Builds trust through reliability + value

### 2. Progressive Disclosure of Competence

**Don't show all capabilities at once.** Let humans discover agent abilities organically.

**Week 1: Basic Usage**
```
Human: "Explain this error"
Agent: [Provides clear explanation]
Human: "Thanks, that's helpful"
```

**Week 2: Proactive Suggestion**
```
Human: [Manually running same command 5 times]
Agent: "I noticed you run 'npm run build:prod' before 
        every deploy. Want me to automate that?"
Human: "Oh! Yes, please"
```

**Week 3: Anticipatory Action**
```
Agent: "I see you're about to merge PR #342, but it has
        a SQL injection vulnerability. I can fix it 
        automatically if you'd like?"
Human: "Wow, I didn't even see that. Yes!"
```

**Week 4: Trusted Partner**
```
Agent: "This architecture change looks risky. Based on
        our previous discussions about scalability, I
        think approach B would be better. Want to review?"
Human: "I trust your judgment. Go with approach B"
```

**Stickiness Driver:** **Continuous discovery**
- "I didn't know it could do that!"
- "It keeps getting better"
- "It learns what I need"

### 3. Memory & Continuity

**Agents should remember:**
- Previous conversations (context persistence)
- Human preferences (learning style, coding style)
- Team conventions (naming, architecture patterns)
- Failed attempts (don't suggest same solution twice)
- Successful solutions (build on what worked)

**Example: Context-Aware Response**
```
Human: "How should I handle auth for this new API?"

Agent: "Last time you asked about authentication 
        (3 weeks ago for the user service), you preferred 
        JWT over sessions because:
        1. Stateless design
        2. Better for microservices
        3. Easier mobile integration
        
        For this payment API, I'd recommend:
        - Same JWT approach for consistency
        - But add: Request signing (payment security)
        - Plus: IP allowlisting (extra protection)
        
        This builds on your existing auth infrastructure
        while meeting payment API security requirements.
        
        Want me to draft the implementation?"
```

**Why This Is Sticky:**
- Feels like a **long-term colleague**, not a fresh conversation
- Saves time (no re-explaining preferences)
- Builds on past decisions coherently
- Shows the agent is "paying attention"

### 4. Asymmetric Effort

**The Golden Ratio:**
- **Small human input** → **Large agent output**
- **Minimal human effort** → **Maximum agent value**

**Not Sticky:**
```
Human: [Writes 500 words describing problem in detail]
Agent: "Try restarting the server"

Ratio: 500:5 (human invests 100x what they get back)
```

**Sticky:**
```
Human: "users complaining"

Agent: [Analyzes automatically]
✓ Error logs (found 3 spike patterns)
✓ User feedback (sentiment analysis on 47 complaints)
✓ Recent deployments (correlation detected)
✓ Database queries (slow query identified)
✓ Network latency (API gateway timeout)

Root cause: Database migration 2 days ago
  → New index missing on users.email
  → Queries 20x slower
  → Cascading failures

3 Solution options:
1. Add missing index (5 min, high confidence)
2. Rollback migration (immediate, safe)
3. Scale database (1 hour, expensive)

Recommendation: #1 (I can apply it now if approved)

Ratio: 2:500 (agent provides 250x value for minimal input)
```

**Stickiness Driver:** 
- "Wow, I barely had to ask"
- "It did all the hard work"
- "This is like having a senior engineer on call"

### 5. Attribution & Ownership

**Make it clear:**
- What the agent did
- What the human did  
- Who gets credit

**Anti-Pattern: Agent Takes Credit**
```
Canvas shows:
  └─ Fix for Issue #234 by Agent

Human feels: Replaceable
```

**Sticky Pattern: Shared Success**
```
Canvas shows:
  └─ Fix for Issue #234
     ├─ Agent found: Root cause in auth module
     ├─ Agent analyzed: 3 potential solutions
     ├─ Human selected: Option 2 (caching approach)
     ├─ Agent implemented: Code + tests + docs
     └─ Human reviewed: Approved with minor tweaks

Final commit:
  "Fix auth latency issue
   
   Root cause identified by Agent analysis
   Solution designed in collaboration with Agent
   Implementation by Agent, reviewed by Alice
   
   Co-authored-by: Agent <agent@chrysalis.dev>"
```

**Stickiness Driver:**
- Human feels **amplified**, not replaced
- Clear division of labor
- Recognition for both contributions
- Builds trust and partnership

### 6. Proactive, Not Reactive

**Reactive (Less Sticky):**
```
Human asks question → Agent answers → Done
Repeat when human asks next question
```

**Proactive (Sticky):**
```
Agent notices anomaly → Alerts human → Proposes solution
  ↓
Human trusts agent is "watching their back"
```

**Example: Proactive Optimization**
```
Agent: "I noticed you've imported 'lodash' in 47 files 
        but only use 3 functions (map, filter, reduce).
        
        Current cost:
        - Bundle size: +234KB
        - Load time: +890ms
        - Tree shaking: Not working (lodash structure)
        
        Recommendation: Switch to 'lodash-es'
        - Bundle size: -234KB → -5KB (tree-shakeable)
        - Load time: -890ms → -20ms
        - Breaking changes: None (drop-in replacement)
        
        I can create a PR with this change in about 
        5 minutes. It'll update all 47 imports and add
        tests. Want me to go ahead?"
```

**Why This Is Sticky:**
- Agent is **actively working** even when not asked
- Surfaces opportunities human would miss
- Shows agent "cares about" the project
- Feels like having a dedicated optimization engineer

### 7. Graceful Degradation

**When agent doesn't know, it should:**

**Anti-Pattern: Dead End**
```
Human: "Why is the CI failing?"
Agent: "I don't know"

Result: Human gives up on asking agent
```

**Sticky Pattern: Collaborative Exploration**
```
Human: "Why is the CI failing?"

Agent: "I'm not certain yet, but here's what I tried:

Checked:
✓ CI logs → No obvious errors
✓ Recent commits → No suspicious changes  
✓ Dependencies → All unchanged
✓ Environment vars → All present

But I'm confused about:
❓ The error message mentions 'ECONNREFUSED'
❓ But our CI doesn't usually make network calls
❓ Could this be a new dependency side effect?

Can you help me understand:
1. Did we add any dependencies recently?
2. Are there any new network calls in tests?
3. Has the CI environment changed?

Once I understand these, I'll be able to help debug.
I'll also remember this pattern for next time."
```

**Stickiness Driver:**
- Agent shows its reasoning (builds trust)
- Agent asks intelligent questions (shows thinking)
- Agent commits to learning (growth mindset)
- Feels like **collaborative problem-solving**

---

## Prompt Set Architecture for Logical Decomposition

### Core Principle: Prompts as Cognitive Scaffolding

Each prompt should represent a **distinct cognitive operation**:

```typescript
interface PromptTemplate {
  // Identity
  id: string;
  name: string;
  version: string;
  
  // Function
  role: 'decompose' | 'analyze' | 'synthesize' | 'verify' | 'translate';
  
  // Semantic spaces
  inputSpace: SemanticSpace;
  outputSpace: SemanticSpace;
  
  // Quality dimensions
  dimensions: QualityDimension[];
  
  // The prompt
  template: string;
  
  // Learning
  examples: Example[];
  
  // Validation
  confidenceThreshold: number;
  validationRules: ValidationRule[];
}

type SemanticSpace = 
  | 'code' 
  | 'error' 
  | 'requirement' 
  | 'architecture' 
  | 'data'
  | 'test'
  | 'documentation';

type QualityDimension = 
  | 'correctness'    // Is it right?
  | 'completeness'   // Is anything missing?
  | 'consistency'    // Does it contradict itself?
  | 'clarity'        // Is it understandable?
  | 'efficiency';    // Can it be better?
```

**Key Properties:**

1. **Well-defined input/output spaces**
   - Clear semantic boundaries
   - Type safety for composition

2. **Single responsibility**
   - One cognitive operation
   - Composable with others

3. **Dimensional validation**
   - Check quality attributes
   - Ensure semantic consistency

4. **Examples for learning**
   - Few-shot learning
   - Continuous improvement

### The Prompt Hierarchy for Problem Solving

#### Level 1: Decomposition Prompts

**Purpose:** Break complex problems into atomic pieces

```
Prompt ID: "error-to-hypotheses"
Role: decompose
Input: ErrorSpace (error message + stack trace + context)
Output: HypothesisSpace (array of possible causes)

Template:
"Given this error:
{error_message}

Stack trace:
{stack_trace}

Context:
{code_context}
{recent_changes}
{environment}

Generate hypotheses for the root cause.

For each hypothesis, provide:
1. The hypothetical cause
2. Confidence level (0-1)
3. Tests to validate/invalidate
4. Supporting evidence
5. Contradicting evidence

Format as JSON array of hypotheses."

Dimensions: Completeness (considering all possible causes?)

Example Output:
[
  {
    hypothesis: "Database connection timeout",
    confidence: 0.8,
    tests: [
      "Check database logs for connection errors",
      "Verify connection pool configuration",
      "Monitor active connections"
    ],
    supporting: [
      "Error message mentions 'ETIMEDOUT'",
      "Recent increase in concurrent users"
    ],
    contradicting: [
      "Database server shows normal load"
    ]
  },
  {
    hypothesis: "Memory leak in request handler",
    confidence: 0.6,
    tests: [
      "Profile memory usage during requests",
      "Check for unclosed resources",
      "Review closure usage in handlers"
    ],
    supporting: [
      "Memory usage trending up",
      "Error occurs after sustained load"
    ],
    contradicting: [
      "Restarting server fixes temporarily"
    ]
  }
]
```

#### Level 2: Analysis Prompts

**Purpose:** Examine each piece deeply

```
Prompt ID: "hypothesis-to-evidence"
Role: analyze
Input: HypothesisSpace (single hypothesis + context)
Output: EvidenceSpace (validated evidence)

Template:
"Analyze this hypothesis:
{hypothesis}

Available data:
{logs}
{metrics}
{code}
{environment}

Classify each piece of evidence as:
- Supporting (confirms hypothesis)
- Contradicting (refutes hypothesis)  
- Missing (needed to validate)

Calculate:
- Strength of supporting evidence
- Strength of contradicting evidence
- Critical missing data

Conclusion: Likelihood (0-1) and next steps"

Dimensions: Correctness (is evidence valid and relevant?)

Example Output:
{
  hypothesis: "Database connection timeout",
  
  supporting_evidence: [
    {
      fact: "Connection pool at 100% utilization",
      strength: 0.9,
      source: "database_metrics.json"
    },
    {
      fact: "Average query time > 30 seconds",
      strength: 0.85,
      source: "slow_query_log"
    }
  ],
  
  contradicting_evidence: [
    {
      fact: "Database server CPU at 20%",
      strength: 0.3,
      source: "server_metrics.json",
      explanation: "Low CPU suggests not compute-bound"
    }
  ],
  
  missing_evidence: [
    "Network latency between app and database",
    "Connection pool configuration",
    "Query execution plans"
  ],
  
  likelihood: 0.75,
  confidence: 0.6, // Lower due to missing data
  
  next_steps: [
    "Measure network latency",
    "Review connection pool settings",
    "Analyze query plans for slow queries"
  ]
}
```

#### Level 3: Synthesis Prompts

**Purpose:** Combine insights into coherent solution

```
Prompt ID: "evidence-to-solution"
Role: synthesize
Input: EvidenceSpace (array of evidence for multiple hypotheses)
Output: SolutionSpace (proposed solutions)

Template:
"Given the evidence for multiple hypotheses:
{evidence_array}

Synthesize into solution(s):

1. Identify the root cause(s)
2. Propose solution(s)
3. Rank by: impact, effort, risk
4. Specify verification criteria

Consider:
- Multiple causes may interact
- Solutions may address multiple causes
- Trade-offs between solutions

Output solutions with implementation details."

Dimensions: Consistency (does solution address root cause?)

Example Output:
{
  root_causes: [
    {
      cause: "Connection pool exhaustion",
      confidence: 0.82,
      contributing_factors: [
        "Pool size too small (10 connections)",
        "Queries holding connections too long",
        "No connection timeout configured"
      ]
    }
  ],
  
  solutions: [
    {
      id: "sol1",
      name: "Increase connection pool size",
      description: "Expand pool from 10 to 50 connections",
      
      implementation: {
        files: ["config/database.js"],
        changes: "Update maxConnections: 10 → 50",
        testing: "Load test with 100 concurrent users"
      },
      
      impact: {
        fixes: ["Connection timeouts"],
        improves: ["Response time under load"],
        risks: ["Higher memory usage", "May mask deeper issue"]
      },
      
      effort: "5 minutes",
      risk: "low",
      
      verification: {
        metrics: ["Connection pool utilization < 80%"],
        tests: ["Load test passes"],
        monitoring: "Watch connection wait times for 24h"
      },
      
      rank: 1 // Best immediate solution
    },
    {
      id: "sol2",
      name: "Optimize slow queries",
      description: "Add indexes and optimize query plans",
      
      implementation: {
        files: ["models/User.js", "migrations/add_indexes.sql"],
        changes: "Add indexes on frequently queried columns",
        testing: "Measure query performance improvement"
      },
      
      impact: {
        fixes: ["Slow queries holding connections"],
        improves: ["Overall query performance"],
        risks: ["Index maintenance overhead"]
      },
      
      effort: "2 hours",
      risk: "medium",
      
      rank: 2 // Better long-term solution
    }
  ],
  
  recommendation: "Apply sol1 immediately for quick relief, then sol2 for long-term fix"
}
```

#### Level 4: Verification Prompts

**Purpose:** Check solution quality

```
Prompt ID: "solution-to-critique"
Role: verify
Input: SolutionSpace (proposed solution)
Output: CritiqueSpace (quality assessment)

Template:
"Critique this solution:
{solution}

Check these dimensions:
1. Semantic correctness - Does it make sense?
2. Logical consistency - Is the reasoning sound?
3. Completeness - Does it address all aspects?
4. Risk assessment - What could go wrong?
5. Alternatives - Are there better approaches?

Rate each dimension 0-10 and provide:
- Strengths
- Weaknesses  
- Improvement suggestions
- Known failure modes"

Dimensions: Clarity + Efficiency (can we do better?)

Example Output:
{
  solution_id: "sol1",
  
  semantic_check: {
    score: 9,
    assessment: "Solution directly addresses identified cause",
    reasoning: "Connection pool exhaustion → Increase pool size is logically sound"
  },
  
  logic_check: {
    score: 7,
    assessment: "Logic is sound but incomplete",
    concerns: [
      "Doesn't address WHY queries are slow",
      "May delay symptom discovery rather than fix root cause"
    ]
  },
  
  completeness_check: {
    score: 6,
    assessment: "Addresses immediate issue but not underlying cause",
    missing: [
      "Query optimization",
      "Connection timeout configuration",
      "Monitoring and alerting"
    ]
  },
  
  risk_check: {
    score: 8,
    assessment: "Low risk, reversible change",
    risks: [
      {
        risk: "Higher memory usage",
        likelihood: "high",
        severity: "low",
        mitigation: "Monitor memory, can reduce if needed"
      },
      {
        risk: "Masks underlying query performance issues",
        likelihood: "medium",
        severity: "medium",
        mitigation: "Combine with query optimization (sol2)"
      }
    ]
  },
  
  alternatives: [
    "Implement connection pooling with timeout",
    "Use read replicas to distribute load",
    "Cache frequently accessed data"
  ],
  
  overall_score: 7.5,
  
  recommendation: "Good immediate fix, but should be paired with sol2 for complete solution"
}
```

### Dimensional Consistency Checks

Each prompt transformation must maintain **semantic invariants**:

```typescript
class PromptValidator {
  /**
   * Dimension 1: Information Preservation
   * Output shouldn't lose critical input information
   */
  validateInformationFlow(
    input: any, 
    output: any, 
    allowedLosses: string[]
  ): ValidationResult {
    const inputKeys = this.extractCriticalKeys(input);
    const lostKeys = inputKeys.filter(key => 
      !this.isPreservedIn(key, output) && 
      !this.isTransformedIn(key, output) &&
      !allowedLosses.includes(key)
    );
    
    return {
      passed: lostKeys.length === 0,
      lostInformation: lostKeys,
      explanation: lostKeys.length > 0 
        ? `Lost critical information: ${lostKeys.join(', ')}`
        : "All critical information preserved or transformed"
    };
  }
  
  /**
   * Dimension 2: Logical Consistency  
   * Output shouldn't contradict itself
   */
  validateLogic(output: any): ValidationResult {
    const claims = this.extractClaims(output);
    const contradictions = this.findContradictions(claims);
    
    return {
      passed: contradictions.length === 0,
      contradictions,
      explanation: contradictions.length > 0
        ? `Found ${contradictions.length} logical contradictions`
        : "No logical contradictions detected"
    };
  }
  
  /**
   * Dimension 3: Semantic Coherence
   * Output should be in expected semantic space
   */
  validateSemantics(
    input: any, 
    output: any,
    expectedTransformation: SemanticTransformation
  ): ValidationResult {
    const inputDomain = this.identifyDomain(input);
    const outputDomain = this.identifyDomain(output);
    
    const isValid = this.isValidTransformation(
      inputDomain,
      outputDomain,
      expectedTransformation
    );
    
    return {
      passed: isValid,
      inputDomain,
      outputDomain,
      expectedTransformation,
      explanation: isValid
        ? `Valid transformation: ${inputDomain} → ${outputDomain}`
        : `Invalid transformation: Expected ${expectedTransformation}, got ${inputDomain} → ${outputDomain}`
    };
  }
  
  /**
   * Dimension 4: Completeness
   * Output should address all aspects of problem
   */
  validateCompleteness(
    output: any,
    problem: any,
    requiredAspects: string[]
  ): ValidationResult {
    const problemAspects = this.extractAspects(problem);
    const coverage = this.measureCoverage(output, problemAspects);
    const missingAspects = problemAspects.filter(
      aspect => !this.isAddressed(aspect, output)
    );
    
    return {
      passed: coverage >= this.completenessThreshold,
      coverage,
      missingAspects,
      explanation: coverage >= this.completenessThreshold
        ? `Complete: Addresses ${coverage * 100}% of problem aspects`
        : `Incomplete: Missing ${missingAspects.join(', ')}`
    };
  }
  
  /**
   * Dimension 5: Confidence Calibration
   * Output confidence should match actual reliability
   */
  validateConfidence(
    output: any,
    historicalAccuracy: number
  ): ValidationResult {
    const claimedConfidence = this.extractConfidence(output);
    const calibrationError = Math.abs(claimedConfidence - historicalAccuracy);
    
    return {
      passed: calibrationError < this.calibrationThreshold,
      claimedConfidence,
      historicalAccuracy,
      calibrationError,
      explanation: calibrationError < this.calibrationThreshold
        ? `Well calibrated: Error = ${calibrationError.toFixed(2)}`
        : `Poorly calibrated: Overconfident by ${calibrationError.toFixed(2)}`
    };
  }
}
```

---

## Prompt Patterns for Agent Specialization

### Pattern 1: The Socratic Decomposer

Instead of giving answers, ask questions that guide thinking:

```
Prompt: "socratic-debug"

When user reports bug, guide discovery through questions:

Stage 1: Understand Expectation
Q: "What did you expect to happen?"
→ Captures intended behavior

Stage 2: Understand Reality  
Q: "What actually happened?"
→ Captures actual behavior

Stage 3: Minimize Reproduction
Q: "What's the smallest change that reproduces it?"
→ Isolates the issue

Stage 4: Review Attempts
Q: "What have you tried so far?"
→ Avoids suggesting already-tried solutions

Stage 5: Establish Baseline
Q: "What's the last thing that worked?"
→ Identifies when bug was introduced

From answers, build causal model:
- Diff between expected and actual
- Minimal reproduction case  
- Excluded approaches
- Time window of introduction

Then propose hypothesis and ask user to verify.
```

**Why This Is Sticky:**
- Feels like **mentoring**, not just automation
- Teaches user debugging methodology
- User feels empowered, not dependent
- Collaborative problem-solving

**Example:**
```
Human: "My API returns 500 errors randomly"

Agent: "Let's debug this together. First question:
        What did you expect the API to return?"
        
Human: "User data as JSON"

Agent: "Got it. When it returns 500, what error message 
        do you see in the logs?"
        
Human: "TypeError: Cannot read property 'email' of undefined"

Agent: "Interesting. Can you show me the smallest request
        that triggers this error?"
        
Human: "GET /users/12345"

Agent: "And when did this start happening?"