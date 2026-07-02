import { beforeEach, describe, expect, it } from 'vitest'
import type { MediaSourceInfo } from '../types'
import { configureEmbyApiSession } from '../embyApiSession'
import {
  resolveEmbeddedPlaybackUrl,
  resolveMediaPlayback,
  UnplayableSourceError,
} from './resolve'

function mediaSource(input: Partial<MediaSourceInfo>): MediaSourceInfo {
  return {
    id: 'source-1',
    mediaStreams: [
      { type: 'Video', index: 0, codec: 'h264' },
      { type: 'Audio', index: 1, codec: 'aac' },
    ],
    ...input,
  }
}

describe('playback URL resolution', () => {
  beforeEach(() => {
    configureEmbyApiSession(() => ({
      server: 'https://emby.example.test',
      accessToken: 'token-123',
      deviceId: 'device-abc',
      userId: 'user-1',
    }))
  })

  it('keeps browser-playable MP4 on the HTML playback path', () => {
    const resolved = resolveMediaPlayback({
      itemId: 'item-1',
      mediaSource: mediaSource({
        container: 'mp4',
        directStreamUrl: '/Videos/item-1/original.mp4',
        supportsDirectPlay: true,
        supportsDirectStream: true,
      }),
      preferredMethod: 'DirectStream',
    })

    expect(resolved.method).toBe('DirectStream')
    expect(resolved.url).toBe(
      'https://emby.example.test/Videos/item-1/original.mp4?api_key=token-123&DeviceId=device-abc',
    )
  })

  it('rejects MKV for browser playback instead of inventing a stream URL', () => {
    expect(() => resolveMediaPlayback({
      itemId: 'item-1',
      mediaSource: mediaSource({
        container: 'mkv',
        directStreamUrl: '/Videos/item-1/original.mkv',
        supportsDirectPlay: true,
        supportsDirectStream: true,
        supportsTranscoding: false,
      }),
      preferredMethod: 'DirectStream',
    })).toThrow(UnplayableSourceError)
  })

  it('uses PlaybackInfo media URLs for embedded MPV with Emby query identity', () => {
    const url = resolveEmbeddedPlaybackUrl('item-1', mediaSource({
      container: 'mkv',
      directStreamUrl: '/Videos/item-1/original.mkv?MediaSourceId=source-1',
    }))

    expect(url).toBe(
      'https://emby.example.test/Videos/item-1/original.mkv?MediaSourceId=source-1&api_key=token-123&DeviceId=device-abc',
    )
  })
})
