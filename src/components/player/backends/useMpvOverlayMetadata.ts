import { useEffect, useRef } from 'react'
import type { BaseItemDto, MediaSourceInfo, MediaStream, PlayMethod } from '@/api/types'

interface UseMpvOverlayMetadataParams {
  enabled: boolean
  itemId: string
  itemInfo?: BaseItemDto | null
  mediaSources: MediaSourceInfo[]
  currentMediaSourceId?: string
  audioStreams: MediaStream[]
  currentAudioIndex?: number
  subtitleStreams: MediaStream[]
  currentSubtitleIndex: number | null
  playMethod?: PlayMethod
  playbackRate: number
  hasPrev: boolean
  hasNext: boolean
}

interface MetadataKeyInput {
  title: string
  mediaSources: MediaSourceInfo[]
  currentMediaSourceId?: string
  audioStreams: MediaStream[]
  currentAudioIndex?: number
  subtitleStreams: MediaStream[]
  currentSubtitleIndex: number | null
  playMethod?: PlayMethod
  playbackRate: number
  hasPrev: boolean
  hasNext: boolean
}

export function useMpvOverlayMetadata(params: UseMpvOverlayMetadataParams): void {
  const lastKeyRef = useRef('')
  const {
    enabled,
    itemId,
    itemInfo,
    mediaSources,
    currentMediaSourceId,
    audioStreams,
    currentAudioIndex,
    subtitleStreams,
    currentSubtitleIndex,
    playMethod,
    playbackRate,
    hasPrev,
    hasNext,
  } = params

  useEffect(() => {
    if (!enabled) {
      lastKeyRef.current = ''
      return
    }
    const title = itemInfo?.name ?? itemId
    const metadataKey = makeMetadataKey({
      title, mediaSources, currentMediaSourceId, audioStreams, currentAudioIndex,
      subtitleStreams, currentSubtitleIndex, playMethod, playbackRate, hasPrev, hasNext,
    })
    if (lastKeyRef.current === metadataKey) return
    lastKeyRef.current = metadataKey

    void window.ehp.mpvCommand({
      command: 'set-overlay-metadata',
      args: [{
        title,
        mediaSources,
        currentMediaSourceId,
        audioStreams,
        currentAudioIndex,
        subtitleStreams,
        currentSubtitleIndex,
        playMethod,
        playbackRate,
        hasPrev,
        hasNext,
      }],
    }).catch((err: unknown) => {
      console.warn('[Player] mpv overlay metadata failed', err)
    })
  }, [
    enabled, itemId, itemInfo, mediaSources, currentMediaSourceId, audioStreams,
    currentAudioIndex, subtitleStreams, currentSubtitleIndex, playMethod,
    playbackRate, hasPrev, hasNext,
  ])
}

function makeMetadataKey(input: MetadataKeyInput): string {
  return JSON.stringify({
    title: input.title,
    sources: input.mediaSources.map((source) => [
      source.id,
      source.name,
      source.container,
    ].join(':')),
    currentMediaSourceId: input.currentMediaSourceId,
    audio: input.audioStreams.map(streamKey),
    currentAudioIndex: input.currentAudioIndex,
    subtitles: input.subtitleStreams.map(streamKey),
    currentSubtitleIndex: input.currentSubtitleIndex,
    playMethod: input.playMethod,
    playbackRate: input.playbackRate,
    hasPrev: input.hasPrev,
    hasNext: input.hasNext,
  })
}

function streamKey(stream: MediaStream): string {
  return [
    stream.index,
    stream.type,
    stream.displayTitle,
    stream.language,
    stream.codec,
    stream.channels,
    stream.isDefault,
    stream.isForced,
  ].join(':')
}
