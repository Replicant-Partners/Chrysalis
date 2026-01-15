/**
 * Curation Canvas - Type Definitions
 * 
 * Domain-focused research library with Mermaid-compatible relationship model
 */

// ============================================================================
// Enums
// ============================================================================

export type ArtifactType = 'document' | 'media' | 'code' | 'data' | 'link' | 'note';

export type RelationType = 
  | 'references' 
  | 'builds-on' 
  | 'contradicts' 
  | 'implements' 
  | 'cites' 
  | 'derives-from' 
  | 'related-to';

export type CollectionType = 'folder' | 'tag';

export type ViewMode = 'grid' | 'timeline' | 'graph' | 'collections';

export type SortBy = 'created' | 'modified' | 'title' | 'type';

// ============================================================================
// Core Data Models
// ============================================================================

/**
 * Artifact - Any item in the curation library
 */
export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  description?: string;
  content?: string; // For documents, notes, code
  url?: string; // For media, links
  thumbnail?: string;
  tags: string[];
  collectionIds: string[];
  createdAt: number;
  createdBy: string;
  modifiedAt: number;
  metadata: {
    size?: number;
    mimeType?: string;
    language?: string; // For code
    author?: string; // For documents
    source?: string; // For data, links
    [key: string]: unknown;
  };
}

/**
 * Relationship - Mermaid-compatible semantic link between artifacts
 */
export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  confidence?: number; // 0-100, for relationship strength
  notes?: string;
  createdAt: number;
  createdBy: string;
}

/**
 * Collection - Hierarchical folder or flat tag
 */
export interface Collection {
  id: string;
  name: string;
  type: CollectionType;
  parentId?: string; // For hierarchical folders
  color?: string;
  icon?: string;
  description?: string;
  createdAt: number;
  order: number;
}

// ============================================================================
// Graph Visualization Models
// ============================================================================

/**
 * Graph node for @xyflow/react
 */
export interface GraphNode {
  id: string;
  type: string; // React Flow node type
  data: {
    artifact: Artifact;
    relationshipCount: number;
  };
  position: { x: number; y: number };
}

/**
 * Graph edge for @xyflow/react
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type?: string; // React Flow edge type
  data: {
    relationship: Relationship;
  };
  label?: string;
  animated?: boolean;
  style?: {
    stroke?: string;
    strokeWidth?: number;
  };
}

// ============================================================================
// Timeline Models
// ============================================================================

/**
 * Timeline group - artifacts grouped by date
 */
export interface TimelineGroup {
  date: string; // YYYY-MM-DD
  displayDate: string; // Formatted date
  artifacts: Artifact[];
}

// ============================================================================
// Canvas Data Model
// ============================================================================

/**
 * Complete curation canvas data
 */
export interface CurationCanvasData {
  id: string;
  topic: string;
  description: string;
  artifacts: Artifact[];
  relationships: Relationship[];
  collections: Collection[];
  metadata: {
    createdAt: number;
    lastModified: number;
    artifactCount: number;
    relationshipCount: number;
  };
}

// ============================================================================
// Component Props
// ============================================================================

export interface CurationCanvasProps {
  canvasData?: CurationCanvasData;
  onArtifactCreate?: (artifact: Artifact) => void;
  onArtifactUpdate?: (id: string, updates: Partial<Artifact>) => void;
  onArtifactDelete?: (id: string) => void;
  onRelationshipCreate?: (relationship: Relationship) => void;
  onRelationshipDelete?: (id: string) => void;
}

// ============================================================================
// State Management
// ============================================================================

export interface CurationCanvasState {
  // View state
  viewMode: ViewMode;
  selectedArtifactIds: string[];
  selectedCollectionId: string | null;
  expandedCollectionIds: string[];
  
  // Filter state
  searchQuery: string;
  filterTypes: ArtifactType[];
  filterTags: string[];
  dateRangeStart: number | null;
  dateRangeEnd: number | null;
  sortBy: SortBy;
  
  // Graph state
  selectedRelationshipId: string | null;
  showRelationshipEditor: boolean;
  
  // Actions - View
  setViewMode: (mode: ViewMode) => void;
  setSelectedArtifacts: (ids: string[]) => void;
  setSelectedCollection: (id: string | null) => void;
  toggleCollection: (id: string) => void;
  
  // Actions - Filter
  setSearchQuery: (query: string) => void;
  setFilterTypes: (types: ArtifactType[]) => void;
  setFilterTags: (tags: string[]) => void;
  setDateRange: (start: number | null, end: number | null) => void;
  setSortBy: (sort: SortBy) => void;
  clearFilters: () => void;
  
  // Actions - Graph
  setSelectedRelationship: (id: string | null) => void;
  setShowRelationshipEditor: (show: boolean) => void;
}