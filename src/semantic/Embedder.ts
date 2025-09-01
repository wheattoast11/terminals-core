import { BaseEvent } from '../core/types'

/**
 * Interface for embedding providers
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  model: string
  dimensions: number
}

/**
 * Mock embedder for testing (returns random vectors)
 */
export class MockEmbedder implements EmbeddingProvider {
  model = 'mock'
  dimensions = 768

  async embed(text: string): Promise<number[]> {
    // Generate deterministic "random" vector from text
    const vector = new Array(this.dimensions)
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i)
      hash = hash & hash
    }
    
    for (let i = 0; i < this.dimensions; i++) {
      vector[i] = Math.sin(hash * (i + 1)) * 0.5 + 0.5
    }
    
    return vector
  }
}

/**
 * OpenAI embedder (requires API key)
 */
export class OpenAIEmbedder implements EmbeddingProvider {
  model = 'text-embedding-ada-002'
  dimensions = 1536

  constructor(private apiKey: string) {}

  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        input: text
      })
    })

    const data = await response.json()
    return data.data[0].embedding
  }
}

/**
 * Event embedder - converts events to vectors
 */
export class EventEmbedder<E extends BaseEvent> {
  private cache = new Map<string, number[]>()

  constructor(
    private provider: EmbeddingProvider,
    private eventToText: (event: E) => string
  ) {}

  /**
   * Get embedding for an event
   */
  async embed(event: E): Promise<number[]> {
    // Check cache
    if (this.cache.has(event.id)) {
      return this.cache.get(event.id)!
    }

    // Generate embedding
    const text = this.eventToText(event)
    const vector = await this.provider.embed(text)
    
    // Cache result
    this.cache.set(event.id, vector)
    return vector
  }

  /**
   * Batch embed multiple events
   */
  async embedBatch(events: E[]): Promise<Map<string, number[]>> {
    const results = new Map<string, number[]>()
    
    for (const event of events) {
      const vector = await this.embed(event)
      results.set(event.id, vector)
    }
    
    return results
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    this.cache.clear()
  }
}