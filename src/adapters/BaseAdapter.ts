import { EventStore } from '../core/EventStore'
import { BaseEvent, EventPayload, Reducer } from '../core/types'

/**
 * Base adapter for framework integration
 */
export abstract class BaseAdapter<E extends BaseEvent, S> {
  protected store: EventStore<E, S>
  protected listeners: Set<(state: S) => void> = new Set()

  constructor(
    initialState: S,
    reducer: Reducer<S, E>,
    options?: any
  ) {
    this.store = new EventStore(initialState, reducer, options)
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: S) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of state change
   */
  protected notifyListeners(): void {
    const state = this.store.project()
    this.listeners.forEach(listener => listener(state))
  }

  /**
   * Dispatch an event
   */
  dispatch(event: EventPayload<E>): void {
    this.store.append(event)
    this.notifyListeners()
  }

  /**
   * Undo last action
   */
  undo(): void {
    if (this.store.undo()) {
      this.notifyListeners()
    }
  }

  /**
   * Redo next action
   */
  redo(): void {
    if (this.store.redo()) {
      this.notifyListeners()
    }
  }

  /**
   * Get current state
   */
  getState(): S {
    return this.store.project()
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.store.canUndo()
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.store.canRedo()
  }

  /**
   * Get all events
   */
  getEvents(): E[] {
    return this.store.getEvents()
  }

  /**
   * Navigate to specific time
   */
  navigateToTime(timestamp: number): void {
    this.store.navigateToTime(timestamp)
    this.notifyListeners()
  }

  /**
   * Save to storage
   */
  abstract save(): Promise<void>

  /**
   * Load from storage
   */
  abstract load(): Promise<void>
}