/**
 * Terminals - Universal Event Store with Time Travel
 * Git for application state. Every bug becomes a replay.
 */

import { EventStore } from './core/EventStore'
import { ReplayManager } from './replay/ReplayManager'
import type { 
  BaseEvent, 
  EventPayload, 
  Reducer, 
  EventStoreOptions, 
  ReplayConfig,
  Snapshot,
  Replay
} from './core/types'

// --- Core Functions ---

function createStore<E extends BaseEvent, S>(
  initialState: S,
  reducer: Reducer<S, E>,
  options?: EventStoreOptions
): EventStore<E, S> {
  return new EventStore<E, S>(initialState, reducer, options)
}

function createReplayManager<E extends BaseEvent, S>(
  store: EventStore<E, S>,
  config?: ReplayConfig
): ReplayManager<E, S> {
  return new ReplayManager<E, S>(store, config)
}

// --- Main Terminals Interface ---

export interface TerminalsConfig<E extends BaseEvent = BaseEvent, S = any> {
  initialState?: S
  reducer?: Reducer<S, E>
  apiKey?: string
  environment?: 'development' | 'production' | 'test'
  maxEvents?: number
  enableCheckpoints?: boolean
  redact?: string[]
  uploadOn?: ('error' | 'manual' | 'interval')[]
  endpoint?: string
  sessionId?: string
  userId?: string
  metadata?: Record<string, any>
}

function init<E extends BaseEvent = BaseEvent, S = any>(
  config: TerminalsConfig<E, S> = {}
) {
  const defaultReducer = (state: any, event: any) => ({ ...state, lastEvent: event })
  const initialState = config.initialState || {} as S
  const reducer = config.reducer || defaultReducer as Reducer<S, E>
  
  const storeOptions: EventStoreOptions = {
    maxEvents: config.maxEvents || 10000,
    enableCheckpoints: config.enableCheckpoints !== false,
    checkpointInterval: 100,
    redactFields: config.redact,
    captureErrors: config.uploadOn?.includes('error'),
    uploadOn: config.uploadOn
  }
  
  const store = new EventStore<E, S>(initialState, reducer, storeOptions)
  
  const replayConfig: ReplayConfig = {
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    redact: config.redact,
    maxEvents: config.maxEvents,
    uploadOn: config.uploadOn || ['error'],
    sessionId: config.sessionId || `session-${Date.now()}`,
    userId: config.userId,
    metadata: config.metadata
  }
  
  const replay = new ReplayManager<E, S>(store, replayConfig)
  
  const api = {
    store,
    replay,
    dispatch: (event: EventPayload<E>) => store.append(event),
    undo: () => store.undo(),
    redo: () => store.redo(),
    generateReplay: async (error?: Error) => replay.captureAndUpload(error),
    rewind: (steps: number) => {
      const newIndex = Math.max(-1, store.getIndex() - steps)
      store.navigate(newIndex)
    },
    export: () => store.snapshot()
  }

  if (typeof window !== 'undefined') {
    (window as any).terminals = {
      ...terminals, // Main object
      ...api,       // Instance methods
    }
  }

  return api
}

// --- Main Export ---

const terminals = {
  init,
  createStore,
  createReplayManager,
  version: '1.0.0',
  EventStore,
  ReplayManager
}

export default terminals

// --- Type Exports ---

export type {
  BaseEvent,
  EventPayload,
  Reducer,
  EventStoreOptions,
  ReplayConfig,
  Snapshot,
  Replay
}

// --- Framework & Feature Exports ---

export { BaseAdapter } from './adapters/BaseAdapter'
export { ReactAdapter, useEventStore, createEventStoreHook } from './adapters/ReactAdapter'
export { MockEmbedder, OpenAIEmbedder, EventEmbedder } from './semantic/Embedder'
export type { EmbeddingProvider } from './semantic/Embedder'
export { SemanticSearch, cosineSimilarity } from './semantic/SemanticSearch'
