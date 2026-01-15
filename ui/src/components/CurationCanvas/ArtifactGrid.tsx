/**
 * Artifact Grid Component
 * 
 * Masonry-style grid layout for artifacts
 */

import React, { useMemo } from 'react';
import { FileQuestion } from 'lucide-react';
import { ArtifactCard } from './ArtifactCard';
import { useCurationStore } from './store';
import type { Artifact, Relationship } from './types';
import styles from './ArtifactGrid.module.css';

interface ArtifactGridProps {
  artifacts: Artifact[];
  relationships: Relationship[];
}

export const ArtifactGrid: React.FC<ArtifactGridProps> = ({
  artifacts,
  relationships,
}) => {
  const { selectedArtifactIds, setSelectedArtifacts } = useCurationStore();
  
  // Count relationships for each artifact
  const relationshipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    relationships.forEach((rel) => {
      counts[rel.sourceId] = (counts[rel.sourceId] || 0) + 1;
      counts[rel.targetId] = (counts[rel.targetId] || 0) + 1;
    });
    
    return counts;
  }, [relationships]);
  
  const handleArtifactSelect = (artifactId: string) => {
    if (selectedArtifactIds.includes(artifactId)) {
      setSelectedArtifacts(selectedArtifactIds.filter(id => id !== artifactId));
    } else {
      setSelectedArtifacts([...selectedArtifactIds, artifactId]);
    }
  };
  
  if (artifacts.length === 0) {
    return (
      <div className={styles.empty}>
        <FileQuestion size={64} className={styles.emptyIcon} />
        <h3 className={styles.emptyTitle}>No artifacts found</h3>
        <p className={styles.emptyText}>
          Try adjusting your filters or add a new artifact to get started
        </p>
      </div>
    );
  }
  
  return (
    <div className={styles.grid}>
      {artifacts.map((artifact) => (
        <div key={artifact.id} className={styles.gridItem}>
          <ArtifactCard
            artifact={artifact}
            relationshipCount={relationshipCounts[artifact.id] || 0}
            onSelect={() => handleArtifactSelect(artifact.id)}
            isSelected={selectedArtifactIds.includes(artifact.id)}
          />
        </div>
      ))}
    </div>
  );
};