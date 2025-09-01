import { EventStore } from '../core/EventStore'
import { BaseEvent, ReplayConfig, Replay } from '../core/types'

/**
 * Manages replay generation, upload, and playback
 */
export class ReplayManager<E extends BaseEvent, S> {
  private config: ReplayConfig
  private uploadQueue: Replay<E, S>[] = []
  private isUploading = false

  constructor(
    private store: EventStore<E, S>,
    config: ReplayConfig = {}
  ) {
    this.config = {
      endpoint: 'https://replay.terminals.tech/api/v1',
      redact: [],
      maxEvents: 10000,
      uploadOn: ['error'],
      ...config
    }

    // Setup automatic capture if configured
    if (this.config.uploadOn?.includes('error')) {
      this.setupErrorCapture()
    }

    if (this.config.uploadOn?.includes('interval')) {
      this.setupIntervalUpload()
    }
  }

  /**
   * Generate a replay from current store state
   */
  generateReplay(error?: Error): Replay<E, S> {
    const events = this.store.getActiveEvents()
    const snapshot = this.store.snapshot()
    
    // Redact sensitive fields
    const redactedEvents = this.redactEvents(events)
    
    const replay: Replay<E, S> = {
      id: `replay-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: '', // Will be set after upload
      events: redactedEvents,
      initialState: snapshot.state,
      finalState: snapshot.state,
      duration: events.length > 0 
        ? events[events.length - 1].timestamp - events[0].timestamp
        : 0,
      timestamp: Date.now(),
      error,
      metadata: {
        ...this.config.metadata,
        sessionId: this.config.sessionId,
        userId: this.config.userId,
        eventCount: events.length,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined
      }
    }

    return replay
  }

  /**
   * Upload replay to cloud
   */
  async upload(replay: Replay<E, S>): Promise<string> {
    if (!this.config.apiKey) {
      // For free tier, use local storage
      return this.saveLocal(replay)
    }

    try {
      const response = await fetch(`${this.config.endpoint}/replays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(replay)
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`)
      }

      const result = await response.json()
      replay.url = result.url || `https://replay.terminals.tech/${replay.id}`
      
      return replay.url
    } catch (error) {
      console.error('Failed to upload replay:', error)
      // Fallback to local storage
      return this.saveLocal(replay)
    }
  }

  /**
   * Generate and upload replay in one step
   */
  async captureAndUpload(error?: Error): Promise<string> {
    const replay = this.generateReplay(error)
    const url = await this.upload(replay)
    
    // Log for user
    if (typeof console !== 'undefined') {
      console.log(
        `%c🎬 Replay captured: ${url}`,
        'color: #667eea; font-size: 14px; font-weight: bold;'
      )
    }
    
    return url
  }

  /**
   * Save replay to local storage
   */
  private saveLocal(replay: Replay<E, S>): string {
    if (typeof localStorage === 'undefined') {
      return `terminals://local/${replay.id}`
    }

    try {
      // Compress if needed
      const data = JSON.stringify(replay)
      if (data.length > 1024 * 1024) {
        // Too large for localStorage, save partial
        replay.events = replay.events.slice(-100) // Last 100 events only
      }
      
      localStorage.setItem(`terminals-replay-${replay.id}`, JSON.stringify(replay))
      
      // Clean old replays if needed
      this.cleanOldReplays()
      
      return `terminals://local/${replay.id}`
    } catch (error) {
      console.error('Failed to save replay locally:', error)
      return `terminals://memory/${replay.id}`
    }
  }

  /**
   * Load replay from ID
   */
  async loadReplay(id: string): Promise<Replay<E, S> | null> {
    // Check if local
    if (id.startsWith('terminals://local/')) {
      const localId = id.replace('terminals://local/', '')
      const data = localStorage.getItem(`terminals-replay-${localId}`)
      return data ? JSON.parse(data) : null
    }

    // Load from cloud
    try {
      const response = await fetch(`${this.config.endpoint}/replays/${id}`, {
        headers: this.config.apiKey ? {
          'Authorization': `Bearer ${this.config.apiKey}`
        } : {}
      })

      if (!response.ok) {
        return null
      }

      return await response.json()
    } catch (error) {
      console.error('Failed to load replay:', error)
      return null
    }
  }

