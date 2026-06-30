import { request } from '../http'
import type { ClientCapabilities, DeviceProfile, SessionInfo } from '../types'
import { useAuthStore } from '@/store/auth'

let registeredKey = ''
let pendingRegistration: Promise<void> | undefined

export async function ensureSessionCapabilities(
  deviceProfile: DeviceProfile,
): Promise<void> {
  const { server, accessToken, deviceId } = useAuthStore.getState()
  if (!server) throw new Error('未配置服务器地址，请先登录')
  if (!accessToken) throw new Error('未登录，无法注册 Emby 播放会话能力')
  if (!deviceId) throw new Error('缺少 DeviceId，无法注册 Emby 播放会话能力')

  const key = `${server.replace(/\/+$/, '')}|${deviceId}|${accessToken}`
  if (registeredKey === key) return
  if (pendingRegistration) return pendingRegistration

  const promise = registerSessionCapabilities(key, deviceId, deviceProfile)
  pendingRegistration = promise.finally(() => {
    if (pendingRegistration === promise) pendingRegistration = undefined
  })
  return pendingRegistration
}

async function registerSessionCapabilities(
  key: string,
  deviceId: string,
  deviceProfile: DeviceProfile,
): Promise<void> {
  const sessions = await request<SessionInfo[]>('/Sessions', {
    params: { deviceId },
    timeout: 10000,
  })
  const session = sessions.find((item) => item.deviceId === deviceId) ?? sessions[0]
  if (!session?.id) {
    throw new Error('未找到当前 Emby 播放会话，无法注册播放能力')
  }
  await request('/Sessions/Capabilities/Full', {
    method: 'POST',
    params: { id: session.id },
    body: buildClientCapabilities(deviceProfile),
    timeout: 10000,
  })
  registeredKey = key
}

function buildClientCapabilities(deviceProfile: DeviceProfile): ClientCapabilities {
  return {
    playableMediaTypes: ['Audio', 'Video'],
    supportedCommands: [
      'VolumeUp',
      'VolumeDown',
      'Mute',
      'Unmute',
      'ToggleMute',
      'SetVolume',
      'SetAudioStreamIndex',
      'SetSubtitleStreamIndex',
      'Play',
      'Pause',
      'PlayPause',
      'Stop',
      'Seek',
      'SetRepeatMode',
      'SetShuffleQueue',
      'SetPlaybackOrder',
      'SetMaxStreamingBitrate',
    ],
    supportsMediaControl: true,
    supportsPersistentIdentifier: true,
    deviceProfile,
  }
}
