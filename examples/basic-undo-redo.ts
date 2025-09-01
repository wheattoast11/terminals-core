/**
 * Basic example: Counter with undo/redo
 */

import { EventStore, BaseEvent } from '../src'

// Define events with explicit discriminated union
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

// Define state
type State = { count: number }

// Create reducer
const reducer = (state: State, event: Event): State => {
  switch (event.type) {
    case 'increment':
      return { count: state.count + event.payload.amount }
    case 'decrement':
      return { count: state.count - event.payload.amount }
    case 'reset':
      return { count: 0 }
    default:
      return state
  }
}

// Initialize store
const store = new EventStore<Event, State>(
  { count: 0 },
  reducer
)

// Use it
console.log('Initial:', store.project()) // { count: 0 }

store.append({ type: 'increment', payload: { amount: 5 } })
console.log('After +5:', store.project()) // { count: 5 }

store.append({ type: 'increment', payload: { amount: 3 } })
console.log('After +3:', store.project()) // { count: 8 }

store.undo()
console.log('After undo:', store.project()) // { count: 5 }

store.undo()
console.log('After undo:', store.project()) // { count: 0 }

store.redo()
console.log('After redo:', store.project()) // { count: 5 }

// Branch timeline
store.append({ type: 'decrement', payload: { amount: 2 } })
console.log('New timeline:', store.project()) // { count: 3 }

// The +3 event is gone - we've created a new timeline!