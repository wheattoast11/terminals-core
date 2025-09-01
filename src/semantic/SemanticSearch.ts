import { BaseEvent } from '../core/types'

/**
 * Cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimensions')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

/**
 * Semantic search over events
 */
export class SemanticSearch<E extends BaseEvent> {
  constructor(
    private events: E[],
    private embeddings: Map<string, number[]>
  ) {}

  /**
   * Find k most similar events to query vector
   */
  findSimilar(queryVector: number[], k: number = 10): Array<{ event: E; similarity: number }> {
    const results = this.events
      .map(event => {
        const embedding = this.embeddings.get(event.id)
        if (!embedding) return null
        
        return {
          event,
          similarity: cosineSimilarity(queryVector, embedding)
        }
      })
      .filter((item): item is { event: E; similarity: number } => item !== null)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, k)

    return results
  }

  /**
   * Find events within similarity threshold
   */
  findWithinThreshold(queryVector: number[], threshold: number = 0.8): E[] {
    return this.events.filter(event => {
      const embedding = this.embeddings.get(event.id)
      if (!embedding) return false
      
      const similarity = cosineSimilarity(queryVector, embedding)
      return similarity >= threshold
    })
  }

  /**
   * Cluster events by similarity
   */
  cluster(threshold: number = 0.8): E[][] {
    const clusters: E[][] = []
    const visited = new Set<string>()

    for (const event of this.events) {
      if (visited.has(event.id)) continue

      const cluster: E[] = [event]
      visited.add(event.id)

      const eventEmbedding = this.embeddings.get(event.id)
      if (!eventEmbedding) continue

      // Find all similar events
      for (const other of this.events) {
        if (visited.has(other.id)) continue

        const otherEmbedding = this.embeddings.get(other.id)
        if (!otherEmbedding) continue

        const similarity = cosineSimilarity(eventEmbedding, otherEmbedding)
        if (similarity >= threshold) {
          cluster.push(other)
          visited.add(other.id)
        }
      }

      clusters.push(cluster)
    }

    return clusters
  }

  /**
   * Find events in time window with semantic filter
   */
  findInTimeWindow(
    startTime: number,
    endTime: number,
    queryVector?: number[],
    minSimilarity?: number
  ): E[] {
    let filtered = this.events.filter(
      event => event.timestamp >= startTime && event.timestamp <= endTime
    )

    if (queryVector && minSimilarity) {
      filtered = filtered.filter(event => {
        const embedding = this.embeddings.get(event.id)
        if (!embedding) return false
        
        const similarity = cosineSimilarity(queryVector, embedding)
        return similarity >= minSimilarity
      })
    }

    return filtered
  }
}