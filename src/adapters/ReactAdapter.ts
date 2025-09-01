import { useSyncExternalStore, useCallback } from 'react'
import { EventStore } from '../core/EventStore'
import { BaseEvent, EventPayload, Reducer } from '../core/types'
import { BaseAdapter } from './BaseAdapter'

/**
 * React adapter using useSyncExternalStore for React 18+
 * Inspired by Journey's Zustand integration
 */
export class ReactAdapter<E extends BaseEvent, S> extends BaseAdapter<E, S> {
  async save(): Promise<void> {
    const snapshot = this.store.snapshot()
    localStorage.setItem('event-store', JSON.stringify(snapshot))
  }

  async load(): Promise<void> {
    const saved = localStorage.getItem('event-store')
    if (saved) {
      const snapshot = JSON.parse(saved)
      this.store.restore(snapshot)
      this.notifyListeners()
    }
  }
}

/**
 * React hook for event store
 */
export function useEventStore<E extends BaseEvent, S>(
  initialState: S,
  reducer: Reducer<S, E>,
  options?: any
): {
  state: S
  dispatch: (event: EventPayload<E>) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  events: E[]
  navigateToTime: (timestamp: number) => void
} {
  // Create or get adapter instance
  const adapter = useCallback(() => {
    // In real app, this would be stored in context or singleton
    return new ReactAdapter<E, S>(initialState, reducer, options)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const instance = adapter()

  // Subscribe to store changes
  const state = useSyncExternalStore(
    (callback) => instance.subscribe(callback),
    () => instance.getState(),
    () => instance.getState()
  )

  return {
    state,
    dispatch: useCallback((event) => instance.dispatch(event), [instance]),
    undo: useCallback(() => instance.undo(), [instance]),
    redo: useCallback(() => instance.redo(), [instance]),
    canUndo: instance.canUndo(),
    canRedo: instance.canRedo(),
    events: instance.getEvents(),
    navigateToTime: useCallback((timestamp) => instance.navigateToTime(timestamp), [instance])
  }
}

/**
 * Create a singleton store hook
 */
export function createEventStoreHook<E extends BaseEvent, S>(
  initialState: S,
  reducer: Reducer<S, E>,
  options?: any
) {
  let adapter: ReactAdapter<E, S> | null = null

  return function useStore() {
    if (!adapter) {
      adapter = new ReactAdapter<E, S>(initialState, reducer, options)
    }

    const state = useSyncExternalStore(
      (callback) => adapter!.subscribe(callback),
      () => adapter!.getState(),
      () => adapter!.getState()
    )

    return {
      state,
      dispatch: (event: EventPayload<E>) => adapter!.dispatch(event),
      undo: () => adapter!.undo(),
      redo: () => adapter!.redo(),
      canUndo: adapter!.canUndo(),
      canRedo: adapter!.canRedo(),
      events: adapter!.getEvents(),
      navigateToTime: (timestamp: number) => adapter!.navigateToTime(timestamp),
      save: () => adapter!.save(),
      load: () => adapter!.load()
    }
  }
}