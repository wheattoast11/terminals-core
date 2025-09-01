import { BaseEvent, EventPayload, Reducer, EventStoreOptions, Snapshot } from './types'

/**
 * Core event store implementation with time travel capabilities
 * Extracted and refined from Journey app's consciousness store
 */
export class EventStore<E extends BaseEvent, S> {
  private events: E[] = []
  private index: number = -1
  private checkpoints: Map<number, S> = new Map()
  private idCounter: number = 0
  private listeners: Set<(event: E, state: S) => void> = new Set()
  private metadata: Map<string, any> = new Map()

  constructor(
    private initialState: S,
    private reducer: Reducer<S, E>,
    private options: EventStoreOptions = {}
  ) {
    // Set checkpoint at beginning if enabled
    if (options.enableCheckpoints) {
      this.checkpoints.set(-1, initialState)
    }
    
    // Set default options
    this.options = {
      maxEvents: 10000,
      enableCheckpoints: true,
      checkpointInterval: 100,
      ...options
    }
  }

  /**
   * Append a new event, truncating any future history
   */
  append(eventPayload: EventPayload<E>): E {
    // Truncate future if we've undone
    if (this.index < this.events.length - 1) {
      this.events = this.events.slice(0, this.index + 1)
      // Clear future checkpoints
      for (const [idx] of this.checkpoints) {
        if (idx > this.index) {
          this.checkpoints.delete(idx)
        }
      }
    }

    // Create full event
    const event = {
      ...eventPayload,
      id: `evt-${Date.now()}-${this.idCounter++}`,
      timestamp: Date.now()
    } as E

    // Enforce max events if specified
    if (this.options.maxEvents && this.events.length >= this.options.maxEvents) {
      // Keep last half of events and create checkpoint
      const midpoint = Math.floor(this.events.length / 2)
      if (this.options.enableCheckpoints) {
        const checkpointState = this.projectAtIndex(midpoint)
        this.checkpoints.clear()
        this.checkpoints.set(0, checkpointState)
      }
      this.events = this.events.slice(midpoint)
      this.index = this.events.length - 1
    }

    this.events.push(event)
    this.index++

    // Create checkpoint if interval reached
    if (
      this.options.enableCheckpoints &&
      this.options.checkpointInterval &&
      this.index % this.options.checkpointInterval === 0
    ) {
      this.checkpoints.set(this.index, this.project())
    }

    // Notify listeners
    const newState = this.project()
    this.listeners.forEach(listener => listener(event, newState))

    return event
  }

  /**
   * Project current state from events
   */
  project(): S {
    return this.projectAtIndex(this.index)
  }

  /**
   * Project state at specific index
   */
  private projectAtIndex(targetIndex: number): S {
    if (targetIndex < 0) return this.initialState

    // Find nearest checkpoint
    if (this.options.enableCheckpoints) {
      let nearestCheckpoint = -1
      let nearestState = this.initialState

      for (const [index, state] of this.checkpoints.entries()) {
        if (index <= targetIndex && index > nearestCheckpoint) {
          nearestCheckpoint = index
          nearestState = state
        }
      }

      // Project from checkpoint
      const startIndex = nearestCheckpoint + 1
      return this.events
        .slice(startIndex, targetIndex + 1)
        .reduce(this.reducer, nearestState)
    }

    // No checkpoints, project from beginning
    return this.events
      .slice(0, targetIndex + 1)
      .reduce(this.reducer, this.initialState)
  }

  /**
   * Undo last action
   */
  undo(): boolean {
    if (this.index >= 0) {
      this.index--
      const newState = this.project()
      // Notify listeners with synthetic undo event
      this.listeners.forEach(listener => 
        listener({ type: '__UNDO__', id: 'undo', timestamp: Date.now() } as E, newState)
      )
      return true
    }
    return false
  }

  /**
   * Redo next action
   */
  redo(): boolean {
    if (this.index < this.events.length - 1) {
      this.index++
      const newState = this.project()
      // Notify listeners with synthetic redo event
      this.listeners.forEach(listener => 
        listener({ type: '__REDO__', id: 'redo', timestamp: Date.now() } as E, newState)
      )
      return true
    }
    return false
  }

