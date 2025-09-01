# Architecture: Universal Event Store

## Core Design Principles

### 1. Immutable Event Log
Events are append-only facts that never change. Each event has:
- `id`: Unique identifier
- `timestamp`: When it occurred  
- `type`: Discriminated union type
- `payload`: Event-specific data

### 2. State Projection
State is always derived by reducing events through a pure function:
```typescript
state = events.slice(0, index + 1).reduce(reducer, initialState)
```

This guarantees:
- **Determinism**: Same events always produce same state
- **Replayability**: Can rebuild state from any point
- **Debuggability**: Every state change is traceable

### 3. Time Navigation
The `eventIndex` pointer controls which events are "active":
- `undo()`: Moves index backward, recomputes state
- `redo()`: Moves index forward, recomputes state  
- `navigate(index)`: Jumps to specific point

## Implementation Details

### Event Store Core (~50 lines)
```typescript
class EventStore<E, S> {
  private events: E[] = []
  private index: number = -1
  
  append(event: E): void {
    // Truncate future if we've undone
    this.events = this.events.slice(0, this.index + 1)
    this.events.push(event)
    this.index++
  }
  
  project(): S {
    return this.events.slice(0, this.index + 1)
      .reduce(this.reducer, this.initial)
  }
  
  undo(): void {
    if (this.index >= 0) this.index--
  }
  
  redo(): void {
    if (this.index < this.events.length - 1) this.index++
  }
}
```

### Memory Characteristics
Based on production usage in Journey app:
- Event size: 50-200 bytes (typical)
- 1,000 events: ~100KB memory
- 10,000 events: ~1MB memory
- Replay 10,000 events: <50ms

### Storage Strategy
```typescript
// Compression for localStorage (10:1 typical)
const compressed = LZString.compress(JSON.stringify(events))

// Chunking for IndexedDB (50MB practical limit)
const chunks = chunkEvents(events, CHUNK_SIZE)

// Streaming for network (WebSocket)
events.forEach(e => ws.send(JSON.stringify(e)))
```

## Semantic Layer (Optional)

### Vector Embeddings
For AI agent context management:
```typescript
interface SemanticEvent extends Event {
  embedding?: number[] // 768-dim vector from text-embedding-ada-002
}

// Similarity search
function findSimilar(query: number[], k: number): Event[] {
  return events
    .map(e => ({ event: e, similarity: cosine(query, e.embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k)
    .map(x => x.event)
}
```

### Cost Analysis
- OpenAI ada-002: $0.00002 per event
- Storage: +3KB per event (768 floats)
- Search: O(n) naive, O(log n) with index

## React Integration Pattern

Using Zustand (as in Journey):
```typescript
const useEventStore = create<State & Actions>((set, get) => ({
  events: [],
  index: -1,
  
  dispatch: (event) => {
    const { events, index } = get()
    const newEvents = [...events.slice(0, index + 1), event]
    set({ 
      events: newEvents, 
      index: newEvents.length - 1,
      projectedState: computeState(newEvents)
    })
  },
  
  undo: () => {
    set(state => ({
      index: state.index - 1,
      projectedState: computeState(state.events.slice(0, state.index))
    }))
  }
}))
```

## Performance Optimizations

### 1. Incremental Projection
Instead of replaying all events:
```typescript
// Cache intermediate states
const checkpoints = new Map<number, S>()

function projectFrom(index: number): S {
  // Find nearest checkpoint
  const checkpoint = findNearestCheckpoint(index)
  
  // Project from checkpoint
  return events.slice(checkpoint.index, index + 1)
    .reduce(reducer, checkpoint.state)
}
```

### 2. Event Compression
```typescript
// Merge consecutive moves
[
  { type: 'move', x: 10 },
  { type: 'move', x: 11 },
  { type: 'move', x: 12 }
] 
// Becomes
[{ type: 'move', x: 12 }]
```

### 3. Lazy Evaluation
```typescript
// Only compute state when accessed
get state() {
  if (this.dirty) {
    this._state = this.project()
    this.dirty = false
  }
  return this._state
}
```

## Real-World Constraints

From production experience:

### Browser Limits
- localStorage: 5-10MB (compressed)
- IndexedDB: 50MB realistic, 1GB theoretical
- Memory: 50MB comfortable for web app
- WebSocket: 1MB message size limit

### User Experience
- Undo/redo: Must be <16ms (single frame)
- Replay: <100ms for good feel
- Save: <500ms acceptable
- Load: <1s on app start

### Agent Integration
- Context window: Last 50-100 events typical
- Semantic search: <100ms for 10,000 events
- Embedding cost: ~$0.20 per 10,000 events
- Storage: 30MB for 10,000 events with embeddings

## Migration Path

From existing Redux/MobX app:
1. Wrap existing actions as events
2. Keep current reducer logic
3. Add event store alongside
4. Gradually move features
5. Remove old state management

From vanilla JavaScript:
1. Identify state changes
2. Convert to event + reducer
3. Add event store
4. Wire UI to dispatch/project

## Production Checklist

- [ ] Event schema versioning
- [ ] Storage quota handling
- [ ] Compression strategy
- [ ] Privacy (PII in events)
- [ ] Performance monitoring
- [ ] Error boundaries
- [ ] Migration tools
- [ ] DevTools extension