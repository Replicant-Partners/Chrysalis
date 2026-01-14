/**
 * Session Management
 * 
 * Handles session tracking, cleanup, and TTL/LRU eviction.
 * 
 * @module a2a-client/a2a/session
 */

import { Session } from '../types';
import { MAX_SESSIONS, SESSION_TTL_MS, CLEANUP_INTERVAL_MS } from './constants';

export interface SessionStats {
  sessionsCreated: number;
  sessionsEvicted: number;
}

export interface SessionManagerEvents {
  onSessionsCleaned?: (expired: number, remaining: number) => void;
  onLog?: (level: 'debug' | 'info' | 'error', message: string) => void;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private stats: SessionStats = {
    sessionsCreated: 0,
    sessionsEvicted: 0
  };
  private events: SessionManagerEvents;
  
  constructor(events: SessionManagerEvents = {}) {
    this.events = events;
    this.startSessionCleanup();
  }
  
  trackSession(sessionId: string, taskId: string): void {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      const now = this.nowIso();
      session = {
        id: sessionId,
        taskIds: [],
        createdAt: now,
        lastActivityAt: now
      };
      this.sessions.set(sessionId, session);
      this.stats.sessionsCreated++;
    }
    
    if (!session.taskIds.includes(taskId)) {
      session.taskIds.push(taskId);
    }
    
    session.lastActivityAt = this.nowIso();
  }
  
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }
  
  getSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
  
  clearSessions(): void {
    this.sessions.clear();
  }
  
  getSessionCount(): number {
    return this.sessions.size;
  }
  
  getStats(): SessionStats {
    return { ...this.stats };
  }
  
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.sessions.clear();
  }
  
  private startSessionCleanup(): void {
    this.cleanupTimer = setInterval(
      () => this.cleanupSessions(),
      CLEANUP_INTERVAL_MS
    );
    
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }
  
  private cleanupSessions(): void {
    const now = Date.now();
    const expiredIds = Array.from(this.sessions.entries())
      .filter(([, session]) => now - new Date(session.lastActivityAt).getTime() > SESSION_TTL_MS)
      .map(([id]) => id);
    
    this.evictSessions(expiredIds);
    
    if (this.sessions.size > MAX_SESSIONS) {
      const sorted = Array.from(this.sessions.entries())
        .sort((a, b) =>
          new Date(a[1].lastActivityAt).getTime() -
          new Date(b[1].lastActivityAt).getTime()
        );
      
      const overflow = this.sessions.size - MAX_SESSIONS;
      const lruIds = sorted.slice(0, overflow).map(([id]) => id);
      this.evictSessions(lruIds);
    }
    
    if (expiredIds.length > 0) {
      this.events.onLog?.('debug', `Cleaned up ${expiredIds.length} expired sessions`);
      this.events.onSessionsCleaned?.(expiredIds.length, this.sessions.size);
    }
  }
  
  private evictSessions(ids: string[]): void {
    for (const id of ids) {
      if (this.sessions.delete(id)) {
        this.stats.sessionsEvicted++;
      }
    }
  }
  
  private nowIso(): string {
    return new Date().toISOString();
  }
}
