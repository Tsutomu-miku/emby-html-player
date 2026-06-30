import type { DeviceProfile } from './playback'

export interface SessionInfo {
  id: string
  userId?: string
  userName?: string
  client?: string
  deviceName?: string
  deviceId?: string
  applicationVersion?: string
  supportedCommands?: string[]
  supportsMediaControl?: boolean
}

export interface ClientCapabilities {
  playableMediaTypes: string[]
  supportedCommands: string[]
  supportsMediaControl: boolean
  supportsPersistentIdentifier: boolean
  deviceProfile: DeviceProfile
}
