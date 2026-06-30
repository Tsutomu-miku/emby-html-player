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
  } catch (error) {
    console.warn('[auth] failed to persist device id', error)
  }
  return id
}

function syncMainProcessAuth(state: {
  server: string
  accessToken: string
  deviceId: string
}): void {
  if (!state.server || !state.deviceId) return
  window.ehp?.setEmbyAuth({
    server: state.server,
    accessToken: state.accessToken,
    deviceId: state.deviceId,
  })
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      server: '',
      userId: '',
      accessToken: '',
      deviceId: generateDeviceId(),
      user: undefined,
      login: (server, userId, accessToken, user) => {
        const normalized = server.replace(/\/+$/, '')
        // 同步给主进程：webRequest 会优先把 API 与媒体流都改成 Emby 播放器身份。
        syncMainProcessAuth({ server: normalized, accessToken, deviceId: get().deviceId })
        set({ server: normalized, userId, accessToken, user })
      },
      setUser: (user) => set({ user }),
      logout: () => {
        syncMainProcessAuth({
          server: get().server,
          accessToken: '',
          deviceId: get().deviceId,
        })
        set({
          userId: '',
          accessToken: '',
          user: undefined,
          // 保留 server 方便重连
        })
      },
      setServer: (server) => {
        const normalized = server.replace(/\/+$/, '')
        syncMainProcessAuth({
          server: normalized,
          accessToken: get().accessToken,
          deviceId: get().deviceId,
        })
        set({ server: normalized })
      },
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
      onRehydrateStorage: () => (state) => {
        if (state) syncMainProcessAuth(state)
      },
    },
  ),
)
