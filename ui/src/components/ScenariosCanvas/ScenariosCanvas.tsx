/**
 * Scenarios Canvas - Future planning through scenario analysis
 */

import React, { useState } from 'react';
import { Plus, BarChart3, Clock, GitCompare } from 'lucide-react';
import { Button } from '../design-system';
import { ScenarioCard } from './ScenarioCard';
import { TimelineView } from './TimelineView';
import { ComparisonView } from './ComparisonView';
import { useScenariosStore } from './store';
import type { Scenario } from './types';
import styles from './ScenariosCanvas.module.css';

// Mock scenarios for demonstration
const MOCK_SCENARIOS: Scenario[] = [
  {
    id: 'scenario-1',
    name: 'Heavy Regulation',
    description: 'Government implements strict AI regulations with compliance requirements and oversight',
    probability: 30,
    timeHorizon: { range: '1-3 years', description: 'Within next 2-3 years' },
    assumptions: [
      {
        id: 'a1',
        description: 'Public backlash against AI increases',
        criticality: 'high',
        confidence: 70,
        evidence: 'Recent surveys show growing concern',
      },
      {
        id: 'a2',
        description: 'Major AI incident occurs',
        criticality: 'high',
        confidence: 40,
      },
    ],
    indicators: [
      {
        id: 'i1',
        name: 'AI Bills Introduced',
        description: 'Number of AI regulation bills in Congress',
        type: 'leading',
        category: 'political',
        measurementMethod: 'manual',
        currentValue: 5,
        targetValue: 10,
        observations: [],
        weight: 8,
      },
    ],
    outcomes: [
      {
        id: 'o1',
        category: 'threat',
        description: 'Increased compliance costs',
        impact: 'high',
        likelihood: 80,
      },
      {
        id: 'o2',
        category: 'opportunity',
        description: 'Compliance consulting business',
        impact: 'medium',
        likelihood: 60,
      },
    ],
    probabilityHistory: [],
    metadata: {
      createdAt: Date.now() - 86400000 * 30,
      createdBy: 'user',
      tags: ['regulation', 'policy', 'AI'],
      status: 'active',
    },
  },
  {
    id: 'scenario-2',
    name: 'Light Touch Regulation',
    description: 'Industry self-regulation prevails with voluntary frameworks and best practices',
    probability: 50,
    timeHorizon: { range: '1-3 years' },
    assumptions: [
      {
        id: 'a3',
        description: 'Industry demonstrates responsible AI development',
        criticality: 'high',
        confidence: 60,
      },
    ],
    indicators: [
      {
        id: 'i2',
        name: 'Industry Frameworks Adopted',
        description: 'Number of companies adopting voluntary AI frameworks',
        type: 'leading',
        category: 'economic',
        measurementMethod: 'automated',
        currentValue: 150,
        targetValue: 500,
        observations: [],
        weight: 7,
      },
    ],
    outcomes: [
      {
        id: 'o3',
        category: 'opportunity',
        description: 'Lower compliance burden',
        impact: 'medium',
        likelihood: 70,
      },
    ],
    probabilityHistory: [],
    metadata: {
      createdAt: Date.now() - 86400000 * 25,
      createdBy: 'user',
      tags: ['regulation', 'self-governance'],
      status: 'active',
    },
  },
  {
    id: 'scenario-3',
    name: 'Regulatory Fragmentation',
    description: 'Different regions implement conflicting AI regulations',
    probability: 20,
    timeHorizon: { range: '3-5 years' },
    assumptions: [],
    indicators: [],
    outcomes: [
      {
        id: 'o4',
        category: 'threat',
        description: 'Increased complexity in global operations',
        impact: 'high',
        likelihood: 85,
      },
    ],
    probabilityHistory: [],
    metadata: {
      createdAt: Date.now() - 86400000 * 20,
      createdBy: 'user',
      tags: ['regulation', 'global'],
      status: 'active',
    },
  },
];

export const ScenariosCanvas: React.FC = () => {
  const { viewMode, setViewMode, selectedScenarioIds, setSelectedScenarios } = useScenariosStore();
  const [scenarios] = useState(MOCK_SCENARIOS);

  const totalProbability = scenarios.reduce((sum, s) => sum + s.probability, 0);
  const needsReconciliation = totalProbability > 100;

  const handleScenarioSelect = (id: string) => {
    if (selectedScenarioIds.includes(id)) {
      setSelectedScenarios(selectedScenarioIds.filter((sid) => sid !== id));
    } else {
      setSelectedScenarios([...selectedScenarioIds, id]);
    }
  };

  return (
    <div className={styles.canvas}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h2 className={styles.title}>🎯 Scenarios</h2>
          <p className={styles.subtitle}>
            AI Regulation Futures • {scenarios.length} scenarios • {totalProbability}% total
            {needsReconciliation && (
              <span className={styles.warning}> ⚠️ Needs reconciliation</span>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('board')}
            iconBefore={<BarChart3 size={16} />}
          >
            Board
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('timeline')}
            iconBefore={<Clock size={16} />}
          >
            Timeline
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode('comparison')}
            iconBefore={<GitCompare size={16} />}
          >
            Compare
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconBefore={<Plus size={16} />}
          >
            New Scenario
          </Button>
        </div>
      </div>

      {/* View Modes */}
      {viewMode === 'board' && (
        <div className={styles.board}>
          <div className={styles.scenarioGrid}>
            {scenarios.map((scenario) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                onSelect={() => handleScenarioSelect(scenario.id)}
                isSelected={selectedScenarioIds.includes(scenario.id)}
              />
            ))}
          </div>
        </div>
      )}

      {viewMode === 'timeline' && (
        <TimelineView
          scenarios={scenarios}
          onScenarioSelect={handleScenarioSelect}
          selectedScenarioIds={selectedScenarioIds}
        />
      )}

      {viewMode === 'comparison' && (
        <ComparisonView
          scenarios={scenarios}
          selectedScenarioIds={selectedScenarioIds}
        />
      )}
    </div>
  );
};