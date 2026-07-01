import type { MpvCommandRequest, MpvCreateRequest, MpvEvent } from './mpvTypes'

export type MetadataEvent = Extract<MpvEvent, { type: 'metadata' }>

export function readBoundsArg(input: MpvCommandRequest): MpvCreateRequest['bounds'] {
  const value = input.args?.[0]
  if (!value || typeof value !== 'object') throw new Error(`${input.command} 需要 bounds 参数`)
  const record = value as Record<string, unknown>
  if (
    typeof record['x'] !== 'number' ||
    typeof record['y'] !== 'number' ||
    typeof record['width'] !== 'number' ||
    typeof record['height'] !== 'number'
  ) {
    throw new Error(`${input.command} bounds 参数类型无效`)
  }
  return {
    x: record['x'],
    y: record['y'],
    width: record['width'],
    height: record['height'],
  }
}

export function readMetadataArg(input: MpvCommandRequest): MetadataEvent {
  const value = input.args?.[0]
  if (!value || typeof value !== 'object') throw new Error(`${input.command} 需要 metadata 参数`)
  const record = value as Record<string, unknown>
  const title = record['title']
  if (typeof title !== 'string') throw new Error(`${input.command} metadata.title 类型无效`)
  return {
    type: 'metadata',
    title,
    mediaSources: Array.isArray(record['mediaSources']) ? record['mediaSources'] : undefined,
    currentMediaSourceId: typeof record['currentMediaSourceId'] === 'string'
      ? record['currentMediaSourceId']
      : undefined,
    audioStreams: Array.isArray(record['audioStreams']) ? record['audioStreams'] : undefined,
    currentAudioIndex: typeof record['currentAudioIndex'] === 'number'
      ? record['currentAudioIndex']
      : undefined,
    subtitleStreams: Array.isArray(record['subtitleStreams']) ? record['subtitleStreams'] : undefined,
    currentSubtitleIndex: readNullableNumber(record['currentSubtitleIndex']),
    playMethod: typeof record['playMethod'] === 'string' ? record['playMethod'] : undefined,
    playbackRate: typeof record['playbackRate'] === 'number' ? record['playbackRate'] : undefined,
    hasPrev: typeof record['hasPrev'] === 'boolean' ? record['hasPrev'] : undefined,
    hasNext: typeof record['hasNext'] === 'boolean' ? record['hasNext'] : undefined,
  }
}

export function readOverlayActionArg(input: MpvCommandRequest): MpvEvent {
  const value = input.args?.[0]
  if (!value || typeof value !== 'object') throw new Error(`${input.command} 需要 action 参数`)
  const record = value as Record<string, unknown>
  const action = record['action']
  if (
    action !== 'back' &&
    action !== 'prev' &&
    action !== 'next' &&
    action !== 'media-source'
  ) {
    throw new Error(`${input.command} action 参数类型无效`)
  }
  const output: MpvEvent = { type: 'ui-action', action }
  if (record['value'] !== undefined) {
    if (typeof record['value'] !== 'string') throw new Error(`${input.command} value 参数类型无效`)
    output.value = record['value']
  }
  return output
}

export function mergeLoadMetadata(current: MetadataEvent, title: string): MetadataEvent {
  if (current.title === title) return { ...current, title }
  return { type: 'metadata', title }
}

function readNullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null
  if (typeof value === 'number') return value
  return undefined
}
