/**
 * Curation Canvas - Mock Data
 * 
 * Demonstration data for the curation canvas
 */

import type { Artifact, Relationship, Collection } from './types';

const now = Date.now();
const DAY = 86400000;

export const MOCK_ARTIFACTS: Artifact[] = [
  // Documents
  {
    id: 'artifact-1',
    type: 'document',
    title: 'AI Regulation Framework Overview',
    description: 'Comprehensive analysis of proposed AI regulation frameworks',
    content: '# AI Regulation Framework\n\nThis document outlines the key aspects of AI regulation...',
    tags: ['ai-regulation', 'policy', 'research'],
    collectionIds: ['coll-1', 'coll-2'],
    createdAt: now - DAY * 10,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 2,
    metadata: {
      author: 'Research Team',
      wordCount: 2500,
    },
  },
  {
    id: 'artifact-2',
    type: 'document',
    title: 'EU AI Act Summary',
    description: 'Key points from the European Union AI Act',
    content: '# EU AI Act\n\nThe European Union has passed comprehensive AI legislation...',
    tags: ['ai-regulation', 'eu', 'legal'],
    collectionIds: ['coll-1'],
    createdAt: now - DAY * 8,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 1,
    metadata: {
      author: 'Legal Team',
      source: 'EUR-Lex',
    },
  },
  
  // Media
  {
    id: 'artifact-3',
    type: 'media',
    title: 'AI Regulation Timeline Infographic',
    description: 'Visual timeline of major AI regulation milestones',
    url: 'https://picsum.photos/800/600',
    thumbnail: 'https://picsum.photos/400/300',
    tags: ['visualization', 'timeline', 'ai-regulation'],
    collectionIds: ['coll-4'],
    createdAt: now - DAY * 15,
    createdBy: 'user-2',
    modifiedAt: now - DAY * 15,
    metadata: {
      mimeType: 'image/png',
      size: 245000,
    },
  },
  {
    id: 'artifact-4',
    type: 'media',
    title: 'Regulatory Impact Visualization',
    description: 'Chart showing impact of regulations across different sectors',
    url: 'https://picsum.photos/1000/600',
    thumbnail: 'https://picsum.photos/400/240',
    tags: ['visualization', 'data', 'impact'],
    collectionIds: ['coll-4'],
    createdAt: now - DAY * 5,
    createdBy: 'user-2',
    modifiedAt: now - DAY * 5,
    metadata: {
      mimeType: 'image/jpeg',
      size: 180000,
    },
  },
  
  // Code
  {
    id: 'artifact-5',
    type: 'code',
    title: 'Compliance Checker Script',
    description: 'Python script for automated compliance checking',
    content: `# compliance_checker.py
import json
from typing import Dict, List

def check_compliance(model_data: Dict) -> List[str]:
    """Check if AI model meets regulatory requirements."""
    issues = []
    
    if not model_data.get('transparency_report'):
        issues.append('Missing transparency report')
    
    if not model_data.get('bias_assessment'):
        issues.append('Missing bias assessment')
    
    return issues`,
    tags: ['code', 'compliance', 'automation'],
    collectionIds: ['coll-3'],
    createdAt: now - DAY * 12,
    createdBy: 'user-3',
    modifiedAt: now - DAY * 3,
    metadata: {
      language: 'python',
      size: 850,
    },
  },
  {
    id: 'artifact-6',
    type: 'code',
    title: 'Regulation API Client',
    description: 'TypeScript client for accessing regulation databases',
    content: `// regulation-api.ts
interface RegulationQuery {
  jurisdiction: string;
  category: string;
  dateFrom?: Date;
}

export class RegulationAPI {
  async query(params: RegulationQuery) {
    // Implementation
  }
}`,
    tags: ['code', 'api', 'typescript'],
    collectionIds: ['coll-3'],
    createdAt: now - DAY * 7,
    createdBy: 'user-3',
    modifiedAt: now - DAY * 7,
    metadata: {
      language: 'typescript',
      size: 420,
    },
  },
  
  // Data
  {
    id: 'artifact-7',
    type: 'data',
    title: 'Regulation Tracking Dataset',
    description: 'CSV dataset tracking AI regulations by country',
    url: '/data/regulations.csv',
    tags: ['data', 'tracking', 'global'],
    collectionIds: ['coll-5'],
    createdAt: now - DAY * 20,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 1,
    metadata: {
      mimeType: 'text/csv',
      size: 52000,
      rows: 150,
    },
  },
  {
    id: 'artifact-8',
    type: 'data',
    title: 'Compliance Metrics',
    description: 'JSON data with compliance scores across different frameworks',
    url: '/data/compliance-metrics.json',
    tags: ['data', 'metrics', 'compliance'],
    collectionIds: ['coll-5'],
    createdAt: now - DAY * 6,
    createdBy: 'user-2',
    modifiedAt: now - DAY * 6,
    metadata: {
      mimeType: 'application/json',
      size: 8400,
    },
  },
  
  // Links
  {
    id: 'artifact-9',
    type: 'link',
    title: 'OECD AI Principles',
    description: 'Official OECD guidelines on AI governance',
    content: 'https://www.oecd.org/digital/artificial-intelligence/',
    url: 'https://www.oecd.org/digital/artificial-intelligence/',
    tags: ['reference', 'oecd', 'guidelines'],
    collectionIds: ['coll-1'],
    createdAt: now - DAY * 25,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 25,
    metadata: {
      source: 'OECD',
    },
  },
  {
    id: 'artifact-10',
    type: 'link',
    title: 'Partnership on AI',
    description: 'Multi-stakeholder organization studying AI impact',
    content: 'https://partnershiponai.org/',
    url: 'https://partnershiponai.org/',
    tags: ['reference', 'organization', 'research'],
    collectionIds: ['coll-1'],
    createdAt: now - DAY * 18,
    createdBy: 'user-2',
    modifiedAt: now - DAY * 18,
    metadata: {
      source: 'Partnership on AI',
    },
  },
  
  // Notes
  {
    id: 'artifact-11',
    type: 'note',
    title: 'Meeting Notes - Regulation Strategy',
    description: 'Notes from strategy meeting on regulatory compliance',
    content: `Meeting: Regulation Strategy Discussion
Date: ${new Date(now - DAY * 4).toLocaleDateString()}

Key Takeaways:
- Need to focus on EU AI Act compliance first
- Consider building automated compliance tools
- Timeline: 6 months to full compliance

Action Items:
- Review transparency requirements
- Schedule bias assessment
- Update documentation`,
    tags: ['meeting', 'strategy', 'action-items'],
    collectionIds: ['coll-2'],
    createdAt: now - DAY * 4,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 4,
    metadata: {},
  },
  {
    id: 'artifact-12',
    type: 'note',
    title: 'Research Ideas',
    description: 'Quick notes on potential research directions',
    content: `Research Ideas for AI Regulation Project:

1. Comparative analysis of US vs EU approaches
2. Impact study on SMEs
3. Cost-benefit analysis of compliance measures
4. Survey of developer attitudes toward regulation

Priority: Start with #1 and #3`,
    tags: ['ideas', 'research', 'planning'],
    collectionIds: ['coll-2'],
    createdAt: now - DAY * 14,
    createdBy: 'user-2',
    modifiedAt: now - DAY * 9,
    metadata: {},
  },
  
  // Additional artifacts for richer graph
  {
    id: 'artifact-13',
    type: 'document',
    title: 'Risk Assessment Framework',
    description: 'Framework for assessing AI system risks',
    content: '# Risk Assessment\n\nThis framework provides a systematic approach...',
    tags: ['risk', 'assessment', 'framework'],
    collectionIds: ['coll-1', 'coll-2'],
    createdAt: now - DAY * 30,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 5,
    metadata: {
      author: 'Risk Team',
    },
  },
  {
    id: 'artifact-14',
    type: 'data',
    title: 'Historical Regulation Data',
    description: 'Archive of past regulatory changes',
    url: '/data/historical-regulations.json',
    tags: ['data', 'historical', 'archive'],
    collectionIds: ['coll-5'],
    createdAt: now - DAY * 40,
    createdBy: 'user-1',
    modifiedAt: now - DAY * 40,
    metadata: {
      mimeType: 'application/json',
      size: 125000,
    },
  },
];

