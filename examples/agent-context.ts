/**
 * Agent context management example
 */

import { EventStore, BaseEvent, MockEmbedder, EventEmbedder, SemanticSearch } from '../src'

// Chat events
type ChatEvent = 
  | { type: 'user-message'; payload: { text: string } }
  | { type: 'agent-response'; payload: { text: string } }
  | { type: 'tool-use'; payload: { tool: string; args: any; result: any } }
  | { type: 'context-switch'; payload: { topic: string } }

type Event = ChatEvent & BaseEvent

// Conversation state
interface State {
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  currentTopic: string
  toolUses: number
}

// Reducer
const reducer = (state: State, event: Event): State => {
  switch (event.type) {
    case 'user-message':
      return {
        ...state,
        messages: [...state.messages, { 
          role: 'user', 
          content: event.payload.text 
        }]
      }
    
    case 'agent-response':
      return {
        ...state,
        messages: [...state.messages, { 
          role: 'assistant', 
          content: event.payload.text 
        }]
      }
    
    case 'tool-use':
      return {
        ...state,
        toolUses: state.toolUses + 1,
        messages: [...state.messages, {
          role: 'system',
          content: `Used tool: ${event.payload.tool}`
        }]
      }
    
    case 'context-switch':
      return {
        ...state,
        currentTopic: event.payload.topic
      }
    
    default:
      return state
  }
}

// Agent context manager
class AgentContextManager {
  private store: EventStore<Event, State>
  private embedder: EventEmbedder<Event>
  private embeddings = new Map<string, number[]>()

  constructor() {
    this.store = new EventStore<Event, State>(
      { messages: [], currentTopic: 'general', toolUses: 0 },
      reducer,
      { maxEvents: 1000, enableCheckpoints: true, checkpointInterval: 50 }
    )

    // Initialize embedder
    this.embedder = new EventEmbedder(
      new MockEmbedder(),
      (event) => {
        // Convert event to text for embedding
        switch (event.type) {
          case 'user-message':
            return `User: ${event.payload.text}`
          case 'agent-response':
            return `Assistant: ${event.payload.text}`
          case 'tool-use':
            return `Tool: ${event.payload.tool} with ${JSON.stringify(event.payload.args)}`
          case 'context-switch':
            return `Context switch to: ${event.payload.topic}`
          default:
            return JSON.stringify(event)
        }
      }
    )
  }

  /**
   * Add user message
   */
  async addUserMessage(text: string): Promise<void> {
    const event = this.store.append({
      type: 'user-message',
      payload: { text }
    })
    
    // Generate embedding
    const embedding = await this.embedder.embed(event)
    this.embeddings.set(event.id, embedding)
  }

  /**
   * Add agent response
   */
  async addAgentResponse(text: string): Promise<void> {
    const event = this.store.append({
      type: 'agent-response',
      payload: { text }
    })
    
    const embedding = await this.embedder.embed(event)
    this.embeddings.set(event.id, embedding)
  }

  /**
   * Get context for LLM (last N events)
   */
  getRecentContext(n: number = 10): string {
    const events = this.store.getActiveEvents().slice(-n)
    const state = this.store.project()
    
    return `Current topic: ${state.currentTopic}
Tool uses: ${state.toolUses}
Recent messages:
${state.messages.slice(-n).map(m => `${m.role}: ${m.content}`).join('\n')}`
  }

  /**
   * Find similar conversations
   */
  async findSimilar(query: string, k: number = 5): Promise<Event[]> {
    // Embed query
    const queryEmbedding = await this.embedder.embed({
      id: 'query',
      timestamp: Date.now(),
      type: 'query',
      payload: { text: query }
    } as any)

    // Search
    const search = new SemanticSearch(
      this.store.getEvents(),
      this.embeddings
    )
    
    const results = search.findSimilar(queryEmbedding, k)
    return results.map(r => r.event)
  }

  /**
   * Navigate to relevant context
   */
  async navigateToRelevant(query: string): Promise<void> {
    const similar = await this.findSimilar(query, 1)
    if (similar.length > 0) {
      this.store.navigateToTime(similar[0].timestamp)
    }
  }

  /**
   * Fork for hypothetical exploration
   */
  fork(): AgentContextManager {
    const forked = new AgentContextManager()
    forked.store = this.store.fork()
    forked.embeddings = new Map(this.embeddings)
    return forked
  }

  /**
   * Get conversation summary
   */
  getSummary(): any {
    const state = this.store.project()
    const events = this.store.getEvents()
    
    return {
      totalEvents: events.length,
      messageCount: state.messages.length,
      toolUses: state.toolUses,
      currentTopic: state.currentTopic,
      duration: events.length > 0 
        ? events[events.length - 1].timestamp - events[0].timestamp
        : 0
    }
  }
}

// Example usage
async function demo() {
  const context = new AgentContextManager()

  // Simulate conversation
  await context.addUserMessage("What's the weather like?")
  await context.addAgentResponse("I'll check the weather for you.")
  
  await context.addUserMessage("Actually, tell me about TypeScript instead")
  context.store.append({
    type: 'context-switch',
    payload: { topic: 'TypeScript' }
  })
  
  await context.addAgentResponse("TypeScript is a statically typed superset of JavaScript...")
  
  // Get context for LLM
  console.log('Recent context:')
  console.log(context.getRecentContext())
  
  // Find similar past conversations
  const similar = await context.findSimilar("programming languages", 3)
  console.log('\nSimilar events:', similar.map(e => e.type))
  
  // Fork to explore alternative
  const alternative = context.fork()
  await alternative.addUserMessage("What about Python?")
  
  console.log('\nOriginal timeline:', context.getSummary())
  console.log('Alternative timeline:', alternative.getSummary())
}

// Run demo
demo().catch(console.error)