/**
 * Curation Canvas - Utility Functions
 * 
 * Helper functions for formatting, filtering, and data transformation
 */

import type { Artifact, ArtifactType, RelationType, SortBy } from './types';

// ============================================================================
// Date Formatters
// ============================================================================

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 7) return formatDate(timestamp);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
};

// ============================================================================
// Type Label Formatters
// ============================================================================

export const getArtifactTypeLabel = (type: ArtifactType): string => {
  const labels: Record<ArtifactType, string> = {
    document: 'Document',
    media: 'Media',
    code: 'Code',
    data: 'Data',
    link: 'Link',
    note: 'Note',
  };
  return labels[type];
};

export const getArtifactTypeIcon = (type: ArtifactType): string => {
  const icons: Record<ArtifactType, string> = {
    document: '📄',
    media: '🎬',
    code: '💻',
    data: '📊',
    link: '🔗',
    note: '📝',
  };
  return icons[type];
};

export const getArtifactTypeColor = (type: ArtifactType): string => {
  const colors: Record<ArtifactType, string> = {
    document: 'var(--color-blue-500)',
    media: 'var(--color-purple-500)',
    code: 'var(--color-cyan-500)',
    data: 'var(--color-success)',
    link: 'var(--color-slate-400)',
    note: 'var(--color-warning-dark)',
  };
  return colors[type];
};

export const getRelationshipTypeLabel = (type: RelationType): string => {
  const labels: Record<RelationType, string> = {
    'references': 'References',
    'builds-on': 'Builds On',
    'contradicts': 'Contradicts',
    'implements': 'Implements',
    'cites': 'Cites',
    'derives-from': 'Derives From',
    'related-to': 'Related To',
  };
  return labels[type];
};

export const getRelationshipMermaidSyntax = (type: RelationType): string => {
  const syntax: Record<RelationType, string> = {
    'references': '-->',
    'builds-on': '==>',
    'contradicts': '-.->',
    'implements': '-->',
    'cites': '-->',
    'derives-from': '==>',
    'related-to': '---',
  };
  return syntax[type];
};

// ============================================================================
// Count Formatters
// ============================================================================

export const formatCount = (count: number, singular: string): string => {
  return `${count} ${singular}${count !== 1 ? 's' : ''}`;
};

// ============================================================================
// Filtering Functions
// ============================================================================

export const filterArtifacts = (
  artifacts: Artifact[],
  filters: {
    searchQuery?: string;
    types?: ArtifactType[];
    tags?: string[];
    collectionId?: string | null;
    dateStart?: number | null;
    dateEnd?: number | null;
  }
): Artifact[] => {
  return artifacts.filter((artifact) => {
    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const matchesTitle = artifact.title.toLowerCase().includes(query);
      const matchesDescription = artifact.description?.toLowerCase().includes(query);
      const matchesContent = artifact.content?.toLowerCase().includes(query);
      const matchesTags = artifact.tags.some((tag) => tag.toLowerCase().includes(query));
      
      if (!matchesTitle && !matchesDescription && !matchesContent && !matchesTags) {
        return false;
      }
    }
    
    // Type filter
    if (filters.types && filters.types.length > 0) {
      if (!filters.types.includes(artifact.type)) {
        return false;
      }
    }
    
    // Tag filter
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some((tag) => artifact.tags.includes(tag));
      if (!hasTag) {
        return false;
      }
    }
    
    // Collection filter
    if (filters.collectionId) {
      if (!artifact.collectionIds.includes(filters.collectionId)) {
        return false;
      }
    }
    
    // Date range filter
    if (filters.dateStart && artifact.createdAt < filters.dateStart) {
      return false;
    }
    if (filters.dateEnd && artifact.createdAt > filters.dateEnd) {
      return false;
    }
    
    return true;
  });
};

// ============================================================================
// Sorting Functions
// ============================================================================

export const sortArtifacts = (artifacts: Artifact[], sortBy: SortBy): Artifact[] => {
  const sorted = [...artifacts];
  
  switch (sortBy) {
    case 'created':
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case 'modified':
      return sorted.sort((a, b) => b.modifiedAt - a.modifiedAt);
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'type':
      return sorted.sort((a, b) => a.type.localeCompare(b.type));
    default:
      return sorted;
  }
};

// ============================================================================
// Timeline Grouping
// ============================================================================

export const groupByDate = (artifacts: Artifact[]): Map<string, Artifact[]> => {
  const groups = new Map<string, Artifact[]>();
  
  artifacts.forEach((artifact) => {
    const date = new Date(artifact.createdAt);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(artifact);
  });
  
  return groups;
};