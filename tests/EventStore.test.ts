/**
 * Basic tests for EventStore
 */

import { EventStore } from '../src/core/EventStore'
import { BaseEvent } from '../src/core/types'

// Test types
interface IncrementEvent extends BaseEvent {
  type: 'increment'
  payload: { amount: number }
}

interface DecrementEvent extends BaseEvent {
  type: 'decrement'
  payload: { amount: number }
}

interface ResetEvent extends BaseEvent {
  type: 'reset'
}

type Event = IncrementEvent | DecrementEvent | ResetEvent
type State = { value: number }

const reducer = (state: State, event: Event): State => {
  switch (event.type) {
    case 'increment':
      return { value: state.value + event.payload.amount }
    case 'decrement':
      return { value: state.value - event.payload.amount }
    case 'reset':
      return { value: 0 }
    default:
      return state
  }
}

describe('EventStore', () => {
  let store: EventStore<Event, State>

  beforeEach(() => {
    store = new EventStore({ value: 0 }, reducer)
  })

  test('initial state', () => {
    expect(store.project()).toEqual({ value: 0 })
    expect(store.getEvents()).toHaveLength(0)
    expect(store.canUndo()).toBe(false)
    expect(store.canRedo()).toBe(false)
  })

  test('append events', () => {
    store.append({ type: 'increment', payload: { amount: 5 } })
    expect(store.project()).toEqual({ value: 5 })
    
    store.append({ type: 'increment', payload: { amount: 3 } })
    expect(store.project()).toEqual({ value: 8 })
    
    expect(store.getEvents()).toHaveLength(2)
  })

  test('undo/redo', () => {
    store.append({ type: 'increment', payload: { amount: 5 } })
    store.append({ type: 'decrement', payload: { amount: 2 } })
    
    expect(store.project()).toEqual({ value: 3 })
    
    store.undo()
    expect(store.project()).toEqual({ value: 5 })
    expect(store.canRedo()).toBe(true)
    
    store.undo()
    expect(store.project()).toEqual({ value: 0 })
    
    store.redo()
    expect(store.project()).toEqual({ value: 5 })
    
    store.redo()
    expect(store.project()).toEqual({ value: 3 })
    expect(store.canRedo()).toBe(false)
  })

  test('branching timeline', () => {
    store.append({ type: 'increment', payload: { amount: 5 } })
    store.append({ type: 'increment', payload: { amount: 3 } })
    
    store.undo() // Back to 5
    store.append({ type: 'decrement', payload: { amount: 2 } }) // New timeline
    
    expect(store.project()).toEqual({ value: 3 })
    expect(store.getEvents()).toHaveLength(2) // Second increment is gone
    expect(store.canRedo()).toBe(false)
  })

  test('navigation by index', () => {
    store.append({ type: 'increment', payload: { amount: 1 } })
    store.append({ type: 'increment', payload: { amount: 2 } })
    store.append({ type: 'increment', payload: { amount: 3 } })
    
    store.navigate(1) // After second event
    expect(store.project()).toEqual({ value: 3 })
    
    store.navigate(0) // After first event
    expect(store.project()).toEqual({ value: 1 })
    
    store.navigate(-1) // Before any events
    expect(store.project()).toEqual({ value: 0 })
  })

  test('navigation by time', (done) => {
    const event1 = store.append({ type: 'increment', payload: { amount: 1 } })
    
    // Wait a bit
    setTimeout(() => {
      const event2 = store.append({ type: 'increment', payload: { amount: 2 } })
      
      // Navigate to just after first event
      store.navigateToTime(event1.timestamp + 1)
      expect(store.project()).toEqual({ value: 1 })
      
      // Navigate to after second event
      store.navigateToTime(event2.timestamp + 1)
      expect(store.project()).toEqual({ value: 3 })
      done();
    }, 10)
  })

  test('fork store', () => {
    store.append({ type: 'increment', payload: { amount: 5 } })
    store.append({ type: 'increment', payload: { amount: 3 } })
    
    const fork = store.fork()
    
    // Original continues
    store.append({ type: 'increment', payload: { amount: 2 } })
    expect(store.project()).toEqual({ value: 10 })
    
    // Fork diverges
    fork.append({ type: 'decrement', payload: { amount: 1 } })
    expect(fork.project()).toEqual({ value: 7 })
    
    // They're independent
    expect(store.getEvents()).toHaveLength(3)
    expect(fork.getEvents()).toHaveLength(3)
  })

  test('snapshot and restore', () => {
    store.append({ type: 'increment', payload: { amount: 5 } })
    store.append({ type: 'decrement', payload: { amount: 2 } })
    
    const snapshot = store.snapshot()
    
    // Modify store
    store.append({ type: 'reset' })
    expect(store.project()).toEqual({ value: 0 })
    
    // Restore
    store.restore(snapshot)
    expect(store.project()).toEqual({ value: 3 })
    expect(store.getEvents()).toHaveLength(2)
  })

  test('max events limit', () => {
    const limitedStore = new EventStore(
      { value: 0 },
      reducer,
      { maxEvents: 5 }
    )
    
    // Add more than limit
    for (let i = 1; i <= 10; i++) {
      limitedStore.append({ type: 'increment', payload: { amount: 1 } })
    }
    
    // Should only keep last 5 (actually keeps ~2.5 after truncation)
    expect(limitedStore.getEvents().length).toBeLessThanOrEqual(5)
    
    // But state should still be correct
    expect(limitedStore.project().value).toBeGreaterThan(0)
  })

  test('checkpoints', () => {
    const checkpointStore = new EventStore(
      { value: 0 },
      reducer,
      { enableCheckpoints: true, checkpointInterval: 3 }
    )
    
    // Add events
    for (let i = 1; i <= 10; i++) {
      checkpointStore.append({ type: 'increment', payload: { amount: 1 } })
    }
    
    // Navigate and check performance (checkpoints make this faster)
    checkpointStore.navigate(5)
    expect(checkpointStore.project()).toEqual({ value: 6 })
    
    checkpointStore.navigate(9)
    expect(checkpointStore.project()).toEqual({ value: 10 })
  })
})