export const MOCK_RELATIONSHIPS: Relationship[] = [
  // Document citations
  {
    id: 'rel-1',
    sourceId: 'artifact-1',
    targetId: 'artifact-2',
    type: 'cites',
    confidence: 95,
    notes: 'References EU AI Act in regulatory framework section',
    createdAt: now - DAY * 5,
    createdBy: 'user-1',
  },
  {
    id: 'rel-2',
    sourceId: 'artifact-1',
    targetId: 'artifact-9',
    type: 'references',
    confidence: 90,
    notes: 'Uses OECD principles as foundation',
    createdAt: now - DAY * 5,
    createdBy: 'user-1',
  },
  
  // Code implementations
  {
    id: 'rel-3',
    sourceId: 'artifact-5',
    targetId: 'artifact-13',
    type: 'implements',
    confidence: 100,
    notes: 'Implements risk assessment framework',
    createdAt: now - DAY * 10,
    createdBy: 'user-3',
  },
  {
    id: 'rel-4',
    sourceId: 'artifact-6',
    targetId: 'artifact-7',
    type: 'references',
    confidence: 85,
    notes: 'Uses tracking dataset as data source',
    createdAt: now - DAY * 7,
    createdBy: 'user-3',
  },
  
  // Data relationships
  {
    id: 'rel-5',
    sourceId: 'artifact-4',
    targetId: 'artifact-8',
    type: 'derives-from',
    confidence: 100,
    notes: 'Visualization created from compliance metrics',
    createdAt: now - DAY * 5,
    createdBy: 'user-2',
  },
  {
    id: 'rel-6',
    sourceId: 'artifact-3',
    targetId: 'artifact-7',
    type: 'derives-from',
    confidence: 95,
    notes: 'Timeline generated from tracking dataset',
    createdAt: now - DAY * 14,
    createdBy: 'user-2',
  },
  {
    id: 'rel-7',
    sourceId: 'artifact-7',
    targetId: 'artifact-14',
    type: 'builds-on',
    confidence: 80,
    notes: 'Current dataset extends historical data',
    createdAt: now - DAY * 15,
    createdBy: 'user-1',
  },
  
  // Contradictions and conflicts
  {
    id: 'rel-8',
    sourceId: 'artifact-2',
    targetId: 'artifact-10',
    type: 'contradicts',
    confidence: 60,
    notes: 'Different approaches to AI governance',
    createdAt: now - DAY * 3,
    createdBy: 'user-2',
  },
  
  // Related notes and documents
  {
    id: 'rel-9',
    sourceId: 'artifact-11',
    targetId: 'artifact-1',
    type: 'related-to',
    confidence: 85,
    notes: 'Meeting discusses framework implementation',
    createdAt: now - DAY * 4,
    createdBy: 'user-1',
  },
  {
    id: 'rel-10',
    sourceId: 'artifact-12',
    targetId: 'artifact-1',
    type: 'related-to',
    confidence: 75,
    notes: 'Research ideas inspired by framework',
    createdAt: now - DAY * 9,
    createdBy: 'user-2',
  },
  
  // Additional relationships for richer graph
  {
    id: 'rel-11',
    sourceId: 'artifact-5',
    targetId: 'artifact-8',
    type: 'references',
    confidence: 90,
    notes: 'Checker validates against metrics',
    createdAt: now - DAY * 6,
    createdBy: 'user-3',
  },
  {
    id: 'rel-12',
    sourceId: 'artifact-13',
    targetId: 'artifact-2',
    type: 'builds-on',
    confidence: 85,
    notes: 'Framework adapted from EU AI Act requirements',
    createdAt: now - DAY * 8,
    createdBy: 'user-1',
  },
];

