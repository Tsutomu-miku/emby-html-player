import { request, buildQuery } from './http'
import type {
  PublicSystemInfo,
  AuthenticationResult,
  UserDto,
  NameIdPair,
} from './types'

/**
 * 获取 Emby 服务器公开信息（无需登录）。用于连接测试。
 */
export function getPublicSystemInfo(server: string): Promise<PublicSystemInfo> {
  const base = server.replace(/\/+$/, '')
  return request<PublicSystemInfo>(`${base}/System/Info/Public`, {
    // 这里走的是绝对 URL，实际逻辑在 request 里当 path 含 http 时会被当成完整 URL
    // 所以我们改用裸 fetch
  })
}

/**
 * 用户登录：用户名密码认证。
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
      body: {
        Username: params.username,
        Pw: params.pw,
      },
      headers: {
        'X-Emby-Authorization':
          'MediaBrowser Client="Emby H5 Player", Device="Web Browser", DeviceId="unknown", Version="0.1.0"',
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
      Fields: 'PrimaryImageAspectRatio,BaseItemName,Overview',
    },
  }) as Promise<{ items: UserView[]; totalRecordCount: number }>
}

export interface UserView extends NameIdPair {
  collectionType?: string
  imageTags?: Record<string, string>
  primaryImageAspectRatio?: number
}

export { buildQuery }
