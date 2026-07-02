import { ipcMain } from 'electron'
import {
  normalizeOrigin,
  parseEmbyAuth,
  type EmbyAuthState,
} from './embyIdentity'

const DEBUG_LOGS = process.env['EHP_DEBUG_LOGS'] === '1'

export interface EmbyAuthIpcOptions {
  getAuth: () => EmbyAuthState
  setAuth: (auth: EmbyAuthState) => void
}

export function installEmbyAuthIpc(options: EmbyAuthIpcOptions): void {
  ipcMain.on('set-server-origin', (_event, origin: unknown) => {
    if (typeof origin !== 'string') {
      console.warn('[main] set-server-origin received non-string', origin)
      return
    }
    const next = { ...options.getAuth(), serverOrigin: normalizeOrigin(origin) }
    options.setAuth(next)
    debugLog(`[main] serverOrigin updated -> ${next.serverOrigin}`)
  })

  ipcMain.on('set-emby-auth', (_event, payload: unknown) => {
    const parsed = parseEmbyAuth(payload)
    if (!parsed) {
      console.warn('[main] set-emby-auth received invalid payload', payload)
      return
    }
    options.setAuth(parsed)
    debugLog(`[main] embyAuth updated -> ${parsed.serverOrigin}`, {
      token: parsed.accessToken ? 'present' : 'missing',
      deviceId: parsed.deviceId ? 'present' : 'missing',
    })
  })
}

function debugLog(...args: unknown[]): void {
  if (DEBUG_LOGS) console.warn(...args)
}
