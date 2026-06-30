import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import type {
  EmbeddedMpvBackend,
  MpvBounds,
  MpvCommandRequest,
  MpvEvent,
  MpvLoadRequest,
} from './mpvTypes'

interface LibMpvAddon {
  create(rootViewHandle: string, x: number, y: number, width: number, height: number): string
  load(
    player: string,
    url: string,
    title: string,
    startSeconds: number,
    userAgent: string,
    referer: string,
    headers: string[],
  ): void
  command(player: string, command: string, value: boolean | number): void
  setBounds(player: string, x: number, y: number, width: number, height: number): void
  pollEvent(player: string): MpvEvent | null
  destroy(player: string): void
}

const loadNativeModule = createRequire(import.meta.url)
const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'

export class LibMpvBackend implements EmbeddedMpvBackend {
  private readonly addon = loadAddon()
  private player: string | undefined
  private eventCallback: (event: MpvEvent) => void = () => {}
  private eventTimer: NodeJS.Timeout | undefined

  setEventCallback(callback: (event: MpvEvent) => void): void {
    this.eventCallback = callback
  }

  async create(input: { windowHandle: string; bounds: MpvBounds; itemId: string }): Promise<void> {
    await this.destroy()
    this.player = this.addon.create(
      input.windowHandle,
      input.bounds.x,
      input.bounds.y,
      input.bounds.width,
      input.bounds.height,
    )
    if (DEBUG_LOGS) {
      console.warn('[main] LIBMPV create', {
        itemId: input.itemId,
        bounds: input.bounds,
        player: this.player ? 'present' : 'missing',
      })
    }
    this.startEventPolling()
    this.eventCallback({ type: 'ready' })
  }

  load(input: MpvLoadRequest & { headers: Record<string, string> }): Promise<void> {
    const player = this.requirePlayer()
    this.addon.load(
      player,
      input.url,
      input.title ?? '',
      input.startSeconds ?? 0,
      input.headers['User-Agent'] ?? '',
      input.headers['Referer'] ?? '',
      toHeaderFields(input.headers),
    )
    return Promise.resolve()
  }

  command(input: MpvCommandRequest): Promise<void> {
    if (input.command === 'set-bounds') {
      const bounds = readBoundsArg(input)
      this.addon.setBounds(this.requirePlayer(), bounds.x, bounds.y, bounds.width, bounds.height)
      return Promise.resolve()
    }
    this.addon.command(this.requirePlayer(), input.command, readCommandValue(input))
    return Promise.resolve()
  }

  destroy(): Promise<void> {
    if (this.eventTimer) clearInterval(this.eventTimer)
    this.eventTimer = undefined
    const player = this.player
    this.player = undefined
    if (player) this.addon.destroy(player)
    return Promise.resolve()
  }

  private requirePlayer(): string {
    if (!this.player) throw new Error('libmpv 尚未创建')
    return this.player
  }

  private startEventPolling(): void {
    this.eventTimer = setInterval(() => {
      if (!this.player) return
      for (let index = 0; index < 20; index++) {
        const event = this.addon.pollEvent(this.player)
        if (!event) return
        if (event.type === 'log') {
          if (!DEBUG_LOGS) continue
          console.warn(`[main] LIBMPV/${event.level} ${event.prefix}: ${event.message.trim()}`)
          this.eventCallback(event)
          continue
        }
        if (DEBUG_LOGS) console.warn('[main] LIBMPV event', event)
        this.eventCallback(event)
      }
    }, 50)
  }
}

function loadAddon(): LibMpvAddon {
  const addonPath = resolveAddonPath()
  return loadNativeModule(addonPath) as LibMpvAddon
}

function resolveAddonPath(): string {
  const candidates = [
    path.join(process.resourcesPath, 'native', process.platform, process.arch, 'ehp_mpv_player.node'),
    path.join(process.cwd(), 'resources', 'native', process.platform, process.arch, 'ehp_mpv_player.node'),
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw new Error([
      '未找到 libmpv native addon。',
      `请构建到 resources/native/${process.platform}/${process.arch}/ehp_mpv_player.node；`,
      '当前不会回退到 mpv 可执行文件或系统播放器。',
    ].join(''))
  }
  return found
}

function toHeaderFields(headers: Record<string, string>): string[] {
  return Object.entries(headers)
    .filter(([name]) => !['User-Agent', 'Referer'].includes(name))
    .map(([name, value]) => `${name}: ${value}`)
}

function readCommandValue(input: MpvCommandRequest): boolean | number {
  const value = input.args?.[0]
  if (typeof value !== 'boolean' && typeof value !== 'number') {
    throw new Error(`${input.command} 参数类型无效`)
  }
  return value
}

function readBoundsArg(input: MpvCommandRequest): MpvBounds {
  const value = input.args?.[0]
  if (!isBounds(value)) throw new Error(`${input.command} 需要 bounds 参数`)
  return value
}

function isBounds(value: unknown): value is MpvBounds {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record['x'] === 'number' &&
    typeof record['y'] === 'number' &&
    typeof record['width'] === 'number' &&
    typeof record['height'] === 'number'
  )
}
