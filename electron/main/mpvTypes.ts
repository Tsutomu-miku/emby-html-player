export interface MpvBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface MpvCreateRequest {
  bounds: MpvBounds
  itemId: string
}

export interface MpvLoadRequest {
  url: string
  title?: string
  headers?: Record<string, string>
  startSeconds?: number
}

export interface MpvCommandRequest {
  command: string
  args?: unknown[]
}

export type MpvEvent =
  | { type: 'ready' }
  | { type: 'started' }
  | { type: 'time'; seconds: number }
  | { type: 'duration'; seconds: number }
  | { type: 'paused'; paused: boolean }
  | { type: 'network'; bytesPerSecond: number }
  | { type: 'ended' }
  | { type: 'error'; message: string }
  | { type: 'log'; level: string; prefix: string; message: string }

export interface EmbeddedMpvBackend {
  create(input: { windowHandle: string; bounds: MpvBounds; itemId: string }): Promise<void>
  load(input: MpvLoadRequest & { headers: Record<string, string> }): Promise<void>
  command(input: MpvCommandRequest): Promise<void>
  destroy(): Promise<void>
  setEventCallback(callback: (event: MpvEvent) => void): void
}
