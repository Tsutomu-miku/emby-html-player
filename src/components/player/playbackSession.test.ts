import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BaseItemDto, MediaSourceInfo, PlaybackInfoResponse } from '@/api/types'
import { configureEmbyApiSession } from '@/api/embyApiSession'
import {
  loadPlayerPlaybackSession,
  type PlayerPlaybackPorts,
  type PlayerReadSettings,
} from './playbackSession'

const defaultSettings: PlayerReadSettings = {
  playMode: 'auto',
  maxBitrateBps: 20_000_000,
  maxAudioChannels: 6,
  sourceStrategy: 'balanced',
  preferredAudioLangs: [],
  preferredSubLangs: [],
  subtitleAutoSelect: 'off',
  burnInPolicy: 'auto',
  subtitleForcedOnly: false,
  resumeRewindSeconds: 0,
}

function source(input: Partial<MediaSourceInfo>): MediaSourceInfo {
  return {
    id: 'source-1',
    container: 'mkv',
    directStreamUrl: '/Videos/item-1/original.mkv',
    supportsDirectPlay: true,
    supportsDirectStream: true,
    supportsTranscoding: false,
    mediaStreams: [
      { type: 'Video', index: 0, codec: 'h264' },
      { type: 'Audio', index: 1, codec: 'aac', isDefault: true },
    ],
    ...input,
  }
}

describe('player playback session workflow', () => {
  beforeEach(() => {
    configureEmbyApiSession(() => ({
      server: 'https://emby.example.test',
      accessToken: 'token-123',
      deviceId: 'device-abc',
      userId: 'user-1',
    }))
  })

  it('routes non-browser-playable MKV sources to embedded MPV', async () => {
    const item: BaseItemDto = {
      id: 'item-1',
      name: 'Episode 1',
      userData: { playbackPositionTicks: 0 },
    }
    const playbackInfo: PlaybackInfoResponse = {
      playSessionId: 'play-session-1',
      mediaSources: [source({})],
    }
    const getItemMock = vi.fn<PlayerPlaybackPorts['getItem']>(() => Promise.resolve(item))
    const ports: PlayerPlaybackPorts = {
      getItem: getItemMock,
      getPlaybackInfo: () => Promise.resolve(playbackInfo),
      buildDeviceProfile: () => ({ name: 'test-profile' }),
    }

    const session = await loadPlayerPlaybackSession({
      itemId: 'item-1',
      userId: 'user-1',
      readSettings: defaultSettings,
      ports,
    })

    expect(session.playbackBackend).toBe('mpv')
    expect(session.playMethod).toBe('DirectPlay')
    expect(session.currentUrl).toBe(
      'https://emby.example.test/Videos/item-1/original.mkv?api_key=token-123&DeviceId=device-abc',
    )
    expect(session.playSessionId).toBe('play-session-1')
    expect(getItemMock).toHaveBeenCalledTimes(1)
  })
})
