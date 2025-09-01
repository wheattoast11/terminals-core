/**
 * Core types for the universal event store
 */

/** Base interface for all events */
export interface BaseEvent {
  id: string
  timestamp: number
  type: string
  userId?: string
  sessionId?: string
  metadata?: Record<string, any>
}

/** Helper type for event payloads (without id/timestamp) */
export type EventPayload<E extends BaseEvent> = E extends any ? Omit<E, 'id' | 'timestamp'> : never;

/** State reducer function */
export type Reducer<S, E> = (state: S, event: E) => S

/** Event store options */
export interface EventStoreOptions {
  maxEvents?: number
  enableCheckpoints?: boolean
  checkpointInterval?: number
  redactFields?: string[]
  captureErrors?: boolean
  uploadOn?: ('error' | 'manual' | 'interval')[]
}

/** Event store state snapshot */
export interface Snapshot<E, S> {
  events: E[]
  index: number
  state: S
  timestamp: number
  metadata?: Record<string, any>
}

/** Vector embedding for semantic search */
export interface Embedding {
  vector: number[]
  model: string
  dimensions: number
}

/** Replay configuration */
export interface ReplayConfig {
  apiKey?: string
  endpoint?: string
  redact?: string[]
  maxEvents?: number
  uploadOn?: ('error' | 'manual' | 'interval')[]
  sessionId?: string
  userId?: string
  metadata?: Record<string, any>
}

/** Replay data structure */
export interface Replay<E extends BaseEvent, S> {
  id: string
  url: string
  events: E[]
  initialState: S
  finalState: S
  duration: number
  timestamp: number
  error?: Error
  metadata?: Record<string, any>
}