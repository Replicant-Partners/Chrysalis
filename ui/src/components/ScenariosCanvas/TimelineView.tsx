/**
 * Timeline View - Scenarios arranged by time horizon
 */

import React, { useMemo } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import type { Scenario, TimeHorizonRange } from './types';
import styles from './TimelineView.module.css';

interface TimelineViewProps {
  scenarios: Scenario[];
  onScenarioSelect: (id: string) => void;
  selectedScenarioIds: string[];
}

const TIME_HORIZON_ORDER: TimeHorizonRange[] = [
  '0-3 months',
  '3-12 months',
  '1-3 years',
  '3-5 years',
  '5+ years',
];

const TIME_HORIZON_LABELS: Record<TimeHorizonRange, string> = {
  '0-3 months': 'Immediate (0-3 months)',
  '3-12 months': 'Near-term (3-12 months)',
  '1-3 years': 'Medium-term (1-3 years)',
  '3-5 years': 'Long-term (3-5 years)',
  '5+ years': 'Very Long-term (5+ years)',
};

const getProbabilityColor = (prob: number): string => {
  if (prob >= 70) return 'var(--color-error)';
  if (prob >= 40) return 'var(--color-warning)';
  return 'var(--color-success)';
};

const getProbabilityIcon = (prob: number) => {
  if (prob >= 70) return <TrendingUp size={16} />;
  if (prob >= 40) return <AlertCircle size={16} />;
  return <TrendingDown size={16} />;
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  scenarios,
  onScenarioSelect,
  selectedScenarioIds,
}) => {
  // Group scenarios by time horizon
  const timelineGroups = useMemo(() => {
    const groups = new Map<TimeHorizonRange, Scenario[]>();
    
    TIME_HORIZON_ORDER.forEach(horizon => {
      groups.set(horizon, []);
    });
    
    scenarios.forEach(scenario => {
      const existing = groups.get(scenario.timeHorizon.range) || [];
      groups.set(scenario.timeHorizon.range, [...existing, scenario]);
    });
    
    // Sort scenarios within each group by probability (descending)
    groups.forEach((scenarios, horizon) => {
      groups.set(horizon, scenarios.sort((a, b) => b.probability - a.probability));
    });
    
    return groups;
  }, [scenarios]);
  
  return (
    <div className={styles.timeline}>
      {/* Timeline axis */}
      <div className={styles.timelineAxis}>
        {TIME_HORIZON_ORDER.map((horizon, index) => {
          const scenariosInHorizon = timelineGroups.get(horizon) || [];
          const hasScenarios = scenariosInHorizon.length > 0;
          
          return (
            <div key={horizon} className={styles.timelineSegment}>
              {/* Time marker */}
              <div className={styles.timeMarker}>
                <div className={`${styles.timeMarkerDot} ${hasScenarios ? styles.active : ''}`}>
                  <Clock size={16} />
                </div>
                {index < TIME_HORIZON_ORDER.length - 1 && (
                  <div className={styles.timeMarkerLine} />
                )}
              </div>
              
              {/* Time period */}
              <div className={styles.timePeriod}>
                <h3 className={styles.timePeriodLabel}>{TIME_HORIZON_LABELS[horizon]}</h3>
                <span className={styles.timePeriodCount}>
                  {scenariosInHorizon.length} scenario{scenariosInHorizon.length !== 1 ? 's' : ''}
                </span>
                
                {/* Scenarios in this period */}
                {hasScenarios && (
                  <div className={styles.scenarioList}>
                    {scenariosInHorizon.map((scenario) => {
                      const isSelected = selectedScenarioIds.includes(scenario.id);
                      const totalIndicators = scenario.indicators.length;
                      const totalOutcomes = scenario.outcomes.length;
                      
                      return (
                        <div
                          key={scenario.id}
                          className={`${styles.scenarioCard} ${isSelected ? styles.selected : ''}`}
                          onClick={() => onScenarioSelect(scenario.id)}
                        >
                          <div className={styles.scenarioHeader}>
                            <div className={styles.scenarioProb} style={{ color: getProbabilityColor(scenario.probability) }}>
                              {getProbabilityIcon(scenario.probability)}
                              <span className={styles.scenarioProbValue}>{scenario.probability}%</span>
                            </div>
                            <span className={styles.scenarioStatus}>{scenario.metadata.status}</span>
                          </div>
                          
                          <h4 className={styles.scenarioName}>{scenario.name}</h4>
                          <p className={styles.scenarioDesc}>{scenario.description}</p>
                          
                          <div className={styles.scenarioMeta}>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Indicators:</span>
                              <span className={styles.metaValue}>{totalIndicators}</span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Outcomes:</span>
                              <span className={styles.metaValue}>{totalOutcomes}</span>
                            </div>
                            <div className={styles.metaItem}>
                              <span className={styles.metaLabel}>Assumptions:</span>
                              <span className={styles.metaValue}>{scenario.assumptions.length}</span>
                            </div>
                          </div>
                          
                          {scenario.timeHorizon.description && (
                            <p className={styles.scenarioHorizonDesc}>{scenario.timeHorizon.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};