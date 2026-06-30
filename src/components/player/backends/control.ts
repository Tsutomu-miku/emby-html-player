export interface PlayerControl {
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  volume: number
  bufferedEnd: number
  canPictureInPicture: boolean
  started?: boolean
  play: () => void | Promise<void>
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  setMuted: (muted: boolean) => void
  setPlaybackRate: (rate: number) => void
  setAudioTrack?: (index: number) => void
  setSubtitleTrack?: (index: number | null) => void
  togglePictureInPicture?: () => void | Promise<void>
}

export interface MpvPlaybackState {
  currentTime: number
  duration: number
  paused: boolean
  muted: boolean
  volume: number
  started: boolean
}