export const MOCK_COLLECTIONS: Collection[] = [
  // Hierarchical folders
  {
    id: 'coll-1',
    name: 'Research Papers',
    type: 'folder',
    color: 'var(--color-blue-500)',
    icon: '📁',
    description: 'Academic and policy research documents',
    createdAt: now - DAY * 50,
    order: 0,
  },
  {
    id: 'coll-2',
    name: 'Notes & Ideas',
    type: 'folder',
    parentId: 'coll-1',
    color: 'var(--color-purple-500)',
    icon: '📝',
    description: 'Meeting notes and research ideas',
    createdAt: now - DAY * 45,
    order: 0,
  },
  {
    id: 'coll-3',
    name: 'Implementation',
    type: 'folder',
    color: 'var(--color-cyan-500)',
    icon: '💻',
    description: 'Code and technical implementations',
    createdAt: now - DAY * 40,
    order: 1,
  },
  {
    id: 'coll-4',
    name: 'Visualizations',
    type: 'folder',
    color: 'var(--color-purple-500)',
    icon: '📊',
    description: 'Charts, graphs, and infographics',
    createdAt: now - DAY * 35,
    order: 2,
  },
  {
    id: 'coll-5',
    name: 'Datasets',
    type: 'folder',
    color: 'var(--color-success)',
    icon: '📂',
    description: 'Data files and databases',
    createdAt: now - DAY * 30,
    order: 3,
  },
  
  // Flat tags
  {
    id: 'coll-tag-1',
    name: 'High Priority',
    type: 'tag',
    color: 'var(--color-error)',
    createdAt: now - DAY * 20,
    order: 100,
  },
  {
    id: 'coll-tag-2',
    name: 'Needs Review',
    type: 'tag',
    color: 'var(--color-warning)',
    createdAt: now - DAY * 15,
    order: 101,
  },
];