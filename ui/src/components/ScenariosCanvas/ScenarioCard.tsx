/**
 * Scenario Card - Individual scenario display
 */

import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';
import type { Scenario } from './types';
import styles from './ScenarioCard.module.css';

interface ScenarioCardProps {
  scenario: Scenario;
  onSelect: () => void;
  isSelected: boolean;
}

export const ScenarioCard: React.FC<ScenarioCardProps> = ({
  scenario,
  onSelect,
  isSelected,
}) => {
  const getProbabilityColor = (prob: number) => {
    if (prob >= 70) return 'var(--color-error)';
    if (prob >= 40) return 'var(--color-warning)';
    return 'var(--color-success)';
  };

  const getStatusIcon = () => {
    switch (scenario.metadata.status) {
      case 'active':
        return <TrendingUp size={16} />;
      case 'happened':
        return <CheckCircle size={16} />;
      case 'ruled-out':
        return <TrendingDown size={16} />;
      case 'archived':
        return <AlertTriangle size={16} />;
    }
  };

  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      <div className={styles.header}>
        <div className={styles.statusIcon}>{getStatusIcon()}</div>
        <h3 className={styles.name}>{scenario.name}</h3>
      </div>

      <p className={styles.description}>{scenario.description}</p>

      <div className={styles.probability}>
        <div className={styles.probabilityLabel}>Probability</div>
        <div className={styles.probabilityBar}>
          <div
            className={styles.probabilityFill}
            style={{
              width: `${scenario.probability}%`,
              backgroundColor: getProbabilityColor(scenario.probability),
            }}
          />
        </div>
        <div
          className={styles.probabilityValue}
          style={{ color: getProbabilityColor(scenario.probability) }}
        >
          {scenario.probability}%
        </div>
      </div>

      <div className={styles.metadata}>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>Assumptions:</span>
          <span className={styles.metadataValue}>{scenario.assumptions.length}</span>
        </div>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>Indicators:</span>
          <span className={styles.metadataValue}>{scenario.indicators.length}</span>
        </div>
        <div className={styles.metadataItem}>
          <span className={styles.metadataLabel}>Outcomes:</span>
          <span className={styles.metadataValue}>{scenario.outcomes.length}</span>
        </div>
      </div>

      {scenario.metadata.tags.length > 0 && (
        <div className={styles.tags}>
          {scenario.metadata.tags.map((tag) => (
            <span key={tag} className={styles.tag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};