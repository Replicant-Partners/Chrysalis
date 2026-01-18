/**
 * Canvas Event Bus
 * 
 * Centralized event management for canvas operations.
 */

import type { CanvasEvent } from '../types';

export type EventFilter = (event: CanvasEvent) => boolean;
export type EventHandler = (event: CanvasEvent) => void;

interface Subscription {
  filter?: EventFilter;
  handler: EventHandler;
}

export class EventBus {
  private subscriptions: Subscription[] = [];
  private eventLog: CanvasEvent[] = [];
  private maxLogSize: number;

  constructor(maxLogSize = 1000) {
    this.maxLogSize = maxLogSize;
  }

  public emit(event: CanvasEvent): void {
    // Log event
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Notify subscribers
    this.subscriptions.forEach((sub) => {
      if (!sub.filter || sub.filter(event)) {
        sub.handler(event);
      }
    });
  }

  public subscribe(handler: EventHandler, filter?: EventFilter): () => void {
    const subscription: Subscription = { handler, filter };
    this.subscriptions.push(subscription);

    return () => {
      const index = this.subscriptions.indexOf(subscription);
      if (index > -1) {  
        this.subscriptions.splice(index, 1);
      }
    };
  }

  public getLog(): readonly CanvasEvent[] {
    return this.eventLog;
  }

  public filterLog(filter: EventFilter): CanvasEvent[] {
    return this.eventLog.filter(filter);
  }

  public clearLog(): void {
    this.eventLog = [];
  }

  public replay(from: number, handler: EventHandler): void {
    this.eventLog
      .filter((event) => event.timestamp >= from)
      .forEach((event) => handler(event));
  }
}
