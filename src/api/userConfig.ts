import { request } from './http'
import type { UserConfiguration } from './types'

/** 读取 Emby 服务器用户配置（GET /Users/{userId}/Configuration）。可选使用。 */
export function getUserConfiguration(userId: string): Promise<UserConfiguration> {
  return request<UserConfiguration>(`/Users/${userId}/Configuration`)
}

/** 更新 Emby 服务器用户配置。仅当用户显式点击「同步到服务器」时调用，默认不会执行。 */
export function updateUserConfiguration(
  userId: string,
  config: Partial<UserConfiguration>,
): Promise<void> {
  // Emby Configuration 接口要求 POST 整个对象；这里采用先读取再合并再写回的策略由调用方负责
  // （避免覆盖未读取字段）。此函数只负责把 patch 原封不动发出去。
  return request<void>(`/Users/${userId}/Configuration`, {
    method: 'POST',
    body: config,
  })
}
