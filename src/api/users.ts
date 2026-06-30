import { request, buildQuery } from './http'
import type {
  PublicSystemInfo,
  AuthenticationResult,
  UserDto,
  NameIdPair,
} from './types'

/**
 * 获取 Emby 服务器公开信息（无需登录）。用于连接测试。
 *
 * 说明：传入的 server 未配置在 authStore 中，所以直接拼接成完整 URL 传入 request；
 * http.ts 会识别 http(s):// 开头的 path 并直接使用，不再拼接 base。
 */
export function getPublicSystemInfo(server: string): Promise<PublicSystemInfo> {
  const base = server.replace(/\/+$/, '')
  return request<PublicSystemInfo>(`${base}/System/Info/Public`)
}

/**
 * 用户登录：用户名密码认证。
 * body 中使用 camelCase，http.ts 会自动转为 PascalCase（Username/Pw）。
 */
export async function authenticateByName(params: {
  server: string
  username: string
  pw: string
}): Promise<AuthenticationResult> {
  const base = params.server.replace(/\/+$/, '')
  const res = await request<AuthenticationResult>(
    `${base}/Users/AuthenticateByName`,
    {
      method: 'POST',
      // 注意：这里不需要手动写 Username/Pw，统一用 camelCase，由 http.ts 转换
      // 注意：不要在 headers 里再手动写 X-Emby-Authorization，
      // http.ts 会按统一规则（Client / Device / Version / Token）构造。
      body: {
        username: params.username,
        pw: params.pw,
      },
    },
  )
  return res
}

/** 获取当前用户信息 */
export function getCurrentUser(): Promise<UserDto> {
  // 需要在登录后由客户端填充 userId。request 会自动附加 api_key
  return request<UserDto>(`/Users/Me`)
}

/** 获取用户列表（仅管理用户可见，用于公共展示） */
export function getPublicUsers(server: string): Promise<UserDto[]> {
  const base = server.replace(/\/+$/, '')
  return request<UserDto[]>(`${base}/Users/Public`)
}

/** 根据 ID 获取用户详情 */
export function getUserById(userId: string): Promise<UserDto> {
  return request<UserDto>(`/Users/${userId}`)
}

/** 获取用户可访问的媒体库视图 */
export function getUserViews(userId: string): Promise<{ items: UserView[]; totalRecordCount: number }> {
  return request(`/Users/${userId}/Views`, {
    params: {
      // fields 为字符串数组枚举值，不是字段名本身 —— 但因为整体 camelToPascal，
      // 'fields' 会被转为 'Fields'，值保持不变（符合 Emby 约定）
      fields: 'PrimaryImageAspectRatio,BaseItemName,Overview',
    },
  })
}

export interface UserView extends NameIdPair {
  collectionType?: string
  imageTags?: Record<string, string>
  primaryImageAspectRatio?: number
}

export { buildQuery }
