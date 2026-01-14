/**
 * VoyeurPane - Observability event viewer component
 * 
 * Displays real-time observability events from the VoyeurBus
 * with filtering, search, and connection management.
 * 
 * @module ui/components/VoyeurPane
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useVoyeurEvents } from '../../contexts/VoyeurContext';
import { VoyeurEvent, VoyeurEventKind } from '../../utils/VoyeurBusClient';
import { Badge, Button, Input } from '../design-system';
import type { BadgeVariant } from '../design-system/Badge/Badge';
import styles from './VoyeurPane.module.css';

// ============================================================================
// Event Kind Metadata
// ============================================================================

interface EventKindMeta {
  label: string;
  color: string;
  icon: string;
}

const EVENT_KIND_META: Record<string, EventKindMeta> = {
  'ingest.start': { label: 'Ingest Start', color: 'info', icon: '📥' },
  'ingest.complete': { label: 'Ingest Done', color: 'success', icon: '✓' },
  'embed.request': { label: 'Embed Req', color: 'info', icon: '🔢' },
  'embed.fallback': { label: 'Embed Fallback', color: 'warning', icon: '⚠️' },
  'match.candidate': { label: 'Match Found', color: 'success', icon: '🎯' },
  'match.none': { label: 'No Match', color: 'secondary', icon: '∅' },
  'merge.applied': { label: 'Merge Applied', color: 'success', icon: '🔀' },
  'merge.deferred': { label: 'Merge Deferred', color: 'warning', icon: '⏸' },
  'error': { label: 'Error', color: 'error', icon: '❌' }
};

const DEFAULT_META: EventKindMeta = { 
  label: 'Unknown', 
  color: 'secondary', 
  icon: '•' 
};

// ============================================================================
// Sub-components
// ============================================================================

interface EventItemProps {
  event: VoyeurEvent;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function EventItem({ event, isExpanded, onToggleExpand }: EventItemProps) {
  const meta = EVENT_KIND_META[event.kind] || DEFAULT_META;
  
  // Format timestamp
  const timestamp = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className={styles.eventItem}>
      <div className={styles.eventHeader} onClick={onToggleExpand}>
        <div className={styles.eventIcon}>{meta.icon}</div>
        
        <div className={styles.eventMain}>
          <div className={styles.eventKind}>
            <Badge variant={meta.color as any}>{meta.label}</Badge>
            {event.sourceInstance && (
              <span className={styles.eventSource}>@{event.sourceInstance}</span>
            )}
          </div>
          
          <div className={styles.eventMeta}>
            <span className={styles.eventTime}>{timestamp}</span>
            
            {event.latencyMs !== undefined && (
              <span className={styles.eventLatency}>{event.latencyMs}ms</span>
            )}
            
            {event.similarity !== undefined && (
              <span className={styles.eventSimilarity}>
                sim: {(event.similarity * 100).toFixed(1)}%
              </span>
            )}
            
            {event.memoryHash && (
              <span className={styles.eventHash}>
                {event.memoryHash.slice(0, 8)}
              </span>
            )}
          </div>
        </div>
        
        <div className={styles.eventExpand}>
          {isExpanded ? '▼' : '▶'}
        </div>
      </div>
      
      {isExpanded && (
        <div className={styles.eventDetails}>
          <pre>{JSON.stringify(event, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

interface ConnectionStatusProps {
  state: string;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
}

function ConnectionStatus({ 
  state, 
  isConnected, 
  onConnect, 
  onDisconnect, 
  onReconnect 
}: ConnectionStatusProps) {
  // Map connection states to valid Badge variants with proper typing
  const statusColor: BadgeVariant = {
    disconnected: 'secondary',
    connecting: 'warning',
    connected: 'success',
    reconnecting: 'warning',
    error: 'error'
  }[state] as BadgeVariant || 'secondary';

  const statusLabel = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    reconnecting: 'Reconnecting...',
    error: 'Error'
  }[state] || state;

  return (
    <div className={styles.connectionStatus}>
      <Badge variant={statusColor}>{statusLabel}</Badge>
      
      <div className={styles.connectionButtons}>
        {!isConnected && state !== 'connecting' && (
          <Button size="sm" onClick={onConnect}>Connect</Button>
        )}
        {isConnected && (
          <Button size="sm" variant="secondary" onClick={onDisconnect}>
            Disconnect
          </Button>
        )}
        {state === 'error' && (
          <Button size="sm" onClick={onReconnect}>Retry</Button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export interface VoyeurPaneProps {
  /** Optional callback when close is requested */
  onClose?: () => void;
}

