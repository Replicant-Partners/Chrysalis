/**
 * Timeline View Component
 * 
 * Chronological timeline of artifacts
 */

import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { ArtifactCard } from './ArtifactCard';
import { groupByDate, formatDate } from './utils';
import type { Artifact } from './types';
import styles from './TimelineView.module.css';

interface TimelineViewProps {
  artifacts: Artifact[];
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  artifacts,
}) => {
  // Group artifacts by date
  const timelineGroups = useMemo(() => {
    const groups = groupByDate(artifacts);
    
    // Convert to sorted array
    return Array.from(groups.entries())
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Newest first
      .map(([date, groupArtifacts]) => ({
        date,
        displayDate: formatDate(new Date(date).getTime()),
        artifacts: groupArtifacts.sort((a, b) => b.createdAt - a.createdAt),
      }));
  }, [artifacts]);
  
  if (timelineGroups.length === 0) {
    return (
      <div className={styles.empty}>
        <Calendar size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No artifacts to display</h3>
        <p className={styles.emptyText}>
          Add artifacts to see them in chronological order
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.timeline}>
      {timelineGroups.map((group) => (
        <div key={group.date} className={styles.timelineGroup}>
          {/* Date Header */}
          <div className={styles.dateHeader}>
            <div className={styles.dateLine} />
            <div className={styles.dateMarker}>
              <Calendar size={16} />
            </div>
            <h3 className={styles.dateTitle}>{group.displayDate}</h3>
            <span className={styles.dateCount}>
              {group.artifacts.length} {group.artifacts.length === 1 ? 'artifact' : 'artifacts'}
            </span>
          </div>
          
          {/* Artifacts */}
          <div className={styles.artifactList}>
            {group.artifacts.map((artifact) => (
              <div key={artifact.id} className={styles.artifactItem}>
                <div className={styles.artifactConnector} />
                <div className={styles.artifactCard}>
                  <ArtifactCard artifact={artifact} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};