  /**
   * Navigate to specific index
   */
  navigate(index: number): void {
    const oldIndex = this.index
    this.index = Math.max(-1, Math.min(index, this.events.length - 1))
    if (oldIndex !== this.index) {
      const newState = this.project()
      this.listeners.forEach(listener => 
        listener({ type: '__NAVIGATE__', id: 'nav', timestamp: Date.now() } as E, newState)
      )
    }
  }

  /**
   * Navigate to specific timestamp
   */
  navigateToTime(timestamp: number): void {
    let targetIndex = -1
    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].timestamp <= timestamp) {
        targetIndex = i
      } else {
        break
      }
    }
    this.navigate(targetIndex)
  }

  /**
   * Subscribe to events
   */
  subscribe(listener: (event: E, state: S) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Get current event index
   */
  getIndex(): number {
    return this.index
  }

  /**
   * Get all events
   */
  getEvents(): E[] {
    return [...this.events]
  }

  /**
   * Get active events (up to current index)
   */
  getActiveEvents(): E[] {
    return this.events.slice(0, this.index + 1)
  }

  /**
   * Get events in time range
   */
  getEventsInRange(start: number, end: number): E[] {
    return this.events.filter(e => e.timestamp >= start && e.timestamp <= end)
  }

  /**
   * Check if can undo
   */
  canUndo(): boolean {
    return this.index >= 0
  }

  /**
   * Check if can redo
   */
  canRedo(): boolean {
    return this.index < this.events.length - 1
  }

  /**
   * Create a snapshot for persistence
   */
  snapshot(): Snapshot<E, S> {
    return {
      events: [...this.events],
      index: this.index,
      state: this.project(),
      timestamp: Date.now(),
      metadata: Object.fromEntries(this.metadata)
    }
  }

  /**
   * Restore from snapshot
   */
  restore(snapshot: Snapshot<E, S>): void {
    this.events = [...snapshot.events]
    this.index = snapshot.index
    this.metadata = new Map(Object.entries(snapshot.metadata || {}))
    this.checkpoints.clear()
    
    if (this.options.enableCheckpoints) {
      // Rebuild checkpoints
      this.checkpoints.set(-1, this.initialState)
      if (this.options.checkpointInterval) {
        for (let i = this.options.checkpointInterval - 1; i <= this.index; i += this.options.checkpointInterval) {
          this.checkpoints.set(i, this.projectAtIndex(i))
        }
      }
    }
  }

  /**
   * Fork the store at current state
   */
  fork(): EventStore<E, S> {
    const forked = new EventStore(this.initialState, this.reducer, this.options)
    forked.events = this.getActiveEvents()
    forked.index = forked.events.length - 1
    forked.metadata = new Map(this.metadata)
    
    // Rebuild checkpoints for fork
    if (this.options.enableCheckpoints && this.options.checkpointInterval) {
      forked.checkpoints.set(-1, this.initialState)
      for (let i = this.options.checkpointInterval - 1; i <= forked.index; i += this.options.checkpointInterval) {
        forked.checkpoints.set(i, forked.projectAtIndex(i))
      }
    }
    
    return forked
  }

  /**
   * Clear all events and reset
   */
  clear(): void {
    this.events = []
    this.index = -1
    this.checkpoints.clear()
    this.metadata.clear()
    if (this.options.enableCheckpoints) {
      this.checkpoints.set(-1, this.initialState)
    }
  }

  /**
   * Set metadata
   */
  setMetadata(key: string, value: any): void {
    this.metadata.set(key, value)
  }

  /**
   * Get metadata
   */
  getMetadata(key: string): any {
    return this.metadata.get(key)
  }

  /**
   * Get store statistics
   */
  getStats(): {
    eventCount: number
    activeEventCount: number
    checkpointCount: number
    memoryUsage: number
    oldestEvent: number | null
    newestEvent: number | null
  } {
    const memoryUsage = JSON.stringify(this.events).length + 
                       JSON.stringify(Array.from(this.checkpoints.values())).length

    return {
      eventCount: this.events.length,
      activeEventCount: this.index + 1,
      checkpointCount: this.checkpoints.size,
      memoryUsage,
      oldestEvent: this.events[0]?.timestamp || null,
      newestEvent: this.events[this.events.length - 1]?.timestamp || null
    }
  }
}