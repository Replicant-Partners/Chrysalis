/**
 * Artifact Card Component
 * 
 * Display card for individual artifacts
 */

import React from 'react';
import { MoreVertical, Link2, Calendar } from 'lucide-react';
import { Badge } from '../design-system';
import { formatRelativeTime, getArtifactTypeIcon, getArtifactTypeColor } from './utils';
import type { Artifact } from './types';
import styles from './ArtifactCard.module.css';

interface ArtifactCardProps {
  artifact: Artifact;
  relationshipCount?: number;
  onSelect?: () => void;
  isSelected?: boolean;
}

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  relationshipCount = 0,
  onSelect,
  isSelected = false,
}) => {
  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
    >
      {/* Thumbnail or icon */}
      <div 
        className={styles.thumbnail}
        style={{ background: getArtifactTypeColor(artifact.type) + '20' }}
      >
        {artifact.thumbnail ? (
          <img src={artifact.thumbnail} alt={artifact.title} className={styles.thumbnailImage} />
        ) : artifact.type === 'media' && artifact.url ? (
          <img src={artifact.url} alt={artifact.title} className={styles.thumbnailImage} />
        ) : (
          <span className={styles.typeIcon} style={{ color: getArtifactTypeColor(artifact.type) }}>
            {getArtifactTypeIcon(artifact.type)}
          </span>
        )}
      </div>
      
      {/* Content */}
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <Badge 
            variant="default"
            style={{ 
              background: getArtifactTypeColor(artifact.type) + '20',
              color: getArtifactTypeColor(artifact.type),
              borderColor: getArtifactTypeColor(artifact.type) + '40'
            }}
          >
            {artifact.type}
          </Badge>
          
          <button className={styles.menuButton} onClick={(e) => e.stopPropagation()}>
            <MoreVertical size={16} />
          </button>
        </div>
        
        {/* Title */}
        <h3 className={styles.title}>{artifact.title}</h3>
        
        {/* Description */}
        {artifact.description && (
          <p className={styles.description}>{artifact.description}</p>
        )}
        
        {/* Tags */}
        {artifact.tags.length > 0 && (
          <div className={styles.tags}>
            {artifact.tags.slice(0, 3).map((tag) => (
              <span key={tag} className={styles.tag}>
                #{tag}
              </span>
            ))}
            {artifact.tags.length > 3 && (
              <span className={styles.tag}>+{artifact.tags.length - 3}</span>
            )}
          </div>
        )}
        
        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.metadata}>
            <Calendar size={12} />
            <span>{formatRelativeTime(artifact.createdAt)}</span>
          </div>
          
          {relationshipCount > 0 && (
            <div className={styles.metadata}>
              <Link2 size={12} />
              <span>{relationshipCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};