  /**
   * Playback a replay
   */
  playback(replay: Replay<E, S>, speed: number = 1): {
    stop: () => void
    pause: () => void
    resume: () => void
  } {
    let currentIndex = 0
    let isPlaying = true
    let timeoutId: any = null

    const play = () => {
      if (!isPlaying || currentIndex >= replay.events.length) {
        return
      }

      // Navigate to current event
      this.store.navigate(currentIndex)
      currentIndex++

      // Calculate delay to next event
      if (currentIndex < replay.events.length) {
        const currentEvent = replay.events[currentIndex - 1]
        const nextEvent = replay.events[currentIndex]
        const delay = (nextEvent.timestamp - currentEvent.timestamp) / speed

        timeoutId = setTimeout(play, Math.max(delay, 16)) // Min 16ms (60fps)
      }
    }

    // Start playback
    play()

    return {
      stop: () => {
        isPlaying = false
        if (timeoutId) clearTimeout(timeoutId)
        currentIndex = 0
      },
      pause: () => {
        isPlaying = false
        if (timeoutId) clearTimeout(timeoutId)
      },
      resume: () => {
        isPlaying = true
        play()
      }
    }
  }

  /**
   * Redact sensitive fields from events
   */
  private redactEvents(events: E[]): E[] {
    if (!this.config.redact || this.config.redact.length === 0) {
      return events
    }

    return events.map(event => {
      const redacted = { ...event }
      
      // Redact fields recursively
      const redactObject = (obj: any, path: string = '') => {
        for (const key in obj) {
          const fullPath = path ? `${path}.${key}` : key
          
          if (this.config.redact?.includes(fullPath) || this.config.redact?.includes(key)) {
            obj[key] = '[REDACTED]'
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            redactObject(obj[key], fullPath)
          }
        }
      }
      
      redactObject(redacted)
      return redacted
    })
  }

  /**
   * Setup automatic error capture
   */
  private setupErrorCapture(): void {
    if (typeof window === 'undefined') return

    // Capture unhandled errors
    window.addEventListener('error', async (event) => {
      const error = new Error(event.message)
      error.stack = event.error?.stack || ''
      
      const url = await this.captureAndUpload(error)
      
      // Add replay link to error message
      console.error(`Error captured. Debug at: ${url}`)
    })

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', async (event) => {
      const error = new Error(`Unhandled Promise: ${event.reason}`)
      
      const url = await this.captureAndUpload(error)
      
      console.error(`Promise rejection captured. Debug at: ${url}`)
    })
  }

  /**
   * Setup interval upload
   */
  private setupIntervalUpload(): void {
    setInterval(() => {
      this.processUploadQueue()
    }, 60000) // Every minute
  }

  /**
   * Process upload queue
   */
  private async processUploadQueue(): Promise<void> {
    if (this.isUploading || this.uploadQueue.length === 0) {
      return
    }

    this.isUploading = true
    
    while (this.uploadQueue.length > 0) {
      const replay = this.uploadQueue.shift()!
      await this.upload(replay)
    }
    
    this.isUploading = false
  }

  /**
   * Clean old replays from localStorage
   */
  private cleanOldReplays(): void {
    if (typeof localStorage === 'undefined') return

    const keys = Object.keys(localStorage)
    const replayKeys = keys.filter(k => k.startsWith('terminals-replay-'))
    
    // Keep only last 10 replays
    if (replayKeys.length > 10) {
      const sorted = replayKeys.sort()
      const toDelete = sorted.slice(0, sorted.length - 10)
      
      toDelete.forEach(key => localStorage.removeItem(key))
    }
  }

  /**
   * Get replay statistics
   */
  getStats(): {
    localReplays: number
    queuedUploads: number
    totalSize: number
  } {
    const localReplays = typeof localStorage !== 'undefined'
      ? Object.keys(localStorage).filter(k => k.startsWith('terminals-replay-')).length
      : 0

    const totalSize = typeof localStorage !== 'undefined'
      ? Object.keys(localStorage)
          .filter(k => k.startsWith('terminals-replay-'))
          .reduce((sum, k) => sum + (localStorage.getItem(k)?.length || 0), 0)
      : 0

    return {
      localReplays,
      queuedUploads: this.uploadQueue.length,
      totalSize
    }
  }
}