import type { SubtitleMode, IntroSkipMode } from './item'

export interface PublicSystemInfo {
  serverName: string
  version: string
  productName: string
  id: string
  startupWizardCompleted?: boolean
}

export interface NameIdPair {
  name: string
  id: string
}

export interface AuthenticationResult {
  user?: UserDto
  accessToken?: string
  serverId?: string
}

export interface UserDto {
  id: string
  name: string
  serverId?: string
  hasPassword?: boolean
  hasConfiguredPassword?: boolean
  primaryImageTag?: string
  primaryImageAspectRatio?: number
  policy?: UserPolicy
  configuration?: UserConfiguration
  /** 最近登录时间（ISO 字符串） */
  lastLoginDate?: string
  /** 最近活动时间（ISO 字符串） */
  lastActivityDate?: string
}

export interface UserPolicy {
  isAdministrator?: boolean
  isHidden?: boolean
  enableAllFolders?: boolean
  enabledFolders?: string[]
  maxParentalRating?: number
}

/** Emby 用户显示/播放配置（与 /Users/{id}/Configuration 返回的 Pascal 字段对齐，
 *  由 http.ts 自动转为 camelCase） */
export interface UserConfiguration {
  maxParentalRating?: number
  // 语言偏好
  subtitleLanguagePreference?: string
  audioLanguagePreference?: string
  playDefaultAudioTrack?: boolean
  displayMissingEpisodes?: boolean
  groupedFolders?: boolean
  subtitleMode?: SubtitleMode
  displayCollectionsView?: boolean
  enableLocalPassword?: boolean
  hidePlayedInLatest?: boolean
  rememberAudioSelections?: boolean
  rememberSubtitleSelections?: boolean
  enableNextEpisodeAutoPlay?: boolean
  resumeRewindSeconds?: number
  introSkipMode?: IntroSkipMode
  quickConnectAvailable?: boolean
  // 可选扩展字段：若 Emby 版本不含以下字段则保持 undefined
  defaultAudioTrackExtendedLanguagePreference?: string
  defaultSubtitleExtendedLanguagePreference?: string
}
