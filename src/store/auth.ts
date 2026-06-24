import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserDto } from '@/api/types'

interface AuthState {
  /** 服务器基础地址，如 https://emby.example.com:8920 */
  server: string
  /** 当前用户 ID */
  userId: string
  /** Emby AccessToken */
  accessToken: string
  /** 设备 ID（持久化，保持稳定，上报播放状态时要用到） */
  deviceId: string
  /** 当前用户资料（可选） */
  user?: UserDto
  /** 登录并保存凭据 */
  login: (
    server: string,
    userId: string,
    accessToken: string,
    user?: UserDto,
  ) => void
  /** 更新用户资料 */
  setUser: (user: UserDto) => void
  /** 登出（清除持久化数据） */
  logout: () => void
  /** 只更新服务器地址（例如：登录前先测试连接） */
  setServer: (server: string) => void
}

function generateDeviceId(): string {
  const existing =
    typeof localStorage !== 'undefined' ? localStorage.getItem('ehp_device_id') : null
  if (existing) return existing
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  const id = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  try {
    localStorage.setItem('ehp_device_id', id)
  } catch {
    /* ignore */
  }
  return id
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      server: '',
      userId: '',
      accessToken: '',
      deviceId: generateDeviceId(),
      user: undefined,
      login: (server, userId, accessToken, user) =>
        set({
          server: server.replace(/\/+$/, ''),
          userId,
          accessToken,
          user,
        }),
      setUser: (user) => set({ user }),
      logout: () =>
        set({
          userId: '',
          accessToken: '',
          user: undefined,
          // 保留 server 方便重连
        }),
      setServer: (server) => set({ server: server.replace(/\/+$/, '') }),
    }),
    {
      name: 'ehp_auth',
      partialize: (s) => ({
        server: s.server,
        userId: s.userId,
        accessToken: s.accessToken,
        deviceId: s.deviceId,
        user: s.user,
      }),
    },
  ),
)
