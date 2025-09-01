# @terminals-tech/core

**Time travel for web apps. Context memory for AI agents. 100 lines of TypeScript.**

## What This Is

A minimal event sourcing system extracted from production code. Every user action becomes an immutable event. State is computed by replaying events. Navigate to any point in time instantly.

## Installation

```bash
npm install @terminals-tech/core
```

## 3-Minute Setup

```typescript
import { EventStore } from '@terminals-tech/core'

// Define your events
type MyEvent = 
  | { type: 'increment'; payload: { amount: number } }
  | { type: 'reset' }

// Define your state
type MyState = { count: number }

// Create reducer
const reducer = (state: MyState, event: MyEvent): MyState => {
  switch (event.type) {
    case 'increment': 
      return { count: state.count + event.payload.amount }
    case 'reset': 
      return { count: 0 }
    default: 
      return state
  }
}

// Initialize store
const store = new EventStore<MyEvent, MyState>(
  { count: 0 },
  reducer
)

// Use it
store.append({ type: 'increment', payload: { amount: 5 } })
console.log(store.project()) // { count: 5 }

store.undo()
console.log(store.project()) // { count: 0 }

store.redo()
console.log(store.project()) // { count: 5 }
```

## React Integration

```tsx
import { useEventStore } from '@terminals-tech/core/react'

function Counter() {
  const { state, dispatch, undo, redo, canUndo, canRedo } = useEventStore<MyEvent, MyState>(
    { count: 0 },
    reducer
  )

  return (
    <>
      <div>Count: {state.count}</div>
      <button onClick={() => dispatch({ type: 'increment', payload: { amount: 1 } })}>+1</button>
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </>
  )
}
```

## Agent Context Management

```typescript
// Give agents perfect memory
const agentStore = new EventStore<ConversationEvent, ConversationState>(
  initialState,
  conversationReducer
)

// Get context window for LLM
const recentEvents = agentStore.getEvents().slice(-50)
const context = recentEvents.map(e => e.payload.message).join('\n')

// Navigate to specific moment
agentStore.navigateToTime(timestamp)

// Fork for exploring alternatives
const alternateTimeline = agentStore.fork()
```

## Performance

- **10,000 events**: <50ms replay time
- **Memory**: ~100 bytes per event
- **Storage**: Automatic compression for localStorage
- **Network**: ~100 bytes per event over WebSocket

## Core Concepts

1. **Events are facts** - Immutable, timestamped, ordered
2. **State is derived** - Always computed from events
3. **Time is navigable** - Move to any point instantly
4. **History is forkable** - Create alternate timelines

## Why This Pattern Works

- **Debugging**: See exactly what happened when
- **Undo/Redo**: Built-in, unlimited levels
- **Persistence**: Save/load entire session history
- **Testing**: Replay exact user sequences
- **AI Training**: Perfect interaction recordings

## Production Ready

This is extracted from [Journey](https://github.com/wheattoast11/flow), a consciousness exploration app where every thought is an event. Currently handling 1000+ events per session with zero performance issues.

## License

The core `@terminals-tech/core` package is licensed under the MIT License.

Other packages in the Terminals ecosystem, such as `@terminals-tech/replay` and `@terminals-tech/sync`, may have different, commercial licenses. Please see the respective packages for their specific licensing terms.

---

MIT License

Copyright (c) 2024 Intuition Labs