export function VoyeurPane({ onClose }: VoyeurPaneProps = {}) {
  // Note: onClose is currently unused but reserved for future close functionality
  void onClose;
  
  const voyeur = useVoyeurEvents();
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [selectedKinds, setSelectedKinds] = useState<VoyeurEventKind[]>([]);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [voyeur.filteredEvents.length, autoScroll]);

  // Update filter when search or kinds change
  useEffect(() => {
    voyeur.setFilter({
      searchText: searchText || undefined,
      kinds: selectedKinds.length > 0 ? selectedKinds : undefined
    });
  }, [searchText, selectedKinds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle event expansion
  const toggleEventExpand = useCallback((eventId: string) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  // Toggle event kind filter
  const toggleKindFilter = useCallback((kind: VoyeurEventKind) => {
    setSelectedKinds(prev => {
      if (prev.includes(kind)) {
        return prev.filter(k => k !== kind);
      } else {
        return [...prev, kind];
      }
    });
  }, []);

  // Get available event kinds from current events
  const availableKinds = Array.from(
    new Set(voyeur.events.map(e => e.kind))
  ).sort();

  return (
    <div className={styles.voyeurPane} role="region" aria-label="Observability Events">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.titleIcon} aria-hidden="true">👁️</span>
          <h3>Voyeur Stream</h3>
        </div>
        
        <ConnectionStatus
          state={voyeur.connectionState}
          isConnected={voyeur.isConnected}
          onConnect={voyeur.connect}
          onDisconnect={voyeur.disconnect}
          onReconnect={voyeur.reconnect}
        />
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Input
            type="text"
            placeholder="Search events..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className={styles.searchInput}
            aria-label="Search events"
          />
          
          <Button 
            size="sm" 
            variant="secondary"
            onClick={voyeur.clearEvents}
          >
            Clear
          </Button>
        </div>
        
        <div className={styles.toolbarGroup}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={voyeur.isPaused}
              onChange={(e) => voyeur.setPaused(e.target.checked)}
            />
            Pause
          </label>
          
          <span className={styles.eventCount}>
            {voyeur.filteredEvents.length} / {voyeur.events.length}
          </span>
        </div>
      </div>

      {/* Event Kind Filters */}
      {availableKinds.length > 0 && (
        <div className={styles.filterChips}>
          {availableKinds.map(kind => {
            const meta = EVENT_KIND_META[kind] || DEFAULT_META;
            const isSelected = selectedKinds.includes(kind);
            
            return (
              <button
                key={kind}
                className={`${styles.filterChip} ${isSelected ? styles.filterChipActive : ''}`}
                onClick={() => toggleKindFilter(kind)}
              >
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Event List */}
      <div className={styles.eventList}>
        {voyeur.filteredEvents.length === 0 ? (
          <div className={styles.emptyState}>
            {voyeur.events.length === 0 ? (
              <>
                <span className={styles.emptyIcon}>📡</span>
                <p>No events yet</p>
                <p className={styles.emptyHint}>
                  {voyeur.isConnected 
                    ? 'Waiting for events from the backend...'
                    : 'Connect to start receiving events'}
                </p>
              </>
            ) : (
              <>
                <span className={styles.emptyIcon}>🔍</span>
                <p>No matching events</p>
                <p className={styles.emptyHint}>
                  Try adjusting your filters or search query
                </p>
              </>
            )}
          </div>
        ) : (
          voyeur.filteredEvents.map((event, index) => {
            const eventId = `${event.timestamp}-${index}`;
            return (
              <EventItem
                key={eventId}
                event={event}
                isExpanded={expandedEventIds.has(eventId)}
                onToggleExpand={() => toggleEventExpand(eventId)}
              />
            );
          })
        )}
        <div ref={eventsEndRef} />
      </div>
    </div>
  );
}

export default VoyeurPane;