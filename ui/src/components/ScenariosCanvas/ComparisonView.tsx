/**
 * Comparison View - Side-by-side scenario comparison
 */

import React from 'react';
import { GitCompare, Info, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { Scenario } from './types';
import styles from './ComparisonView.module.css';

interface ComparisonViewProps {
  scenarios: Scenario[];
  selectedScenarioIds: string[];
}

const getProbabilityColor = (prob: number): string => {
  if (prob >= 70) return 'var(--color-error)';
  if (prob >= 40) return 'var(--color-warning)';
  return 'var(--color-success)';
};

const getImpactIcon = (impact: string) => {
  if (impact === 'high') return <AlertTriangle size={14} className={styles.impactHigh} />;
  if (impact === 'medium') return <Info size={14} className={styles.impactMedium} />;
  return <CheckCircle size={14} className={styles.impactLow} />;
};

export const ComparisonView: React.FC<ComparisonViewProps> = ({
  scenarios,
  selectedScenarioIds,
}) => {
  // Filter to selected scenarios, or show first 3 if none selected
  const compareScenarios = selectedScenarioIds.length > 0
    ? scenarios.filter(s => selectedScenarioIds.includes(s.id))
    : scenarios.slice(0, 3);
  
  if (compareScenarios.length === 0) {
    return (
      <div className={styles.empty}>
        <GitCompare size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No scenarios to compare</h3>
        <p className={styles.emptyText}>
          Select 2 or more scenarios from the Board view to compare them side-by-side
        </p>
      </div>
    );
  }
  
  if (compareScenarios.length === 1) {
    return (
      <div className={styles.empty}>
        <GitCompare size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>Select more scenarios</h3>
        <p className={styles.emptyText}>
          Select at least one more scenario to enable comparison
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.comparison}>
      <div className={styles.comparisonHeader}>
        <GitCompare size={20} />
        <h3>Comparing {compareScenarios.length} Scenarios</h3>
      </div>
      
      <div className={styles.comparisonTable}>
        {/* Overview Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Overview</div>
          <div className={styles.comparisonGrid}>
            <div className={styles.rowLabel}>Scenario</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.scenarioColumn}>
                <h4 className={styles.scenarioName}>{scenario.name}</h4>
              </div>
            ))}
            
            <div className={styles.rowLabel}>Description</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.description}
              </div>
            ))}
            
            <div className={styles.rowLabel}>Probability</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                <span 
                  className={styles.probability}
                  style={{ color: getProbabilityColor(scenario.probability) }}
                >
                  {scenario.probability}%
                </span>
              </div>
            ))}
            
            <div className={styles.rowLabel}>Time Horizon</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.timeHorizon.range}
                {scenario.timeHorizon.description && (
                  <span className={styles.cellSubtext}>{scenario.timeHorizon.description}</span>
                )}
              </div>
            ))}
            
            <div className={styles.rowLabel}>Status</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                <span className={styles.statusBadge}>{scenario.metadata.status}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Assumptions Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Key Assumptions</div>
          <div className={styles.comparisonGrid}>
            <div className={styles.rowLabel}>Count</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                <span className={styles.count}>{scenario.assumptions.length}</span>
              </div>
            ))}
            
            <div className={styles.rowLabel}>Assumptions</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.assumptions.length === 0 ? (
                  <span className={styles.emptyCell}>No assumptions</span>
                ) : (
                  <ul className={styles.list}>
                    {scenario.assumptions.map(assumption => (
                      <li key={assumption.id} className={styles.listItem}>
                        <span className={styles.listText}>{assumption.description}</span>
                        <div className={styles.listMeta}>
                          <span className={styles.criticality}>
                            {assumption.criticality === 'high' && <AlertTriangle size={12} />}
                            {assumption.criticality}
                          </span>
                          <span className={styles.confidence}>{assumption.confidence}% confidence</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Indicators Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Indicators</div>
          <div className={styles.comparisonGrid}>
            <div className={styles.rowLabel}>Count</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                <span className={styles.count}>{scenario.indicators.length}</span>
              </div>
            ))}
            
            <div className={styles.rowLabel}>Key Indicators</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.indicators.length === 0 ? (
                  <span className={styles.emptyCell}>No indicators</span>
                ) : (
                  <ul className={styles.list}>
                    {scenario.indicators.map(indicator => (
                      <li key={indicator.id} className={styles.listItem}>
                        <span className={styles.listText}>{indicator.name}</span>
                        <div className={styles.listMeta}>
                          <span className={styles.indicatorType}>{indicator.type}</span>
                          <span className={styles.indicatorCategory}>{indicator.category}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Outcomes Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Potential Outcomes</div>
          <div className={styles.comparisonGrid}>
            <div className={styles.rowLabel}>Count</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                <span className={styles.count}>{scenario.outcomes.length}</span>
              </div>
            ))}
            
            <div className={styles.rowLabel}>Threats</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.outcomes.filter(o => o.category === 'threat').length === 0 ? (
                  <span className={styles.emptyCell}>None</span>
                ) : (
                  <ul className={styles.list}>
                    {scenario.outcomes
                      .filter(o => o.category === 'threat')
                      .map(outcome => (
                        <li key={outcome.id} className={styles.listItem}>
                          <span className={styles.listText}>
                            <XCircle size={14} className={styles.threatIcon} />
                            {outcome.description}
                          </span>
                          <div className={styles.listMeta}>
                            {getImpactIcon(outcome.impact)}
                            <span>{outcome.impact} impact</span>
                            <span>{outcome.likelihood}% likely</span>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
            
            <div className={styles.rowLabel}>Opportunities</div>
            {compareScenarios.map(scenario => (
              <div key={scenario.id} className={styles.cell}>
                {scenario.outcomes.filter(o => o.category === 'opportunity').length === 0 ? (
                  <span className={styles.emptyCell}>None</span>
                ) : (
                  <ul className={styles.list}>
                    {scenario.outcomes
                      .filter(o => o.category === 'opportunity')
                      .map(outcome => (
                        <li key={outcome.id} className={styles.listItem}>
                          <span className={styles.listText}>
                            <CheckCircle size={14} className={styles.opportunityIcon} />
                            {outcome.description}
                          </span>
                          <div className={styles.listMeta}>
                            {getImpactIcon(outcome.impact)}
                            <span>{outcome.impact} impact</span>
                            <span>{outcome.likelihood}% likely</span>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};